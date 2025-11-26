/**
 * WebArchive Widget - 网页存档与爬虫
 *
 * 功能：
 * 1. 管理网页 URL 列表
 * 2. 定时或手动抓取网页内容
 * 3. 查看抓取的内容（文本、图片、链接等）
 * 4. 数据存储在 config 中
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Button,
  Input,
  Modal,
  Form,
  Select,
  Switch,
  InputNumber,
  message,
  Space,
  Drawer,
  Row,
  Col,
  Statistic,
  Collapse,
  Alert,
} from 'antd'
import {
  GlobalOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  LockOutlined,
  InfoCircleOutlined,
  LoginOutlined,
} from '@ant-design/icons'
import { useWidget } from '@/hooks/useWidget'
import { useWidgetStorage } from '@/hooks/useWidgetStorage'
import { useWidgetActions } from '@/hooks/useWidgetActions'
import { useWidgetConfig } from '@/hooks/useWidgetConfig'
import { WidgetLayout, WidgetSection } from '@/components/widgets'
import type { WidgetMetadata } from '@/shared/widget-types'
import { UrlList } from './WebArchiveWidget/UrlList'
import { ContentViewer } from './WebArchiveWidget/ContentViewer'
import type {
  WebArchiveItem,
  CrawlRequest,
  CrawlResult,
  WebArchiveUIState,
} from './WebArchiveWidget/types'
import type { 
  CheckInRequest, 
  CheckInResult,
  WebArchiveConfig,
  WebArchiveConfigItem,
  WebArchiveRuntimeData,
} from '@/shared/web-archive-types'

const { Search } = Input

// Widget 元数据
const metadata: WidgetMetadata = {
  id: 'web-archive',
  displayName: '网页存档',
  icon: <GlobalOutlined />,
  description: '网页内容抓取、存储和定时更新',
  category: 'tools',
  order: 10,
  enabled: true,
  requiresObsidian: false,
}

/**
 * WebArchive Widget 主组件
 */
