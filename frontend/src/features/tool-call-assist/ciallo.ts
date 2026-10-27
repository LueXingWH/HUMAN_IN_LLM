import { buildInitialToolFormValues, getSchemaType } from '../../lib/chat-format'
import type { JsonSchema, ToolFieldValue, ToolSchemaOption } from '../../types/chat'

export const CIALLO_TEXT = 'Ciallo～(∠・ω )⌒☆'

const COMMAND_FIELDS = ['command', 'cmd', 'script', 'shell_command', 'bash_command']

export type CialloPresetTarget = {
  tool: ToolSchemaOption
  commandField: string
}

function findCommandField(schema?: JsonSchema): string | null {
  const properties = schema?.properties ?? {}
  for (const fieldName of COMMAND_FIELDS) {
    const fieldSchema = properties[fieldName]
    if (fieldSchema && getSchemaType(fieldSchema) === 'string') {
      return fieldName
    }
  }
  return null
}

function rankTool(name: string): number {
  const normalized = name.trim().toLowerCase()
  if (normalized === 'bash') return 3
  if (normalized.includes('bash') || normalized.includes('shell') || normalized.includes('terminal')) return 2
  if (normalized.includes('exec') || normalized.includes('command') || normalized.includes('run')) return 1
  return 0
}

// findCialloPresetTarget prefers the caller's Bash tool, then any other tool that
// exposes a string command field, so the preset works with non-Claude clients too.
export function findCialloPresetTarget(schemas: ToolSchemaOption[]): CialloPresetTarget | null {
  let best: { target: CialloPresetTarget; rank: number } | null = null
  for (const tool of schemas) {
    const commandField = findCommandField(tool.parameters)
    if (!commandField) continue
    const rank = rankTool(tool.name)
    if (!best || rank > best.rank) {
      best = { target: { tool, commandField }, rank }
    }
  }
  return best?.target ?? null
}

export function cialloPageUrl(origin: string): string {
  const base = new URL(import.meta.env.BASE_URL || '/', origin)
  return new URL('ciallo.html', base).toString()
}

// buildCialloCommand opens three independent Chrome windows. When Chrome is not
// installed the first start fails and the second one falls back to the default
// browser, so the command still shows the page instead of doing nothing.
export function buildCialloCommand(origin: string, count = 3): string {
  const pageUrl = cialloPageUrl(origin)
  const lines: string[] = []
  for (let index = 1; index <= count; index += 1) {
    const url = new URL(pageUrl)
    url.searchParams.set('win', String(index))
    const target = url.toString()
    lines.push(`start "" chrome --new-window "${target}" 2>/dev/null || start "" "${target}"`)
  }
  return lines.join('\nsleep 1\n')
}

export function buildCialloFormValues(target: CialloPresetTarget, origin: string): Record<string, ToolFieldValue> {
  const values = buildInitialToolFormValues(target.tool.parameters)
  values[target.commandField] = buildCialloCommand(origin)
  const descriptionSchema = target.tool.parameters.properties?.description
  if (descriptionSchema && getSchemaType(descriptionSchema) === 'string') {
    values.description = 'Open three Ciallo browser windows'
  }
  return values
}
