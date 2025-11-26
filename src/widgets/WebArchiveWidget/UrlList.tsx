/**
 * URL 列表组件
 */

import React, { useState, useEffect } from 'react'
import { List, Tag, Typography, Button, Tooltip, Space, Empty, Progress } from 'antd'
import {
  GlobalOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  LoadingOutlined,
  LinkOutlined,
  EditOutlined,
  FieldTimeOutlined,
  LockOutlined,
  LoginOutlined,
} from '@ant-design/icons'
import { useTheme } from '@/contexts/ThemeContext'
import type { WebArchiveItem } from './types'

const { Text, Paragraph } = Typography

interface UrlListProps {
  items: WebArchiveItem[]
  loading?: boolean
  selectedId?: string | null
  checkingIn?: string | null  // 正在签到的项目 ID
  onSelect?: (item: WebArchiveItem) => void
  onCrawl?: (item: WebArchiveItem) => void
  onEdit?: (item: WebArchiveItem) => void
  onDelete?: (item: WebArchiveItem) => void
  onView?: (item: WebArchiveItem) => void
  onToggleAutoRefresh?: (item: WebArchiveItem) => void
  onCheckIn?: (item: WebArchiveItem) => void
}

export const UrlList: React.FC<UrlListProps> = ({
  items,
  loading = false,
  selectedId,
  checkingIn,
  onSelect,
  onCrawl,
  onEdit,
  onDelete,
  onView,
  onToggleAutoRefresh,
  onCheckIn,
}) => {
  const { colors } = useTheme()
  const [now, setNow] = useState(Date.now())

  // 每秒更新一次当前时间，用于倒计时
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const getStatusIcon = (status: WebArchiveItem['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      case 'crawling':
        return <LoadingOutlined style={{ color: colors.primary }} />
      default:
        return <ClockCircleOutlined style={{ color: colors.textSecondary }} />
    }
  }

  /**
   * 格式化相对时间（如"5分钟前"）
   */
  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return '从未'
    const seconds = Math.floor((now - timestamp) / 1000)
    if (seconds < 60) return `${seconds}秒前`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}小时前`
    const days = Math.floor(hours / 24)
    return `${days}天前`
  }

  /**
   * 计算下次刷新时间和进度
   */
  const getRefreshInfo = (item: WebArchiveItem) => {
    if (!item.autoRefresh || !item.lastCrawled) {
      return { nextRefresh: null, progress: 0, timeLeft: '' }
    }

    const interval = item.refreshInterval * 60 * 1000
    const nextRefresh = item.lastCrawled + interval
    const elapsed = now - item.lastCrawled
    const remaining = Math.max(0, nextRefresh - now)
    const progress = Math.min(100, (elapsed / interval) * 100)

    let timeLeft = ''
    const secondsLeft = Math.floor(remaining / 1000)
    if (secondsLeft < 60) {
      timeLeft = `${secondsLeft}秒后`
    } else {
      const minutesLeft = Math.floor(secondsLeft / 60)
      if (minutesLeft < 60) {
        timeLeft = `${minutesLeft}分钟后`
      } else {
        const hoursLeft = Math.floor(minutesLeft / 60)
        timeLeft = `${hoursLeft}小时${minutesLeft % 60}分钟后`
      }
    }

    return { nextRefresh, progress, timeLeft }
  }

  return (
    <List
      loading={loading}
      dataSource={items}
      locale={{
        emptyText: (
          <Empty description="暂无网页存档" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ),
      }}
      renderItem={(item) => (
        <List.Item
          key={item.id}
          style={{
            padding: '12px 16px',
            cursor: 'pointer',
            background: selectedId === item.id ? colors.bgTertiary : 'transparent',
            borderLeft: selectedId === item.id ? `3px solid ${colors.primary}` : 'none',
            transition: 'all 0.2s',
          }}
          onClick={() => onSelect?.(item)}
          actions={[
            item.checkInScriptPath && onCheckIn && (
              <Tooltip title="签到" key="checkin">
                <Button
                  type="text"
                  size="small"
                  icon={<LoginOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    onCheckIn(item)
                  }}
                  loading={checkingIn === item.id}
                />
              </Tooltip>
            ),
            <Tooltip title="在浏览器中打开" key="open">
              <Button
                type="text"
                size="small"
                icon={<LinkOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  window.electronAPI.openExternal(item.url)
                }}
              />
            </Tooltip>,
            <Tooltip title="查看内容" key="view">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  onView?.(item)
                }}
                disabled={!item.content || item.status === 'crawling'}
              />
            </Tooltip>,
            <Tooltip title="编辑" key="edit">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit?.(item)
                }}
              />
            </Tooltip>,
            <Tooltip title="抓取" key="crawl">
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  onCrawl?.(item)
                }}
                loading={item.status === 'crawling'}
              />
            </Tooltip>,
            <Tooltip title="删除" key="delete">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete?.(item)
                }}
              />
            </Tooltip>,
          ]}
        >
          <List.Item.Meta
            avatar={getStatusIcon(item.status)}
            title={
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <Text strong ellipsis style={{ maxWidth: 400 }}>
                  {item.title || item.url}
                </Text>
                {item.tags && item.tags.length > 0 && (
                  <Space size={4} wrap>
                    {item.tags.slice(0, 3).map((tag) => (
                      <Tag key={tag} style={{ margin: 0, fontSize: 11 }}>
                        {tag}
                      </Tag>
                    ))}
                    {item.tags.length > 3 && (
                      <Tag style={{ margin: 0, fontSize: 11 }}>+{item.tags.length - 3}</Tag>
                    )}
                  </Space>
                )}
              </Space>
            }
            description={
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <Paragraph
                  ellipsis={{ rows: 1 }}
                  style={{ margin: 0, fontSize: 12, cursor: 'pointer' }}
                  type="secondary"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.electronAPI.openExternal(item.url)
                  }}
                >
                  <GlobalOutlined style={{ marginRight: 4 }} />
                  <Text type="secondary" underline style={{ fontSize: 12 }}>
                    {item.url}
                  </Text>
                </Paragraph>
                {item.description && (
                  <Paragraph
                    ellipsis={{ rows: 1 }}
                    style={{ margin: 0, fontSize: 12 }}
                    type="secondary"
                  >
                    {item.description}
                  </Paragraph>
                )}
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space size={12} style={{ fontSize: 12 }}>
                    <Text type="secondary">
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      {formatRelativeTime(item.lastCrawled)}
                    </Text>
                    {item.headers && (
                      <Tag color="green" style={{ margin: 0, fontSize: 11 }}>
                        <LockOutlined /> 已配置验证
                      </Tag>
                    )}
                    {item.checkInScriptPath && (
                      <Tooltip title={`脚本: ${item.checkInScriptPath}`}>
                        <Tag color="purple" style={{ margin: 0, fontSize: 11 }}>
                          <LoginOutlined /> 已配置签到
                        </Tag>
                      </Tooltip>
                    )}
                    {item.lastCheckIn && (
                      <Tooltip title={`上次签到: ${formatRelativeTime(item.lastCheckIn)}`}>
                        <Tag 
                          color={item.checkInResult?.success ? 'success' : 'error'} 
                          style={{ margin: 0, fontSize: 11 }}
                        >
                          <LoginOutlined /> {item.checkInResult?.success ? '签到成功' : '签到失败'}
                        </Tag>
                      </Tooltip>
                    )}
                    {item.autoRefresh && (
                      <Tag
                        color="blue"
                        style={{ margin: 0, fontSize: 11, cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleAutoRefresh?.(item)
                        }}
                      >
                        <FieldTimeOutlined /> 自动刷新 ({item.refreshInterval}分钟)
                      </Tag>
                    )}
                    {!item.autoRefresh && onToggleAutoRefresh && (
                      <Tag
                        style={{ margin: 0, fontSize: 11, cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleAutoRefresh(item)
                        }}
                      >
                        点击开启自动刷新
                      </Tag>
                    )}
                  </Space>
                  {item.autoRefresh && item.lastCrawled && (() => {
                    const { progress, timeLeft } = getRefreshInfo(item)
                    return (
                      <Space direction="vertical" size={2} style={{ width: '100%' }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          <FieldTimeOutlined style={{ marginRight: 4 }} />
                          下次刷新: {timeLeft}
                        </Text>
                        <Progress
                          percent={progress}
                          size="small"
                          showInfo={false}
                          strokeColor={colors.primary}
                          trailColor={colors.bgTertiary}
                        />
                      </Space>
                    )
                  })()}
                </Space>
                {item.error && (
                  <Text type="danger" style={{ fontSize: 11 }}>
                    错误: {item.error}
                  </Text>
                )}
              </Space>
            }
          />
        </List.Item>
      )}
    />
  )
}
