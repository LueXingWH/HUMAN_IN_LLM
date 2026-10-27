import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { buildPresetArguments, buildPresetCommand, findPresetTargets } from './presets.ts'

test('matches only declared compatible tools and prefers native file tools', () => {
  const schemas = [
    { name: 'exec_command', parameters: { type: 'object', properties: { cmd: { type: 'string' } } } },
    { name: 'Write', parameters: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } } } },
  ]
  const targets = findPresetTargets(schemas, 'write')
  assert.equal(targets[0].tool.name, 'Write')
  assert.equal(findPresetTargets([], 'write_open').length, 0)
  assert.deepEqual(buildPresetArguments(targets[0], { kind: 'write', os: 'windows', path: '笔记.txt', content: '你好', url: '' }), { file_path: '笔记.txt', content: '你好' })
  assert.throws(() => buildPresetCommand({ kind: 'open_url', os: 'windows', path: '', content: '', url: 'javascript:alert(1)' }))
})

test('Windows generated command preserves Unicode, quotes and shell metacharacters as file data', { skip: process.platform !== 'win32' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'chatapi-preset-'))
  assert.equal(dirname(resolve(root)), resolve(tmpdir()))
  assert.ok(basename(root).startsWith('chatapi-preset-'))
  try {
    const path = join(root, "中文 空格 ' &", 'notes.txt')
    const content = "你好\n'\"`$(); & | < > 😀"
    const command = buildPresetCommand({ kind: 'write', os: 'windows', path, content, url: '' })
    const encoded = command.split(' ').at(-1)!
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded])
    assert.equal(readFileSync(path, 'utf8'), content)
    const read = buildPresetCommand({ kind: 'read', os: 'windows', path, content: '', url: '' })
    const script = Buffer.from(read.split(' ').at(-1)!, 'base64').toString('utf16le')
    assert.match(script, /Get-Content -LiteralPath/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
