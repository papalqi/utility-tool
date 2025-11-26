/**
 * Project Widget
 * 项目管理组件 - 管理多个项目库，支持 P4V 同步和构建操作
 */

import { useState, useCallback } from 'react'
import {
  Card,
  Row,
  Col,
  Button,
  Input,
  Space,
  Typography,
  Tag,
  Modal,
  Form,
  Select,
  Tabs,
  App,
  Popconfirm,
  Empty,
  Divider,
  Descriptions,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  SyncOutlined,
  BuildOutlined,
  FolderOutlined,
  DesktopOutlined,
  MoreOutlined,
  CodeOutlined,
} from '@ant-design/icons'
import { useTheme } from '@/contexts/ThemeContext'
import { motion } from 'framer-motion'
import { useProjects } from '../hooks/useProjects'
import type { Project } from '../shared/types'
import { useTerminalStore } from '@/stores/useTerminalStore'
import { useNavigation } from '@/context/NavigationContext'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs

// 引擎版本选项
const ENGINE_VERSIONS = ['UE4', 'UE5', 'Unity', 'Custom']
// 构建配置选项
const BUILD_CONFIGS = ['Development', 'Shipping', 'Debug', 'Test']
// 平台选项
const PLATFORMS = ['Win64', 'Android', 'iOS', 'Linux', 'Mac']

