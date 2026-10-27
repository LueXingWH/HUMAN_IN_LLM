# 项目迁移：保留现有账号、模型、Key 和图片

## 先确认需要带走什么

迁移由三部分组成：项目源码（不含 node_modules / .tools）、完整数据目录、实际生效的环境配置。
本机通过 `start.cmd` 启动 `build/chatapi.exe`，以 `backend` 为工作目录。默认数据是 `backend/data`。
先按实际配置检查 `CHATAPI_DB_DSN`、`CHATAPI_DATA_DIR` 和 `CHATAPI_MEDIA_DERIVED_DIR`，自定义目录也要备份。
配置加载顺序为 `backend/.env` → `backend/.env.local` → 根目录 `.env` → `CHATAPI_ENV_FILE` 指定的文件，后面的文件覆盖前面的值。
这些配置文件不得公开上传。

必须保留原来的 `CHATAPI_MASTER_KEY`、`CHATAPI_SESSION_SECRET`；同时保留 GLM 密钥、管理员配置以及启用的 SMTP/OIDC 等配置。
保持 master key 与数据库配套，已有模型 Key 才能继续解密使用。浏览器本地偏好不随服务器迁移。
正在等待回复的连接和运行中的任务属于运行时状态，不会通过文件迁移恢复；先完成或终止任务，迁移后由 Agent 重试。

## 本机 Windows → Linux Docker（推荐）

1. 在旧站完成任务，关闭运行服务；确认没有进程继续写数据库。复制整个 data 目录，不要只复制正在使用的 sqlite3 主文件。
   如残留 `chatapi.sqlite3-wal` / `chatapi.sqlite3-shm`，随目录一并保留。把数据副本和配置存到项目目录以外。
2. 将项目源码与 `data` 副本传到新主机，例如 `/opt/chatapi` 与 `/opt/chatapi/migration-data`。
   新主机需要 Docker Compose；下面命令均在 `/opt/chatapi` 执行。
3. 复制部署模板并填写配置。模板不会自动读取旧的 backend/.env，需要手动将原密钥、管理员和 GLM 配置填入根目录 `.env`。

```bash
cp docker-compose.env.example .env
chmod 600 .env
```

设置 `CHATAPI_BASE_URL=https://你的域名` 和 `CHATAPI_CORS_ORIGINS=https://你的域名`。
如果使用 OIDC/邮件等额外配置，在 compose.yaml 的 environment 中传入相应环境变量，或使用独立只读 env 文件挂载并设置 CHATAPI_ENV_FILE。
仅在根 .env 中写入一个未由 compose.yaml 引用的变量，不会自动传入容器。

4. 检查并转换图片路径。数据库可能存储旧机器的绝对路径。先在数据副本上查看路径（输出不含 Key）：

```bash
python3 -c "import sqlite3; c=sqlite3.connect('file:migration-data/chatapi.sqlite3?mode=ro',uri=True); print(*c.execute('SELECT path FROM media_assets LIMIT 5'),sep='\n')"
```

根据显示结果填写旧媒体目录前缀。下面旧路径是示例，必须替换为实际记录的前缀；如果记录是相对路径 `data/derived/request_media/...`，则 old-root 应填 `data/derived/request_media`。

```bash
python3 backend/scripts/rebase_media_paths.py \
  --database migration-data/chatapi.sqlite3 \
  --old-root 'D:\ai项目\我就是llm\backend\data\derived\request_media' \
  --new-root /data/derived/request_media
```

默认只预览。确认数量、旧路径和新路径正确后，重跑并追加 `--apply`。
脚本会先生成 `.before-rebase.sqlite3` 备份，再在一个事务内更新媒体与删除失败记录的路径。
若原来使用多个媒体根目录，分别处理；第二次应用前先把已生成的备份移到安全位置。
媒体目录中的文件也必须复制齐全。任意聊天文本中包含的旧域名或外部 URL 不会由脚本修改。

5. 构建镜像并创建容器（此时不启动服务），将数据导入命名卷：

```bash
docker compose build
docker compose create chatapi
docker compose run --rm --no-deps --user root --entrypoint sh \
  -v "$PWD/migration-data:/restore:ro" chatapi \
  -c 'cp -a /restore/. /data/ && chown -R chatapi:chatapi /data'
docker compose up -d
docker compose logs --tail=100 chatapi
curl -f http://127.0.0.1:5000/api/ready
```

导入应在**新建的空数据卷**上进行，切勿覆盖已有业务数据。镜像使用 Linux 二进制，不能复制 Windows 的 chatapi.exe 来运行。
服务默认宿主机端口 5000，以根 .env 的 CHATAPI_PORT 为准；必要时同步修改命令中的端口。

## 已经使用 Docker → 另一台 Docker 主机

停止旧站后导出整个卷；保留原源码版本、根 .env 及其他外置配置。以下命令在旧项目目录执行：

```bash
mkdir -p migration-backup
docker compose stop chatapi
docker compose run --rm --no-deps --user root --entrypoint sh \
  -v "$PWD/migration-backup:/backup" chatapi \
  -c 'tar czf /backup/chatapi-data.tar.gz -C /data .'
```

将备份传到新主机同名目录，并恢复配置；在新主机项目目录执行：

```bash
docker compose build
docker compose create chatapi
docker compose run --rm --no-deps --user root --entrypoint sh \
  -v "$PWD/migration-backup:/backup:ro" chatapi \
  -c 'tar xzf /backup/chatapi-data.tar.gz -C /data && chown -R chatapi:chatapi /data'
docker compose up -d
```

容器内仍使用 `/data`，原来也是此路径时无需改媒体路径。不要执行 `docker compose down -v`。

## 不使用 Docker

在新主机用 Node 24 和 Go 1.26 构建：`cd frontend && npm ci && npm run build`，再在 backend 执行 `go build -o ../build/chatapi ./cmd/server`（Windows 输出 chatapi.exe）。
恢复 data 目录和 backend/.env，按新位置修改数据、数据库、前端和媒体目录配置。
保持以 backend 为工作目录启动；跨目录或跨系统迁移时，按上文对**停机后的 SQLite 副本**转换媒体路径。
Linux 可使用 systemd 托管，WorkingDirectory 指向 backend，ExecStart 指向构建出的二进制。
PostgreSQL 用户先停止业务写入，使用 pg_dump/pg_restore 备份恢复数据库，并独立复制媒体目录；本文路径脚本只处理 SQLite。

## 验收、切流和回滚

- 新站 /api/ready 成功，原账号可以登录；历史会话、模型及 Key 数量一致，历史图片可打开。
- 使用原模型 Key 请求 /v1/models；在新站完成一次「Agent 请求 → 人工回复 → Agent 收到」往返，再测试 AI 代写。
- Agent 的 Base URL 改成新站地址；模型名和 Key 不必重建。反向代理放行 WebSocket，SSE 不缓冲，并将读取超时调至能等待人工回复。
- 更新 DNS、HTTPS、CORS 与 OIDC 回调。待检查通过再切流，保留旧主机和停机备份。
- 失败时先停止新站写入、恢复旧地址并启动旧站；新站切流后产生的数据需单独保留，不能直接覆盖旧库。
