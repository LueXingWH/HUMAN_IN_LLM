export const DEFAULT_MODEL_NAME = 'human-assistant'

export type APIFormat = 'chat_completions' | 'responses' | 'anthropic_messages'

export const API_FORMATS: { id: APIFormat; label: string; path: string; input: string }[] = [
  { id: 'chat_completions', label: 'OpenAI Chat Completions', path: '/v1/chat/completions', input: 'messages' },
  { id: 'responses', label: 'OpenAI Responses', path: '/v1/responses', input: 'input' },
  { id: 'anthropic_messages', label: 'Anthropic Messages', path: '/v1/messages', input: 'messages + max_tokens' },
]

export function buildAPIExample(format: APIFormat, origin: string) {
  const definition = API_FORMATS.find((item) => item.id === format)!
  const model = DEFAULT_MODEL_NAME
  const message = { role: 'user', content: '你好，请回复一句话' }
  const request = format === 'responses'
    ? { model, input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: message.content }] }], stream: false }
    : format === 'anthropic_messages'
      ? { model, max_tokens: 1024, messages: [message], stream: false }
      : { model, messages: [message], stream: false }
  const response = format === 'responses'
    ? { object: 'response', status: 'completed', output_text: '你好！', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '你好！' }] }] }
    : format === 'anthropic_messages'
      ? { type: 'message', role: 'assistant', content: [{ type: 'text', text: '你好！' }], stop_reason: 'end_turn' }
      : { object: 'chat.completion', model, choices: [{ index: 0, message: { role: 'assistant', content: '你好！' }, finish_reason: 'stop' }] }
  const headers: Record<string, string> = format === 'anthropic_messages'
    ? { 'Content-Type': 'application/json', 'x-api-key': 'YOUR_MODEL_KEY', 'anthropic-version': '2023-06-01' }
    : { 'Content-Type': 'application/json', Authorization: 'Bearer YOUR_MODEL_KEY' }
  const json = JSON.stringify(request, null, 2)
  const quote = (text: string) => `'${text.replace(/'/g, `'"'"'`)}'`
  const curl = [`curl ${origin}${definition.path}`, ...Object.entries(headers).map(([name, value]) => `  -H ${quote(`${name}: ${value}`)}`), `  -d ${quote(json)}`].join(' \\\n')
  const rawHTTP = [`POST ${definition.path} HTTP/1.1`, `Host: ${new URL(origin).host}`, ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`), '', json].join('\n')
  const output = format === 'responses' ? 'result["output_text"]' : format === 'anthropic_messages' ? 'result["content"][0]["text"]' : 'result["choices"][0]["message"]["content"]'
  const python = `import json, os, urllib.request

api_key = os.environ["CHATAPI_MODEL_KEY"]
body = json.loads(${JSON.stringify(json)})
headers = {"Content-Type": "application/json"}
${format === 'anthropic_messages' ? 'headers.update({"x-api-key": api_key, "anthropic-version": "2023-06-01"})' : 'headers["Authorization"] = "Bearer " + api_key'}
request = urllib.request.Request(
    ${JSON.stringify(origin + definition.path)},
    data=json.dumps(body).encode("utf-8"),
    headers=headers,
)
# 运行后打开网站工作台，在收到的会话中发送回复。
with urllib.request.urlopen(request, timeout=600) as response:
    result = json.load(response)
    print(${output})
`
  return { ...definition, request, response, headers, curl, rawHTTP, python }
}
