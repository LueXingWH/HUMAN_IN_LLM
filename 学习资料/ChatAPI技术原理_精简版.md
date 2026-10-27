# ChatAPI 技术原理：从网页到 Agent

依据当前项目源码整理。重点是技术机制，不按面试题展开。

## 1. 先看完整链路

```text
Agent ──HTTP 请求──→ Go 后端 ──WebSocket──→ React 工作台
                       ↑                       │
                       └──── 人工回复命令 ─────┘
                       │
Agent ←──JSON / SSE─────┘
```

一般模型服务用模型计算答案；本项目主要由工作台中的人决定答案。Go 后端负责认证、保存请求、等待回复，再将结果转换成模型客户端认识的协议。

## 2. 网页是怎样运行的

浏览器获取 `index.html`，再加载 JS 和 CSS。JS 中的 React 代码把组件挂载到页面，React Router 根据地址选择登录页、工作台等界面。

React 通过状态驱动界面：WebSocket 收到新会话 → 更新 state → React 重新计算组件 → 更新对应 DOM。开发者主要修改数据状态，不必逐个手动操作页面元素。

前端三个常见工具各有职责：

- `useState`：保存会话列表等需要显示的数据。
- `useEffect`：建立连接、监听事件，并在离开时清理。
- `useRef`：保存 socket、计时器和最新 ID 等跨渲染对象，修改它本身不触发渲染。

入口：`frontend/src/main.tsx`；实时逻辑：`frontend/src/hooks/useWorkspaceRealtime.ts`。

## 3. Go 怎样把“请求”和“稍后的回答”接起来

三种模型接口的 JSON 不同，后端先统一为 `TurnRequest`，再创建 `PendingTurn`。数据库保存会话和消息，内存保存当前等待对象。

核心连接机制是 Go channel。以下是便于理解的简化逻辑：

```go
select {
case result := <-turn.Done:
    // 人工完成，返回最终结果
case <-ctx.Done():
    // 客户端断开或请求被取消
}
```

等待 channel 时不需要忙循环反复查数据库。Go 的 HTTP 服务可并发处理其他请求；等待本身仍会占用连接和一定内存。

项目中的 `Events` channel 传递流式事件，`Done` channel 传递最终结果。网页回复经过权限检查和回合状态检查，再更新数据库并通知等待者。

`conversation_id` 定位会话，`request_id` 定位其中的本轮请求。后者能避免旧标签页把上一轮回复写入新一轮。

入口：`backend/internal/service/chat/turn/submitter.go`；等待逻辑：`backend/internal/service/chat/pending/pending.go`。

## 4. WebSocket、SSE、数据库分别做什么

| 技术 | 本项目的用途 |
|---|---|
| HTTP + JSON | 登录、设置、模型请求等一次请求/响应操作 |
| WebSocket | 网页与后端双向通信：接收会话变化、发送回复命令 |
| SSE | 在模型请求的 HTTP 响应中持续发送文字和结束事件 |
| SQLite / PostgreSQL | 保存重启后仍需存在的用户、消息和配置等 |

SSE 可以理解为“HTTP 响应暂不结束，持续写入事件”。`stream:true` 时客户端逐段读取；`stream:false` 时等待最终 JSON。它们都可能等待人工回复。

数据库不能保存活跃 socket 和 Go channel，所以重启后历史记录仍在，旧请求连接却不能继续。网页重连后先取快照，再接收增量，以重建界面。

## 5. Agent 怎样接入 API 并运行

Agent 通常是“调用模型、执行工具、继续调用模型”的程序循环。模型负责提出下一步，Agent 程序负责执行。

接入 ChatAPI 时，需要配置三项：

```text
Base URL：http://127.0.0.1:5000/v1
API Key ：在工作台创建的模型 Key
Model   ：human-assistant（示例标识）
```

对于会自动拼接 `/chat/completions` 的客户端，上面的 Base URL 最终形成：

```http
POST http://127.0.0.1:5000/v1/chat/completions
Authorization: Bearer <模型Key>
Content-Type: application/json
```

```json
{
  "model": "human-assistant",
  "messages": [{"role": "user", "content": "查询上海天气"}],
  "stream": false
}
```

API Key 用于认证和确定用户归属；model 是请求中的模型标识。客户端选择的接口格式必须匹配后端入口；有些客户端要求填写完整 URL，不能机械地重复添加 `/v1`。

若 Agent 同时声明了 `get_weather` 工具，完整运行过程可以是：

1. Agent 将问题和工具定义发给 ChatAPI。
2. 你在网页输出工具调用：`get_weather({"city":"上海"})`。
3. ChatAPI 返回结构化调用；Agent 解析后执行真实天气工具。
4. Agent 把工具结果和对应 call ID 加入消息，再次请求 ChatAPI。
5. 你根据结果回复，Agent 收到最终文字并结束本次任务。

**API 负责通信，工具调用负责表达执行意图，Agent 程序负责实际执行与循环。** 仅能聊天的 API 客户端未必会执行工具；工具必须由 Agent 提供并实现。本项目返回工具调用，并不意味着 Go 后端自动执行同名函数。

这里的 `127.0.0.1` 始终指调用程序所在的机器或容器。Agent 在另一台机器时，应使用它能访问到的服务地址。

## 6. 从源码到可访问的网站

开发时：Vite 在 5173 提供页面和热更新，把 `/api`、`/v1` 及 WebSocket 请求代理到 Go 的 5000。前端处理交互，后端处理数据与业务。

部署时：`npm run build` 先经 TypeScript 检查，再由 Vite 生成 HTML、JS、CSS；Go 编译成可执行程序。Go 可以直接提供这些静态资源，也可以用 `embed_frontend` 构建标签把资源嵌入程序。

公网访问通常再增加：`域名解析 → HTTPS 入口 → Go 服务`。代理要支持 WebSocket，并避免缓冲 SSE。浏览器直接刷新 `/app` 时，服务器需要回退到 `index.html`，让 React Router 接管该地址；项目已提供这种 SPA fallback。

建议先跟读一条链路：`chatapi.go → ingress → turn → pending → streaming`，再读前端的 `useChatWorkspace` 与 `useWorkspaceRealtime`。这样能把网页、并发和 Agent API 串起来。
