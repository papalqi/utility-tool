/**
 * useWidget Hook
 * 为 Widget 提供统一的生命周期管理和通用功能
 *
 * 对应 Python BaseWidget 的功能
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { WidgetMetadata, WidgetLifecycle, WidgetState } from '@/shared/widget-types'
import { logger } from '@/core/Logger'
import { useConfig } from './useConfig'
import { useTheme } from '@/contexts/ThemeContext'
import { useNavigation } from '@/context/NavigationContext'

interface UseWidgetOptions {
  /** Widget 元数据 */
  metadata: WidgetMetadata
  /** 生命周期钩子 */
  lifecycle?: WidgetLifecycle
  /** 是否自动初始化 */
  autoInit?: boolean
}

interface UseWidgetReturn {
  /** Widget 状态 */
  state: WidgetState
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void
  /** 设置错误 */
  setError: (error: string | null) => void
  /** 设置状态消息 */
  setStatus: (status: string) => void
  /** 手动初始化 */
  initialize: () => Promise<void>
  /** Widget 日志器（带作用域） */
  widgetLogger: ReturnType<typeof logger.createScope>
  /** Widget 当前是否可见（活动 TAB） */
  isVisible: boolean
}

/**
 * Widget 核心 Hook
 *
 * 提供：
 * - 统一的状态管理
 * - 生命周期管理
 * - 配置和主题响应
 * - 日志功能
 * - 错误处理
 *
 * @example
 * ```tsx
 * const MyWidget = () => {
 *   const { state, setStatus, widgetLogger } = useWidget({
 *     metadata: {
 *       id: 'my-widget',
 *       displayName: 'My Widget',
 *       // ... other metadata
 *     },
 *     lifecycle: {
 *       onInit: async () => {
 *         // 初始化逻辑
 *       },
 *       onUnmount: () => {
 *         // 清理逻辑
 *       }
 *     }
 *   })
 *
 *   return <div>{state.statusMessage}</div>
 * }
 * ```
 */
export function useWidget(options: UseWidgetOptions): UseWidgetReturn {
  const { metadata, lifecycle, autoInit = true } = options

  // Widget 状态
  const [state, setState] = useState<WidgetState>({
    loading: false,
    error: null,
    statusMessage: '初始化中...',
    initialized: false,
  })

  // 创建 Widget 专用日志器
  const widgetLogger = useRef(logger.createScope(metadata.displayName))

  // 配置和主题（用于响应变化）
  const config = useConfig()
  const { mode: themeMode } = useTheme()
  const { activeWidget } = useNavigation()
  const isVisible = useMemo(() => activeWidget === metadata.id, [activeWidget, metadata.id])

  // 初始化标志
  const initRef = useRef(false)

  /**
   * 设置加载状态
   */
  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }))
  }, [])

  /**
   * 设置错误
   */
  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }))
    if (error) {
      widgetLogger.current.error(error)
    }
  }, [])

  /**
   * 设置状态消息
   */
  const setStatus = useCallback((statusMessage: string) => {
    setState((prev) => ({ ...prev, statusMessage }))
    widgetLogger.current.debug(`Status: ${statusMessage}`)
  }, [])

  /**
   * 初始化 Widget
   */
  const initialize = useCallback(async () => {
    if (initRef.current) {
      widgetLogger.current.warn('Widget already initialized, skipping')
      return
    }

    try {
      widgetLogger.current.info('Initializing widget')
      setLoading(true)
      setError(null)
      setStatus('正在初始化...')

      // 调用生命周期钩子
      if (lifecycle?.onInit) {
        await lifecycle.onInit()
      }

      setState((prev) => ({
        ...prev,
        initialized: true,
        loading: false,
        statusMessage: '就绪',
      }))

      widgetLogger.current.info('Widget initialized successfully')
      initRef.current = true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      widgetLogger.current.error('Failed to initialize widget', error as Error)
      setState((prev) => ({
        ...prev,
        loading: false,
        error: `初始化失败: ${errorMessage}`,
        statusMessage: '初始化失败',
      }))
    }
  }, [lifecycle, setLoading, setError, setStatus])

  /**
   * 挂载时初始化
   */
  useEffect(() => {
    widgetLogger.current.debug('Widget mounted')

    if (autoInit && !initRef.current) {
      initialize()
    }

    // 调用 onMount 钩子
    if (lifecycle?.onMount) {
      lifecycle.onMount()
    }

    // 清理函数
    return () => {
      widgetLogger.current.debug('Widget unmounting')

      // 调用 onUnmount 钩子
      if (lifecycle?.onUnmount) {
        lifecycle.onUnmount()
      }

      // 重置初始化标志
      initRef.current = false
    }
  }, [])

  /**
   * 配置变化时响应
   */
  useEffect(() => {
    if (!state.initialized) return

    widgetLogger.current.debug('Config changed, triggering onConfigChange')

    if (lifecycle?.onConfigChange) {
      lifecycle.onConfigChange()
    }
  }, [config, state.initialized, lifecycle])

  /**
   * 主题变化时响应
   */
  useEffect(() => {
    if (!state.initialized) return

    widgetLogger.current.debug(`Theme changed to: ${themeMode}`)

    if (lifecycle?.onThemeChange) {
      lifecycle.onThemeChange()
    }
  }, [themeMode, state.initialized, lifecycle])

  return {
    state,
    setLoading,
    setError,
    setStatus,
    initialize,
    widgetLogger: widgetLogger.current,
    isVisible,
  }
}

export default useWidget
