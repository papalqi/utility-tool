/**
 * 系统通知 Hook
 * 封装通知相关的 IPC 调用
 */

import { useCallback } from 'react'
import { ipc } from '@/core/ipc-client'

// ==================== 类型定义 ====================

export interface NotificationOptions {
  title: string
  message: string
  channel?: 'auto' | 'system' | 'in-app'
  severity?: 'info' | 'warning' | 'error' | 'success'
}

export interface NotificationResult {
  delivered: boolean
  channel?: string
  error?: string
}

interface UseNotificationReturn {
  notify: (options: NotificationOptions) => Promise<NotificationResult>
  info: (title: string, message: string) => Promise<NotificationResult>
  success: (title: string, message: string) => Promise<NotificationResult>
  warning: (title: string, message: string) => Promise<NotificationResult>
  error: (title: string, message: string) => Promise<NotificationResult>
}

// ==================== Hook 实现 ====================

/**
 * 系统通知 Hook
 * 
 * @example
 * ```tsx
 * function App() {
 *   const { notify, success, error } = useNotification()
 *   
 *   const handleSave = async () => {
 *     try {
 *       await saveData()
 *       success('保存成功', '数据已保存到本地')
 *     } catch (e) {
 *       error('保存失败', e.message)
 *     }
 *   }
 * }
 * ```
 */
export function useNotification(): UseNotificationReturn {
  // 发送通知
  const notify = useCallback(async (options: NotificationOptions): Promise<NotificationResult> => {
    try {
      const result = await ipc.invoke('notification:dispatch', options)
      return result as NotificationResult
    } catch (e) {
      return {
        delivered: false,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }, [])

  // 便捷方法
  const info = useCallback(
    (title: string, message: string) =>
      notify({ title, message, severity: 'info' }),
    [notify]
  )

  const success = useCallback(
    (title: string, message: string) =>
      notify({ title, message, severity: 'success' }),
    [notify]
  )

  const warning = useCallback(
    (title: string, message: string) =>
      notify({ title, message, severity: 'warning' }),
    [notify]
  )

  const error = useCallback(
    (title: string, message: string) =>
      notify({ title, message, severity: 'error' }),
    [notify]
  )

  return {
    notify,
    info,
    success,
    warning,
    error,
  }
}
