import React from 'react'
import { Modal, Space, Select, Input, Typography } from 'antd'
import type { GenericAIConfig } from '@/shared/ai'
import type { AIParserConfig } from '@/shared/types'

const { Text } = Typography

interface TodoAiClipboardModalProps {
  visible: boolean
  aiProviders: GenericAIConfig[]
  selectedProviderId?: string
  aiParsingConfig: AIParserConfig
  aiClipboardText: string
  loading: boolean
  onProviderChange: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export const TodoAiClipboardModal: React.FC<TodoAiClipboardModalProps> = ({
  visible,
  aiProviders,
  selectedProviderId,
  aiParsingConfig,
  aiClipboardText,
  loading,
  onProviderChange,
  onCancel,
  onConfirm,
}) => {
  return (
    <Modal
      open={visible}
      title="使用 AI 解析剪贴板内容"
      okText="开始解析"
      cancelText="取消"
      onCancel={onCancel}
      onOk={onConfirm}
      confirmLoading={loading}
      destroyOnHidden
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Select
          placeholder="选择 AI 提供商"
          value={selectedProviderId}
          onChange={onProviderChange}
          options={aiProviders.map((cfg) => ({
            label: `${cfg.name} (${cfg.provider})`,
            value: cfg.id,
          }))}
        />
        <Text type="secondary">模板：{aiParsingConfig.prompt_template_path}</Text>
        <Text type="secondary">
          将截取前 {aiParsingConfig.max_clipboard_length.toLocaleString()} 字符，当前{' '}
          {aiClipboardText.length.toLocaleString()} 字符
        </Text>
        <Input.TextArea rows={6} value={aiClipboardText.slice(0, 2000)} readOnly />
      </Space>
    </Modal>
  )
}
