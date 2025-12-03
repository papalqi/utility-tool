/**
 * 快捷链接卡片组件
 * 支持添加、编辑、删除常用网址，点击快速打开
 */

import React, { useState, useEffect } from 'react'
import {
  Card,
  Space,
  Button,
  Modal,
  Form,
  Input,
  List,
  Typography,
  Popconfirm,
  Empty,
  Tooltip,
} from 'antd'
import {
  LinkOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  GlobalOutlined,
} from '@ant-design/icons'
import { useTheme } from '@/contexts/ThemeContext'

const { Text } = Typography

interface QuickLink {
  id: string
  title: string
  url: string
  icon?: string
  color?: string
  description?: string
}

const STORAGE_KEY = 'quick_links'

// 默认快捷链接
const DEFAULT_LINKS: QuickLink[] = [
  {
    id: '1',
    title: 'GitHub',
    url: 'https://github.com',
    icon: '🐙',
    color: '#333',
    description: 'Code hosting platform',
  },
  {
    id: '2',
    title: 'Stack Overflow',
    url: 'https://stackoverflow.com',
    icon: '📚',
    color: '#f48024',
    description: 'Q&A for developers',
  },
  {
    id: '3',
    title: 'MDN',
    url: 'https://developer.mozilla.org',
    icon: '📖',
    color: '#0066cc',
    description: 'Web docs',
  },
]

const QuickLinksCard: React.FC = () => {
  const { colors } = useTheme()
  const [links, setLinks] = useState<QuickLink[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null)
  const [form] = Form.useForm()

  // 加载链接
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setLinks(JSON.parse(stored))
      } catch {
        setLinks(DEFAULT_LINKS)
      }
    } else {
      setLinks(DEFAULT_LINKS)
    }
  }, [])

  // 保存链接
  const saveLinks = (newLinks: QuickLink[]) => {
    setLinks(newLinks)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLinks))
  }

  // 打开链接
  const openLink = async (url: string) => {
    try {
      await window.electronAPI.openExternal(url)
    } catch (error) {
      console.error('Failed to open link:', error)
    }
  }

  // 添加/编辑链接
  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const newLink: QuickLink = {
        id: editingLink?.id || Date.now().toString(),
        title: values.title,
        url: values.url,
        icon: values.icon || '🔗',
        color: values.color || colors.primary,
        description: values.description || '',
      }

      if (editingLink) {
        // 编辑
        saveLinks(links.map((link) => (link.id === editingLink.id ? newLink : link)))
      } else {
        // 添加
        saveLinks([...links, newLink])
      }

      setIsModalOpen(false)
      setEditingLink(null)
      form.resetFields()
    })
  }

  // 删除链接
  const handleDelete = (id: string) => {
    saveLinks(links.filter((link) => link.id !== id))
  }

  // 打开编辑对话框
  const handleEdit = (link: QuickLink) => {
    setEditingLink(link)
    form.setFieldsValue(link)
    setIsModalOpen(true)
  }

  // 打开添加对话框
  const handleAdd = () => {
    setEditingLink(null)
    form.resetFields()
    setIsModalOpen(true)
  }

  const cardStyle: React.CSSProperties = {
    background: colors.bgSecondary,
    border: `1px solid ${colors.borderPrimary}`,
    borderRadius: 16,
    height: '100%',
  }

  return (
    <>
      <Card
        style={cardStyle}
        variant="borderless"
        title={
          <Space>
            <GlobalOutlined style={{ color: colors.primary }} />
            <Text strong>快捷链接</Text>
          </Space>
        }
        extra={
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={handleAdd}>
            添加
          </Button>
        }
      >
        {links.length > 0 ? (
          <List
            dataSource={links}
            renderItem={(link) => (
              <List.Item
                style={{
                  padding: '8px 0',
                  borderBottom: `1px solid ${colors.borderPrimary}`,
                  cursor: 'pointer',
                }}
                actions={[
                  <Tooltip title="编辑" key="edit">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(link)
                      }}
                    />
                  </Tooltip>,
                  <Popconfirm
                    title="确定删除这个链接吗？"
                    onConfirm={(e) => {
                      e?.stopPropagation()
                      handleDelete(link.id)
                    }}
                    okText="删除"
                    cancelText="取消"
                    key="delete"
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>,
                ]}
                onClick={() => openLink(link.url)}
              >
                <List.Item.Meta
                  avatar={
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: link.color || colors.bgTertiary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                      }}
                    >
                      {link.icon || '🔗'}
                    </div>
                  }
                  title={
                    <Space>
                      <Text strong style={{ color: colors.textPrimary }}>
                        {link.title}
                      </Text>
                      <LinkOutlined style={{ fontSize: 12, color: colors.textSecondary }} />
                    </Space>
                  }
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: link.url }}>
                      {link.description || link.url}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无快捷链接" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      <Modal
        title={editingLink ? '编辑链接' : '添加链接'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalOpen(false)
          setEditingLink(null)
          form.resetFields()
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="标题"
            name="title"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="例如：GitHub" />
          </Form.Item>

          <Form.Item
            label="网址"
            name="url"
            rules={[
              { required: true, message: '请输入网址' },
              { type: 'url', message: '请输入有效的网址' },
            ]}
          >
            <Input placeholder="https://example.com" />
          </Form.Item>

          <Form.Item label="图标" name="icon" tooltip="输入一个 Emoji 作为图标">
            <Input placeholder="🔗" maxLength={2} />
          </Form.Item>

          <Form.Item label="颜色" name="color" tooltip="图标背景颜色（十六进制）">
            <Input placeholder="#1890ff" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="简短描述（可选）" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default QuickLinksCard
