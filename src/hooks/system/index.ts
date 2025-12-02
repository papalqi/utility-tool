/**
 * System Hooks - 系统级功能 Hook
 */

export { useResourceMonitor } from './useResourceMonitor'
export { useNotification } from './useNotification'

// 类型导出
export type {
  ResourceUsage,
  ProcessInfo,
} from './useResourceMonitor'

export type {
  NotificationOptions,
  NotificationResult,
} from './useNotification'
