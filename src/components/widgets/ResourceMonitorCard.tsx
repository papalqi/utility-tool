import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, Progress, Typography, Space, Modal, Table, Button } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useTheme } from '@/contexts/ThemeContext'
import { DatabaseOutlined, ExpandOutlined } from '@ant-design/icons'

const { Text } = Typography

interface ResourceUsage {
  cpu: number
  memory: { used: number; total: number; percent: number }
  disk: { used: number; total: number; percent: number }
  gpu?: { percent: number; memory?: { used: number; total: number } }
  timestamp: number
}

interface ProcessInfo {
  pid: number
  name: string
  cpu: number
  memory: number
  memPercent: number
}

interface HistoryPoint {
  time: string
  cpu: number
  memory: number
  gpu?: number
}

const MAX_HISTORY_POINTS = 30

const ResourceMonitorCard: React.FC = () => {
  const { colors } = useTheme()
  const safePercent = (n: number | null | undefined) => {
    const v = typeof n === 'number' ? n : 0
    return Number.isFinite(v) && v >= 0 ? Math.min(100, Math.max(0, Math.round(v))) : 0
  }
  const safeFixed = (n: number | null | undefined, digits = 0) => {
    const v = typeof n === 'number' ? n : 0
    return Number.isFinite(v) ? v.toFixed(digits) : (0).toFixed(digits)
  }
  const [currentUsage, setCurrentUsage] = useState<ResourceUsage | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [showProcesses, setShowProcesses] = useState(false)
  const [loading, setLoading] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  const loadingRef = useRef(false)

  const fetchResourceUsage = useCallback(async () => {
    try {
      const usage = (await window.electronAPI.getResourceUsage()) as ResourceUsage
      if (!isMountedRef.current) return
      setCurrentUsage(usage)
      setHistory((prev) => {
        const newPoint: HistoryPoint = {
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          cpu: safePercent(usage.cpu),
          memory: safePercent(usage.memory.percent),
          gpu: usage.gpu ? safePercent(usage.gpu.percent) : undefined,
        }
        return [...prev, newPoint].slice(-MAX_HISTORY_POINTS)
      })
    } catch (error) {
      console.error('Failed to fetch resource usage:', error)
    }
  }, [])

  const fetchProcesses = useCallback(async () => {
    if (loadingRef.current) return
    try {
      loadingRef.current = true
      if (isMountedRef.current) setLoading(true)
      const procs = (await window.electronAPI.getTopProcesses(10)) as ProcessInfo[]
      if (isMountedRef.current) setProcesses(procs)
    } catch (error) {
      console.error('Failed to fetch processes:', error)
    } finally {
      loadingRef.current = false
      if (isMountedRef.current) setLoading(false)
    }
  }, [])

  const scheduleNextFetch = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => {
      if (isMountedRef.current) {
        await fetchResourceUsage()
        scheduleNextFetch()
      }
    }, 3000) // 3 秒刷新间隔
  }, [fetchResourceUsage])

  useEffect(() => {
    isMountedRef.current = true
    fetchResourceUsage()
    scheduleNextFetch()
    return () => {
      isMountedRef.current = false
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [fetchResourceUsage, scheduleNextFetch])

  useEffect(() => {
    if (showProcesses) fetchProcesses()
  }, [showProcesses, fetchProcesses])

  const processColumns: ColumnsType<ProcessInfo> = [
    { title: 'PID', dataIndex: 'pid', key: 'pid', width: 80 },
    { title: '进程名称', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'CPU 时间 (s)', dataIndex: 'cpu', key: 'cpu', width: 120, sorter: (a, b) => a.cpu - b.cpu, render: (value: number) => <Text>{value.toFixed(1)}</Text> },
    { title: '内存 (MB)', dataIndex: 'memory', key: 'memory', width: 120, sorter: (a, b) => a.memory - b.memory, render: (value: number) => <Text>{value}</Text> },
    { title: '内存 (%)', dataIndex: 'memPercent', key: 'memPercent', width: 100, sorter: (a, b) => a.memPercent - b.memPercent, render: (value: number) => <Text>{value.toFixed(1)}%</Text> },
  ]

  const cardStyle: React.CSSProperties = { background: colors.bgSecondary, border: `1px solid ${colors.borderPrimary}`, borderRadius: 16, height: '100%' }

  return (
    <>
      <Card style={cardStyle} bordered={false} title={<Space><DatabaseOutlined style={{ color: colors.primary }} /><Text strong>系统资源监控</Text></Space>} extra={<Button type="text" size="small" icon={<ExpandOutlined />} onClick={() => setShowProcesses(true)}>进程排行</Button>}>
        {currentUsage && (
          <div style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <div><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><Text type="secondary">CPU</Text><Text strong>{safePercent(currentUsage.cpu)}%</Text></div><Progress percent={safePercent(currentUsage.cpu)} strokeColor={colors.primary} showInfo={false} size="small" /></div>
              <div><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><Text type="secondary">内存</Text><Text strong>{safeFixed(currentUsage.memory.used, 1)} / {safeFixed(currentUsage.memory.total, 1)} GB ({safePercent(currentUsage.memory.percent)}%)</Text></div><Progress percent={safePercent(currentUsage.memory.percent)} strokeColor={colors.success} showInfo={false} size="small" /></div>
              {currentUsage.gpu && <div><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><Text type="secondary">GPU</Text><Text strong>{safePercent(currentUsage.gpu.percent)}%</Text></div><Progress percent={safePercent(currentUsage.gpu.percent)} strokeColor={colors.info} showInfo={false} size="small" /></div>}
            </Space>
          </div>
        )}
        {history.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.borderPrimary} />
                <XAxis dataKey="time" stroke={colors.textSecondary} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis stroke={colors.textSecondary} tick={{ fontSize: 10 }} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
                <Tooltip contentStyle={{ backgroundColor: colors.bgSecondary, border: `1px solid ${colors.borderPrimary}`, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="cpu" stroke={colors.primary} strokeWidth={2} dot={false} name="CPU" />
                <Line type="monotone" dataKey="memory" stroke={colors.success} strokeWidth={2} dot={false} name="内存" />
                {currentUsage?.gpu && <Line type="monotone" dataKey="gpu" stroke={colors.info} strokeWidth={2} dot={false} name="GPU" />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <Modal title="进程资源占用排行" open={showProcesses} onCancel={() => setShowProcesses(false)} footer={[<Button key="refresh" onClick={fetchProcesses} loading={loading}>刷新</Button>,<Button key="close" type="primary" onClick={() => setShowProcesses(false)}>关闭</Button>]} width={700}>
        <Table columns={processColumns} dataSource={processes} rowKey="pid" loading={loading} pagination={false} size="small" scroll={{ y: 400 }} />
      </Modal>
    </>
  )
}

export default ResourceMonitorCard
