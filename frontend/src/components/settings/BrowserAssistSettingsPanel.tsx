import { useEffect, useState } from 'react'
import { Alert, Button, Descriptions, Typography } from 'antd'
import { requestJson } from '../../lib/api'

export function BrowserAssistSettingsPanel({ open }: { open: boolean; userID: string }) {
  const [status, setStatus] = useState<{ enabled: boolean; model: string } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    let active = true
    void requestJson<{ enabled: boolean; model: string }>('/api/chat/ai-assist-status').then((data) => {
      if (active) { setStatus(data); setError('') }
    }).catch((err) => { if (active) setError(err instanceof Error ? err.message : '无法读取配置状态') })
    return () => { active = false }
  }, [open])
  return <div className="browser-assist-settings">
    <Typography.Title level={4}>AI 代写与工具填参</Typography.Title>
    <Alert type={error ? 'error' : status?.enabled ? 'success' : 'info'} showIcon message={error || (status ? status.enabled ? '服务端辅助模型已配置' : '尚未配置服务端辅助模型' : '正在读取配置状态')} />
    <Descriptions column={1} style={{ marginTop: 20 }} items={[
      { key: 'model', label: '当前模型', children: status?.model || '—' },
      { key: 'storage', label: '密钥位置', children: '仅保存在服务端环境配置，浏览器无需填写密钥' },
      { key: 'usage', label: '使用方式', children: '回复框点击 AI 代写；工具调用表单点击「让 AI 帮我填」。生成后检查并发送。' },
    ]} />
    <Typography.Paragraph type="secondary">由站点维护者设置 CHATAPI_GLM_API_KEY、CHATAPI_GLM_BASE_URL 和 CHATAPI_GLM_MODEL，修改后重启服务。旧的浏览器端辅助模型设置已不参与调用。</Typography.Paragraph>
    <Button href="/help" target="_blank">查看使用教程</Button>
  </div>
}
