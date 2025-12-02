/**
 * 系统资源监控 Hook
 * 封装 CPU、内存、磁盘监控相关的 IPC 调用
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { ipc } from '@/core/ipc-client'

// ==================== 类型定义 ====================

export interface ResourceUsage {
  cpu: number
  memory: {
    used: number
    total: number
    percent: number
  }
  disk: {
    used: number
    total: number
    percent: number
  }
  timestamp: number
}

export interface ProcessInfo {
  pid: number
  name: string
  cpu: number
  memory: number
}

interface UseResourceMonitorReturn {
  usage: ResourceUsage | null
  processes: ProcessInfo[]
  loading: boolean
  error: Error | null
  history: ResourceUsage[]
  refresh: () => Promise<void>
  startMonitoring: () => void
  stopMonitoring: () => void
  isMonitoring: boolean
}

interface UseResourceMonitorOptions {
  interval?: number
  historyLength?: number
  autoStart?: boolean
  processLimit?: number
}

// ==================== Hook 实现 ====================

/**
 * 系统资源监控 Hook
 * 
 * @example
 * ```tsx
 * function DashboardWidget() {
 *   const { 
 *     usage, 
 *     processes, 
 *     history, 
 *     isMonitoring,
 *     startMonitoring,
 *     stopMonitoring 
 *   } = useResourceMonitor({
 *     interval: 2000,
 *     historyLength: 60,
 *     autoStart: true,
 *   })
 *   
 *   return (
 *     <div>
 *       <CPUChart data={history} />
 *       <MemoryGauge value={usage?.memory.percent ?? 0} />
 *       <ProcessList processes={processes} />
 *       <Button onClick={isMonitoring ? stopMonitoring : startMonitoring}>
 *         {isMonitoring ? 'Stop' : 'Start'}
 *       </Button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useResourceMonitor(
  options: UseResourceMonitorOptions = {}
): UseResourceMonitorReturn {
  const {
    interval = 2000,
    historyLength = 30,
    autoStart = true,
    processLimit = 10,
  } = options

  const [usage, setUsage] = useState<ResourceUsage | null>(null)
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [history, setHistory] = useState<ResourceUsage[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // 获取资源使用情况
  const fetchUsage = useCallback(async () => {
    try {
      const [usageResult, processResult] = await Promise.all([
        ipc.invoke('resources:getUsage'),
        ipc.invoke('resources:getProcesses', processLimit),
      ])

      const newUsage = usageResult as ResourceUsage
      setUsage(newUsage)
      setProcesses(processResult as ProcessInfo[])

      // 更新历史记录
      setHistory((prev) => {
        const updated = [...prev, newUsage]
        return updated.slice(-historyLength)
      })

      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    }
  }, [processLimit, historyLength])

  // 刷新（单次）
  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchUsage()
    setLoading(false)
  }, [fetchUsage])

  // 开始监控
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return

    setIsMonitoring(true)
    fetchUsage() // 立即获取一次

    timerRef.current = setInterval(fetchUsage, interval)
  }, [isMonitoring, fetchUsage, interval])

  // 停止监控
  const stopMonitoring = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsMonitoring(false)
  }, [])

  // 自动开始
  useEffect(() => {
    if (autoStart) {
      startMonitoring()
    }

    return () => {
      stopMonitoring()
    }
  }, [autoStart, startMonitoring, stopMonitoring])

  return {
    usage,
    processes,
    loading,
    error,
    history,
    refresh,
    startMonitoring,
    stopMonitoring,
    isMonitoring,
  }
}
