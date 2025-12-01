import { useMemo, useState, useEffect, memo } from 'react'
import { Layout, Menu, Button, Drawer, Checkbox, Typography, Space, Divider, message } from 'antd'
import {
  RobotOutlined,
  ApiOutlined,
  MessageOutlined,
  CheckSquareOutlined,
  CalendarOutlined,
  CodeOutlined,
  CloudUploadOutlined,
  DesktopOutlined,
  ToolOutlined,
  MobileOutlined,
  FolderOutlined,
  ExperimentOutlined,
  GithubOutlined,
  GatewayOutlined,
  ControlOutlined,
  GlobalOutlined,
} from '@ant-design/icons'
import { configManager } from '../core/ConfigManager'
import type { AppConfig } from '../shared/types'
import { DEFAULT_VISIBLE_TABS } from '../config/widgetKeys'

const { Sider } = Layout
const { Text } = Typography

interface SidebarProps {
  activeWidget: string
  onWidgetChange: (widget: string) => void
  config: AppConfig | null
}

const BASE_MENU_ITEMS = [
  {
    key: 'dashboard',
    icon: <DesktopOutlined />,
    label: '仪表盘',
  },
  {
    key: 'ai-cli',
    icon: <RobotOutlined />,
    label: 'AI CLI',
  },
  {
    key: 'generic-ai',
    icon: <ApiOutlined />,
    label: 'AI 配置',
  },
  {
    key: 'ai-chat',
    icon: <MessageOutlined />,
    label: 'AI 对话',
  },
  {
    key: 'file-transfer',
    icon: <CloudUploadOutlined />,
    label: '文件传输',
  },
  {
    key: 'todo',
    icon: <CheckSquareOutlined />,
    label: 'TODO',
  },
  {
    key: 'calendar',
    icon: <CalendarOutlined />,
    label: 'Calendar',
  },
  {
    key: 'scripts',
    icon: <CodeOutlined />,
    label: 'Scripts',
  },
  {
    key: 'environment',
    icon: <GatewayOutlined />,
    label: '环境变量',
  },
  {
    key: 'terminal',
    icon: <DesktopOutlined />,
    label: 'Terminal',
  },
  {
    key: 'renderdoc',
    icon: <ToolOutlined />,
    label: 'RenderDoc',
  },
  {
    key: 'adb',
    icon: <MobileOutlined />,
    label: 'ADB',
  },
  {
    key: 'projects',
    icon: <FolderOutlined />,
    label: 'Projects',
  },
  {
    key: 'github',
    icon: <GithubOutlined />,
    label: 'GitHub',
  },
  {
    key: 'web-archive',
    icon: <GlobalOutlined />,
    label: '网页存档',
  },
]