export default function ProjectWidget() {
  const { message } = App.useApp()
  const { colors } = useTheme()
  const { setActiveWidget } = useNavigation()
  const createTerminalSession = useTerminalStore((store) => store.createSession)
  const {
    projects,
    selectedProject,
    setSelectedProject,
    loading,
    addProject,
    updateProject,
    deleteProject,
    refreshProjects,
  } = useProjects()

  const [searchText, setSearchText] = useState('')
  const [dialogVisible, setDialogVisible] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [form] = Form.useForm()

  // 临时构建配置（不保存到项目）
  const [tempBuildConfig, setTempBuildConfig] = useState<string>('Development')
  const [tempPlatform, setTempPlatform] = useState<string>('Win64')

  // 同步状态
  // const [lastSyncTime, setLastSyncTime] = useState<string>('')

  const dispatchTerminalTask = useCallback(
    (title: string, command: string, args: string[], cwd: string) => {
      createTerminalSession({
        title,
        command,
        args,
        cwd,
        mode: 'task',
      })
      message.open({
        type: 'info',
        content: `已将 ${title} 推送到终端窗口`,
        duration: 3,
      })
    },
    [createTerminalSession, message]
  )

  // 过滤后的项目列表
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchText.toLowerCase())
  )

  // 刷新项目并更新同步时间
  const handleRefresh = async () => {
    await refreshProjects()
    const now = new Date()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    message.success(`已从 Obsidian 同步项目 - ${timeStr}`)
  }

  // 打开添加项目对话框
  const handleAdd = () => {
    setEditingProject(null)
    form.resetFields()
    form.setFieldsValue({
      engine_version: 'UE5',
      build_config: 'Development',
      platform: 'Win64',
      p4_charset: 'utf8',
    })
    setDialogVisible(true)
  }

  // 打开编辑项目对话框
  const handleEdit = () => {
    if (!selectedProject) return
    setEditingProject(selectedProject)
    form.setFieldsValue(selectedProject)
    setDialogVisible(true)
  }

  // 保存项目（添加或更新）
  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const projectData: Project = {
        ...values,
        p4_charset: values.p4_charset || 'utf8',
      }

      if (editingProject) {
        await updateProject(editingProject.name, projectData)
        message.success(`已更新项目: ${projectData.name}`)
      } else {
        await addProject(projectData)
        message.success(`已添加项目: ${projectData.name}`)
      }

      setDialogVisible(false)
      form.resetFields()
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    }
  }

  // 删除项目
  const handleDelete = async () => {
    if (!selectedProject) return
    try {
      await deleteProject(selectedProject.name)
      message.success(`已删除项目: ${selectedProject.name}`)
    } catch (error) {
      message.error('删除项目失败')
    }
  }

  // 打开项目文件夹
  const handleOpenFolder = async () => {
    if (!selectedProject) return
    try {
      // 跨平台打开文件夹
      const platform = await window.electronAPI.getPlatform()
      let command = ''

      if (platform === 'darwin') {
        // macOS
        command = `open "${selectedProject.path}"`
      } else if (platform === 'win32') {
        // Windows
        command = `start "" "${selectedProject.path}"`
      } else {
        // Linux
        command = `xdg-open "${selectedProject.path}"`
      }

      const result = await window.electronAPI.execCommand(command)
      message.success('已打开项目文件夹')
      console.log('Open folder result:', result)
    } catch (error) {
      console.error('Failed to open folder:', error)
      message.error('打开文件夹失败')
    }
  }

  // 重置构建配置
  // const handleResetBuildConfig = () => {
  //   if (selectedProject) {
  //     setTempBuildConfig(selectedProject.build_config || 'Development')
  //     setTempPlatform(selectedProject.platform || 'Win64')
  //     message.success('已重置为项目默认配置')
  //   }
  // }

  // 生成并编译 TypeScript
  const handleGenerateTypeScript = async () => {
    if (!selectedProject) return

    try {
      // 获取脚本路径
      const scriptPath = await window.electronAPI.getAppPath()
      const compileScript = `${scriptPath}/scripts/project-tools/compile-typescript.bat`

      // 准备参数：项目路径
      const args = [selectedProject.path]

      // 使用终端执行
      dispatchTerminalTask(`${selectedProject.name} - 编译 TS`, compileScript, args, selectedProject.path)
      message.success('已启动 TypeScript 编译任务')
    } catch (error) {
      console.error('Failed to start TypeScript compilation:', error)
      message.error(`启动编译失败: ${error}`)
    }
  }

  // 打开项目
  const handleOpenProject = async () => {
    if (!selectedProject) return

    try {
      message.loading({ content: '正在打开项目...', key: 'open', duration: 0 })

      // 获取脚本路径
      const scriptPath = await window.electronAPI.getAppPath()
      const openScript = `${scriptPath}/scripts/project-tools/open-in-rider.bat`

      // 从配置中获取 Rider 路径
      let riderPath = selectedProject.rider_path || ''

      if (!riderPath) {
        // 如果项目配置中没有 Rider 路径，尝试自动查找
        const platform = await window.electronAPI.getPlatform()

        let riderPattern = ''
        if (platform === 'win32') {
          // Windows 路径
          riderPattern = 'C:/Program Files/JetBrains/JetBrains Rider */bin/rider64.exe'
        } else if (platform === 'darwin') {
          // macOS 路径
          riderPattern = '/Applications/JetBrains Rider*.app/Contents/MacOS/rider'
        } else {
          // Linux 路径
          riderPattern = '/opt/JetBrains/Rider-*/bin/rider.sh'
        }

        const riderMatches = await window.electronAPI.findFiles(riderPattern)

        if (riderMatches && riderMatches.length > 0) {
          // 如果找到多个版本，选择最新的（按字母排序，版本号越大越靠后）
          riderPath = riderMatches.sort()[riderMatches.length - 1]
          console.log(`🔍 自动找到 Rider: ${riderPath}`)
        } else {
          message.error({
            content:
              '未找到 JetBrains Rider 安装路径\n\n请在项目配置中设置 rider_path 字段\n或安装 Rider 到默认位置',
            key: 'open',
            duration: 5,
          })
          return
        }
      }

      // 准备参数：Rider 路径、项目路径
      const params = [riderPath, selectedProject.path]

      console.log(`📋 Rider 路径: ${riderPath}`)
      console.log(`📋 工作目录: ${selectedProject.path}`)

      // 使用终端会话执行脚本，输出将显示在终端面板
      dispatchTerminalTask(
        `${selectedProject.name} - 打开项目 (Rider)`,
        openScript,
        params,
        selectedProject.path
      )
      message.success({ content: '✅ 已启动 Rider 打开任务', key: 'open' })
    } catch (error) {
      console.error('Open project failed:', error)
      message.error({ content: `❌ 打开项目失败: ${error}`, key: 'open' })
    }
  }

  // P4 同步项目
  const handleSyncProject = async () => {
    if (!selectedProject) return

    // 检查 P4 配置
    if (!selectedProject.p4_workspace) {
      message.warning('此项目未配置 P4 工作区，请先编辑项目添加 P4 配置')
      return
    }

    try {
      // 获取脚本路径
      const scriptPath = await window.electronAPI.getAppPath()
      const updateScript = `${scriptPath}/scripts/project-tools/sync-perforce.bat`

      // 准备参数
      const args = [
        selectedProject.p4_server || '',
        selectedProject.p4_user || '',
        selectedProject.p4_charset || 'utf8',
        selectedProject.p4_workspace || '',
        selectedProject.path,
        '', // sync_path (空表示同步整个项目)
        'false', // force_sync
      ]

      // 使用终端执行
      dispatchTerminalTask(
        `${selectedProject.name} - P4 同步`,
        updateScript,
        args,
        selectedProject.path
      )
      message.success('已启动 P4 同步任务')
    } catch (error) {
      console.error('Failed to start sync:', error)
      message.error(`启动同步失败: ${error}`)
    }
  }

  // 构建编辑器
  const handleBuildEditor = async () => {
    if (!selectedProject) return

    try {
      // 获取脚本路径
      const scriptPath = await window.electronAPI.getAppPath()
      const buildScript = `${scriptPath}/scripts/project-tools/build-unreal-target.bat`

      // 准备参数：项目路径、构建配置、平台
      const args = [selectedProject.path, tempBuildConfig, tempPlatform]

      // 使用终端执行
      dispatchTerminalTask(
        `${selectedProject.name} - 构建编辑器 (${tempBuildConfig}/${tempPlatform})`,
        buildScript,
        args,
        selectedProject.path
      )
      message.success('已启动编辑器构建任务')
    } catch (error) {
      console.error('Failed to start build:', error)
      message.error(`启动构建失败: ${error}`)
    }
  }

  // 构建游戏
  const handleBuildGame = async () => {
    if (!selectedProject) return

    try {
      // 获取脚本路径
      const scriptPath = await window.electronAPI.getAppPath()
      const buildScript = `${scriptPath}/scripts/project-tools/build-unreal-target.bat`

      // 准备参数：项目路径、构建配置、平台
      const args = [selectedProject.path, tempBuildConfig, tempPlatform]

      // 使用终端执行
      dispatchTerminalTask(
        `${selectedProject.name} - 构建游戏 (${tempBuildConfig}/${tempPlatform})`,
        buildScript,
        args,
        selectedProject.path
      )
      message.success('已启动游戏构建任务')
    } catch (error) {
      console.error('Failed to start build:', error)
      message.error(`启动构建失败: ${error}`)
    }
  }

  // 浏览项目路径
  const handleBrowsePath = async () => {
    try {
      const path = await window.electronAPI.selectFolder({})
      if (path) {
        form.setFieldsValue({ path })
      }
    } catch (error) {
      console.error('Failed to select folder:', error)
    }
  }

  // 自动检测 P4 工作区
  const handleDetectP4Workspace = async () => {
    const path = form.getFieldValue('path')
    if (!path) {
      message.warning('请先输入项目路径')
      return
    }

    try {
      message.loading({ content: '正在检测 P4 工作区...', key: 'detect' })

      // 跨平台执行 p4 info 命令
      const platform = await window.electronAPI.getPlatform()
      let command = ''

      if (platform === 'win32') {
        // Windows: 使用 cmd /c
        command = `cmd /c "cd /d "${path}" && p4 info"`
      } else {
        // macOS/Linux: 使用 sh -c
        command = `sh -c 'cd "${path}" && p4 info'`
      }

      const result = await window.electronAPI.execCommand(command)

      // 解析 p4 info 输出，查找 Client name
      const match = result.match(/Client name:\s*(.+)/i)
      if (match && match[1]) {
        const clientName = match[1].trim()
        form.setFieldsValue({ p4_workspace: clientName })
        message.success({ content: `已检测到 P4 工作区：${clientName}`, key: 'detect' })
      } else {
        message.warning({ content: '无法检测到 P4 工作区，请手动输入', key: 'detect' })
      }
    } catch (error) {
      console.error('P4 workspace detection failed:', error)
      message.error({
        content: '检测失败：请确认 P4 命令行工具已安装且该目录是 P4 工作区',
        key: 'detect',
      })
    }
  }

  // Project Card Component
  const ProjectCard = ({ project }: { project: Project }) => {
    const isSelected = selectedProject?.name === project.name

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        onClick={() => setSelectedProject(project)}
        style={{
          cursor: 'pointer',
          background: isSelected ? `rgba(var(--primary-rgb), 0.1)` : colors.bgSecondary,
          border: isSelected ? `1px solid ${colors.primary}` : `1px solid ${colors.borderPrimary}`,
          borderRadius: 12,
          padding: 16,
          height: '100%',
          position: 'relative',
          boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: colors.bgTertiary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FolderOutlined style={{ fontSize: 20, color: colors.primary }} />
          </div>
          {isSelected && <Tag color="blue">Selected</Tag>}
        </div>

        <Title level={5} style={{ margin: '0 0 8px 0', color: colors.textPrimary }} ellipsis>
          {project.name}
        </Title>

        <Text
          type="secondary"
          style={{ fontSize: 12, display: 'block', marginBottom: 12 }}
          ellipsis
        >
          {project.path}
        </Text>

        <Space size={[0, 8]} wrap>
          <Tag style={{ margin: 0 }}>{project.engine_version}</Tag>
          <Tag style={{ margin: 0 }}>{project.platform}</Tag>
        </Space>
      </motion.div>
    )
  }

  return (
    <div
      style={{
        height: '100%',
        padding: '16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Space>
          <Title level={4} style={{ margin: 0 }}>
            Projects
          </Title>
          <Tag color="default">{projects.length}</Tag>
        </Space>
        <Space>
          <Input.Search
            placeholder="Search projects..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Button icon={<SyncOutlined />} onClick={handleRefresh} loading={loading}>
            Sync
          </Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={handleAdd}>
            New Project
          </Button>
        </Space>
      </div>

      <Row gutter={[24, 24]} style={{ flex: 1, minHeight: 0 }}>
        {/* Project Grid */}
        <Col
          span={selectedProject ? 16 : 24}
          style={{ height: '100%', overflow: 'auto', paddingRight: 8 }}
        >
          {filteredProjects.length > 0 ? (
            <Row gutter={[16, 16]}>
              {filteredProjects.map((project) => (
                <Col key={project.name} xs={24} sm={12} md={8} lg={8} xl={6}>
                  <ProjectCard project={project} />
                </Col>
              ))}
            </Row>
          ) : (
            <Empty description="No projects found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Col>

        {/* Details Panel */}
        {selectedProject && (
          <Col span={8} style={{ height: '100%' }}>
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              style={{ height: '100%' }}
            >
              <Card
                title={selectedProject.name}
                extra={
                  <Space>
                    <Button type="text" icon={<EditOutlined />} onClick={handleEdit} />
                    <Popconfirm
                      title="Delete project?"
                      onConfirm={handleDelete}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                    <Button
                      type="text"
                      icon={<MoreOutlined />}
                      onClick={() => setSelectedProject(null)}
                    />
                  </Space>
                }
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  background: colors.bgSecondary,
                }}
                styles={{ body: { flex: 1, overflow: 'auto', padding: 20 } }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  {/* Quick Actions Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Button block icon={<FolderOpenOutlined />} onClick={handleOpenFolder}>
                      Folder
                    </Button>
                    <Button block icon={<CodeOutlined />} onClick={handleOpenProject}>
                      IDE
                    </Button>
                    <Button
                      block
                      icon={<SyncOutlined />}
                      onClick={handleSyncProject}
                      disabled={!selectedProject.p4_workspace}
                    >
                      P4 Sync
                    </Button>
                    <Button
                      block
                      icon={<DesktopOutlined />}
                      onClick={() => setActiveWidget('terminal')}
                    >
                      Terminal
                    </Button>
                  </div>

                  <Divider style={{ margin: '12px 0' }} />

                  {/* Build Config */}
                  <div>
                    <Title level={5} style={{ fontSize: 14, marginBottom: 12 }}>
                      Build Configuration
                    </Title>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Row gutter={8}>
                        <Col span={12}>
                          <Select
                            value={tempBuildConfig}
                            onChange={setTempBuildConfig}
                            style={{ width: '100%' }}
                            placeholder="Config"
                          >
                            {BUILD_CONFIGS.map((c) => (
                              <Select.Option key={c} value={c}>
                                {c}
                              </Select.Option>
                            ))}
                          </Select>
                        </Col>
                        <Col span={12}>
                          <Select
                            value={tempPlatform}
                            onChange={setTempPlatform}
                            style={{ width: '100%' }}
                            placeholder="Platform"
                          >
                            {PLATFORMS.map((p) => (
                              <Select.Option key={p} value={p}>
                                {p}
                              </Select.Option>
                            ))}
                          </Select>
                        </Col>
                      </Row>

                      <Button
                        block
                        icon={<BuildOutlined />}
                        type="primary"
                        onClick={handleBuildEditor}
                        style={{ marginTop: 8 }}
                      >
                        Build Editor
                      </Button>
                      <Button block icon={<BuildOutlined />} onClick={handleBuildGame}>
                        Build Game
                      </Button>
                      <Button block icon={<CodeOutlined />} onClick={handleGenerateTypeScript}>
                        编译 TS
                      </Button>
                    </Space>
                  </div>

                  <Divider style={{ margin: '12px 0' }} />

                  {/* Project Info */}
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="Path">
                      <Text copyable ellipsis style={{ maxWidth: 200 }}>
                        {selectedProject.path}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Engine">
                      <Tag color="blue">{selectedProject.engine_version}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="P4 Workspace">
                      {selectedProject.p4_workspace ? (
                        <Tag color="green">{selectedProject.p4_workspace}</Tag>
                      ) : (
                        <Text type="secondary">Not configured</Text>
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                </Space>
              </Card>
            </motion.div>
          </Col>
        )}
      </Row>

      {/* 添加/编辑项目对话框 */}
      <Modal
        title={editingProject ? '编辑项目' : '添加项目'}
        open={dialogVisible}
        onOk={handleSave}
        onCancel={() => {
          setDialogVisible(false)
          form.resetFields()
        }}
        width={700}
        okText="保存"
        cancelText="取消"
      >
        <Tabs defaultActiveKey="basic">
          <TabPane tab="📋 基本信息" key="basic">
            <Form form={form} layout="vertical">
              <Form.Item
                label="项目名称"
                name="name"
                rules={[{ required: true, message: '请输入项目名称' }]}
              >
                <Input placeholder="例如: MyProject" />
              </Form.Item>

              <Form.Item
                label="项目路径"
                name="path"
                rules={[{ required: true, message: '请输入项目路径' }]}
              >
                <Space.Compact style={{ width: '100%' }}>
                  <Input placeholder="例如: D:/Projects/MyProject" />
                  <Button icon={<FolderOpenOutlined />} onClick={handleBrowsePath}>
                    浏览
                  </Button>
                </Space.Compact>
              </Form.Item>

              <Form.Item label="引擎版本" name="engine_version">
                <Select>
                  {ENGINE_VERSIONS.map((version) => (
                    <Select.Option key={version} value={version}>
                      {version}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="构建配置" name="build_config">
                <Select>
                  {BUILD_CONFIGS.map((config) => (
                    <Select.Option key={config} value={config}>
                      {config}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="目标平台" name="platform">
                <Select>
                  {PLATFORMS.map((platform) => (
                    <Select.Option key={platform} value={platform}>
                      {platform}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane tab="🔄 P4 配置" key="p4">
            <Form form={form} layout="vertical">
              <Form.Item label="P4 服务器 (P4PORT)" name="p4_server">
                <Input placeholder="例如: ssl:p4.example.com:1666" />
              </Form.Item>

              <Form.Item label="P4 用户名 (P4USER)" name="p4_user">
                <Input placeholder="例如: username" />
              </Form.Item>

              <Form.Item label="P4 字符集 (P4CHARSET)" name="p4_charset">
                <Input placeholder="例如: utf8" />
              </Form.Item>

              <Form.Item label="P4 工作区 (P4CLIENT)" name="p4_workspace">
                <Space.Compact style={{ width: '100%' }}>
                  <Input placeholder="例如: MyWorkspace" />
                  <Button onClick={handleDetectP4Workspace}>🔍 自动检测</Button>
                </Space.Compact>
              </Form.Item>

              <Paragraph type="secondary" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                💡 提示：点击「自动检测」可以从项目目录自动获取 P4 工作区名称
              </Paragraph>
            </Form>
          </TabPane>
        </Tabs>
      </Modal>
    </div>
  )
}
