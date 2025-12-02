/**
 * Hooks 统一导出
 * 
 * @example
 * ```tsx
 * import { useGitHubRepos, useConfig, useResourceMonitor } from '@/hooks'
 * ```
 */

// API Hooks - IPC 调用封装
export * from './api'

// System Hooks - 系统功能
export * from './system'

// Widget Hooks - 现有小部件基础设施
export { useWidget } from './useWidget'
export { useWidgetActions } from './useWidgetActions'
export { useWidgetConfig } from './useWidgetConfig'
export { useWidgetObsidian } from './useWidgetObsidian'
export { useWidgetStorage } from './useWidgetStorage'

// Other Hooks - 其他通用功能
export { useTheme } from './useTheme'
export { useNotifier } from './useNotifier'
export { useObsidian } from './useObsidian'
export { useProjects } from './useProjects'
