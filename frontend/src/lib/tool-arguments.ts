import Ajv, { type ErrorObject } from 'ajv'

import type { JsonSchema, ToolFieldValue } from '../types/chat'
import { getSchemaType, normalizeToolFieldValue } from './chat-format'

const ajv = new Ajv({ allErrors: true, strict: false })

function formatValidationError(error: ErrorObject) {
  const field = error.instancePath || '/'
  return `${field} ${error.message || '不符合 schema'}`
}

export function validateToolArguments(value: unknown, schema: JsonSchema): asserts value is Record<string, unknown> {
  let validate
  try {
    validate = ajv.compile(schema)
  } catch (error) {
    throw new Error('当前 Tool Schema 不是受支持的 JSON Schema draft-07 格式', { cause: error })
  }
  if (validate(value)) return
  throw new Error(`参数不符合 Tool Schema：${(validate.errors ?? []).map(formatValidationError).join('；')}`)
}

export function toolArgumentsToFormValues(
  value: Record<string, unknown>,
  schema: JsonSchema,
): Record<string, ToolFieldValue> {
  const properties = schema.properties ?? {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([name, fieldValue]) => {
      const fieldSchema = properties[name]
      if (!fieldSchema) return []
      const type = getSchemaType(fieldSchema)
      if (type === 'object' || type === 'array') {
        return [[name, JSON.stringify(fieldValue, null, 2)]]
      }
      if (type === 'number' || type === 'integer') return [[name, String(fieldValue)]]
      return [[name, fieldValue as ToolFieldValue]]
    }),
  )
}

// validateFieldValue performs a best-effort, field-level validation for inline
// feedback. It returns a human-readable error message, or null when the value is
// acceptable. Required-emptiness is handled by the caller (it needs the parent
// object's `required` list).
export function validateFieldValue(
  schema: JsonSchema,
  value: ToolFieldValue | string | undefined,
): string | null {
  if (value == null || value === '') return null

  if (schema.enum?.length) return null

  const type = getSchemaType(schema)

  if (type === 'number' || type === 'integer') {
    const num = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(num)) return '请输入数字'
    if (type === 'integer' && !Number.isInteger(num)) return '请输入整数'
    if (schema.minimum != null && num < schema.minimum) return `不能小于 ${schema.minimum}`
    if (schema.maximum != null && num > schema.maximum) return `不能大于 ${schema.maximum}`
    return null
  }

  if (type === 'string') {
    const text = String(value)
    if (schema.minLength != null && text.length < schema.minLength) return `至少 ${schema.minLength} 个字符`
    if (schema.maxLength != null && text.length > schema.maxLength) return `最多 ${schema.maxLength} 个字符`
    return null
  }

  if (type === 'array' || type === 'object') {
    if (typeof value !== 'string') return null
    try {
      JSON.parse(value)
    } catch {
      return 'JSON 格式错误'
    }
    return null
  }

  return null
}

export function formValuesToToolArguments(
  values: Record<string, ToolFieldValue>,
  schema: JsonSchema,
): Record<string, unknown> {
  const properties = schema.properties ?? {}
  const required = new Set(schema.required ?? [])
  const result = Object.fromEntries(
    Object.entries(properties).flatMap(([name, fieldSchema]) => {
      const rawValue = values[name]
      if (rawValue == null || rawValue === '') {
        if (required.has(name)) throw new Error(`请填写必填参数: ${name}`)
        return []
      }
      return [[name, normalizeToolFieldValue(rawValue, fieldSchema)]]
    }),
  )
  return result
}
