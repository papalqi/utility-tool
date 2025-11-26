import React from 'react'
import { Button, Space } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  RobotOutlined,
  ImportOutlined,
} from '@ant-design/icons'

interface TodoActionBarProps {
  isEnabled: boolean
  aiLoading: boolean
  hasAiProvider: boolean
  onAdd: () => void
  onEdit: () => void
  onDelete: () => void
  onAiParse: () => void
  onMigrateLastWeek: () => void
}

export const TodoActionBar: React.FC<TodoActionBarProps> = ({
  isEnabled,
  aiLoading,
  hasAiProvider,
  onAdd,
  onEdit,
  onDelete,
  onAiParse,
  onMigrateLastWeek,
}) => {
  return (
    <Space style={{ marginBottom: '16px' }} wrap>
      <Button icon={<PlusOutlined />} type="primary" onClick={onAdd} disabled={!isEnabled}>
        新增
      </Button>
      <Button icon={<EditOutlined />} onClick={onEdit} disabled={!isEnabled}>
        编辑
      </Button>
      <Button icon={<DeleteOutlined />} danger onClick={onDelete} disabled={!isEnabled}>
        删除
      </Button>
      <Button
        icon={<RobotOutlined />}
        onClick={onAiParse}
        disabled={!isEnabled || !hasAiProvider}
        loading={aiLoading}
      >
        AI 解析剪贴板
      </Button>
      <Button icon={<ImportOutlined />} onClick={onMigrateLastWeek} disabled={!isEnabled}>
        迁移上周任务
      </Button>
    </Space>
  )
}
