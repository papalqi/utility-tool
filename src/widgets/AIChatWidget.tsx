import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Input, List, Select, Space, Typography, App, Empty } from 'antd'
import {
  SendOutlined,
  DeleteOutlined,
  RobotOutlined,
  ReloadOutlined,
  ApiOutlined,
} from '@ant-design/icons'
import { WidgetLayout, WidgetSection } from '@/components/widgets'
import { useWidget } from '@/hooks/useWidget'
import type { GenericAIConfig, AIChatMessage } from '@/shared/ai'
import type { WidgetMetadata } from '@/shared/widget-types'
import { obsidianManager } from '@/core/ObsidianManager'
import aiClient from '@/services/aiClient'

const { TextArea } = Input
const { Text, Paragraph } = Typography

const metadata: WidgetMetadata = {
  id: 'ai-chat',
  displayName: 'AI 对话',
  icon: <RobotOutlined />,
  description: '使用通用 AI 配置进行即时对话',
  category: 'tools',
  order: 5,
  enabled: true,
}

interface ChatEntry extends AIChatMessage {
  id: string
}

const createMessageId = () =>
  window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random()}`

export const AIChatWidget: React.FC = () => {
  const { message } = App.useApp()
  const { state, setError, setStatus } = useWidget({ metadata })
  const [configs, setConfigs] = useState<GenericAIConfig[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<string>()
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([])
  const [input, setInput] = useState('')
  const [loadingConfigs, setLoadingConfigs] = useState(false)
  const [sending, setSending] = useState(false)

  const loadConfigs = useCallback(async () => {
    try {
      setLoadingConfigs(true)
      const entries = await obsidianManager.getGenericAIConfigs()
      const enabled = entries.filter((cfg) => cfg.enabled !== false)
      setConfigs(enabled)
      if (!selectedConfigId && enabled.length > 0) {
        setSelectedConfigId(enabled[0].id)
      }
      setStatus(enabled.length ? `已加载 ${enabled.length} 个 AI 配置` : '未找到通用 AI 配置')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setError(errorMessage)
      message.error(`读取配置失败：${errorMessage}`)
    } finally {
      setLoadingConfigs(false)
    }
  }, [message, selectedConfigId, setError, setStatus])

  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  const selectedConfig = useMemo(
    () => configs.find((cfg) => cfg.id === selectedConfigId),
    [configs, selectedConfigId]
  )

  const normalizedMessages = useMemo(
    () =>
      chatHistory.map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
    [chatHistory]
  )

  const appendMessage = useCallback((messageEntry: AIChatMessage) => {
    setChatHistory((prev) => [...prev, { ...messageEntry, id: createMessageId() }])
  }, [])

  const handleSend = useCallback(async () => {
    if (!input.trim()) {
      message.warning('请输入需要发送的内容')
      return
    }
    if (!selectedConfig) {
      message.warning('请先选择一个 AI 配置')
      return
    }

    const userMessage: AIChatMessage = { role: 'user', content: input.trim() }
    appendMessage(userMessage)
    setInput('')

    try {
      setSending(true)
      const payload = [...normalizedMessages, userMessage]
      const result = await aiClient.chatCompletion({
        config: selectedConfig,
        messages: payload,
        feature: 'AI 对话',
      })
      appendMessage({ role: 'assistant', content: result.content })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      message.error(`发送失败：${errorMessage}`)
      appendMessage({
        role: 'assistant',
        content: `⚠️ 对话失败：${errorMessage}`,
      })
    } finally {
      setSending(false)
    }
  }, [appendMessage, input, message, normalizedMessages, selectedConfig])

  const handleClear = useCallback(() => {
    setChatHistory([])
  }, [])

  return (
    <WidgetLayout
      title={metadata.displayName}
      icon={metadata.icon}
      loading={state.loading || loadingConfigs}
      error={state.error}
      actionInProgress={sending}
      showRefresh
      onRefresh={loadConfigs}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <WidgetSection title="选择配置" icon={<ApiOutlined />}>
          <Space>
            <Select
              placeholder="选择 AI 配置"
              style={{ minWidth: 260 }}
              value={selectedConfigId}
              options={configs.map((cfg) => ({
                label: `${cfg.name} (${cfg.provider})`,
                value: cfg.id,
              }))}
              onChange={setSelectedConfigId}
            />
            <Button icon={<ReloadOutlined />} onClick={loadConfigs}>
              刷新
            </Button>
          </Space>
        </WidgetSection>

        <WidgetSection title="对话" icon={<RobotOutlined />}>
          {chatHistory.length === 0 ? (
            <Empty description="发送第一条消息，开始与 AI 对话吧" />
          ) : (
            <List
              dataSource={chatHistory}
              renderItem={(item) => (
                <List.Item key={item.id}>
                  <Card
                    size="small"
                    style={{ width: '100%' }}
                    styles={{
                      body: {
                        background: item.role === 'user' ? '#0f172a' : '#111827',
                        color: '#fff',
                      },
                    }}
                  >
                    <Text strong>{item.role === 'user' ? '你' : 'AI'}</Text>
                    <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap', color: '#fff' }}>
                      {item.content}
                    </Paragraph>
                  </Card>
                </List.Item>
              )}
            />
          )}
        </WidgetSection>

        <WidgetSection title="发送消息">
          <TextArea
            rows={4}
            placeholder="输入要发送的内容..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
          />
          <Space style={{ marginTop: 12 }}>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={sending}
              onClick={handleSend}
              disabled={!selectedConfig}
            >
              发送
            </Button>
            <Button
              icon={<DeleteOutlined />}
              onClick={handleClear}
              disabled={chatHistory.length === 0}
            >
              清空
            </Button>
          </Space>
        </WidgetSection>
      </Space>
    </WidgetLayout>
  )
}

export default AIChatWidget
