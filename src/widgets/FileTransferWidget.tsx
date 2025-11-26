import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileOutlined,
  FileImageOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileZipOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  InboxOutlined,
  LoginOutlined,
  LogoutOutlined,
  UserAddOutlined,
  UserOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
  CloudDownloadOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  MenuProps,
  Modal,
  Progress,
  Row,
  Col,
  Space,
  Statistic,
  Table,
  Tag,
  Tabs,
  Typography,
  Upload,
  Avatar,
  Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile, UploadProps } from 'antd/es/upload'
import { WidgetLayout } from '@/components/widgets'
import { useWidget } from '@/hooks/useWidget'
import { useWidgetActions } from '@/hooks/useWidgetActions'
import { useWidgetConfig } from '@/hooks/useWidgetConfig'
import type { WidgetMetadata } from '@/shared/widget-types'
import type { FileTransferConfig } from '@/shared/types'

const { Text } = Typography
const { Dragger } = Upload

interface UserInfo {
  id: string
  username: string
  createdAt: string
  updatedAt: string
}

interface AuthData {
  user: UserInfo
  token: string
}

interface FileInfo {
  id: string
  originalName: string
  filename: string
  path: string
  size: number
  mimetype: string
  userId: string
  uploadedAt: string
}

interface StorageUsage {
  used: number
  files: number
}

const metadata: WidgetMetadata = {
  id: 'file-transfer',
  displayName: '文件传输',
  icon: <CloudUploadOutlined />,
  description: '连接到文件服务器进行文件上传、下载和管理',
  category: 'tools',
  order: 3,
  enabled: true,
}

const DEFAULT_SERVER_URL = 'http://localhost:3000/api'

