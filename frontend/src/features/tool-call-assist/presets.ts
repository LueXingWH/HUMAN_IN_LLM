import type { ToolSchemaOption } from '../../types/chat'

export type PresetKind = 'write' | 'write_open' | 'read' | 'open_url'
export type AgentOS = 'windows' | 'posix'
export type PresetInput = { kind: PresetKind; os: AgentOS; path: string; content: string; url: string }
export type PresetTarget = { tool: ToolSchemaOption; fields: { command?: string; path?: string; content?: string } }

const commandFields = ['command', 'cmd', 'script', 'shell_command', 'bash_command']
const pathFields = ['file_path', 'path', 'filename', 'filePath']
const contentFields = ['content', 'text', 'contents', 'file_content']
function stringField(tool: ToolSchemaOption, names: string[]) {
  return names.find((name) => tool.parameters.properties?.[name]?.type === 'string')
}

export function findPresetTargets(schemas: ToolSchemaOption[], kind: PresetKind): PresetTarget[] {
  const native: PresetTarget[] = []
  const terminal: PresetTarget[] = []
  for (const tool of schemas) {
    const path = stringField(tool, pathFields)
    const content = stringField(tool, contentFields)
    if (path && kind === 'write' && content && /write|create.*file/i.test(tool.name)) native.push({ tool, fields: { path, content } })
    if (path && kind === 'read' && /read|get.*file/i.test(tool.name)) native.push({ tool, fields: { path } })
    const command = stringField(tool, commandFields)
    if (command && /bash|shell|terminal|exec|command|run/i.test(tool.name)) terminal.push({ tool, fields: { command } })
  }
  return [...native, ...terminal]
}

function base64(text: string) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
function utf16Base64(text: string) {
  let binary = ''
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    binary += String.fromCharCode(code & 255, code >> 8)
  }
  return btoa(binary)
}
function shellQuote(text: string) { return `'${text.replace(/'/g, `'"'"'`)}'` }

export function buildPresetCommand(input: PresetInput): string {
  if (input.kind === 'open_url') {
    let url: URL
    try { url = new URL(input.url) } catch { throw new Error('请填写完整网址，例如 https://example.com') }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('网址须以 http:// 或 https:// 开头')
  } else if (!input.path.trim()) throw new Error('请填写文件路径')
  if (input.os === 'windows') {
    const decode = (value: string) => `[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${base64(value)}'))`
    const lines = ["$ErrorActionPreference = 'Stop'", `$p = ${decode(input.path)}`]
    if (input.kind === 'write' || input.kind === 'write_open') {
      lines.push('$p = [IO.Path]::GetFullPath($p)', '[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($p)) | Out-Null', `[IO.File]::WriteAllText($p, ${decode(input.content)}, (New-Object Text.UTF8Encoding($false)))`)
      if (input.kind === 'write_open') lines.push('Invoke-Item -LiteralPath $p')
    } else if (input.kind === 'read') lines.push('Get-Content -LiteralPath $p -Raw -Encoding UTF8')
    else lines.push(`$u = ${decode(input.url)}`, 'Start-Process $u')
    const command = `powershell.exe -NoProfile -NonInteractive -EncodedCommand ${utf16Base64(lines.join('\n'))}`
    if (command.length > 30000) throw new Error('内容超过 Windows 命令长度限制，请改用 Agent 的原生写入文件工具或分段写入')
    return command
  }
  const data = base64(JSON.stringify({ path: input.path, content: input.content, url: input.url }))
  const lines = ['import base64,json,pathlib,subprocess,sys', `d=json.loads(base64.b64decode('${data}').decode('utf-8'))`, "p=pathlib.Path(d['path']).expanduser()"]
  if (input.kind === 'write' || input.kind === 'write_open') {
    lines.push('p.parent.mkdir(parents=True, exist_ok=True)', "p.write_text(d['content'], encoding='utf-8')")
    if (input.kind === 'write_open') lines.push("subprocess.run(['open' if sys.platform == 'darwin' else 'xdg-open', str(p.resolve())], check=True)")
  } else if (input.kind === 'read') lines.push("print(p.read_text(encoding='utf-8'))")
  else lines.push("subprocess.run(['open' if sys.platform == 'darwin' else 'xdg-open', d['url']], check=True)")
  return `python3 -c ${shellQuote(lines.join('\n'))}`
}

export function buildPresetArguments(target: PresetTarget, input: PresetInput): Record<string, unknown> {
  if (target.fields.command) return { [target.fields.command]: buildPresetCommand(input) }
  if (!input.path.trim()) throw new Error('请填写文件路径')
  const args: Record<string, unknown> = { [target.fields.path!]: input.path }
  if (target.fields.content) args[target.fields.content] = input.content
  return args
}
