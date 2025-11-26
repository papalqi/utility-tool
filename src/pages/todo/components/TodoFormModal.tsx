import React from 'react'
import { Modal, Form, Row, Col, Input, Select, Radio, Space, Card, Button } from 'antd'
import {
  PlusOutlined,
  FileImageOutlined,
  FileOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import type { FormInstance } from 'antd/es/form'
import type { TodoFormValues } from '../types'
import type { Attachment } from '@/shared/types'

interface TodoFormModalProps {
  visible: boolean
  isEdit: boolean
  form: FormInstance<TodoFormValues>
  categories: string[]
  attachments: Attachment[]
  onSubmit: () => void
  onCancel: () => void
  onAddAttachment: () => void
  onRemoveAttachment: (index: number) => void
  onPaste: (e: React.ClipboardEvent) => void
}

export const TodoFormModal: React.FC<TodoFormModalProps> = ({
  visible,
  isEdit,
  form,
  categories,
  attachments,
  onSubmit,
  onCancel,
  onAddAttachment,
  onRemoveAttachment,
  onPaste,
}) => {
  return (
    <Modal
      title={isEdit ? '编辑待办事项' : '新增待办事项'}
      open={visible}
      onOk={onSubmit}
      onCancel={onCancel}
      width={600}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onPaste={onPaste}>
        <Form.Item
          label="任务描述"
          name="text"
          rules={[{ required: true, message: '请填写任务描述' }]}
        >
          <Input placeholder="输入任务标题或描述" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="分类" name="category" initialValue="默认">
              <Select>
                {categories.map((cat) => (
                  <Select.Option key={cat} value={cat}>
                    {cat}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="优先级" name="priority" initialValue="medium">
              <Radio.Group>
                <Radio.Button value="high">高</Radio.Button>
                <Radio.Button value="medium">正常</Radio.Button>
                <Radio.Button value="low">低</Radio.Button>
              </Radio.Group>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="标签" name="tags">
          <Input placeholder="多个标签用逗号分隔" />
        </Form.Item>

        <Form.Item label="备注" name="note">
          <Input.TextArea rows={3} placeholder="记录执行中的关键信息" />
        </Form.Item>

        <Form.Item label="结论" name="conclusion">
          <Input.TextArea rows={2} placeholder="收尾总结或结论" />
        </Form.Item>

        <Form.Item label="附件">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button icon={<PlusOutlined />} onClick={onAddAttachment}>
              添加附件
            </Button>
            {attachments.length > 0 && (
              <Space direction="vertical" style={{ width: '100%' }}>
                {attachments.map((att, index) => (
                  <Card
                    key={index}
                    size="small"
                    extra={
                      <Button
                        type="link"
                        danger
                        size="small"
                        onClick={() => onRemoveAttachment(index)}
                      >
                        删除
                      </Button>
                    }
                  >
                    <Space>
                      {att.type === 'image' && <FileImageOutlined />}
                      {att.type === 'video' && <VideoCameraOutlined />}
                      {att.type === 'file' && <FileOutlined />}
                      <span>{att.name}</span>
                    </Space>
                  </Card>
                ))}
              </Space>
            )}
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
