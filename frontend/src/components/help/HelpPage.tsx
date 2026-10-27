import { Button, Card, Space, Tabs, Typography } from 'antd'
import { Link, useSearchParams } from 'react-router-dom'
import { AgentGuide } from './AgentGuide'

export function HelpPage() {
  const [params, setParams] = useSearchParams()
  const active = ['agent', 'tools', 'migration'].includes(params.get('tab') || '') ? params.get('tab')! : 'agent'
  return <main className="help-page">
    <Space wrap><Link to="/app"><Button>返回工作台</Button></Link><Link to="/"><Button>返回首页</Button></Link></Space>
    <Typography.Title level={2}>使用教程</Typography.Title>
    <Card><Tabs activeKey={active} onChange={(tab) => setParams({ tab })} items={[
      { key: 'agent', label: '接入 Agent', children: <AgentGuide /> },
      { key: 'tools', label: '工具模块', children: <div className="help-content">
        <Typography.Title level={3}>用表单完成常见操作</Typography.Title>
        <ol><li>Agent 发来带 tools 的任务后，切换到「工具调用」。</li><li>选择「写入文件」「写入并打开文件」「读取文件」或「打开网页」。</li><li>选择 Agent 所在电脑的系统，填写路径、内容或网址。</li><li>点击「填入工具参数」，检查下方表单，再点「输出工具调用」。</li><li>等待 Agent 执行并返回结果。</li></ol>
        <Typography.Paragraph>文件路径属于 Agent 所在的电脑。网站迁移到服务器后，这一点仍然相同。写入会覆盖同名文件，打开操作需要 Agent 电脑存在桌面会话与相应程序。</Typography.Paragraph>
        <Typography.Paragraph>模块只使用当前 Agent 已提供的工具。缺少兼容工具时会说明原因；可以继续使用原有参数表单或「让 AI 帮我填」。Windows 命令模块需要 PowerShell，macOS / Linux 命令模块需要 python3，Linux 打开文件还需要 xdg-open。</Typography.Paragraph>
      </div> },
      { key: 'migration', label: '迁移网站', children: <div className="help-content">
        <Typography.Title level={3}>换主机时保留账号、会话和密钥</Typography.Title>
        <ol><li>安排停机，完成或终止正在等待人工回复的请求，然后停止旧站服务。</li><li>备份项目源码、后端完整 data 目录、实际使用的环境配置文件和外置媒体目录。SQLite 的 -wal / -shm 文件如存在也随目录复制。</li><li>保留原 CHATAPI_MASTER_KEY 和 CHATAPI_SESSION_SECRET，以及管理员、GLM、邮件等配置。</li><li>新主机安装 Docker / Compose；使用项目根目录的 compose.yaml，恢复数据到 chatapi-data 卷，再启动服务。</li><li>修改域名、CHATAPI_BASE_URL、CHATAPI_CORS_ORIGINS；如有单点登录，同时更新回调地址。</li><li>检查 /api/ready、登录、历史会话、图片、模型列表和一次 Agent 往返，再切换流量。</li></ol>
        <Typography.Paragraph>完整可执行命令、Windows 到 Linux 的迁移步骤、Docker 卷迁移、备份和回滚方法见项目 README 的「项目迁移」及 backend/docs/migration-guide.md。</Typography.Paragraph>
        <Typography.Paragraph>不要重新生成 master key，否则已保存的模型密钥将无法解密。不要使用 docker compose down -v，这会删除数据卷。待新站验证通过后再处理旧站备份。</Typography.Paragraph>
      </div> },
    ]} /></Card>
  </main>
}
