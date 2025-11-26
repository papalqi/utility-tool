import React from 'react'
import {
  Modal,
  Card,
  Checkbox,
  Input,
  Select,
  Radio,
  DatePicker,
  Space,
  Typography,
  Collapse,
} from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import type { TodoItem } from '@/shared/types'

const { TextArea } = Input

export interface TodoAISuggestion extends TodoItem {
  selected: boolean
  /** Display-only depth captured from AI parsing */
  indentLevel?: number
}

interface TodoAIPreviewModalProps {
  visible: boolean
  items: TodoAISuggestion[]
  categories: string[]
  onItemsChange: (items: TodoAISuggestion[]) => void
  onCancel: () => void
  onConfirm: () => void
  loading?: boolean
}

const priorityOptions = [
  { label: '高', value: 'high' },
  { label: '普通', value: 'medium' },
  { label: '低', value: 'low' },
]

export const TodoAIPreviewModal: React.FC<TodoAIPreviewModalProps> = ({
  visible,
  items,
  categories,
  onItemsChange,
  onCancel,
  onConfirm,
  loading,
}) => {
  const updateItem = (id: string, updates: Partial<TodoAISuggestion>) => {
    const next = items.map((item) => (item.id === id ? { ...item, ...updates } : item))
    onItemsChange(next)
  }

  const renderDueDate = (value?: number | string | null) => {
    if (!value) return null
    return typeof value === 'string' ? dayjs(value) : dayjs(value)
  }

  const formatDueDate = (value: Dayjs | null) => {
    if (!value) return undefined
    return value.format('YYYY-MM-DD')
  }

  return (
    <Modal
      open={visible}
      title="AI 解析结果预览"
      onCancel={onCancel}
      onOk={onConfirm}
      okText="添加到 TODO"
      cancelText="取消"
      width={720}
      confirmLoading={loading}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Typography.Text type="secondary">使用 Tab 键 (⇥) 表示子任务层级</Typography.Text>
        {items.map((item, index) => (
          <div key={item.id} style={{ paddingLeft: (item.indentLevel ?? 0) * 24 }}>
            <Card
              size="small"
              title={
                <Space align="center">
                  <Checkbox
                    checked={item.selected}
                    onChange={(e) => updateItem(item.id, { selected: e.target.checked })}
                  >
                    TODO {index + 1}
                  </Checkbox>
                </Space>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Input
                  value={item.text}
                  placeholder="任务内容"
                  onChange={(e) => updateItem(item.id, { text: e.target.value })}
                />
                <Space wrap>
                  <Select
                    value={item.category || '默认'}
                    style={{ width: 160 }}
                    onChange={(value) => updateItem(item.id, { category: value })}
                    options={[
                      { label: '默认', value: '默认' },
                      ...categories
                        .filter((cat) => cat !== '默认')
                        .map((cat) => ({ label: cat, value: cat })),
                    ]}
                  />
                  <Radio.Group
                    value={item.priority || 'medium'}
                    options={priorityOptions}
                    optionType="button"
                    onChange={(e) =>
                      updateItem(item.id, { priority: e.target.value as TodoItem['priority'] })
                    }
                  />
                  <DatePicker
                    value={renderDueDate(item.dueDate || null)}
                    onChange={(date) => updateItem(item.id, { dueDate: formatDueDate(date) })}
                    placeholder="截止日期"
                  />
                  <Input
                    style={{ minWidth: 200 }}
                    placeholder="#标签"
                    value={(item.tags || []).map((tag) => `#${tag}`).join(' ')}
                    onChange={(e) => {
                      const tags = e.target.value
                        .split(' ')
                        .map((tag) => tag.trim())
                        .filter(Boolean)
                        .map((tag) => tag.replace(/^#/, ''))
                      updateItem(item.id, { tags })
                    }}
                  />
                </Space>

                {/* 笔记字段 - 显示 AI 提取的额外信息 */}
                {item.note && (
                  <Collapse
                    size="small"
                    items={[
                      {
                        key: 'note',
                        label: (
                          <Space>
                            <Typography.Text type="secondary">📝 笔记</Typography.Text>
                            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                              {item.note.length > 50
                                ? `${item.note.substring(0, 50)}...`
                                : item.note}
                            </Typography.Text>
                          </Space>
                        ),
                        children: (
                          <TextArea
                            value={item.note}
                            placeholder="笔记（资产路径、负责人等额外信息）"
                            autoSize={{ minRows: 2, maxRows: 6 }}
                            onChange={(e) => updateItem(item.id, { note: e.target.value })}
                          />
                        ),
                      },
                    ]}
                  />
                )}

                {/* 结论字段 - 如果有的话 */}
                {item.conclusion && (
                  <Input
                    value={item.conclusion}
                    placeholder="✅ 结论"
                    onChange={(e) => updateItem(item.id, { conclusion: e.target.value })}
                    prefix={<Typography.Text type="secondary">✅</Typography.Text>}
                  />
                )}
              </Space>
            </Card>
          </div>
        ))}
      </Space>
    </Modal>
  )
}

export default TodoAIPreviewModal
