import { type ReactNode } from 'react'
import { Button, Input, InputNumber, Select, Switch, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'

import {
  arrayItemSchema,
  getSchemaExamples,
  getSchemaType,
  humanTypeLabel,
  isNestedObjectSchema,
} from '../lib/chat-format'
import { validateFieldValue } from '../lib/tool-arguments'
import type { JsonSchema, ToolFieldValue } from '../types/chat'

const { TextArea } = Input

type NativeValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | NativeValue[]
  | { [key: string]: NativeValue }

function isNativeObject(value: NativeValue): value is { [key: string]: NativeValue } {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isNativeArray(value: NativeValue): value is NativeValue[] {
  return Array.isArray(value)
}

function toNative(value: ToolFieldValue | string | undefined, fallback: NativeValue): NativeValue {
  if (typeof value !== 'string' || value === '') return fallback
  try {
    return JSON.parse(value) as NativeValue
  } catch {
    return fallback
  }
}

// FieldShell renders the shared label/description/examples/error chrome around a control.
function FieldShell({
  children,
  error,
  fieldName,
  required,
  schema,
}: {
  children: ReactNode
  error: string | null
  fieldName: string
  required: boolean
  schema: JsonSchema
}) {
  const label = schema.title || fieldName
  const description = schema.description || ''
  const examples = getSchemaExamples(schema)
  const typeLabel = humanTypeLabel(schema)

  return (
    <div className="tool-form-item">
      <div className="tool-form-label-row">
        <span className="tool-form-label">
          {label}
          {required && <span className="tool-form-required">*</span>}
        </span>
        {typeLabel ? <span className="tool-form-type">{typeLabel}</span> : null}
      </div>
      {description ? <div className="tool-form-description">{description}</div> : null}
      {examples.length ? (
        <div className="tool-form-examples">例如：{examples.join(' / ')}</div>
      ) : null}
      {children}
      {error ? (
        <Typography.Text type="danger" className="tool-form-error-text">
          {error}
        </Typography.Text>
      ) : null}
    </div>
  )
}

// JsonTextarea works with a native value and keeps the parent's native contract.
function JsonTextarea({
  disabled,
  onChange,
  placeholder,
  value,
}: {
  disabled: boolean
  onChange: (value: NativeValue) => void
  placeholder: string
  value: NativeValue
}) {
  const text =
    typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value, null, 2)
  return (
    <TextArea
      value={text}
      onChange={(event) => {
        const raw = event.target.value
        try {
          onChange(JSON.parse(raw))
        } catch {
          onChange(raw)
        }
      }}
      placeholder={placeholder}
      autoSize={{ minRows: 3, maxRows: 8 }}
      disabled={disabled}
    />
  )
}

// NativeField is the recursive core: it renders one schema property whose value is
// always a native in-memory value (never a JSON string).
function NativeField({
  disabled,
  fieldName,
  onChange,
  required,
  schema,
  value,
}: {
  disabled: boolean
  fieldName: string
  onChange: (value: NativeValue) => void
  required: boolean
  schema: JsonSchema
  value: NativeValue
}) {
  const type = getSchemaType(schema)
  const error = validateFieldValue(schema, value as ToolFieldValue | string)

  let control: ReactNode

  if (schema.enum?.length) {
    control = (
      <Select
        value={value == null ? undefined : (value as string | number | boolean | null)}
        allowClear={!required}
        placeholder="请选择"
        options={schema.enum.map((option) => ({
          label: String(option),
          value: option as string | number | boolean,
        }))}
        onChange={(next) => onChange(next as NativeValue)}
        disabled={disabled}
      />
    )
  } else if (type === 'boolean') {
    control = <Switch checked={Boolean(value)} onChange={(checked) => onChange(checked)} disabled={disabled} />
  } else if (type === 'number' || type === 'integer') {
    control = (
      <InputNumber
        value={value == null || value === '' ? undefined : Number(value)}
        onChange={(next) => onChange(next == null ? undefined : next)}
        placeholder={schema.examples?.[0] != null ? String(schema.examples[0]) : '请输入数字'}
        style={{ width: '100%' }}
        disabled={disabled}
        status={error ? 'error' : undefined}
      />
    )
  } else if (isNestedObjectSchema(schema)) {
    control = (
      <ObjectControl
        disabled={disabled}
        schema={schema}
        value={isNativeObject(value) ? value : {}}
        onChange={onChange}
      />
    )
  } else if (type === 'array') {
    control = (
      <ArrayControl
        disabled={disabled}
        schema={schema}
        value={isNativeArray(value) ? value : []}
        onChange={onChange}
      />
    )
  } else if (type === 'object') {
    control = <JsonTextarea disabled={disabled} value={value} onChange={onChange} placeholder="请输入 JSON 对象" />
  } else {
    const isLongText = schema.maxLength == null || schema.maxLength > 120
    control = isLongText ? (
      <TextArea
        value={value == null ? '' : String(value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={schema.examples?.[0] != null ? String(schema.examples[0]) : descriptionPlaceholder(schema)}
        autoSize={{ minRows: 2, maxRows: 6 }}
        disabled={disabled}
        status={error ? 'error' : undefined}
      />
    ) : (
      <Input
        value={value == null ? '' : String(value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={schema.examples?.[0] != null ? String(schema.examples[0]) : descriptionPlaceholder(schema)}
        disabled={disabled}
        status={error ? 'error' : undefined}
      />
    )
  }

  return (
    <FieldShell error={error} fieldName={fieldName} required={required} schema={schema}>
      {control}
    </FieldShell>
  )
}

function descriptionPlaceholder(schema: JsonSchema): string {
  return schema.description ? `请输入 ${schema.title || '内容'}` : '请输入'
}

// ObjectControl renders the concrete properties of an object as nested NativeField
// entries, preserving the parent object's native value.
function ObjectControl({
  disabled,
  onChange,
  schema,
  value,
}: {
  disabled: boolean
  onChange: (value: NativeValue) => void
  schema: JsonSchema
  value: { [key: string]: NativeValue }
}) {
  const properties = schema.properties ?? {}
  const required = new Set(schema.required ?? [])
  const entries = Object.entries(properties)
  const hasKeys = entries.length > 0

  return (
    <div className="tool-object-editor">
      {hasKeys ? (
        entries.map(([key, childSchema]) => (
          <NativeField
            key={key}
            disabled={disabled}
            fieldName={key}
            schema={childSchema}
            required={required.has(key)}
            value={value[key]}
            onChange={(next) => {
              const nextValue = { ...value }
              if (next == null || next === '') {
                delete nextValue[key]
              } else {
                nextValue[key] = next
              }
              onChange(nextValue)
            }}
          />
        ))
      ) : (
        <div className="tool-form-empty">该对象没有声明具体字段。</div>
      )}
    </div>
  )
}

// ArrayControl renders an array as a tag list (primitive strings), a line list
// (numbers), a list of object editors, or a JSON fallback.
function ArrayControl({
  disabled,
  onChange,
  schema,
  value,
}: {
  disabled: boolean
  onChange: (value: NativeValue) => void
  schema: JsonSchema
  value: NativeValue[]
}) {
  const items = arrayItemSchema(schema)
  const itemType = getSchemaType(items)

  if (items.enum?.length) {
    return (
      <Select
        mode="multiple"
        value={value as (string | number | boolean)[]}
        placeholder="选择多项"
        options={items.enum.map((option) => ({
          label: String(option),
          value: option as string | number | boolean,
        }))}
        onChange={(next) => onChange(next as NativeValue[])}
        disabled={disabled}
      />
    )
  }

  if (itemType === 'string' || itemType === '') {
    return (
      <Select
        mode="tags"
        value={value as string[]}
        placeholder="输入后回车添加一项"
        open={false}
        onChange={(next) => onChange(next as NativeValue[])}
        disabled={disabled}
      />
    )
  }

  if (itemType === 'number' || itemType === 'integer') {
    return (
      <TextArea
        value={value.map(String).join('\n')}
        onChange={(event) => {
          const numbers = event.target.value
            .split(/[\n,，]/)
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => Number(item))
          onChange(numbers as NativeValue[])
        }}
        placeholder="每行一个数字"
        autoSize={{ minRows: 2, maxRows: 6 }}
        disabled={disabled}
      />
    )
  }

  if (isNestedObjectSchema(items)) {
    return (
      <div className="tool-array-editor">
        {value.map((item, index) => (
          <div key={index} className="tool-array-item">
            <div className="tool-array-item-head">
              <span className="tool-array-item-index">第 {index + 1} 项</span>
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  const next = value.filter((_, itemIndex) => itemIndex !== index)
                  onChange(next)
                }}
                disabled={disabled}
              />
            </div>
            <ObjectControl
              disabled={disabled}
              schema={items}
              value={isNativeObject(item) ? item : {}}
              onChange={(next) => {
                const nextValue = value.slice()
                nextValue[index] = next
                onChange(nextValue)
              }}
            />
          </div>
        ))}
        <Button
          size="small"
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => onChange([...value, {}])}
          disabled={disabled}
          block
        >
          添加一项
        </Button>
      </div>
    )
  }

  return (
    <JsonTextarea
      disabled={disabled}
      value={value}
      onChange={onChange}
      placeholder="请输入 JSON 数组"
    />
  )
}

export function ToolField({
  disabled,
  fieldName,
  onChange,
  required,
  schema,
  value,
}: {
  disabled: boolean
  fieldName: string
  onChange: (fieldName: string, value: ToolFieldValue | string) => void
  required: boolean
  schema: JsonSchema
  value: ToolFieldValue | undefined
}) {
  const type = getSchemaType(schema)

  if (isNestedObjectSchema(schema)) {
    const native = toNative(value, {})
    return (
      <NativeField
        disabled={disabled}
        fieldName={fieldName}
        required={required}
        schema={schema}
        value={isNativeObject(native) ? native : {}}
        onChange={(next) => onChange(fieldName, JSON.stringify(next))}
      />
    )
  }

  if (type === 'array') {
    const native = toNative(value, [])
    return (
      <NativeField
        disabled={disabled}
        fieldName={fieldName}
        required={required}
        schema={schema}
        value={isNativeArray(native) ? native : []}
        onChange={(next) => onChange(fieldName, JSON.stringify(next))}
      />
    )
  }

  // Primitives and non-nested objects keep the string/number/boolean contract so
  // formValuesToToolArguments behaves exactly as before.
  return (
    <NativeField
      disabled={disabled}
      fieldName={fieldName}
      required={required}
      schema={schema}
      value={value as NativeValue}
      onChange={(next) => onChange(fieldName, (next ?? '') as ToolFieldValue | string)}
    />
  )
}