export const WebArchiveWidget: React.FC = () => {
  // ========== Hooks ==========
  const { state, widgetLogger } = useWidget({
    metadata,
    lifecycle: {
      onInit: async () => {
        widgetLogger.info('WebArchive Widget initialized')
      },
    },
  })

  // 静态配置（config.toml）
  const { config: webArchiveConfig, updateConfig: updateWebArchiveConfig } = useWidgetConfig<WebArchiveConfig>({
    section: 'web_archive',
    defaultConfig: { items: [] },
  })

  // 运行时数据（localStorage）
  const { value: runtimeData, setValue: setRuntimeData } = useWidgetStorage<Record<string, WebArchiveRuntimeData>>({
    key: 'web-archive-runtime',
    defaultValue: {},
    persist: true,
  })

  // 合并配置和运行时数据
  const items: WebArchiveItem[] = useMemo(() => {
    return webArchiveConfig.items.map(configItem => {
      const runtime = runtimeData[configItem.id] || {
        id: configItem.id,
        status: 'idle' as const,
        updatedAt: Date.now(),
      }
      return {
        ...configItem,
        ...runtime,
      }
    })
  }, [webArchiveConfig.items, runtimeData])

  // 更新配置项
  const setItems = useCallback(async (updater: WebArchiveItem[] | ((prev: WebArchiveItem[]) => WebArchiveItem[])) => {
    const newItems = typeof updater === 'function' ? updater(items) : updater
    
    // 分离配置和运行时数据
    const newConfigItems: WebArchiveConfigItem[] = []
    const newRuntimeData: Record<string, WebArchiveRuntimeData> = { ...runtimeData }
    
    newItems.forEach(item => {
      // 静态配置
      newConfigItems.push({
        id: item.id,
        url: item.url,
        title: item.title,
        description: item.description,
        tags: item.tags,
        crawlMode: item.crawlMode,
        autoRefresh: item.autoRefresh,
        refreshInterval: item.refreshInterval,
        headers: item.headers,
        checkInScriptPath: item.checkInScriptPath,
        autoCheckIn: item.autoCheckIn,
        createdAt: item.createdAt,
      })
      
      // 运行时数据
      newRuntimeData[item.id] = {
        id: item.id,
        lastCrawled: item.lastCrawled,
        status: item.status,
        error: item.error,
        content: item.content,
        lastCheckIn: item.lastCheckIn,
        checkInResult: item.checkInResult,
        updatedAt: item.updatedAt,
      }
    })
    
    // 保存到各自的存储
    await updateWebArchiveConfig({ items: newConfigItems })
    setRuntimeData(newRuntimeData)
  }, [items, runtimeData, updateWebArchiveConfig, setRuntimeData])

  const { value: uiState, setValue: setUIState } = useWidgetStorage<WebArchiveUIState>({
    key: 'web-archive-ui-state',
    defaultValue: {
      selectedId: null,
      searchText: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      viewMode: 'list',
    },
    persist: true,
  })

  const { refresh } = useWidgetActions({
    widgetId: metadata.id,
    onRefresh: async () => {
      widgetLogger.info('Refreshing all auto-refresh items...')
      await handleBatchCrawl(items.filter((item) => item.autoRefresh))
      message.success('刷新完成')
    },
  })

  // ========== Local State ==========
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<WebArchiveItem | null>(null)
  const [viewDrawerVisible, setViewDrawerVisible] = useState(false)
  const [crawling, setCrawling] = useState(false)
  const [form] = Form.useForm()
  const [authType, setAuthType] = useState<'none' | 'cookie' | 'bearer' | 'custom'>('none')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [checkingIn, setCheckingIn] = useState<string | null>(null) // 正在签到的项目 ID

  // 调试：监控 items 变化
  useEffect(() => {
    console.log('[WebArchive] Items changed:', items.length, items)
  }, [items])

  // ========== Computed ==========
  const selectedItem = useMemo(
    () => items.find((item) => item.id === uiState.selectedId),
    [items, uiState.selectedId]
  )

  const filteredItems = useMemo(() => {
    let filtered = [...items]

    // 搜索过滤
    if (uiState.searchText) {
      const query = uiState.searchText.toLowerCase()
      filtered = filtered.filter(
        (item) =>
          item.url.toLowerCase().includes(query) ||
          item.title?.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.tags?.some((tag) => tag.toLowerCase().includes(query))
      )
    }

    // 排序
    filtered.sort((a, b) => {
      let aValue: number | string = 0
      let bValue: number | string = 0

      switch (uiState.sortBy) {
        case 'createdAt':
          aValue = a.createdAt
          bValue = b.createdAt
          break
        case 'lastCrawled':
          aValue = a.lastCrawled || 0
          bValue = b.lastCrawled || 0
          break
        case 'title':
          aValue = a.title || a.url
          bValue = b.title || b.url
          break
        case 'url':
          aValue = a.url
          bValue = b.url
          break
      }

      const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      return uiState.sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [items, uiState])

  const stats = useMemo(() => {
    return {
      total: items.length,
      success: items.filter((item) => item.status === 'success').length,
      error: items.filter((item) => item.status === 'error').length,
      autoRefresh: items.filter((item) => item.autoRefresh).length,
    }
  }, [items])

  // ========== Handlers ==========

  /**
   * 添加新的存档项
   */
  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      // 构建 headers
      const headers: Record<string, string> = {}
      if (values.authType === 'cookie' && values.cookie) {
        headers['Cookie'] = values.cookie.trim()
      } else if (values.authType === 'bearer' && values.token) {
        headers['Authorization'] = `Bearer ${values.token.trim()}`
      } else if (values.authType === 'custom' && values.customHeaders) {
        try {
          Object.assign(headers, JSON.parse(values.customHeaders))
        } catch (e) {
          message.error('自定义 Headers 格式错误，请使用有效的 JSON')
          return
        }
      }

      const newItem: WebArchiveItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: values.url.trim(),
        title: values.title?.trim(),
        description: values.description?.trim(),
        tags: values.tags || [],
        crawlMode: values.crawlMode || 'metadata',
        autoRefresh: values.autoRefresh || false,
        refreshInterval: values.refreshInterval || 60,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        checkInScriptPath: values.checkInScriptPath?.trim(),
        autoCheckIn: values.autoCheckIn || false,
        status: 'idle',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      setItems([...items, newItem])
      setAddModalVisible(false)
      form.resetFields()
      message.success('已添加网页')

      // 立即抓取一次
      if (values.crawlNow) {
        await handleCrawl(newItem)
      }

      widgetLogger.info('Added new archive item', { url: newItem.url })
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return
      }
      widgetLogger.error('Failed to add archive item', error as Error)
    }
  }

  /**
   * 编辑存档项
   */
  const handleEdit = (item: WebArchiveItem) => {
    setEditingItem(item)
    
    // 检测身份验证类型
    let detectedAuthType: 'none' | 'cookie' | 'bearer' | 'custom' = 'none'
    let cookie = ''
    let token = ''
    let customHeaders = ''
    
    if (item.headers) {
      if (item.headers['Cookie']) {
        detectedAuthType = 'cookie'
        cookie = item.headers['Cookie']
      } else if (item.headers['Authorization']?.startsWith('Bearer ')) {
        detectedAuthType = 'bearer'
        token = item.headers['Authorization'].replace('Bearer ', '')
      } else {
        detectedAuthType = 'custom'
        customHeaders = JSON.stringify(item.headers, null, 2)
      }
    }
    
    setAuthType(detectedAuthType)
    form.setFieldsValue({
      url: item.url,
      title: item.title,
      description: item.description,
      tags: item.tags,
      crawlMode: item.crawlMode,
      autoRefresh: item.autoRefresh,
      refreshInterval: item.refreshInterval,
      authType: detectedAuthType,
      cookie,
      token,
      customHeaders,
      checkInScriptPath: item.checkInScriptPath,
      autoCheckIn: item.autoCheckIn,
    })
    setEditModalVisible(true)
  }

  /**
   * 保存编辑
   */
  const handleSaveEdit = async () => {
    if (!editingItem) return

    try {
      const values = await form.validateFields()
      
      // 构建 headers
      const headers: Record<string, string> = {}
      if (values.authType === 'cookie' && values.cookie) {
        headers['Cookie'] = values.cookie.trim()
      } else if (values.authType === 'bearer' && values.token) {
        headers['Authorization'] = `Bearer ${values.token.trim()}`
      } else if (values.authType === 'custom' && values.customHeaders) {
        try {
          Object.assign(headers, JSON.parse(values.customHeaders))
        } catch (e) {
          message.error('自定义 Headers 格式错误，请使用有效的 JSON')
          return
        }
      }
      
      const updatedItem: WebArchiveItem = {
        ...editingItem,
        url: values.url.trim(),
        title: values.title?.trim(),
        description: values.description?.trim(),
        tags: values.tags || [],
        crawlMode: values.crawlMode,
        autoRefresh: values.autoRefresh,
        refreshInterval: values.refreshInterval,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        checkInScriptPath: values.checkInScriptPath?.trim(),
        autoCheckIn: values.autoCheckIn,
        updatedAt: Date.now(),
      }

      setItems((prevItems) =>
        prevItems.map((item) => (item.id === editingItem.id ? updatedItem : item))
      )
      setEditModalVisible(false)
      setEditingItem(null)
      form.resetFields()
      message.success('已保存修改')

      widgetLogger.info('Updated archive item', { id: editingItem.id })
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return
      }
      widgetLogger.error('Failed to update archive item', error as Error)
    }
  }

  /**
   * 快速切换自动刷新
   */
  const handleToggleAutoRefresh = (item: WebArchiveItem) => {
    setItems((prevItems) =>
      prevItems.map((i) =>
        i.id === item.id
          ? {
              ...i,
              autoRefresh: !i.autoRefresh,
              updatedAt: Date.now(),
            }
          : i
      )
    )
    message.success(item.autoRefresh ? '已关闭自动刷新' : '已开启自动刷新')
    widgetLogger.info('Toggled auto-refresh', { id: item.id, enabled: !item.autoRefresh })
  }

  /**
   * 删除存档项
   */
  const handleDelete = (item: WebArchiveItem) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除「${item.title || item.url}」吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setItems((prevItems) => prevItems.filter((i) => i.id !== item.id))
        message.success('已删除')
        widgetLogger.info('Deleted archive item', { id: item.id })
      },
    })
  }

  /**
   * 抓取单个网页
   */
  const handleCrawl = useCallback(async (item: WebArchiveItem) => {
    widgetLogger.info('Crawling web page', { url: item.url })

    // 更新状态为抓取中
    setItems((prevItems) =>
      prevItems.map((i) =>
        i.id === item.id ? { ...i, status: 'crawling' as const, error: undefined } : i
      )
    )

    try {
      const request: CrawlRequest = {
        url: item.url,
        config: {
          mode: item.crawlMode,
          headers: item.headers,
        },
      }

      const result = (await window.electronAPI.webarchiveCrawl(request)) as CrawlResult

      if (result.success) {
        setItems((prevItems) =>
          prevItems.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'success' as const,
                  content: result.content,
                  lastCrawled: Date.now(),
                  updatedAt: Date.now(),
                  title: result.content?.title || i.title,
                  error: undefined,
                }
              : i
          )
        )
        message.success(`抓取成功：${item.url}`)
        widgetLogger.info('Crawl succeeded', { url: item.url, duration: result.duration })
      } else {
        throw new Error(result.error || '未知错误')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setItems((prevItems) =>
        prevItems.map((i) =>
          i.id === item.id
            ? {
                ...i,
                status: 'error' as const,
                error: errorMessage,
                updatedAt: Date.now(),
              }
            : i
        )
      )
      message.error(`抓取失败：${errorMessage}`)
      widgetLogger.error('Crawl failed', { url: item.url, error })
    }
  }, [setItems, widgetLogger])

  /**
   * 批量抓取
   */
  const handleBatchCrawl = useCallback(async (itemsToCrawl: WebArchiveItem[]) => {
    if (itemsToCrawl.length === 0) return

    setCrawling(true)
    widgetLogger.info('Starting batch crawl', { count: itemsToCrawl.length })

    for (const item of itemsToCrawl) {
      await handleCrawl(item)
      // 避免请求过快
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    setCrawling(false)
    widgetLogger.info('Batch crawl completed')
  }, [handleCrawl, widgetLogger])

  /**
   * 执行签到
   */
  const handleCheckIn = useCallback(async (item: WebArchiveItem) => {
    if (!item.checkInScriptPath) {
      message.warning('未配置签到脚本')
      return
    }

    widgetLogger.info('Starting check-in', { url: item.url })
    setCheckingIn(item.id)

    try {
      const request: CheckInRequest = {
        url: item.url,
        script: item.checkInScriptPath,
        headers: item.headers,
      }

      const result = (await window.electronAPI.webarchiveCheckIn(request)) as CheckInResult

      setItems((prevItems) =>
        prevItems.map((i) =>
          i.id === item.id
            ? {
                ...i,
                lastCheckIn: Date.now(),
                checkInResult: result,
                updatedAt: Date.now(),
              }
            : i
        )
      )

      if (result.success) {
        message.success(`签到成功：${result.message || '已完成签到'}`)
        widgetLogger.info('Check-in succeeded', { url: item.url, result })
      } else {
        throw new Error(result.error || '签到失败')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      message.error(`签到失败：${errorMessage}`)
      widgetLogger.error('Check-in failed', { url: item.url, error })

      setItems((prevItems) =>
        prevItems.map((i) =>
          i.id === item.id
            ? {
                ...i,
                lastCheckIn: Date.now(),
                checkInResult: {
                  success: false,
                  error: errorMessage,
                  timestamp: Date.now(),
                },
                updatedAt: Date.now(),
              }
            : i
        )
      )
    } finally {
      setCheckingIn(null)
    }
  }, [setItems, widgetLogger])

  /**
   * 查看内容
   */
  const handleView = (item: WebArchiveItem) => {
    setUIState({ ...uiState, selectedId: item.id })
    setViewDrawerVisible(true)
  }

  /**
   * 打开登录窗口并自动获取 Cookie
   */
  const handleAutoLogin = useCallback(async () => {
    const targetUrl = form.getFieldValue('url')
    
    if (!targetUrl) {
      message.warning('请先输入网页 URL')
      return
    }

    if (!window.electronAPI?.openLoginWindow) {
      message.error('当前环境不支持自动登录功能')
      return
    }

    try {
      setIsAuthenticating(true)
      message.info('正在打开登录窗口，请完成登录...')
      widgetLogger.info('Opening login window', { url: targetUrl })

      const result = await window.electronAPI.openLoginWindow({
        url: targetUrl,
        autoDetect: false, // 手动确认，更可靠
      })

      if (result.success && result.cookies) {
        form.setFieldsValue({ cookie: result.cookies })
        message.success(
          `已获取 ${result.metadata?.cookieCount || 0} 个 Cookie，来自域名：${result.metadata?.domain}`
        )
        widgetLogger.info('Cookies captured successfully', result.metadata)
      } else {
        throw new Error(result.error || '获取 Cookie 失败')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      message.error(`登录失败：${errorMessage}`)
      widgetLogger.error('Auto login failed', error as Error)
    } finally {
      setIsAuthenticating(false)
    }
  }, [form, widgetLogger])

  // ========== 定时任务（简化版） ==========
  useEffect(() => {
    const checkAutoRefresh = () => {
      const now = Date.now()
      const itemsToRefresh = items.filter((item) => {
        if (!item.autoRefresh) return false
        if (!item.lastCrawled) return true
        const elapsed = now - item.lastCrawled
        const interval = item.refreshInterval * 60 * 1000
        return elapsed >= interval
      })

      if (itemsToRefresh.length > 0) {
        widgetLogger.info('Auto-refreshing items', { count: itemsToRefresh.length })
        handleBatchCrawl(itemsToRefresh)
      }
    }

    // 每分钟检查一次
    const interval = setInterval(checkAutoRefresh, 60000)
    return () => clearInterval(interval)
  }, [items, handleBatchCrawl, widgetLogger])

  // ========== Render ==========

  return (
    <WidgetLayout
      title={metadata.displayName}
      icon={metadata.icon}
      loading={state.loading}
      error={state.error}
      showRefresh
      onRefresh={refresh}
    >
      {/* 统计信息 */}
      <WidgetSection>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="总数" value={stats.total} prefix={<GlobalOutlined />} />
          </Col>
          <Col span={6}>
            <Statistic
              title="成功"
              value={stats.success}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="失败"
              value={stats.error}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="自动刷新"
              value={stats.autoRefresh}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
        </Row>
      </WidgetSection>

      {/* 工具栏 */}
      <WidgetSection>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
              添加网页
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => handleBatchCrawl(items.filter((item) => item.autoRefresh))}
              loading={crawling}
            >
              全部刷新
            </Button>
          </Space>
          <Search
            placeholder="搜索 URL、标题或标签"
            value={uiState.searchText}
            onChange={(e) => setUIState({ ...uiState, searchText: e.target.value })}
            style={{ width: 300 }}
            prefix={<SearchOutlined />}
            allowClear
          />
        </Space>
      </WidgetSection>

      {/* 网页列表 */}
      <WidgetSection>
        <UrlList
          items={filteredItems}
          selectedId={uiState.selectedId}
          checkingIn={checkingIn}
          onSelect={(item) => setUIState({ ...uiState, selectedId: item.id })}
          onCrawl={handleCrawl}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={handleView}
          onToggleAutoRefresh={handleToggleAutoRefresh}
          onCheckIn={handleCheckIn}
        />
      </WidgetSection>

      {/* 添加网页模态框 */}
      <Modal
        title="添加网页"
        open={addModalVisible}
        onOk={handleAdd}
        onCancel={() => {
          setAddModalVisible(false)
          form.resetFields()
        }}
        okText="添加"
        cancelText="取消"
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="网页 URL"
            name="url"
            rules={[
              { required: true, message: '请输入网页 URL' },
              { type: 'url', message: '请输入有效的 URL' },
            ]}
          >
            <Input placeholder="https://example.com" prefix={<GlobalOutlined />} />
          </Form.Item>

          <Form.Item label="标题" name="title">
            <Input placeholder="（可选）自定义标题" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="（可选）添加备注" rows={2} />
          </Form.Item>

          <Form.Item label="标签" name="tags">
            <Select
              mode="tags"
              placeholder="添加标签"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item label="抓取模式" name="crawlMode" initialValue="metadata">
            <Select>
              <Select.Option value="metadata">仅元数据（标题、描述、图片）</Select.Option>
              <Select.Option value="text">文本内容</Select.Option>
              <Select.Option value="full">完整 HTML</Select.Option>
              <Select.Option value="custom">自定义选择器</Select.Option>
            </Select>
          </Form.Item>

          <Collapse
            ghost
            items={[
              {
                key: 'auth',
                label: (
                  <Space>
                    <LockOutlined />
                    <span>身份验证配置（可选）</span>
                  </Space>
                ),
                children: (
                  <>
                    <Alert
                      message="某些网页需要登录才能访问内容，您可以配置身份验证信息"
                      type="info"
                      showIcon
                      icon={<InfoCircleOutlined />}
                      style={{ marginBottom: 16 }}
                    />
                    <Form.Item label="验证方式" name="authType" initialValue="none">
                      <Select
                        onChange={(value) =>
                          setAuthType(value as 'none' | 'cookie' | 'bearer' | 'custom')
                        }
                      >
                        <Select.Option value="none">无需验证</Select.Option>
                        <Select.Option value="cookie">Cookie（自动登录获取）</Select.Option>
                        <Select.Option value="bearer">Bearer Token（API 令牌）</Select.Option>
                        <Select.Option value="custom">自定义 Headers（JSON）</Select.Option>
                      </Select>
                    </Form.Item>

                    {authType === 'cookie' && (
                      <Form.Item
                        label="Cookie"
                        name="cookie"
                        tooltip="点击自动登录按钮打开登录窗口，或手动从浏览器开发者工具中复制"
                      >
                        <Space.Compact style={{ width: '100%' }} direction="vertical">
                          <Input.TextArea
                            placeholder="点击下方按钮自动登录，或手动粘贴 Cookie: session=abc123; token=xyz789"
                            rows={3}
                            autoSize={{ minRows: 3, maxRows: 6 }}
                            disabled={isAuthenticating}
                          />
                          <Button
                            type="primary"
                            icon={<LoginOutlined />}
                            loading={isAuthenticating}
                            onClick={handleAutoLogin}
                            block
                          >
                            {isAuthenticating ? '登录中...' : '自动登录获取 Cookie'}
                          </Button>
                        </Space.Compact>
                      </Form.Item>
                    )}

                    {authType === 'bearer' && (
                      <Form.Item
                        label="Token"
                        name="token"
                        tooltip="API 访问令牌，将自动添加 'Bearer ' 前缀"
                      >
                        <Input.TextArea
                          placeholder="your-api-token-here"
                          rows={2}
                          autoSize={{ minRows: 2, maxRows: 4 }}
                        />
                      </Form.Item>
                    )}

                    {authType === 'custom' && (
                      <Form.Item
                        label="自定义 Headers"
                        name="customHeaders"
                        tooltip="JSON 格式的 HTTP Headers"
                        rules={[
                          {
                            validator: async (_, value) => {
                              if (!value) return
                              try {
                                JSON.parse(value)
                              } catch {
                                throw new Error('请输入有效的 JSON 格式')
                              }
                            },
                          },
                        ]}
                      >
                        <Input.TextArea
                          placeholder={`{\n  "Authorization": "Bearer token",\n  "X-API-Key": "key123"\n}`}
                          rows={4}
                          autoSize={{ minRows: 4, maxRows: 8 }}
                        />
                      </Form.Item>
                    )}
                  </>
                ),
              },
            ]}
          />

          <Form.Item label="自动刷新" name="autoRefresh" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item
            label="刷新间隔（分钟）"
            name="refreshInterval"
            initialValue={60}
            dependencies={['autoRefresh']}
          >
            <InputNumber min={5} max={1440} style={{ width: '100%' }} />
          </Form.Item>

          <Collapse
            ghost
            items={[
              {
                key: 'checkin',
                label: (
                  <Space>
                    <LoginOutlined />
                    <span>签到脚本配置（可选）</span>
                  </Space>
                ),
                children: (
                  <>
                    <Alert
                      message="签到脚本说明"
                      description={
                        <div style={{ fontSize: 12 }}>
                          <p>签到脚本会在沙箱环境中执行，可以访问：</p>
                          <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                            <li><code>url</code> - 目标网址</li>
                            <li><code>html</code> - 网页 HTML 内容</li>
                            <li><code>headers</code> - 自定义 Headers</li>
                            <li><code>fetch(url, options)</code> - 发起 HTTP 请求</li>
                          </ul>
                          <p>脚本必须返回：<code>{'{success: boolean, message?: string, data?: any}'}</code></p>
                        </div>
                      }
                      type="info"
                      showIcon
                      style={{ marginBottom: 16, fontSize: 12 }}
                    />
                    <Form.Item
                      label="签到脚本路径"
                      name="checkInScriptPath"
                      tooltip="相对于 scripts/ 目录的脚本文件路径，例如：checkin/example.js"
                    >
                      <Input
                        placeholder="checkin/example.js"
                        prefix={<GlobalOutlined />}
                      />
                    </Form.Item>
                    <Form.Item label="启用自动签到" name="autoCheckIn" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />

          <Form.Item name="crawlNow" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="立即抓取" unCheckedChildren="稍后抓取" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑网页模态框 */}
      <Modal
        title="编辑网页"
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => {
          setEditModalVisible(false)
          setEditingItem(null)
          form.resetFields()
        }}
        okText="保存"
        cancelText="取消"
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="网页 URL"
            name="url"
            rules={[
              { required: true, message: '请输入网页 URL' },
              { type: 'url', message: '请输入有效的 URL' },
            ]}
          >
            <Input placeholder="https://example.com" prefix={<GlobalOutlined />} />
          </Form.Item>

          <Form.Item label="标题" name="title">
            <Input placeholder="（可选）自定义标题" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="（可选）添加备注" rows={2} />
          </Form.Item>

          <Form.Item label="标签" name="tags">
            <Select
              mode="tags"
              placeholder="添加标签"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item label="抓取模式" name="crawlMode">
            <Select>
              <Select.Option value="metadata">仅元数据（标题、描述、图片）</Select.Option>
              <Select.Option value="text">文本内容</Select.Option>
              <Select.Option value="full">完整 HTML</Select.Option>
              <Select.Option value="custom">自定义选择器</Select.Option>
            </Select>
          </Form.Item>

          <Collapse
            ghost
            items={[
              {
                key: 'auth',
                label: (
                  <Space>
                    <LockOutlined />
                    <span>身份验证配置（可选）</span>
                  </Space>
                ),
                children: (
                  <>
                    <Alert
                      message="某些网页需要登录才能访问内容，您可以配置身份验证信息"
                      type="info"
                      showIcon
                      icon={<InfoCircleOutlined />}
                      style={{ marginBottom: 16 }}
                    />
                    <Form.Item label="验证方式" name="authType" initialValue="none">
                      <Select
                        onChange={(value) =>
                          setAuthType(value as 'none' | 'cookie' | 'bearer' | 'custom')
                        }
                      >
                        <Select.Option value="none">无需验证</Select.Option>
                        <Select.Option value="cookie">Cookie（自动登录获取）</Select.Option>
                        <Select.Option value="bearer">Bearer Token（API 令牌）</Select.Option>
                        <Select.Option value="custom">自定义 Headers（JSON）</Select.Option>
                      </Select>
                    </Form.Item>

                    {authType === 'cookie' && (
                      <Form.Item
                        label="Cookie"
                        name="cookie"
                        tooltip="点击自动登录按钮打开登录窗口，或手动从浏览器开发者工具中复制"
                      >
                        <Space.Compact style={{ width: '100%' }} direction="vertical">
                          <Input.TextArea
                            placeholder="点击下方按钮自动登录，或手动粘贴 Cookie: session=abc123; token=xyz789"
                            rows={3}
                            autoSize={{ minRows: 3, maxRows: 6 }}
                            disabled={isAuthenticating}
                          />
                          <Button
                            type="primary"
                            icon={<LoginOutlined />}
                            loading={isAuthenticating}
                            onClick={handleAutoLogin}
                            block
                          >
                            {isAuthenticating ? '登录中...' : '自动登录获取 Cookie'}
                          </Button>
                        </Space.Compact>
                      </Form.Item>
                    )}

                    {authType === 'bearer' && (
                      <Form.Item
                        label="Token"
                        name="token"
                        tooltip="API 访问令牌，将自动添加 'Bearer ' 前缀"
                      >
                        <Input.TextArea
                          placeholder="your-api-token-here"
                          rows={2}
                          autoSize={{ minRows: 2, maxRows: 4 }}
                        />
                      </Form.Item>
                    )}

                    {authType === 'custom' && (
                      <Form.Item
                        label="自定义 Headers"
                        name="customHeaders"
                        tooltip="JSON 格式的 HTTP Headers"
                        rules={[
                          {
                            validator: async (_, value) => {
                              if (!value) return
                              try {
                                JSON.parse(value)
                              } catch {
                                throw new Error('请输入有效的 JSON 格式')
                              }
                            },
                          },
                        ]}
                      >
                        <Input.TextArea
                          placeholder={`{\n  "Authorization": "Bearer token",\n  "X-API-Key": "key123"\n}`}
                          rows={4}
                          autoSize={{ minRows: 4, maxRows: 8 }}
                        />
                      </Form.Item>
                    )}
                  </>
                ),
              },
            ]}
          />

          <Form.Item label="自动刷新" name="autoRefresh" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item
            label="刷新间隔（分钟）"
            name="refreshInterval"
            dependencies={['autoRefresh']}
          >
            <InputNumber min={5} max={1440} style={{ width: '100%' }} />
          </Form.Item>

          <Collapse
            ghost
            items={[
              {
                key: 'checkin',
                label: (
                  <Space>
                    <LoginOutlined />
                    <span>签到脚本配置（可选）</span>
                  </Space>
                ),
                children: (
                  <>
                    <Alert
                      message="签到脚本说明"
                      description={
                        <div style={{ fontSize: 12 }}>
                          <p>签到脚本会在沙箱环境中执行，可以访问：</p>
                          <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                            <li><code>url</code> - 目标网址</li>
                            <li><code>html</code> - 网页 HTML 内容</li>
                            <li><code>headers</code> - 自定义 Headers</li>
                            <li><code>fetch(url, options)</code> - 发起 HTTP 请求</li>
                          </ul>
                          <p>脚本必须返回：<code>{'{success: boolean, message?: string, data?: any}'}</code></p>
                        </div>
                      }
                      type="info"
                      showIcon
                      style={{ marginBottom: 16, fontSize: 12 }}
                    />
                    <Form.Item
                      label="签到脚本路径"
                      name="checkInScriptPath"
                      tooltip="相对于 scripts/ 目录的脚本文件路径，例如：checkin/example.js"
                    >
                      <Input
                        placeholder="checkin/example.js"
                        prefix={<GlobalOutlined />}
                      />
                    </Form.Item>
                    <Form.Item label="启用自动签到" name="autoCheckIn" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      {/* 内容查看抽屉 */}
      <Drawer
        title={selectedItem?.title || selectedItem?.url || '内容查看'}
        placement="right"
        width={720}
        open={viewDrawerVisible}
        onClose={() => setViewDrawerVisible(false)}
      >
        <ContentViewer content={selectedItem?.content} />
      </Drawer>
    </WidgetLayout>
  )
}

export default WebArchiveWidget
