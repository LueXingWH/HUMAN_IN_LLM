import { Form, Input, Modal } from 'antd'
import type { FormInstance } from 'antd'

type UserPasswordModalProps = {
  open: boolean
  username: string
  form: FormInstance<{ password: string; confirmPassword: string }>
  submitting: boolean
  onCancel: () => void
  onSubmit: () => void
}

export function UserPasswordModal({
  open,
  username,
  form,
  submitting,
  onCancel,
  onSubmit,
}: UserPasswordModalProps) {
  return (
    <Modal
      title={`重置密码 - ${username}`}
      open={open}
      onOk={onSubmit}
      onCancel={onCancel}
      confirmLoading={submitting}
      okText="确认修改"
      cancelText="取消"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="password"
          label="新密码"
          rules={[{ required: true, min: 4, message: '密码至少 4 个字符' }]}
        >
          <Input.Password placeholder="请输入新密码" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="确认密码"
          dependencies={['password']}
          rules={[
            { required: true, message: '请确认密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('两次密码输入不一致'))
              },
            }),
          ]}
        >
          <Input.Password placeholder="请再次输入新密码" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
