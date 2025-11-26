/**
 * useWidgetActions Hook
 * 为 Widget 提供通用操作（刷新、保存、导出等）
 */

import { useCallback, useState } from 'react'
import { logger } from '@/core/Logger'
import { WidgetActions } from '@/shared/widget-types'

interface UseWidgetActionsOptions {
  /** Widget ID（用于日志） */
  widgetId: string
  /** 刷新数据的实现 */
  onRefresh?: () => Promise<void>
  /** 保存数据的实现 */
  onSave?: () => Promise<void>
  /** 导出数据的实现 */
  onExport?: () => void
  /** 重置的实现 */
  onReset?: () => void
}

interface UseWidgetActionsReturn extends WidgetActions {
  /** 是否正在执行操作 */
  isActionInProgress: boolean
  /** 最后一次操作的错误 */
  actionError: string | null
  /** 清除错误 */
  clearError: () => void
}

/**
 * Widget 操作管理 Hook
 *
 * 提供统一的操作接口和状态管理
 *
 * @example
 * ```tsx
 * const MyWidget = () => {
 *   const { refresh, save, isActionInProgress } = useWidgetActions({
 *     widgetId: 'my-widget',
 *     onRefresh: async () => {
 *       // 刷新逻辑
 *       await fetchData()
 *     },
 *     onSave: async () => {
 *       // 保存逻辑
 *       await saveData()
 *     }
 *   })
 *
 *   return (
 *     <div>
 *       <Button onClick={refresh} loading={isActionInProgress}>
 *         刷新
 *       </Button>
 *       <Button onClick={save} loading={isActionInProgress}>
 *         保存
 *       </Button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useWidgetActions(options: UseWidgetActionsOptions): UseWidgetActionsReturn {
  const { widgetId, onRefresh, onSave, onExport, onReset } = options

  const [isActionInProgress, setIsActionInProgress] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  /**
   * 包装异步操作，统一处理加载状态和错误
   */
  const wrapAsyncAction = useCallback(
    (actionName: string, action: () => Promise<void>) => {
      return async () => {
        try {
          setIsActionInProgress(true)
          setActionError(null)
          logger.info(`[${widgetId}] ${actionName} started`)

          await action()

          logger.info(`[${widgetId}] ${actionName} completed`)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          setActionError(errorMessage)
          logger.error(`[${widgetId}] ${actionName} failed`, error as Error)
          throw error
        } finally {
          setIsActionInProgress(false)
        }
      }
    },
    [widgetId]
  )

  /**
   * 包装同步操作
   */
  const wrapSyncAction = useCallback(
    (actionName: string, action: () => void) => {
      return () => {
        try {
          setActionError(null)
          logger.info(`[${widgetId}] ${actionName} started`)

          action()

          logger.info(`[${widgetId}] ${actionName} completed`)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          setActionError(errorMessage)
          logger.error(`[${widgetId}] ${actionName} failed`, error as Error)
        }
      }
    },
    [widgetId]
  )

  /**
   * 刷新操作
   */
  const refresh = onRefresh ? wrapAsyncAction('refresh', onRefresh) : undefined

  /**
   * 保存操作
   */
  const save = onSave ? wrapAsyncAction('save', onSave) : undefined

  /**
   * 导出操作
   */
  const exportAction = onExport ? wrapSyncAction('export', onExport) : undefined

  /**
   * 重置操作
   */
  const reset = onReset ? wrapSyncAction('reset', onReset) : undefined

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setActionError(null)
  }, [])

  return {
    refresh,
    save,
    export: exportAction,
    reset,
    isActionInProgress,
    actionError,
    clearError,
  }
}

export default useWidgetActions
