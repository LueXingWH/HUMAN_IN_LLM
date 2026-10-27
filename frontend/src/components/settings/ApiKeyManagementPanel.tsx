import { useEffect, useState } from 'react'
import { Alert, Button, Form, Input, Modal, Popconfirm, Table, Tabs, Typography } from 'antd'
import { AgentGuide } from '../help/AgentGuide'
import { CopyOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'

import { appMessage } from '../../lib/antdMessage'
import { requestJson } from '../../lib/api'
import type { ApiKeyInfo, ApiKeyListResponse, ModelKeyInfo } from '../../types/chat'

type ApiKeyManagementPanelProps = {
  open: boolean
}

export function ApiKeyManagementPanel({ open }: ApiKeyManagementPanelProps) {
  const [appKeys, setAppKeys] = useState<ApiKeyInfo[]>([])
  const [modelKeys, setModelKeys] = useState<ModelKeyInfo[]>([])
  const [appLoading, setAppLoading] = useState(false)
  const [modelLoading, setModelLoading] = useState(false)
  const [creatingAppKey, setCreatingAppKey] = useState(false)
  const [creatingModelKey, setCreatingModelKey] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [viewingKey, setViewingKey] = useState('')
  const [renaming, setRenaming] = useState<{ kind: 'api-keys' | 'model-keys'; id: string; name: string } | null>(null)
  const [renameName, setRenameName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [apiKeyLimit, setApiKeyLimit] = useState(0)
  const [appForm] = Form.useForm()
  const [modelForm] = Form.useForm()

  useEffect(() => {
    if (!open) return
    let active = true
    async function loadAppKeys() {
      setAppLoading(true)
      try {
        const data = await requestJson<ApiKeyListResponse>('/api/user/api-keys')
        if (!active) return
        setAppKeys(Array.isArray(data.api_keys) ? data.api_keys : [])
        setApiKeyLimit(Number(data.api_key_limit_per_user ?? 0))
      } catch (error) {
        if (!active) return
        appMessage.error(error instanceof Error ? error.message : '加载应用 API Key 列表失败')
      } finally {
        if (active) setAppLoading(false)
      }
    }

    async function loadModelKeys() {
      setModelLoading(true)
      try {
        const data = await requestJson<{ ok: boolean; items: ModelKeyInfo[] }>('/api/user/model-keys')
        if (!active) return
        setModelKeys(Array.isArray(data.items) ? data.items : [])
      } catch (error) {
        if (!active) return
        appMessage.error(error instanceof Error ? error.message : '加载模型 Key 列表失败')
      } finally {
        if (active) setModelLoading(false)
      }
    }

    void loadAppKeys()
    void loadModelKeys()
    return () => { active = false }
  }, [open])

  function startRename(kind: 'api-keys' | 'model-keys', item: { id: string; name: string }) {
    setRenaming({ kind, ...item })
    setRenameName(item.name)
  }

  async function saveName() {
    if (!renaming || !renameName.trim()) return
    setSavingName(true)
    try {
      const data = await requestJson<{ name: string }>(`/api/user/${renaming.kind}/${renaming.id}`, { method: 'PATCH', body: JSON.stringify({ name: renameName.trim() }) })
      const update = <T extends { id: string; name: string }>(items: T[]) => items.map((item) => item.id === renaming.id ? { ...item, name: data.name } : item)
      if (renaming.kind === 'api-keys') setAppKeys(update)
      else setModelKeys(update)
      setRenaming(null)
      appMessage.success('名称已更新')
    } catch (error) { appMessage.error(error instanceof Error ? error.message : '改名失败') }
    finally { setSavingName(false) }
  }

  async function handleCreateAppKey(values: { name: string }) {
    if (apiKeyLimit > 0 && appKeys.length >= apiKeyLimit) {
      appMessage.warning(`当前账号最多只能创建 ${apiKeyLimit} 个 API Key`)
      return
    }
    setCreatingAppKey(true)
    try {
      const data = await requestJson<{ ok: boolean; api_key: ApiKeyInfo & { api_key?: string } }>('/api/user/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
        }),
      })
      setAppKeys((prev) => [...prev, data.api_key])
      appForm.resetFields()
      if (data.api_key.api_key) {
        void navigator.clipboard?.writeText(data.api_key.api_key).catch(() => {})
        appMessage.success('应用 API Key 已创建，明文已复制到剪贴板')
      } else {
        appMessage.success('应用 API Key 已创建')
      }
    } catch (error) {
      appMessage.error(error instanceof Error ? error.message : '创建应用 API Key 失败')
    } finally {
      setCreatingAppKey(false)
    }
  }

  async function handleCreateModelKey(values: { name: string; key?: string }) {
    setCreatingModelKey(true)
    try {
      const data = await requestJson<{ ok: boolean; model_key: ModelKeyInfo & { api_key?: string } }>('/api/user/model-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          key: values.key,
        }),
      })
      setModelKeys((prev) => [...prev, data.model_key])
      modelForm.resetFields()
      if (data.model_key.api_key) {
        void navigator.clipboard?.writeText(data.model_key.api_key).catch(() => {})
        appMessage.success('模型 Key 已创建，明文已复制到剪贴板')
      } else {
        appMessage.success('模型 Key 已创建')
      }
    } catch (error) {
      appMessage.error(error instanceof Error ? error.message : '创建模型 Key 失败')
    } finally {
      setCreatingModelKey(false)
    }
  }

  async function handleDeleteAppKey(keyId: string) {
    setDeletingId(keyId)
    try {
      await requestJson(`/api/user/api-keys/${keyId}`, { method: 'DELETE' })
      setAppKeys((prev) => prev.filter((k) => k.id !== keyId))
      appMessage.success('应用 API Key 已删除')
    } catch (error) {
      appMessage.error(error instanceof Error ? error.message : '删除应用 API Key 失败')
    } finally {
      setDeletingId('')
    }
  }

  async function handleDeleteModelKey(keyId: string) {
    setDeletingId(keyId)
    try {
      await requestJson(`/api/user/model-keys/${keyId}`, { method: 'DELETE' })
      setModelKeys((prev) => prev.filter((k) => k.id !== keyId))
      appMessage.success('模型 Key 已删除')
    } catch (error) {
      appMessage.error(error instanceof Error ? error.message : '删除模型 Key 失败')
    } finally {
      setDeletingId('')
    }
  }

  async function copyKey(kind: 'api-keys' | 'model-keys', keyId: string) {
    try {
      const data = await requestJson<{ api_key: string }>(`/api/user/${kind}/${keyId}/secret`)
      await copyText(data.api_key)
      appMessage.success('API Key 已复制')
    } catch (error) {
      appMessage.error(error instanceof Error ? error.message : '复制 API Key 失败')
    }
  }

  async function viewKey(kind: 'api-keys' | 'model-keys', keyId: string) {
    try {
      const data = await requestJson<{ api_key: string }>(`/api/user/${kind}/${keyId}/secret`)
      setViewingKey(data.api_key)
    } catch (error) {
      appMessage.error(error instanceof Error ? error.message : '查看 API Key 失败')
    }
  }

  function copyText(text: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text)
    }
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
    } catch {
      // ignore
    }
    document.body.removeChild(ta)
    return Promise.resolve()
  }

  const appKeyColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', render: (v: string) => v || '-' },
    {
      title: 'Key 前缀',
      dataIndex: 'key_prefix',
      key: 'key_prefix',
      render: (v: string) => (
        <Typography.Text style={{ fontFamily: 'monospace' }}>{v || '-'}</Typography.Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: ApiKeyInfo) => (
        <><Button type="text" onClick={() => startRename('api-keys', record)}>改名</Button><Button type="text" onClick={() => viewKey('api-keys', record.id)}>查看</Button><Button type="text" icon={<CopyOutlined />} onClick={() => copyKey('api-keys', record.id)}>复制</Button><Popconfirm
          title="确定删除该应用 API Key？"
          onConfirm={() => handleDeleteAppKey(record.id)}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            loading={deletingId === record.id}
          >
            删除
          </Button>
        </Popconfirm></>
      ),
    },
  ]

  const modelKeyColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', render: (v: string) => v || '-' },
    {
      title: 'Key 前缀',
      dataIndex: 'key_prefix',
      key: 'key_prefix',
      render: (v: string) => <Typography.Text style={{ fontFamily: 'monospace' }}>{v || '-'}</Typography.Text>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: ModelKeyInfo) => (
        <><Button type="text" onClick={() => startRename('model-keys', record)}>改名</Button><Button type="text" onClick={() => viewKey('model-keys', record.id)}>查看</Button><Button type="text" icon={<CopyOutlined />} onClick={() => copyKey('model-keys', record.id)}>复制</Button><Popconfirm
          title="确定删除该模型 Key？"
          onConfirm={() => handleDeleteModelKey(record.id)}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            loading={deletingId === record.id}
          >
            删除
          </Button>
        </Popconfirm></>
      ),
    },
  ]

  return (
    <>
    <Alert type="info" showIcon message="接入 Agent：创建并复制模型 Key，API 格式选择 OpenAI Chat Completions，模型名可填 human-assistant。" action={<Button size="small" onClick={() => setGuideOpen(true)}>查看教程</Button>} style={{ marginBottom: 16 }} />
    <Tabs
      items={[
        {
          key: 'model-keys',
          label: '模型 Key',
          children: (
            <div className="api-key-management-panel">
              <div className="api-key-management-header"><Typography.Text className="api-key-management-subtitle">用于 Agent 请求本站。模型名填写 human-assistant 即可，无需注册模型。</Typography.Text><Button type="primary" icon={<PlusOutlined />} onClick={() => modelForm.submit()}>新建模型 Key</Button></div>
              <Form form={modelForm} layout="vertical" onFinish={handleCreateModelKey} className="api-key-management-form">
                <Form.Item name="name" label="名称"><Input placeholder="例如 default, workspace, agent" allowClear /></Form.Item>
                <Form.Item name="key" label="Key"><Input placeholder="留空自动生成，或手动填写" addonAfter={<Button type="text" icon={<ReloadOutlined />} aria-label="生成随机 Key" onClick={() => modelForm.setFieldValue('key', `sk-${crypto.randomUUID()}`)} />} /></Form.Item>
                <Form.Item><Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={creatingModelKey}>创建</Button></Form.Item>
              </Form>
              <Table className="api-key-management-table" columns={modelKeyColumns} dataSource={modelKeys} rowKey="id" loading={modelLoading} pagination={false} size="small" />
            </div>
          ),
        },
        {
          key: 'app-keys',
          label: '应用 API Key',
          children: (
            <div className="api-key-management-panel">
              <div className="api-key-management-header">
                <Typography.Text className="api-key-management-subtitle">
                  管理应用 API Key，用于读写自己的 ChatAPI、规则和请求数据。
                  {apiKeyLimit > 0 ? ` 已使用 ${appKeys.length} / ${apiKeyLimit}。` : ' 当前不限制数量。'}
                </Typography.Text>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => appForm.submit()}
                  disabled={apiKeyLimit > 0 && appKeys.length >= apiKeyLimit}
                >
                  新建应用 Key
                </Button>
              </div>

              <Form form={appForm} layout="vertical" onFinish={handleCreateAppKey} className="api-key-management-form">
                <Form.Item name="name" label="名称">
                  <Input placeholder="例如 n8n、本地调试、CI" allowClear />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={creatingAppKey}>
                    创建
                  </Button>
                </Form.Item>
              </Form>

              <Table
                className="api-key-management-table"
                columns={appKeyColumns}
                dataSource={appKeys}
                rowKey="id"
                loading={appLoading}
                pagination={false}
                size="small"
              />
            </div>
          ),
        },
      ]}
    />
    <Modal open={guideOpen} title="接入 Agent" onCancel={() => setGuideOpen(false)} footer={null} width={880} destroyOnHidden>
      <AgentGuide />
    </Modal>
    <Modal open={renaming !== null} title="修改密钥备注名" onCancel={() => { if (!savingName) setRenaming(null) }} onOk={() => void saveName()} confirmLoading={savingName} okButtonProps={{ disabled: !renameName.trim() }} okText="保存" cancelText="取消" destroyOnHidden>
      <Typography.Paragraph>只修改备注名，现有密钥仍可继续使用。</Typography.Paragraph>
      <Input autoFocus value={renameName} onChange={(event) => setRenameName(event.target.value)} maxLength={100} showCount disabled={savingName} onPressEnter={() => { if (!savingName) void saveName() }} />
    </Modal>
    <Modal open={viewingKey !== ''} title="完整 API Key" onCancel={() => setViewingKey('')} footer={null} width={640}>
      <Typography.Text copyable style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: 15 }}>{viewingKey}</Typography.Text>
    </Modal>
    </>
  )
}
