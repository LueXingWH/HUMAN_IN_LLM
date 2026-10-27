import test from 'node:test'
import assert from 'node:assert/strict'
import { API_FORMATS, buildAPIExample } from './apiExamples.ts'

test('tutorial examples match the protocol endpoints, authentication and input shapes', () => {
  for (const format of API_FORMATS) {
    const example = buildAPIExample(format.id, 'https://chat.example.com')
    assert.equal(example.request.model, 'human-assistant')
    assert.equal(example.request.stream, false)
    assert.ok(example.rawHTTP.startsWith(`POST ${format.path} HTTP/1.1\n`))
    assert.ok(example.curl.includes(`https://chat.example.com${format.path}`))
    assert.ok(example.python.includes(`https://chat.example.com${format.path}`))
    if (format.id === 'responses') {
      assert.ok('input' in example.request)
      assert.ok(!('messages' in example.request))
    } else assert.ok('messages' in example.request)
    if (format.id === 'anthropic_messages') {
      assert.equal(example.headers['x-api-key'], 'YOUR_MODEL_KEY')
      assert.equal(example.request.max_tokens, 1024)
    } else assert.equal(example.headers.Authorization, 'Bearer YOUR_MODEL_KEY')
  }
})
