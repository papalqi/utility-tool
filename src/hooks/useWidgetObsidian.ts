/**
 * useWidgetObsidian Hook - Widget 专用的 Obsidian 集成
 *
 * 提供：
 * - 自动同步
 * - 加载状态管理
 * - 错误处理
 * - 上次同步时间跟踪
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { obsidianManager } from '../core/ObsidianManager'
import { TodoItem, CalendarEvent, PomodoroSession, SSHProfile } from '../shared/types'
import { logger } from '@/core/Logger'

type DataType = 'todo' | 'calendar' | 'pomodoro' | 'ssh_profiles'
type DataItem = TodoItem | CalendarEvent | PomodoroSession | SSHProfile

interface UseWidgetObsidianOptions<T extends DataItem> {
  /** Widget ID（用于日志） */
  widgetId: string
  /** 数据类型 */
  dataType: DataType
  /** 模板路径（支持变量：{year}、{week}、{month}、{day}、{date}） */
  template?: string
  /** 是否启用自动同步 */
  autoSync?: boolean
  /** 自动同步间隔（毫秒），默认 60000 (1分钟) */
  syncInterval?: number
  /** 同步后回调 */
  onSync?: (data: T[]) => void
  /** 读取后回调 */
  onRead?: (data: T[]) => void
  /** 错误回调 */
  onError?: (error: Error) => void
}

interface UseWidgetObsidianReturn<T extends DataItem> {
  /** 是否启用 Obsidian */
  isEnabled: boolean
  /** 是否正在同步 */
  syncing: boolean
  /** 是否正在读取 */
  reading: boolean
  /** 上次同步时间 */
  lastSyncTime: Date | null
  /** 错误信息 */
  error: string | null
  /** 同步数据到 Obsidian，返回是否成功 */
  sync: (data: T[]) => Promise<boolean>
  /** 从 Obsidian 读取数据 */
  read: () => Promise<T[]>
  /** 清除错误 */
  clearError: () => void
  /** 手动触发立即同步 */
  forceSync: () => void
}

/**
 * Widget Obsidian Hook
 *
 * @example
 * ```tsx
 * const TodoWidget = () => {
 *   const [todos, setTodos] = useState<TodoItem[]>([])
 *
 *   const { sync, read, syncing, lastSyncTime } = useWidgetObsidian<TodoItem>({
 *     widgetId: 'todo',
 *     dataType: 'todo',
 *     template: '{year}-W{week}.md',
 *     autoSync: true,
 *     syncInterval: 60000,
 *     onSync: () => message.success('已同步到 Obsidian'),
 *   })
 *
 *   const handleLoad = async () => {
 *     const items = await read()
 *     setTodos(items)
 *   }
 *
 *   const handleSave = async () => {
 *     await sync(todos)
 *   }
 * }
 * ```
 */
export function useWidgetObsidian<T extends DataItem>(
  options: UseWidgetObsidianOptions<T>
): UseWidgetObsidianReturn<T> {
  const {
    widgetId,
    dataType,
    template,
    autoSync = false,
    syncInterval = 60000,
    onSync,
    onRead,
    onError,
  } = options

  const isEnabled = obsidianManager.isEnabled()
  const [syncing, setSyncing] = useState(false)
  const [reading, setReading] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const widgetLogger = useRef(logger.createScope(`${widgetId}-Obsidian`))
  const autoSyncTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastDataRef = useRef<T[]>([])

  /**
   * 同步数据到 Obsidian
   */
  const sync = useCallback(
    async (data: T[]) => {
      if (!isEnabled) {
        widgetLogger.current.warn('Obsidian not enabled, skipping sync')
        return false
      }

      try {
        setSyncing(true)
        setError(null)
        widgetLogger.current.info('Syncing to Obsidian', {
          dataType,
          count: data.length,
        })
        let success = false

        switch (dataType) {
          case 'todo':
            if (!template) {
              throw new Error('Obsidian template is required for TODO sync')
            }
            await obsidianManager.syncTodoItems(data as TodoItem[], template)
            success = true
            break
          case 'calendar':
            if (!template) {
              throw new Error('Obsidian template is required for Calendar sync')
            }
            await obsidianManager.syncCalendarEvents(data as CalendarEvent[], template)
            success = true
            break
          case 'pomodoro':
            if (!template) {
              throw new Error('Obsidian template is required for Pomodoro sync')
            }
            await obsidianManager.syncPomodoroSessions(data as PomodoroSession[], template)
            success = true
            break
          case 'ssh_profiles':
            success = await obsidianManager.saveSSHProfiles(data as SSHProfile[])
            break
        }

        if (success) {
          setLastSyncTime(new Date())
          lastDataRef.current = data
          onSync?.(data)
          widgetLogger.current.info('Sync completed', { count: data.length })
        } else {
          widgetLogger.current.warn('Sync did not complete successfully')
        }
        return success
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        widgetLogger.current.error('Sync failed', err as Error)
        onError?.(err as Error)
        return false
      } finally {
        setSyncing(false)
      }
    },
    [isEnabled, dataType, template, onSync, onError]
  )

  /**
   * 从 Obsidian 读取数据
   */
  const read = useCallback(async (): Promise<T[]> => {
    if (!isEnabled) {
      widgetLogger.current.warn('Obsidian not enabled, returning empty data')
      return []
    }

    try {
      setReading(true)
      setError(null)
      widgetLogger.current.info('Reading from Obsidian', { dataType })

      let data: T[] = []

      switch (dataType) {
        case 'todo':
          if (!template) {
            throw new Error('Obsidian template is required for TODO read')
          }
          data = (await obsidianManager.readTodoItems(template)) as T[]
          break
        case 'calendar':
          if (!template) {
            throw new Error('Obsidian template is required for Calendar read')
          }
          data = (await obsidianManager.readCalendarEvents(template)) as T[]
          break
        case 'pomodoro':
          if (!template) {
            throw new Error('Obsidian template is required for Pomodoro read')
          }
          data = (await obsidianManager.readPomodoroSessions(template)) as T[]
          break
        case 'ssh_profiles':
          data = (await obsidianManager.readSSHProfiles()) as T[]
          break
      }

      onRead?.(data)
      widgetLogger.current.info('Read completed', { count: data.length })

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      widgetLogger.current.error('Read failed', err as Error)
      onError?.(err as Error)
      return []
    } finally {
      setReading(false)
    }
  }, [isEnabled, dataType, template, onRead, onError])

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * 手动触发立即同步
   */
  const forceSync = useCallback(() => {
    if (lastDataRef.current.length > 0) {
      sync(lastDataRef.current)
    }
  }, [sync])

  /**
   * 自动同步
   */
  useEffect(() => {
    if (!autoSync || !isEnabled) {
      return
    }

    widgetLogger.current.info('Auto-sync enabled', {
      interval: syncInterval,
    })

    // 清除之前的定时器
    if (autoSyncTimerRef.current) {
      clearInterval(autoSyncTimerRef.current)
    }

    // 设置新的定时器
    autoSyncTimerRef.current = setInterval(() => {
      if (lastDataRef.current.length > 0) {
        widgetLogger.current.debug('Auto-syncing...')
        sync(lastDataRef.current)
      }
    }, syncInterval)

    return () => {
      if (autoSyncTimerRef.current) {
        clearInterval(autoSyncTimerRef.current)
        widgetLogger.current.info('Auto-sync disabled')
      }
    }
  }, [autoSync, isEnabled, syncInterval, sync])

  return {
    isEnabled,
    syncing,
    reading,
    lastSyncTime,
    error,
    sync,
    read,
    clearError,
    forceSync,
  }
}

export default useWidgetObsidian
