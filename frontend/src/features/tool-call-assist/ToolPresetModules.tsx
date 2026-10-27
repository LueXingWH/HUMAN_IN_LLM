import { useState } from 'react'
import { Alert, Button, Form, Input, Modal, Select, Space, Typography } from 'antd'
import type { ToolFieldValue, ToolSchemaOption } from '../../types/chat'
import { toolArgumentsToFormValues } from '../../lib/tool-arguments'
import { buildPresetArguments, findPresetTargets } from './presets'
import type { AgentOS, PresetKind } from './presets'

const modules: { kind: PresetKind; label: string; help: string }[] = [
  { kind: 'write', label: '写入文件', help: '在 Agent 电脑上创建文件并写入内容；同名文件会被覆盖。' },
  { kind: 'write_open', label: '写入并打开文件', help: '保存内容后，用 Agent 电脑的默认程序打开文件；同名文件会被覆盖。' },
  { kind: 'read', label: '读取文件', help: '读取 Agent 电脑上的文本文件，并由 Agent 返回内容。' },
  { kind: 'open_url', label: '打开网页', help: '在 Agent 电脑的默认浏览器打开网址，需要该电脑具有桌面会话。' },
]

export function ToolPresetModules({ schemas, disabled, onApply }: {
  schemas: ToolSchemaOption[]; disabled: boolean
  onApply: (toolName: string, values: Record<string, ToolFieldValue>) => void
}) {
  const [kind, setKind] = useState<PresetKind | null>(null)
  const [os, setOS] = useState<AgentOS>('windows')
  const [path, setPath] = useState('')
  const [content, setContent] = useState('')
  const [url, setURL] = useState('https://example.com')
  const [toolName, setToolName] = useState('')
  const [error, setError] = useState('')
  const targets = kind ? findPresetTargets(schemas, kind) : []
  const target = targets.find((item) => item.tool.name === toolName) ?? targets[0]
  const preset = modules.find((item) => item.kind === kind)

  function apply() {
    if (!kind || !target) return
    try {
      const args = buildPresetArguments(target, { kind, os, path, content, url })
      onApply(target.tool.name, toolArgumentsToFormValues(args, target.tool.parameters))
      setKind(null)
    } catch (err) { setError(err instanceof Error ? err.message : '无法生成参数') }
  }
  return <div className="tool-preset-modules">
    <Typography.Text strong>常用操作</Typography.Text>
    <Typography.Paragraph type="secondary">选择操作，填写内容后检查下方参数，再发送给 Agent 执行。操作发生在 Agent 所在电脑。</Typography.Paragraph>
    <Space wrap>{modules.map((item) => {
      const supported = findPresetTargets(schemas, item.kind).length > 0
      return <Button key={item.kind} disabled={disabled} onClick={() => { setKind(item.kind); setToolName(''); setError(''); setPath(''); setContent('') }}>{item.label}{supported ? '' : '（缺少工具）'}</Button>
    })}</Space>
    <Modal open={kind !== null} title={preset?.label} onCancel={() => setKind(null)} onOk={apply} okText="填入工具参数" cancelText="取消" okButtonProps={{ disabled: disabled || !target || (kind !== 'open_url' && !path.trim()) }} destroyOnHidden>
      <Typography.Paragraph>{preset?.help}</Typography.Paragraph>
      {!target ? <Alert type="info" showIcon message="当前 Agent 没有提供兼容工具" description="请让 Agent 在请求中提供文件读写工具或命令执行工具（如 Bash、exec_command）。网站无法自行添加 Agent 不支持的工具。" /> : <Form layout="vertical">
        <Form.Item label="使用 Agent 提供的工具"><Select value={target.tool.name} onChange={setToolName} options={targets.map((item) => ({ label: item.tool.name, value: item.tool.name }))} /></Form.Item>
        {target.fields.command && <Form.Item label="Agent 所在电脑的系统"><Select value={os} onChange={setOS} options={[{ value: 'windows', label: 'Windows（PowerShell）' }, { value: 'posix', label: 'macOS / Linux（需要 python3）' }]} /></Form.Item>}
        {kind === 'open_url' ? <Form.Item label="网页地址" required><Input value={url} onChange={(e) => setURL(e.target.value)} placeholder="https://example.com" /></Form.Item> : <Form.Item label="文件路径（Agent 所在电脑）" required><Input value={path} onChange={(e) => setPath(e.target.value)} placeholder={os === 'windows' ? '例如 C:\\Users\\你的用户名\\Desktop\\笔记.txt' : '例如 /home/user/notes.txt'} /></Form.Item>}
        {(kind === 'write' || kind === 'write_open') && <Form.Item label="文件内容"><Input.TextArea value={content} onChange={(e) => setContent(e.target.value)} autoSize={{ minRows: 5, maxRows: 12 }} placeholder="在此输入要保存的内容" /></Form.Item>}
        {(target.tool.parameters.required ?? []).some((field) => !Object.values(target.fields).includes(field)) && <Alert type="info" message="这个工具还要求其他参数。填入后，请在下方表单补全再发送。" />}
        {error && <Alert type="error" message={error} showIcon />}
      </Form>}
    </Modal>
  </div>
}
