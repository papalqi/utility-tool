import React, { useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Drawer, Empty, Segmented, Space, Switch, Tag, Typography } from 'antd'
import {
  ClearOutlined,
  CopyOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { logger, type LogEntry, type LogLevel } from '@/core/Logger'
import { useAppContext } from '@/context/AppContext'
import { useTheme } from '@/contexts/ThemeContext'

const { Text } = Typography
const MAX_LOG_ENTRIES = 500

const levelColors: Record<LogLevel, string> = {
  silly: '#bfbfbf',
  debug: '#8c8c8c',
  verbose: '#91d5ff',
  info: '#1890ff',
  warn: '#faad14',
  error: '#ff4d4f',
}

type FilterLevel = 'all' | LogLevel

const formatEntryLine = (entry: LogEntry): string => {
  const ts = entry.timestamp.toISOString()
  const base = `${ts} [${entry.level.toUpperCase()}] ${entry.message}`
  const dataPart = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
  const errorPart = entry.error
    ? ` ${entry.error instanceof Error ? entry.error.stack || entry.error.message : String(entry.error)}`
    : ''
  return `${base}${dataPart}${errorPart}`
}

export const LogViewerDrawer: React.FC = () => {
  const { message } = App.useApp()
  const { isLogViewerOpen, setIsLogViewerOpen } = useAppContext()
  const { colors } = useTheme()
  const [entries, setEntries] = useState<LogEntry[]>(() => [...logger.getHistory()])
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubscribe = logger.subscribe((entry) => {
      setEntries((prev) => {
        const next = [...prev, entry]
        if (next.length > MAX_LOG_ENTRIES) {
          return next.slice(-MAX_LOG_ENTRIES)
        }
        return next
      })
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!autoScroll || !containerRef.current) {
      return
    }
    containerRef.current.scrollTop = containerRef.current.scrollHeight
  }, [entries, filterLevel, autoScroll])

  const filteredEntries = useMemo(() => {
    if (filterLevel === 'all') {
      return entries
    }
    return entries.filter((entry) => entry.level === filterLevel)
  }, [entries, filterLevel])

  const handleClear = () => {
    logger.clearHistory()
    setEntries([])
    message.success('日志已清空')
  }

  const handleCopy = async () => {
    if (!filteredEntries.length) {
      message.info('没有可复制的日志')
      return
    }

    const text = filteredEntries.map(formatEntryLine).join('\n')
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else if (window.electronAPI?.writeClipboardText) {
        await window.electronAPI.writeClipboardText(text)
      } else {
        throw new Error('当前环境不支持剪贴板写入')
      }
      message.success('日志内容已复制到剪贴板')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '复制失败')
    }
  }

  return (
    <Drawer
      title="运行日志"
      placement="right"
      width={520}
      open={isLogViewerOpen}
      onClose={() => setIsLogViewerOpen(false)}
      mask={false}
      closable
      destroyOnClose={false}
      styles={{
        header: { borderBottom: `1px solid ${colors.borderPrimary}`, background: colors.bgSecondary },
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          background: colors.bgPrimary,
        },
      }}
      extra={
        <Space size="small">
          <Button
            icon={autoScroll ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            type="text"
            onClick={() => setAutoScroll((value) => !value)}
          >
            {autoScroll ? '暂停滚动' : '继续滚动'}
          </Button>
          <Button icon={<ClearOutlined />} onClick={handleClear}>
            清空
          </Button>
          <Button icon={<CopyOutlined />} onClick={handleCopy}>
            复制
          </Button>
        </Space>
      }
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${colors.borderPrimary}`,
          background: colors.bgSecondary,
        }}
      >
        <Space size="large" wrap>
          <div>
            <Text type="secondary" style={{ marginRight: 8 }}>
              显示级别
            </Text>
            <Segmented
              size="small"
              options={[
                { label: '全部', value: 'all' },
                { label: 'Info', value: 'info' },
                { label: 'Warn', value: 'warn' },
                { label: 'Error', value: 'error' },
                { label: 'Debug', value: 'debug' },
              ]}
              value={filterLevel}
              onChange={(value) => setFilterLevel(value as FilterLevel)}
            />
          </div>
          <Space>
            <Text type="secondary">自动滚动</Text>
            <Switch size="small" checked={autoScroll} onChange={setAutoScroll} />
          </Space>
        </Space>
      </div>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          background: colors.bgPrimary,
        }}
      >
        {filteredEntries.length === 0 ? (
          <Empty
            description="暂无日志"
            image={<WarningOutlined style={{ fontSize: 32, color: colors.textSecondary }} />}
          />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {filteredEntries.map((entry, index) => (
              <div
                key={`${entry.timestamp.getTime()}-${index}-${entry.message}`}
                style={{
                  border: `1px solid ${colors.borderPrimary}`,
                  borderRadius: 6,
                  padding: '8px 12px',
                  background:
                    entry.level === 'error'
                      ? 'rgba(255, 77, 79, 0.08)'
                      : entry.level === 'warn'
                        ? 'rgba(250, 173, 20, 0.08)'
                        : colors.bgSecondary,
                }}
              >
                <Space align="start" size="middle" style={{ width: '100%' }}>
                  <Tag color={levelColors[entry.level]} style={{ marginTop: 4 }}>
                    {entry.level.toUpperCase()}
                  </Tag>
                  <div style={{ flex: 1 }}>
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {entry.timestamp.toLocaleString()}
                      </Text>
                      <Text style={{ color: colors.textPrimary }}>{entry.message}</Text>
                      {entry.data != null && (
                        <pre
                          style={{
                            margin: 0,
                            padding: '8px',
                            background: colors.bgPrimary,
                            borderRadius: 4,
                            fontSize: 12,
                            overflowX: 'auto',
                          }}
                        >
                          {JSON.stringify(entry.data, null, 2)}
                        </pre>
                      )}
                      {entry.error && (
                        <pre
                          style={{
                            margin: 0,
                            padding: '8px',
                            background: 'rgba(255,77,79,0.1)',
                            borderRadius: 4,
                            fontSize: 12,
                            overflowX: 'auto',
                          }}
                        >
                          {entry.error instanceof Error
                            ? entry.error.stack || entry.error.message
                            : String(entry.error)}
                        </pre>
                      )}
                    </Space>
                  </div>
                </Space>
              </div>
            ))}
          </Space>
        )}
      </div>
    </Drawer>
  )
}

export default LogViewerDrawer