const FileTransferWidget: React.FC = () => {
  const { message, modal } = App.useApp()

  // Widget hooks
  const { state, setStatus, setError, setLoading, widgetLogger } = useWidget({
    metadata,
    autoInit: true,
  })

  // 从配置文件读取服务器地址
  const { config: serverConfig, updateConfig: setServerConfig } = useWidgetConfig<FileTransferConfig>({
    section: 'file_transfer',
    defaultConfig: { server_url: DEFAULT_SERVER_URL },
  })

  // 状态
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null)
  const [files, setFiles] = useState<FileInfo[]>([])
  const [storageUsage, setStorageUsage] = useState<StorageUsage>({ used: 0, files: 0 })
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null)
  
  // UI Control States
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // 表单
  const [loginForm] = Form.useForm()
  const [registerForm] = Form.useForm()
  const [serverForm] = Form.useForm()

  const isAuthenticated = useMemo(() => !!authToken, [authToken])

  // 从 localStorage 加载 token
  useEffect(() => {
    const savedToken = localStorage.getItem('fileserver_token')
    const savedUser = localStorage.getItem('fileserver_user')
    if (savedToken && savedUser) {
      try {
        setAuthToken(savedToken)
        setCurrentUser(JSON.parse(savedUser))
        widgetLogger.info('Restored authentication from localStorage')
      } catch (error) {
        widgetLogger.error('Failed to restore auth', error as Error)
        localStorage.removeItem('fileserver_token')
        localStorage.removeItem('fileserver_user')
      }
    }
  }, [widgetLogger])

  // API 请求辅助函数
  const apiRequest = useCallback(
    async <T,>(
      endpoint: string,
      options: RequestInit = {}
    ): Promise<{ success: boolean; data?: T; error?: string }> => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }

        if (options.headers) {
          Object.assign(headers, options.headers)
        }

        if (authToken && !headers['Authorization']) {
          headers['Authorization'] = `Bearer ${authToken}`
        }

        const response = await fetch(`${serverConfig.server_url}${endpoint}`, {
          ...options,
          headers,
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || `HTTP ${response.status}`)
        }

        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        widgetLogger.error(`API request failed: ${endpoint}`, error as Error)
        return { success: false, error: errorMessage }
      }
    },
    [authToken, serverConfig.server_url, widgetLogger]
  )

  // 登录
  const handleLogin = useCallback(
    async (values: { username: string; password: string }) => {
      try {
        setLoading(true)
        setStatus('正在登录...')

        const result = await apiRequest<AuthData>('/auth/login', {
          method: 'POST',
          body: JSON.stringify(values),
        })

        if (result.success && result.data) {
          setAuthToken(result.data.token)
          setCurrentUser(result.data.user)
          localStorage.setItem('fileserver_token', result.data.token)
          localStorage.setItem('fileserver_user', JSON.stringify(result.data.user))
          setStatus('登录成功')
          message.success(`欢迎回来，${result.data.user.username}！`)
          loginForm.resetFields()
        } else {
          throw new Error(result.error || '登录失败')
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        setError(`登录失败：${errorMessage}`)
        message.error(`登录失败：${errorMessage}`)
      } finally {
        setLoading(false)
      }
    },
    [apiRequest, loginForm, message, setError, setLoading, setStatus]
  )

  // 注册
  const handleRegister = useCallback(
    async (values: { username: string; password: string; confirmPassword: string }) => {
      if (values.password !== values.confirmPassword) {
        message.error('两次输入的密码不一致')
        return
      }

      try {
        setLoading(true)
        setStatus('正在注册...')

        const result = await apiRequest<AuthData>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            username: values.username,
            password: values.password,
          }),
        })

        if (result.success && result.data) {
          setAuthToken(result.data.token)
          setCurrentUser(result.data.user)
          localStorage.setItem('fileserver_token', result.data.token)
          localStorage.setItem('fileserver_user', JSON.stringify(result.data.user))
          setStatus('注册成功')
          message.success(`注册成功，欢迎 ${result.data.user.username}！`)
          registerForm.resetFields()
        } else {
          throw new Error(result.error || '注册失败')
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        setError(`注册失败：${errorMessage}`)
        message.error(`注册失败：${errorMessage}`)
      } finally {
        setLoading(false)
      }
    },
    [apiRequest, registerForm, message, setError, setLoading, setStatus]
  )

  // 下载配置从服务器
  const handleDownloadConfig = useCallback(async () => {
    if (!isAuthenticated) {
      message.warning('请先登录')
      return
    }

    try {
      setDownloading(true)
      setStatus('正在下载配置...')

      // 获取文件列表，查找 config.toml
      const result = await apiRequest<FileInfo[]>('/files')
      
      if (!result.success || !result.data) {
        throw new Error('获取文件列表失败')
      }

      const configFile = result.data.find(f => f.originalName === 'config.toml')
      if (!configFile) {
        throw new Error('服务器上没有找到 config.toml 文件')
      }

      // 下载文件
      const response = await fetch(`${serverConfig.server_url}/files/${configFile.id}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      if (!response.ok) {
        throw new Error('下载失败')
      }

      const configContent = await response.text()

      // 获取本地配置路径并保存
      const configPath = await window.electronAPI.getSavedConfigPath()
      if (!configPath) {
        throw new Error('无法获取配置文件路径')
      }

      await window.electronAPI.writeFile(configPath, configContent)
      
      message.success('配置文件已从服务器下载并保存')
      setStatus('配置下载成功，重启后生效')
      widgetLogger.info('Config downloaded from server')

      // 提示重启
      modal.info({
        title: '配置已更新',
        content: '配置文件已下载，请重启应用以应用新配置。',
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      message.error(`下载失败：${errorMessage}`)
      setError(`下载配置失败：${errorMessage}`)
      widgetLogger.error('Config download failed', error as Error)
    } finally {
      setDownloading(false)
    }
  }, [
    isAuthenticated,
    serverConfig.server_url,
    authToken,
    apiRequest,
    message,
    modal,
    setStatus,
    setError,
    widgetLogger,
  ])

  // 同步配置到服务器
  const handleSyncConfig = useCallback(async () => {
    if (!isAuthenticated) {
      message.warning('请先登录')
      return
    }

    try {
      setSyncing(true)
      setStatus('正在同步配置...')

      // 获取配置文件路径
      const configPath = await window.electronAPI.getSavedConfigPath()
      if (!configPath) {
        throw new Error('无法获取配置文件路径')
      }

      // 读取配置文件内容
      const configContent = await window.electronAPI.readFile(configPath)
      
      // 创建 Blob 并上传
      const blob = new Blob([configContent], { type: 'text/plain' })
      const file = new File([blob], 'config.toml', { type: 'text/plain' })
      
      const formData = new FormData()
      formData.append('files', file)

      const response = await fetch(`${serverConfig.server_url}/files/upload-multiple`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        message.success('配置文件已同步到服务器')
        setStatus('配置同步成功')
        widgetLogger.info('Config synced to server')
      } else {
        throw new Error(result.error || '同步失败')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      message.error(`同步失败：${errorMessage}`)
      setError(`同步配置失败：${errorMessage}`)
      widgetLogger.error('Config sync failed', error as Error)
    } finally {
      setSyncing(false)
    }
  }, [
    isAuthenticated,
    serverConfig.server_url,
    authToken,
    message,
    setStatus,
    setError,
    widgetLogger,
  ])

  // 登出
  const handleLogout = useCallback(() => {
    setAuthToken(null)
    setCurrentUser(null)
    setFiles([])
    setStorageUsage({ used: 0, files: 0 })
    localStorage.removeItem('fileserver_token')
    localStorage.removeItem('fileserver_user')
    setStatus('已登出')
    message.info('已退出登录')
    widgetLogger.info('User logged out')
  }, [message, setStatus, widgetLogger])

  // 加载文件列表
  const loadFiles = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      const result = await apiRequest<FileInfo[]>('/files')

      if (result.success && result.data) {
        setFiles(result.data)
        widgetLogger.info(`Loaded ${result.data.length} files`)
      } else {
        throw new Error(result.error || '加载文件列表失败')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      widgetLogger.error('Failed to load files', error as Error)
      message.error(`加载文件列表失败：${errorMessage}`)
    }
  }, [isAuthenticated, apiRequest, widgetLogger, message])

  // 加载存储使用情况
  const loadStorageUsage = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      const result = await apiRequest<StorageUsage>('/files/storage/usage')

      if (result.success && result.data) {
        setStorageUsage(result.data)
      }
    } catch (error) {
      widgetLogger.error('Failed to load storage usage', error as Error)
    }
  }, [isAuthenticated, apiRequest, widgetLogger])

  // 认证后自动加载数据
  useEffect(() => {
    if (isAuthenticated) {
      loadFiles()
      loadStorageUsage()
    }
  }, [isAuthenticated, loadFiles, loadStorageUsage])

  // 上传文件
  const handleUpload = useCallback(async () => {
    if (fileList.length === 0) {
      message.warning('请先选择文件')
      return
    }

    try {
      setUploading(true)
      setUploadProgress(0)

      const formData = new FormData()
      let hasFiles = false
      fileList.forEach((file) => {
        if (file.originFileObj) {
          formData.append('files', file.originFileObj)
          hasFiles = true
        }
      })

      if (!hasFiles) {
        throw new Error('没有可上传的文件')
      }

      const response = await fetch(`${serverConfig.server_url}/files/upload-multiple`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        message.success(`成功上传 ${fileList.length} 个文件`)
        setFileList([])
        setUploadModalOpen(false) // Close modal on success
        await loadFiles()
        await loadStorageUsage()
        widgetLogger.info(`Uploaded ${fileList.length} files`)
      } else {
        throw new Error(result.error || '上传失败')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      message.error(`上传失败：${errorMessage}`)
      widgetLogger.error('Upload failed', error as Error)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [
    fileList,
    serverConfig.server_url,
    authToken,
    message,
    loadFiles,
    loadStorageUsage,
    widgetLogger,
  ])

  // 下载文件
  const handleDownload = useCallback(
    async (file: FileInfo) => {
      try {
        const response = await fetch(`${serverConfig.server_url}/files/${file.id}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        })

        if (!response.ok) {
          throw new Error('下载失败')
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.originalName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        message.success(`已下载：${file.originalName}`)
        widgetLogger.info(`Downloaded file: ${file.originalName}`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        message.error(`下载失败：${errorMessage}`)
        widgetLogger.error('Download failed', error as Error)
      }
    },
    [serverConfig.server_url, authToken, message, widgetLogger]
  )

  // 删除文件
  const handleDelete = useCallback(
    async (file: FileInfo) => {
      modal.confirm({
        title: '确认删除',
        content: `确定要删除文件 "${file.originalName}" 吗？此操作不可恢复。`,
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          try {
            const result = await apiRequest(`/files/${file.id}`, {
              method: 'DELETE',
            })

            if (result.success) {
              message.success('文件已删除')
              await loadFiles()
              await loadStorageUsage()
              widgetLogger.info(`Deleted file: ${file.originalName}`)
            } else {
              throw new Error(result.error || '删除失败')
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            message.error(`删除失败：${errorMessage}`)
            widgetLogger.error('Delete failed', error as Error)
          }
        },
      })
    },
    [apiRequest, modal, message, loadFiles, loadStorageUsage, widgetLogger]
  )

  // 预览文件
  const handlePreview = useCallback((file: FileInfo) => {
    setPreviewFile(file)
    setPreviewVisible(true)
  }, [])

  // 格式化文件大小
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }, [])

  // 格式化日期
  const formatDate = useCallback((dateString: string): string => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  // Get Icon based on mimetype
  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return <FileImageOutlined style={{ color: '#ff85c0' }} />
    if (mimetype.startsWith('text/')) return <FileTextOutlined style={{ color: '#597ef7' }} />
    if (mimetype.includes('pdf')) return <FilePdfOutlined style={{ color: '#ff4d4f' }} />
    if (mimetype.includes('zip') || mimetype.includes('rar') || mimetype.includes('tar'))
      return <FileZipOutlined style={{ color: '#faad14' }} />
    if (mimetype.includes('excel') || mimetype.includes('sheet'))
      return <FileExcelOutlined style={{ color: '#52c41a' }} />
    if (mimetype.includes('word') || mimetype.includes('document'))
      return <FileWordOutlined style={{ color: '#1890ff' }} />
    return <FileOutlined />
  }

  // Upload props
  const uploadProps: UploadProps = {
    multiple: true,
    fileList,
    beforeUpload: (file) => {
      const uploadFile: UploadFile = {
        uid: file.uid || `${Date.now()}-${Math.random()}`,
        name: file.name,
        status: 'done',
        originFileObj: file,
      }
      setFileList((prev) => [...prev, uploadFile])
      return false
    },
    onRemove: (file) => {
      setFileList((prev) => prev.filter((item) => item.uid !== file.uid))
    },
  }

  // Filtered files based on search
  const filteredFiles = useMemo(() => {
    if (!searchText) return files
    return files.filter(file => 
      file.originalName.toLowerCase().includes(searchText.toLowerCase())
    )
  }, [files, searchText])

  // 表格列定义
  const columns: ColumnsType<FileInfo> = [
    {
      title: '文件名',
      dataIndex: 'originalName',
      key: 'originalName',
      ellipsis: true,
      render: (name: string, record: FileInfo) => (
        <Space>
          {getFileIcon(record.mimetype)}
          <Text ellipsis style={{ maxWidth: 200 }}>
            {name}
          </Text>
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number) => <Text type="secondary">{formatFileSize(size)}</Text>,
      sorter: (a, b) => a.size - b.size,
    },
    {
      title: '类型',
      dataIndex: 'mimetype',
      key: 'mimetype',
      width: 120,
      ellipsis: true,
      render: (type: string) => <Tag>{type.split('/')[1] || type}</Tag>,
    },
    {
      title: '上传时间',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      width: 160,
      render: (date: string) => <Text type="secondary">{formatDate(date)}</Text>,
      sorter: (a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record: FileInfo) => (
        <Space size={0}>
          {record.mimetype.startsWith('image/') && (
            <Tooltip title="预览">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handlePreview(record)}
              />
            </Tooltip>
          )}
          <Tooltip title="下载">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  // Widget actions
  const { refresh, isActionInProgress } = useWidgetActions({
    widgetId: metadata.id,
    onRefresh: async () => {
      if (isAuthenticated) {
        await Promise.all([loadFiles(), loadStorageUsage()])
      }
    },
  })

  // User Menu
  const userMenuProps: MenuProps = {
    items: [
      {
        key: 'info',
        label: (
           <div style={{ padding: '4px 0' }}>
             <Text strong>{currentUser?.username}</Text>
             <br />
             <Text type="secondary" style={{ fontSize: 12 }}>ID: {currentUser?.id.substring(0, 8)}...</Text>
           </div>
        ),
        disabled: true,
      },
      { type: 'divider' },
      {
        key: 'logout',
        label: '退出登录',
        icon: <LogoutOutlined />,
        danger: true,
        onClick: handleLogout,
      },
    ],
  }

  return (
    <WidgetLayout
      title={metadata.displayName}
      icon={metadata.icon}
      loading={state.loading}
      error={state.error}
      showRefresh={isAuthenticated}
      onRefresh={refresh}
      actionInProgress={isActionInProgress}
      showSettings
      onSettings={() => setSettingsOpen(true)}
      extra={
        isAuthenticated && currentUser ? (
           <Dropdown menu={userMenuProps} placement="bottomRight">
             <Space style={{ cursor: 'pointer', marginLeft: 8 }}>
               <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
             </Space>
           </Dropdown>
        ) : null
      }
    >
      {/* Settings Drawer */}
      <Drawer
        title="设置"
        placement="right"
        onClose={() => setSettingsOpen(false)}
        open={settingsOpen}
        width={320}
      >
        <WidgetLayout title="服务器配置" bordered={false} className="p-0">
          <Form
            form={serverForm}
            layout="vertical"
            initialValues={serverConfig}
            onFinish={async (values) => {
              await setServerConfig(values)
              message.success('服务器配置已保存')
              setSettingsOpen(false)
              widgetLogger.info('Server config updated', values)
            }}
          >
            <Form.Item
              name="server_url"
              label="服务器地址"
              rules={[{ required: true, message: '请输入服务器地址' }]}
              extra="例如: http://localhost:3000/api"
            >
              <Input placeholder={DEFAULT_SERVER_URL} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                保存配置
              </Button>
            </Form.Item>
          </Form>
        </WidgetLayout>
      </Drawer>

      {/* Main Content */}
      {!isAuthenticated ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Card style={{ width: '100%', maxWidth: 400 }} bordered={false} className="shadow-sm">
            <Tabs
              centered
              items={[
                {
                  key: 'login',
                  label: '登录',
                  icon: <LoginOutlined />,
                  children: (
                    <Form form={loginForm} onFinish={handleLogin} layout="vertical" size="large">
                      <Form.Item
                        name="username"
                        rules={[{ required: true, message: '请输入用户名' }]}
                      >
                        <Input prefix={<UserOutlined />} placeholder="用户名" />
                      </Form.Item>
                      <Form.Item
                        name="password"
                        rules={[{ required: true, message: '请输入密码' }]}
                      >
                        <Input.Password prefix={<LoginOutlined />} placeholder="密码" />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" block loading={state.loading}>
                          登录
                        </Button>
                      </Form.Item>
                    </Form>
                  ),
                },
                {
                  key: 'register',
                  label: '注册',
                  icon: <UserAddOutlined />,
                  children: (
                    <Form form={registerForm} onFinish={handleRegister} layout="vertical" size="large">
                      <Form.Item
                        name="username"
                        rules={[
                          { required: true, message: '请输入用户名' },
                          { min: 3, message: '用户名至少3个字符' },
                        ]}
                      >
                        <Input prefix={<UserOutlined />} placeholder="用户名" />
                      </Form.Item>
                      <Form.Item
                        name="password"
                        rules={[
                          { required: true, message: '请输入密码' },
                          { min: 6, message: '密码至少6个字符' },
                        ]}
                      >
                        <Input.Password placeholder="密码" />
                      </Form.Item>
                      <Form.Item
                        name="confirmPassword"
                        dependencies={['password']}
                        rules={[
                          { required: true, message: '请确认密码' },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value || getFieldValue('password') === value) {
                                return Promise.resolve()
                              }
                              return Promise.reject(new Error('两次输入的密码不一致'))
                            },
                          }),
                        ]}
                      >
                        <Input.Password placeholder="确认密码" />
                      </Form.Item>
                      <Form.Item>
                        <Button
                          type="primary"
                          htmlType="submit"
                          block
                          loading={state.loading}
                        >
                          注册
                        </Button>
                      </Form.Item>
                    </Form>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
          {/* Storage Stats */}
          <Card size="small" bordered={false} style={{ background: 'rgba(0,0,0,0.02)' }}>
            <Row gutter={16} align="middle">
               <Col flex="none">
                 <Statistic 
                    title={null} 
                    value={files.length} 
                    prefix={<FileOutlined />} 
                    suffix="个文件" 
                    valueStyle={{ fontSize: 16 }} 
                 />
               </Col>
               <Col flex="auto">
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                       <Text type="secondary" style={{ fontSize: 12 }}>存储使用情况</Text>
                       <Text strong style={{ fontSize: 12 }}>{formatFileSize(storageUsage.used)} 已用</Text>
                    </div>
                    <Progress 
                       percent={Math.min(100, (storageUsage.used / (1024 * 1024 * 100)) * 100)} // Assuming 100MB max
                       showInfo={false} 
                       size="small" 
                       strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                    />
                 </div>
               </Col>
            </Row>
          </Card>

          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <Space>
               <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => setUploadModalOpen(true)}>
                  上传文件
               </Button>
               <Button 
                 icon={<SyncOutlined spin={syncing} />} 
                 onClick={handleSyncConfig}
                 loading={syncing}
                 title="上传配置到服务器"
               >
                 上传配置
               </Button>
               <Button 
                 icon={<CloudDownloadOutlined spin={downloading} />} 
                 onClick={handleDownloadConfig}
                 loading={downloading}
                 title="从服务器下载配置"
               >
                 下载配置
               </Button>
               <Button icon={<ReloadOutlined />} onClick={refresh} />
             </Space>
             <Input 
                placeholder="搜索文件..." 
                prefix={<SearchOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} 
                allowClear
                onChange={e => setSearchText(e.target.value)}
                style={{ width: 200 }} 
             />
          </div>

          {/* File List */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Table
              columns={columns}
              dataSource={filteredFiles}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 个文件`,
                size: 'small'
              }}
              locale={{
                emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无文件" />,
              }}
              scroll={{ y: 'calc(100vh - 400px)' }} // Estimate height
              size="middle"
            />
          </div>

          {/* Upload Modal */}
          <Modal
            title="上传文件"
            open={uploadModalOpen}
            onCancel={() => {
               if (!uploading) {
                 setUploadModalOpen(false)
                 setFileList([])
               }
            }}
            footer={null}
            width={600}
            maskClosable={!uploading}
          >
             <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Dragger {...uploadProps} disabled={uploading} style={{ padding: 20 }}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                  <p className="ant-upload-hint">支持单个或批量上传，最大 100MB</p>
                </Dragger>

                {uploading && <Progress percent={uploadProgress} status="active" />}

                <Row justify="end">
                   <Space>
                     <Button onClick={() => setUploadModalOpen(false)} disabled={uploading}>取消</Button>
                     <Button
                        type="primary"
                        onClick={handleUpload}
                        loading={uploading}
                        disabled={fileList.length === 0}
                        icon={<CloudUploadOutlined />}
                      >
                        开始上传 {fileList.length > 0 && `(${fileList.length})`}
                      </Button>
                   </Space>
                </Row>
             </Space>
          </Modal>
        </div>
      )}

      {/* Image Preview Modal */}
      <Modal
        open={previewVisible}
        title={previewFile?.originalName}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width={800}
        centered
      >
        {previewFile && (
          <img
            alt={previewFile.originalName}
            style={{ width: '100%', objectFit: 'contain', maxHeight: '80vh' }}
            src={`${serverConfig.server_url}/files/${previewFile.id}`}
          />
        )}
      </Modal>
    </WidgetLayout>
  )
}

export default FileTransferWidget
