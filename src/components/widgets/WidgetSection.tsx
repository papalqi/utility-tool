/**
 * WidgetSection - Widget 分组区域组件
 *
 * 用于将 Widget 内容分成多个逻辑区域
 */

import React from 'react'
import { Card, Typography, Space } from 'antd'
import { useTheme } from '@/contexts/ThemeContext'

const { Text } = Typography

interface WidgetSectionProps {
  /** 区域标题 */
  title?: string
  /** 图标 */
  icon?: React.ReactNode
  /** 子元素 */
  children: React.ReactNode
  /** 右侧额外内容 */
  extra?: React.ReactNode
  /** 是否可折叠 */
  collapsible?: boolean
  /** 默认是否展开 */
  defaultCollapsed?: boolean
  /** 自定义样式 */
  className?: string
  /** 是否显示边框 */
  bordered?: boolean
}

export const WidgetSection: React.FC<WidgetSectionProps> = ({
  title,
  icon,
  children,
  extra,
  collapsible = false,
  defaultCollapsed = false,
  className,
  bordered = true,
}) => {
  const { colors } = useTheme()
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)

  /**
   * 渲染标题
   */
  const renderTitle = () => {
    if (!title) return undefined

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: collapsible ? 'pointer' : 'default',
        }}
        onClick={() => collapsible && setCollapsed(!collapsed)}
      >
        <Space>
          {icon}
          <Text strong style={{ color: colors.textPrimary }}>
            {title}
          </Text>
        </Space>
        {extra}
      </div>
    )
  }

  return (
    <Card
      title={renderTitle()}
      bordered={bordered}
      className={className}
      size="small"
      style={{
        marginBottom: 16,
        background: colors.bgSecondary,
        borderColor: colors.borderPrimary,
      }}
    >
      {(!collapsible || !collapsed) && children}
    </Card>
  )
}

export default WidgetSection
