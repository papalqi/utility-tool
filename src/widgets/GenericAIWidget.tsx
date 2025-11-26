import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  List,
  Row,
  Select,
  Space,
  Switch,
  Typography,
  App,
  Tag,
} from 'antd'
import {
  ApiOutlined,
  KeyOutlined,
  ThunderboltOutlined,
  SaveOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons'
import { WidgetLayout, WidgetSection } from '@/components/widgets'
import { useWidget } from '@/hooks/useWidget'
import type { WidgetMetadata } from '@/shared/widget-types'
import type { GenericAIConfig } from '@/shared/ai'
import { obsidianManager } from '@/core/ObsidianManager'
import aiClient from '@/services/aiClient'

const { Text, Paragraph } = Typography

const providerOptions = ['OpenAI', 'Anthropic', 'Google', 'Azure', 'DeepSeek', 'Custom']

const metadata: WidgetMetadata = {
  id: 'generic-ai',
  displayName: '通用 AI 配置',
  icon: <ApiOutlined />,
  description: '管理可用于调用的通用 AI API 配置',
  category: 'tools',
  order: 4,
  enabled: true,
}

const DEFAULT_CONFIG: GenericAIConfig = {
  id: '',
  name: '',
  key: '',
  url: '',
  provider: 'OpenAI',
  model: '',
  timeout: 30,
  enabled: true,
}

export const GenericAIWidget: React.FC = () => {
  const { message, modal } = App.useApp()
  const { state, setStatus, setError, widgetLogger } = useWidget({ metadata })
  const [form] = Form.useForm<GenericAIConfig>()
  const [configs, setConfigs] = useState<GenericAIConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setStatus('正在读取 Obsidian 中的 AI 配置...')
      const entries = await obsidianManager.getGenericAIConfigs()
      setConfigs(entries)
      if (entries.length === 0) {
        setStatus('尚未配置任何 AI 提供商')
      } else {
        setStatus(`已加载 ${entries.length} 个 AI 提供商`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setError(errorMessage)
      message.error(`读取 AI 配置失败: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }, [message, setError, setStatus])

  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  const resetForm = useCallback(() => {
    form.resetFields()
    form.setFieldsValue(DEFAULT_CONFIG)
    setEditingId(null)
  }, [form])

  useEffect(() => {
    resetForm()
  }, [resetForm])

  const persistConfigs = useCallback(
    async (nextConfigs: GenericAIConfig[]) => {
      setSaving(true)
      try {
        await obsidianManager.saveGenericAIConfigs(nextConfigs)
        setConfigs(nextConfigs)
        setStatus(`已保存 ${nextConfigs.length} 个配置`)
        widgetLogger.info('Generic AI configs saved', { count: nextConfigs.length })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        setError(errorMessage)
        message.error(`保存失败：${errorMessage}`)
        throw error
      } finally {
        setSaving(false)
      }
    },
    [message, setError, setStatus, widgetLogger]
  )

  const handleSubmit = useCallback(
    async (values: GenericAIConfig) => {
      const configId = values.id?.trim() || values.name.trim()
      if (!configId) {
        message.warning('请填写配置ID或名称')
        return
      }

      const normalized: GenericAIConfig = {
        ...DEFAULT_CONFIG,
        ...values,
        id: configId,
        name: values.name.trim() || configId,
        url: values.url?.trim(),
        model: values.model?.trim(),
        timeout: values.timeout || 30,
        enabled: values.enabled !== false,
      }

      if (!normalized.key) {
        message.warning('API Key 不能为空')
        return
      }

      const next = [...configs]
      const existingIndex = next.findIndex((item) => item.id === normalized.id)
      if (existingIndex >= 0) {
        next[existingIndex] = normalized
      } else {
        next.push(normalized)
      }

      await persistConfigs(next)
      resetForm()
      message.success(existingIndex >= 0 ? '配置已更新' : '配置已添加')
    },
    [configs, message, persistConfigs, resetForm]
  )

  const handleEdit = useCallback(
    (config: GenericAIConfig) => {
      setEditingId(config.id)
      form.setFieldsValue(config)
    },
    [form]
  )

  const handleDelete = useCallback(
    (config: GenericAIConfig) => {
      modal.confirm({
        title: `确认删除 ${config.name}?`,
        content: '此操作会从 Obsidian secrets 文件中移除该配置，且无法恢复。',
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          const next = configs.filter((item) => item.id !== config.id)
          await persistConfigs(next)
          if (editingId === config.id) {
            resetForm()
          }
          message.success('配置已删除')
        },
      })
    },
    [configs, editingId, message, modal, persistConfigs, resetForm]
  )

  const handleTest = useCallback(
    async (config: GenericAIConfig) => {
      try {
        setTestingId(config.id)
        const result = await aiClient.testConnection(config)
        if (result.success) {
          message.success(`连接成功，延迟 ${result.latency.toFixed(0)} ms`)
        } else {
          message.error(`连接失败：${result.error || '未知错误'}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        message.error(`连接失败：${errorMessage}`)
      } finally {
        setTestingId(null)
      }
    },
    [message]
  )

  const currentEditingTitle = useMemo(() => (editingId ? '编辑配置' : '添加配置'), [editingId])

  return (
    <WidgetLayout
      title={metadata.displayName}
      icon={metadata.icon}
      loading={state.loading || loading}
      error={state.error}
      onRefresh={loadConfigs}
      showRefresh
      actionInProgress={saving}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <WidgetSection title="配置列表" icon={<KeyOutlined />}>
          {configs.length === 0 ? (
            <Paragraph type="secondary">暂无配置，右侧表单可添加新的 AI 提供商。</Paragraph>
          ) : (
            <List
              grid={{ gutter: 16, column: 2 }}
              dataSource={configs}
              renderItem={(item) => (
                <List.Item key={item.id}>
                  <Card
                    title={
                      <Space>
                        {item.name}
                        <Tag color={item.enabled === false ? 'red' : 'green'}>
                          {item.enabled === false ? '禁用' : '启用'}
                        </Tag>
                      </Space>
                    }
                    extra={<Text type="secondary">{item.provider}</Text>}
                    actions={[
                      <Button
                        key="test"
                        icon={<ThunderboltOutlined />}
                        loading={testingId === item.id}
                        onClick={() => handleTest(item)}
                        type="link"
                      >
                        测试连接
                      </Button>,
                      <Button
                        key="edit"
                        icon={<EditOutlined />}
                        type="link"
                        onClick={() => handleEdit(item)}
                      >
                        编辑
                      </Button>,
                      <Button
                        key="delete"
                        icon={<DeleteOutlined />}
                        type="link"
                        danger
                        onClick={() => handleDelete(item)}
                      >
                        删除
                      </Button>,
                    ]}
                  >
                    <Paragraph>
                      <Text type="secondary">模型:</Text> {item.model || '未设置'}
                    </Paragraph>
                    <Paragraph>
                      <Text type="secondary">端点:</Text> {item.url || '默认'}
                    </Paragraph>
                    <Paragraph>
                      <Text type="secondary">超时:</Text> {item.timeout || 30} 秒
                    </Paragraph>
                    <Paragraph>
                      <Text type="secondary">配置 ID:</Text> {item.id}
                    </Paragraph>
                  </Card>
                </List.Item>
              )}
            />
          )}
        </WidgetSection>

        <WidgetSection title={currentEditingTitle} icon={<SaveOutlined />}>
          <Form
            form={form}
            layout="vertical"
            initialValues={DEFAULT_CONFIG}
            onFinish={handleSubmit}
            autoComplete="off"
          >
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="配置 ID" name="id" tooltip="用于引用配置的唯一 ID">
                  <Input placeholder="例如：openai-main" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="显示名称"
                  name="name"
                  rules={[{ required: true, message: '请输入名称' }]}
                >
                  <Input placeholder="OpenAI 主账号" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="API Key"
                  name="key"
                  rules={[{ required: true, message: '请输入 API Key' }]}
                >
                  <Input.Password placeholder="sk-..." />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="提供商" name="provider" initialValue="OpenAI">
                  <Select options={providerOptions.map((name) => ({ label: name, value: name }))} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="模型名称" name="model">
                  <Input placeholder="gpt-4o, claude-3, gemini-pro..." />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="端点 URL" name="url">
                  <Input placeholder="留空使用默认端点" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="超时时间 (秒)" name="timeout" initialValue={30}>
                  <InputNumber min={5} max={300} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="是否启用" name="enabled" valuePropName="checked" initialValue>
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
              </Col>
            </Row>

            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                {editingId ? '更新配置' : '添加配置'}
              </Button>
              {editingId && (
                <Button icon={<ReloadOutlined />} onClick={resetForm}>
                  取消编辑
                </Button>
              )}
            </Space>
          </Form>
        </WidgetSection>
      </Space>
    </WidgetLayout>
  )
}

export default GenericAIWidget
