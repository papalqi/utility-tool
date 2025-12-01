import React from 'react'
import {
  Card,
  Space,
  Typography,
  Button,
  Tag,
  Divider,
  Descriptions,
  Row,
  Col,
  Statistic,
} from 'antd'
import {
  PlusOutlined,
  CloseOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { AttachmentThumbnail } from '@/components/AttachmentThumbnail'
import { PomodoroWidget } from '@/pages/PomodoroWidget'
import type { TodoItem } from '@/shared/types'
import type { TodoStats } from '../types'
import { useTheme } from '@/contexts/ThemeContext'
import { motion } from 'framer-motion'

const { Text, Paragraph, Title } = Typography

interface TodoDetailsPanelProps {
  selectedTodo: TodoItem | null
  stats: TodoStats
  syncStatus: string
  isEnabled: boolean
  onAddSubtask: () => void
  onClose?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export const TodoDetailsPanel: React.FC<TodoDetailsPanelProps> = ({
  selectedTodo,
  stats,
  onAddSubtask,
  onClose,
  onEdit,
  onDelete,
}) => {
  const { colors } = useTheme()

  const getPriorityTag = (p?: string) => {
    if (p === 'high') return <Tag color="error">High Priority</Tag>
    if (p === 'low') return <Tag color="processing">Low Priority</Tag>
    return <Tag color="warning">Medium Priority</Tag>
  }

  if (!selectedTodo) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: colors.textSecondary }}>
        Select a task to view details
      </div>
    )
  }

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {/* Pomodoro Timer - 放在顶部 */}
      <PomodoroWidget linkedTask={selectedTodo} compact />

      <Card
        style={{ background: colors.bgSecondary, border: `1px solid ${colors.borderPrimary}` }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Task Details</span>
            <Button type="text" icon={<CloseOutlined />} onClick={onClose} size="small" />
          </div>
        }
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header Info */}
          <div>
            <Title level={4} style={{ marginTop: 0 }}>
              {selectedTodo.text}
            </Title>
            <Space wrap size={[4, 4]}>
              {getPriorityTag(selectedTodo.priority)}
              <Tag>{selectedTodo.category || 'Default'}</Tag>
              <Tag color={selectedTodo.done ? 'success' : 'default'}>
                {selectedTodo.done ? '✓' : '○'}
              </Tag>
            </Space>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          {/* Meta Data */}
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Created">
              {new Date(selectedTodo.createdAt).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Updated">
              {new Date(selectedTodo.updatedAt).toLocaleString()}
            </Descriptions.Item>
            {selectedTodo.tags && selectedTodo.tags.length > 0 && (
              <Descriptions.Item label="Tags">
                <Space size={4}>
                  {selectedTodo.tags.map((tag) => (
                    <Tag key={tag}>#{tag}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* Content */}
          {(selectedTodo.note || selectedTodo.conclusion) && (
            <div style={{ background: colors.bgTertiary, padding: 12, borderRadius: 8 }}>
              {selectedTodo.note && (
                <div style={{ marginBottom: selectedTodo.conclusion ? 12 : 0 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    NOTE
                  </Text>
                  <Paragraph style={{ margin: 0 }}>{selectedTodo.note}</Paragraph>
                </div>
              )}
              {selectedTodo.conclusion && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    CONCLUSION
                  </Text>
                  <Paragraph style={{ margin: 0 }}>{selectedTodo.conclusion}</Paragraph>
                </div>
              )}
            </div>
          )}

          {/* Attachments */}
          {selectedTodo.attachments && selectedTodo.attachments.length > 0 && (
            <div>
              <Text strong>Attachments</Text>
              <div style={{ marginTop: 8 }}>
                <AttachmentThumbnail attachments={selectedTodo.attachments} maxDisplay={10} />
              </div>
            </div>
          )}

          {/* Actions */}
          <Space wrap>
            <Button icon={<EditOutlined />} onClick={onEdit}>
              Edit
            </Button>
            <Button icon={<PlusOutlined />} onClick={onAddSubtask}>
              Subtask
            </Button>
            <Button icon={<DeleteOutlined />} danger onClick={onDelete}>
              Delete
            </Button>
          </Space>
        </Space>
      </Card>

      <Card size="small" title="Statistics" style={{ background: 'transparent', border: 'none' }}>
        <Row gutter={16}>
          <Col span={12}>
            <Statistic title="Pending" value={stats.active} valueStyle={{ fontSize: 16 }} />
          </Col>
          <Col span={12}>
            <Statistic
              title="Completed"
              value={stats.completed}
              valueStyle={{ fontSize: 16, color: colors.success }}
            />
          </Col>
        </Row>
      </Card>
    </motion.div>
  )
}
