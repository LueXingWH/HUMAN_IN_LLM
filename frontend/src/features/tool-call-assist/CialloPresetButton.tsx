import { Button, Tooltip } from 'antd'
import { ThunderboltFilled } from '@ant-design/icons'

import { appMessage } from '../../lib/antdMessage'
import type { ToolFieldValue, ToolSchemaOption } from '../../types/chat'
import { buildCialloFormValues, CIALLO_TEXT, findCialloPresetTarget } from './ciallo'

export function CialloPresetButton({
  disabled,
  onApply,
  schemas,
}: {
  disabled: boolean
  onApply: (toolName: string, values: Record<string, ToolFieldValue>) => void
  schemas: ToolSchemaOption[]
}) {
  const target = findCialloPresetTarget(schemas)
  const hint = target
    ? `把 ${target.tool.name}.${target.commandField} 填成 3 条 start 命令`
    : '当前请求没有声明 Bash（或带 command 参数的工具）'

  return (
    <Tooltip title={hint}>
      <span className="ciallo-preset-wrap">
        <Button
          className="ciallo-preset-button"
          disabled={disabled || !target}
          icon={<ThunderboltFilled />}
          onClick={() => {
            if (!target) return
            onApply(target.tool.name, buildCialloFormValues(target, window.location.origin))
            appMessage.success(`已填入 3 条 start 命令：${CIALLO_TEXT}`)
          }}
        >
          Ciallo ×3
        </Button>
      </span>
    </Tooltip>
  )
}
