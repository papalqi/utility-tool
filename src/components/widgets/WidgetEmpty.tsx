/**
 * WidgetEmpty - Widget 空状态组件
 *
 * 用于显示无数据、无结果等空状态
 */

import React from 'react'
import { Empty, Button } from 'antd'
import { PlusOutlined } from '@ant-design/icons'

interface WidgetEmptyProps {
  /** 描述文字 */
  description?: string
  /** 图片URL或ReactNode */
  image?: React.ReactNode
  /** 操作按钮文字 */
  actionText?: string
  /** 操作按钮图标 */
  actionIcon?: React.ReactNode
  /** 操作按钮回调 */
  onAction?: () => void
}

export const WidgetEmpty: React.FC<WidgetEmptyProps> = ({
  description = '暂无数据',
  image,
  actionText,
  actionIcon = <PlusOutlined />,
  onAction,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        minHeight: 200,
      }}
    >
      <Empty image={image || Empty.PRESENTED_IMAGE_SIMPLE} description={description}>
        {actionText && onAction && (
          <Button type="primary" icon={actionIcon} onClick={onAction}>
            {actionText}
          </Button>
        )}
      </Empty>
    </div>
  )
}

export default WidgetEmpty
