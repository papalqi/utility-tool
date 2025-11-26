/**
 * WidgetHeader - Widget 标题组件
 *
 * 用于无需完整 Card 布局的场景
 */

import React from 'react'
import { Space, Typography, Divider } from 'antd'
import { useTheme } from '@/contexts/ThemeContext'

const { Title, Text } = Typography

interface WidgetHeaderProps {
  /** 标题 */
  title: string
  /** 图标 */
  icon?: React.ReactNode
  /** 描述 */
  description?: string
  /** 右侧额外内容 */
  extra?: React.ReactNode
  /** 是否显示分割线 */
  divider?: boolean
}

export const WidgetHeader: React.FC<WidgetHeaderProps> = ({
  title,
  icon,
  description,
  extra,
  divider = true,
}) => {
  const { colors } = useTheme()

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Space direction="vertical" size={0}>
          <Space>
            {icon}
            <Title level={4} style={{ margin: 0, color: colors.textPrimary }}>
              {title}
            </Title>
          </Space>
          {description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {description}
            </Text>
          )}
        </Space>

        {extra}
      </div>

      {divider && <Divider style={{ margin: '0 0 16px 0' }} />}
    </>
  )
}

export default WidgetHeader
