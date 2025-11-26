/**
 * WidgetLayout - 统一的 Widget 布局组件
 *
 * 提供：
 * - 标题栏（带操作按钮）
 * - 内容区域
 * - 加载状态
 * - 错误显示
 * - 统一样式
 */

import React from 'react'
import { Card, Space, Button, Spin, Alert, Typography } from 'antd'
import { ReloadOutlined, SaveOutlined, ExportOutlined, SettingOutlined } from '@ant-design/icons'
import { useTheme } from '@/contexts/ThemeContext'

const { Title, Text } = Typography

interface WidgetLayoutProps {
  /** 标题 */
  title: string
  /** 图标 */
  icon?: React.ReactNode
  /** 子元素（内容区域） */
  children: React.ReactNode
  /** 是否显示加载状态 */
  loading?: boolean
  /** 错误信息 */
  error?: string | null
  /** 是否显示刷新按钮 */
  showRefresh?: boolean
  /** 刷新回调 */
  onRefresh?: () => void
  /** 是否显示保存按钮 */
  showSave?: boolean
  /** 保存回调 */
  onSave?: () => void
  /** 是否显示导出按钮 */
  showExport?: boolean
  /** 导出回调 */
  onExport?: () => void
  /** 是否显示设置按钮 */
  showSettings?: boolean
  /** 设置回调 */
  onSettings?: () => void
  /** 额外的操作按钮 */
  extra?: React.ReactNode
  /** 自定义样式 */
  className?: string
  /** 是否显示边框 */
  bordered?: boolean
  /** 是否正在执行操作 */
  actionInProgress?: boolean
}

export const WidgetLayout: React.FC<WidgetLayoutProps> = ({
  title,
  icon,
  children,
  loading = false,
  error = null,
  showRefresh = false,
  onRefresh,
  showSave = false,
  onSave,
  showExport = false,
  onExport,
  showSettings = false,
  onSettings,
  extra,
  className,
  bordered = false,
  actionInProgress = false,
}) => {
  const { colors } = useTheme()

  /**
   * 渲染操作按钮
   */
  const renderActions = () => {
    const actions: React.ReactNode[] = []

    if (showRefresh) {
      actions.push(
        <Button
          key="refresh"
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          loading={actionInProgress}
          size="small"
          disabled={!onRefresh}
        >
          刷新
        </Button>
      )
    }

    if (showSave) {
      actions.push(
        <Button
          key="save"
          icon={<SaveOutlined />}
          onClick={onSave}
          loading={actionInProgress}
          size="small"
          type="primary"
          disabled={!onSave}
        >
          保存
        </Button>
      )
    }

    if (showExport && onExport) {
      actions.push(
        <Button
          key="export"
          icon={<ExportOutlined />}
          onClick={onExport}
          loading={actionInProgress}
          size="small"
        >
          导出
        </Button>
      )
    }

    if (showSettings && onSettings) {
      actions.push(
        <Button key="settings" icon={<SettingOutlined />} onClick={onSettings} size="small" />
      )
    }

    if (extra) {
      actions.push(<div key="extra">{extra}</div>)
    }

    return actions.length > 0 ? <Space>{actions}</Space> : null
  }

  /**
   * 渲染标题
   */
  const renderTitle = () => (
    <Space>
      {icon}
      <Title level={4} style={{ margin: 0, color: colors.textPrimary }}>
        {title}
      </Title>
    </Space>
  )

  return (
    <Card
      title={renderTitle()}
      extra={renderActions()}
      variant={bordered ? 'outlined' : 'borderless'}
      className={className}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent', // 让父容器的 Glass 效果透出来
        transition: 'none', // 禁用过渡动画
      }}
      styles={{
        body: {
          flex: 1,
          overflow: 'auto',
          padding: '16px',
        },
        header: {
          borderBottom: '1px solid var(--glass-border)', // 使用更柔和的边框
          transition: 'none', // 禁用 header 的过渡动画
        },
      }}
    >
      {/* 错误提示 */}
      {error && (
        <Alert
          message="错误"
          description={error}
          type="error"
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 加载状态 */}
      {loading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            height: '100%',
          }}
        >
          <Spin size="large" />
          <Text type="secondary">加载中...</Text>
        </div>
      ) : (
        children
      )}
    </Card>
  )
}

export default WidgetLayout
