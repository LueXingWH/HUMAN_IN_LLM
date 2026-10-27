import { useState } from 'react'
import { Alert, Collapse, Descriptions, Table, Tabs, Typography } from 'antd'
import { API_FORMATS, buildAPIExample, DEFAULT_MODEL_NAME } from './apiExamples'
import type { APIFormat } from './apiExamples'

function CodeBlock({ text }: { text: string }) {
  return <Typography.Paragraph className="help-code" copyable={{ text }}><pre>{text}</pre></Typography.Paragraph>
}

export function AgentGuide() {
  const [format, setFormat] = useState<APIFormat>('chat_completions')
  const origin = window.location.origin
  const example = buildAPIExample(format, origin)
  return <div className="help-content">
    <Typography.Paragraph>本站提供兼容模型 API，把 Agent 的请求交给你在工作台回复。创建模型 Key 后即可接入，无需添加或管理虚拟模型。</Typography.Paragraph>
    <Typography.Title level={4}>1. Agent 里怎么填</Typography.Title>
    <ol>
      <li>进入「设置 → API Keys → 模型 Key」，创建并复制一条 Key。</li>
      <li>Agent 支持自定义 OpenAI 接口时，优先选择 <strong>OpenAI Chat Completions</strong> 格式；如果它明确使用 Responses 或 Anthropic，则选择下方对应格式。</li>
      <li>填写地址、模型名、Key，保存后发送一句测试消息。</li>
      <li>保持本站工作台在线，在新会话里发送回复，Agent 就会收到结果。人工回复需要等待，可将 Agent 请求超时设为 600 秒或更长。</li>
    </ol>
    <Table size="small" pagination={false} rowKey="id" scroll={{ x: 600 }} dataSource={API_FORMATS} columns={[
      { title: 'API 格式 / 协议', dataIndex: 'label' },
      { title: 'HTTP 方法', render: () => 'POST' },
      { title: '请求路径', dataIndex: 'path', render: (path: string) => <Typography.Text code>{path}</Typography.Text> },
      { title: '输入字段', dataIndex: 'input' },
    ]} />
    <Typography.Title level={4}>2. 选择 API 格式，查看完整示例</Typography.Title>
    <Tabs activeKey={format} onChange={(key) => setFormat(key as APIFormat)} items={API_FORMATS.map((item) => ({ key: item.id, label: item.label }))} />
    <Descriptions bordered size="small" column={1} items={[
      { key: 'format', label: 'API 格式', children: <Typography.Text strong>{example.label}</Typography.Text> },
      { key: 'base', label: 'Base URL（基础地址）', children: <Typography.Text copyable>{format === 'anthropic_messages' ? origin : `${origin}/v1`}</Typography.Text> },
      { key: 'endpoint', label: '完整请求地址', children: <Typography.Text copyable>{origin + example.path}</Typography.Text> },
      { key: 'model', label: '模型 / model', children: <Typography.Text copyable>{DEFAULT_MODEL_NAME}</Typography.Text> },
      { key: 'key', label: 'API Key', children: '填写本站生成的「模型 Key」' },
      { key: 'auth', label: '认证请求头', children: format === 'anthropic_messages' ? 'x-api-key: 你的模型Key' : 'Authorization: Bearer 你的模型Key' },
      { key: 'content', label: '请求正文格式', children: 'JSON（Content-Type: application/json）' },
    ]} />
    <Typography.Paragraph style={{ marginTop: 12 }}>如果 Agent 的配置项是 Base URL，填写基础地址，由它追加接口路径；如果要求完整 Endpoint，填写完整请求地址。最终请求路径须与上表一致，避免出现重复的 /v1/v1。</Typography.Paragraph>
    <Typography.Paragraph>模型名是这次人工回复服务的标签，默认填 <Typography.Text code>{DEFAULT_MODEL_NAME}</Typography.Text>，也可沿用现有 Agent 的 model 名称。Key 的备注名只方便你管理，不决定请求中的模型名。</Typography.Paragraph>
    <Alert type="info" showIcon message="接入 Agent 使用「模型 Key」。应用 API Key 用于管理本站数据，GLM Key 用于服务端 AI 代写。" />
    <Typography.Title level={4}>请求格式（HTTP + JSON）</Typography.Title>
    <CodeBlock text={example.rawHTTP} />
    <Typography.Title level={4}>响应格式（非流式，正文相关字段）</Typography.Title>
    <CodeBlock text={JSON.stringify(example.response, null, 2)} />
    <Typography.Title level={4}>cURL 调用示例</Typography.Title>
    <Typography.Paragraph>替换 YOUR_MODEL_KEY 后运行。以下命令适用于 Bash，Windows 可用 Git Bash 或 WSL；运行后请在网站工作台回复。</Typography.Paragraph>
    <CodeBlock text={example.curl} />
    <Typography.Title level={4}>流式响应格式</Typography.Title>
    <Typography.Paragraph>示例默认 <Typography.Text code>stream: false</Typography.Text>，回复完成后返回一个 JSON。将其改为 <Typography.Text code>stream: true</Typography.Text> 可启用 SSE，响应类型为 <Typography.Text code>text/event-stream</Typography.Text>；用 cURL 查看时加 <Typography.Text code>-N</Typography.Text>。</Typography.Paragraph>
    <Typography.Paragraph>{format === 'chat_completions' ? 'Chat Completions：逐条读取 data: 后的 JSON，从 choices[0].delta.content 取文本；遇到 [DONE] 结束。' : format === 'responses' ? 'Responses：读取带事件名的 SSE，例如 response.output_text.delta 中的 delta；以 response.completed 作为完成事件。' : 'Anthropic Messages：读取 message_start、content_block_delta 等命名事件，文本增量在 delta.text 中；以 message_stop 结束。'}</Typography.Paragraph>
    <Collapse items={[{ key: 'python', label: 'Python 调用示例（当前选择的 API 格式，无需第三方包）', children: <>
      <Typography.Paragraph>先设置环境变量 CHATAPI_MODEL_KEY。PowerShell：<Typography.Text code>$env:CHATAPI_MODEL_KEY='你的模型Key'</Typography.Text>；Bash：<Typography.Text code>export CHATAPI_MODEL_KEY='你的模型Key'</Typography.Text>。</Typography.Paragraph>
      <CodeBlock text={example.python} />
    </> }]} />
    <Typography.Title level={4}>3. 工具调用与常见问题</Typography.Title>
    <Typography.Paragraph>Agent 请求中声明 tools → 网站显示可用工具 → 你填写并输出工具调用 → Agent 在它所在电脑执行 → 带回结果继续请求。只有聊天功能的客户端不能执行文件操作。</Typography.Paragraph>
    <ul>
      <li>401：检查是否使用本站模型 Key，以及 Key 是否已删除。</li>
      <li>404 / 405：核对所选 API 格式、完整请求路径和 POST 方法；不要重复添加 /v1。</li>
      <li>无法读取回复 / 缺少 messages 或 input：所选协议与请求或响应结构不匹配，按对应格式示例修改。</li>
      <li>一直等待：本站需要人工回复，保持工作台在线并适当增加 Agent 超时。</li>
      <li>远程访问失败：localhost 指向 Agent 自己的电脑，远程 Agent 应填写服务器的可访问域名或 IP。</li>
    </ul>
  </div>
}