const Sidebar = ({ activeWidget, onWidgetChange, config }: SidebarProps) => {
  const isDev = import.meta.env.DEV
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selection, setSelection] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  const menuItems = useMemo(() => {
    if (!isDev) {
      return BASE_MENU_ITEMS
    }
    return [
      ...BASE_MENU_ITEMS,
      {
        key: 'test-widget',
        icon: <ExperimentOutlined />,
        label: 'Test Widget',
      },
    ]
  }, [isDev])

  const menuKeys = useMemo(() => menuItems.map((item) => item.key), [menuItems])

  const configuredVisibleTabs = useMemo(
    () => config?.ui?.visible_tabs?.filter((tab) => menuKeys.includes(tab)) ?? [],
    [config?.ui?.visible_tabs, menuKeys]
  )

  const visibleTabs = useMemo(() => {
    if (configuredVisibleTabs.length > 0) {
      return configuredVisibleTabs
    }
    const fallback = DEFAULT_VISIBLE_TABS.filter((tab) => menuKeys.includes(tab))
    return fallback.length > 0 ? fallback : menuKeys
  }, [configuredVisibleTabs, menuKeys])
  const hiddenCount = menuKeys.length - visibleTabs.length

  useEffect(() => {
    if (drawerOpen) {
      setSelection(visibleTabs)
    }
  }, [drawerOpen, visibleTabs])

  const filteredMenuItems = menuItems.filter((item) => visibleTabs.includes(item.key))

  const handleTabToggle = (key: string, checked: boolean) => {
    if (!checked && selection.length <= 1) {
      messageApi.warning('请至少保留一个 Tab')
      return
    }
    setSelection((prev) => {
      if (checked) {
        if (prev.includes(key)) return prev
        return [...prev, key]
      }
      return prev.filter((item) => item !== key)
    })
  }

  const handleSaveTabs = async () => {
    if (!selection.length) {
      messageApi.warning('请选择至少一个 Tab')
      return
    }

    try {
      setSaving(true)
      const nextUi = {
        visible_tabs: selection.filter((tab) => menuKeys.includes(tab)),
      }
      await configManager.updateSection('ui', nextUi)
      setDrawerOpen(false)
      messageApi.success('Tab 列表已更新')
    } catch (error) {
      console.error(error)
      messageApi.error('更新应用的 Tab 列表失败')
    } finally {
      setSaving(false)
    }
  }

  const handleRestoreTabs = () => {
    setSelection(DEFAULT_VISIBLE_TABS.filter((tab) => menuKeys.includes(tab)))
  }

  return (
    <>
      {contextHolder}
      <Sider
        width={200}
        className="floating-sidebar"
        style={{
          background: 'transparent', // Handled by class
          borderRight: 0,
          zIndex: 9,
        }}
      >
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Menu
            mode="inline"
            selectedKeys={[activeWidget]}
            onClick={({ key }) => onWidgetChange(key)}
            items={filteredMenuItems}
            style={{
              flex: 1,
              borderRight: 0,
              background: 'transparent',
              overflowY: 'auto',
              paddingTop: 8,
            }}
          />
          <div
            style={{
              padding: 12,
              borderTop: '1px solid var(--glass-border)',
              background: 'var(--color-bg-tertiary)',
            }}
          >
            <Button
              block
              ghost
              icon={<ControlOutlined />}
              onClick={() => {
                setSelection(visibleTabs)
                setDrawerOpen(true)
              }}
              style={{
                border: '1px solid var(--glass-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Tab 管理
            </Button>
            {hiddenCount > 0 && (
              <Text style={{ color: '#9ca3af', display: 'block', marginTop: 8, fontSize: 12 }}>
                已隐藏 {hiddenCount} 个 Tab
              </Text>
            )}
          </div>
        </div>
      </Sider>
      <Drawer
        title="Tab 管理"
        placement="left"
        closable
        width={280}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        destroyOnHidden
        footer={
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Button onClick={handleRestoreTabs}>恢复默认</Button>
            <Space>
              <Button onClick={() => setDrawerOpen(false)}>取消</Button>
              <Button type="primary" onClick={handleSaveTabs} loading={saving}>
                保存
              </Button>
            </Space>
          </Space>
        }
      >
        <Text type="secondary">选择需要显示的 Tab</Text>
        <Divider />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 强制显示仪表盘选项 */}
          <Checkbox
            checked={selection.includes('dashboard')}
            onChange={(event) => handleTabToggle('dashboard', event.target.checked)}
          >
            <Space>
              <DesktopOutlined />
              <span>仪表盘</span>
            </Space>
          </Checkbox>
          {menuItems
            .filter((item) => item.key !== 'dashboard')
            .map((item) => (
              <Checkbox
                key={item.key}
                checked={selection.includes(item.key)}
                onChange={(event) => handleTabToggle(item.key, event.target.checked)}
              >
                <Space>
                  {item.icon}
                  <span>{item.label}</span>
                </Space>
              </Checkbox>
            ))}
        </div>
      </Drawer>
    </>
  )
}

export default memo(Sidebar)
