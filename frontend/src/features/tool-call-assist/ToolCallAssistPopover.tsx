import { useEffect, useRef, useState } from 'react'
import { Button, Input, Popover, Space, Typography } from 'antd'
import { CloseOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons'

import type { ToolSchemaOption } from '../../types/chat'
import { toolArgumentsToFormValues, validateToolArguments } from '../../lib/tool-arguments'
import type { ToolCallAssistResult } from './types'

const { TextArea } = Input

export function ToolCallAssistPopover({
  disabled,
  onApply,
  userID,
  schema,
}: {
  disabled: boolean
  onApply: (result: ToolCallAssistResult) => void
  schema: ToolSchemaOption | null
  userID: string
}) {
  const [open, setOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(false)

  function close() {
    controllerRef.current?.abort()
    controllerRef.current = null
    setLoading(false)
    setInstruction('')
    setError('')
    setOpen(false)
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [])
  async function submit() {
    if (!schema || !instruction.trim() || loading) return
    const controller = new AbortController()
    controllerRef.current = controller
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/chat/ai-fill-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_name: schema.name,
          tool_description: schema.description ?? '',
          schema: schema.parameters,
          instruction: instruction.trim(),
          user_id: userID,
        }),
        signal: controller.signal,
      })
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; arguments?: Record<string, unknown>; error?: string }
        | null
      if (!response.ok) {
        throw new Error(payload?.error || `AI 填写失败 (${response.status})`)
      }
      if (!mountedRef.current || controller.signal.aborted || controllerRef.current !== controller) return
      const args = payload?.arguments ?? {}
      validateToolArguments(args, schema.parameters)
      onApply(toolArgumentsToFormValues(args, schema.parameters))
      close()
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(requestError instanceof Error ? requestError.message : 'AI 填写失败')
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null
        if (mountedRef.current) setLoading(false)
      }
    }
  }

  return (
    <Popover
      arrow={false}
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close()
        else setOpen(true)
      }}
      placement="topRight"
      trigger="click"
      content={(
        <div className="tool-assist-popover">
          <div className="tool-assist-heading">
            <div>
              <Typography.Text strong>让 AI 填写 {schema?.name}</Typography.Text>
              <Typography.Text type="secondary" className="tool-assist-subtitle">
                由服务端调用辅助模型填写，生成后可检查和修改
              </Typography.Text>
            </div>
            <Button type="text" icon={<CloseOutlined />} onClick={close} aria-label="关闭" />
          </div>
          <TextArea
            autoFocus
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void submit()
            }}
            autoSize={{ minRows: 4, maxRows: 9 }}
            placeholder="告诉模型如何根据当前任务填写这些参数"
            disabled={loading}
          />
          {error ? <Typography.Text type="danger" className="tool-assist-error">{error}</Typography.Text> : null}
          <Space className="tool-assist-actions">
            {loading ? <Button onClick={() => controllerRef.current?.abort()}>取消</Button> : null}
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={loading}
              disabled={!instruction.trim()}
              onClick={() => void submit()}
            >
              填写表单
            </Button>
          </Space>
        </div>
      )}
    >
      <Button icon={<RobotOutlined />} disabled={disabled || !schema}>让 AI 帮我填</Button>
    </Popover>
  )
}
