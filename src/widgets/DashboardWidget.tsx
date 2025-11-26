import React, { useEffect, useState, useCallback, memo } from 'react'
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Space,
  List,
  Button,
  Empty,
  Avatar,
  Spin,
  Alert,
  Tooltip,
} from 'antd'
import {
  CheckSquareOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  RocketOutlined,
  RightOutlined,
  ProjectOutlined,
  CodeOutlined,
} from '@ant-design/icons'
import { useTheme } from '@/contexts/ThemeContext'
import { motion } from 'framer-motion'
import { useNavigation } from '@/context/NavigationContext'
import { obsidianManager } from '@/core/ObsidianManager'
import { configManager } from '@/core/ConfigManager'
import type { TodoItem, Project, CalendarEvent } from '@/shared/types'
import ResourceMonitorCard from '@/components/widgets/ResourceMonitorCard'
import QuickLinksCard from '@/components/widgets/QuickLinksCard'

const { Title, Text } = Typography

const DashboardWidget: React.FC = () => {
  const { colors } = useTheme()
  const { setActiveWidget } = useNavigation()
  const [time, setTime] = useState(new Date())

  // 真实数据状态
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // 1. 检查 Obsidian 是否启用
      const isObsidianEnabled = obsidianManager.isEnabled()

      if (isObsidianEnabled) {
        // 2. 加载 Todo
        const globalConfig = configManager.getConfig().global?.obsidian?.content_files
        const template = globalConfig?.template || '{year}-W{week}.md'

        // 并行加载数据
        const [loadedTodos, loadedEvents] = await Promise.all([
          obsidianManager.readTodoItems(template),
          obsidianManager.readCalendarEvents(template),
        ])

        // 过滤未完成的 Todo，取前 5 条
        const activeTodos = loadedTodos
          .filter((t) => !t.done)
          .sort((a, b) => {
            // 简单的优先级排序：high > medium > low
            const pMap: Record<string, number> = { high: 3, medium: 2, low: 1 }
            return (pMap[b.priority || 'medium'] || 0) - (pMap[a.priority || 'medium'] || 0)
          })
          .slice(0, 5)

        setTodos(activeTodos)

        // 过滤今天的日程
        const todayStr = new Date().toISOString().split('T')[0]
        const todayEvents = loadedEvents
          .filter((e) => e.date === todayStr)
          .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'))
          .slice(0, 5)

        setEvents(todayEvents)

        // 3. 加载项目 (需要先获取主机名)
        const hostname = await window.electronAPI.getHostname()
        const loadedProjects = await obsidianManager.getProjectsForComputer(hostname)
        setProjects(loadedProjects)
      } else {
        // Obsidian 未启用，尝试只加载项目
        try {
          const hostname = await window.electronAPI.getHostname()
          const loadedProjects = await obsidianManager.getProjectsForComputer(hostname)
          setProjects(loadedProjects)
        } catch {
          // 忽略项目加载错误
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
      setError('部分数据加载失败，请检查 Obsidian 配置')
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始加载和定时刷新 (例如每5分钟刷新一次)
  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [loadData])

  // 项目统计
  const activeProjectsCount = projects.length // 暂时简化，视为所有项目都是 Active

  // 卡片通用样式
  const cardStyle: React.CSSProperties = {
    background: colors.bgSecondary,
    border: `1px solid ${colors.borderPrimary}`,
    borderRadius: 16,
    height: '100%',
    overflow: 'hidden',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  }

  // 欢迎语
  const getGreeting = () => {
    const hour = time.getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 18) return 'Good Afternoon'
    return 'Good Evening'
  }

  return (
    <div style={{ padding: '0 8px' }}>
      {/* 欢迎区域 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ marginBottom: 24 }}
      >
        <Space direction="vertical" size={0}>
          <Title level={2} style={{ margin: 0, color: colors.textPrimary }}>
            {getGreeting()}, User
          </Title>
          <Text type="secondary">Here&apos;s what&apos;s happening today.</Text>
        </Space>
      </motion.div>

      {error && (
        <Alert type="warning" message={error} showIcon style={{ marginBottom: 16 }} closable />
      )}

      <Row gutter={[16, 16]}>
        {/* 左侧主区域 */}
        <Col span={16}>
          <Row gutter={[16, 16]}>
            {/* 顶部统计与操作 - 分为三列 */}
            <Col span={8}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
                style={{ height: '100%' }}
              >
                <Card
                  style={{
                    ...cardStyle,
                    background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`,
                    border: 'none',
                  }}
                  styles={{
                    body: {
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      padding: '16px',
                    },
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
                    {time.toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  <Title level={2} style={{ color: '#fff', margin: '4px 0 0 0', fontSize: 32 }}>
                    {time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </Title>
                </Card>
              </motion.div>
            </Col>

            <Col span={8}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
                style={{ height: '100%' }}
              >
                <Card style={cardStyle} bordered={false}>
                  <div style={headerStyle}>
                    <Space>
                      <ProjectOutlined style={{ color: colors.primary }} />
                      <Text strong>Projects</Text>
                    </Space>
                    <Button
                      type="text"
                      size="small"
                      icon={<RightOutlined />}
                      onClick={() => setActiveWidget('projects')}
                    />
                  </div>
                  <Statistic
                    title="Total Active"
                    value={activeProjectsCount}
                    valueStyle={{ color: colors.textPrimary, fontSize: 24 }}
                  />
                </Card>
              </motion.div>
            </Col>

            <Col span={8}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
                style={{ height: '100%' }}
              >
                <Card style={cardStyle} bordered={false}>
                  <div style={headerStyle}>
                    <Space>
                      <RocketOutlined style={{ color: colors.primary }} />
                      <Text strong>Actions</Text>
                    </Space>
                  </div>
                  <Space size="small" wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Tooltip title="New Task">
                      <Button
                        type="primary"
                        shape="circle"
                        icon={<CheckSquareOutlined />}
                        onClick={() => setActiveWidget('todo')}
                      />
                    </Tooltip>
                    <Tooltip title="Focus Mode">
                      <Button
                        shape="circle"
                        icon={<ClockCircleOutlined />}
                        onClick={() => setActiveWidget('pomodoro')}
                      />
                    </Tooltip>
                    <Tooltip title="Run Script">
                      <Button
                        shape="circle"
                        icon={<CodeOutlined />}
                        onClick={() => setActiveWidget('scripts')}
                      />
                    </Tooltip>
                  </Space>
                </Card>
              </motion.div>
            </Col>

            {/* 资源监控 - 全宽 */}
            <Col span={24}>
              <motion.div
                whileHover={{ scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <ResourceMonitorCard />
              </motion.div>
            </Col>

            {/* 底部：日程与快捷链接 */}
            <Col span={12}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <Card style={cardStyle} bordered={false}>
                  <div style={headerStyle}>
                    <Space>
                      <CalendarOutlined style={{ color: colors.info }} />
                      <Text strong>Schedule</Text>
                    </Space>
                    <Button type="text" size="small" onClick={() => setActiveWidget('calendar')}>
                      View
                    </Button>
                  </div>

                  {loading ? (
                    <div style={{ textAlign: 'center', padding: 20 }}>
                      <Spin />
                    </div>
                  ) : events.length > 0 ? (
                    <List
                      dataSource={events}
                      size="small"
                      renderItem={(item) => (
                        <List.Item style={{ padding: '8px 0', borderBottom: 'none' }}>
                          <List.Item.Meta
                            avatar={
                              <Avatar
                                size="small"
                                style={{
                                  backgroundColor: colors.bgTertiary,
                                  color: colors.primary,
                                  fontSize: 10,
                                }}
                              >
                                {item.allDay ? 'All' : item.time?.split(':')[0]}
                              </Avatar>
                            }
                            title={
                              <Text
                                style={{ color: colors.textPrimary, fontSize: 13 }}
                                ellipsis
                              >
                                {item.title}
                              </Text>
                            }
                            description={
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {item.allDay
                                  ? 'All Day'
                                  : `${item.time}${item.endTime ? ` - ${item.endTime}` : ''}`}
                              </Text>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty
                      description="No events"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      style={{ margin: '10px 0' }}
                    />
                  )}
                </Card>
              </motion.div>
            </Col>

            <Col span={12}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <QuickLinksCard />
              </motion.div>
            </Col>
          </Row>
        </Col>

        {/* 右侧侧边栏 - 待办事项 */}
        <Col span={8}>
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300 }}
            style={{ height: '100%' }}
          >
            <Card style={{ ...cardStyle, minHeight: 500 }} bordered={false}>
              <div style={headerStyle}>
                <Space>
                  <CheckSquareOutlined style={{ color: colors.success }} />
                  <Text strong>My Tasks</Text>
                </Space>
                <Button type="text" size="small" onClick={() => setActiveWidget('todo')}>
                  All
                </Button>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <Spin />
                </div>
              ) : todos.length > 0 ? (
                <List
                  dataSource={todos}
                  renderItem={(item) => (
                    <List.Item
                      style={{
                        padding: '12px 0',
                        borderBottom: `1px solid ${colors.borderPrimary}`,
                      }}
                    >
                      <Row style={{ width: '100%' }} align="middle">
                        <Col flex="24px">
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background:
                                item.priority === 'high'
                                  ? colors.danger
                                  : item.priority === 'low'
                                    ? colors.info
                                    : colors.warning,
                              marginTop: 4,
                            }}
                          />
                        </Col>
                        <Col flex="auto">
                          <Text
                            delete={item.done}
                            style={{ color: colors.textPrimary }}
                            ellipsis={{ tooltip: item.text }}
                          >
                            {item.text}
                          </Text>
                        </Col>
                      </Row>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="No active tasks" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </motion.div>
        </Col>
      </Row>
    </div>
  )
}

export default memo(DashboardWidget)
