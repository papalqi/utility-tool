/**
 * useWidgetConfig Hook
 * 为 Widget 提供配置段落的管理
 *
 * 自动订阅配置变化，提供类型安全的配置访问
 */

import { useState, useEffect, useCallback } from 'react'
import { useConfig } from './useConfig'
import { WidgetConfigSection } from '@/shared/widget-types'
import { logger } from '@/core/Logger'

interface UseWidgetConfigOptions<T> {
  /** 配置段落名称 */
  section: WidgetConfigSection
  /** 默认配置 */
  defaultConfig?: T
  /** 配置变化回调 */
  onChange?: (config: T) => void
}

interface UseWidgetConfigReturn<T> {
  /** 当前配置 */
  config: T
  /** 更新配置 */
  updateConfig: (updates: Partial<T>) => Promise<void>
  /** 重置为默认配置 */
  resetConfig: () => Promise<void>
  /** 是否正在加载 */
  loading: boolean
  /** 错误信息 */
  error: string | null
}

/**
 * Widget 配置管理 Hook
 *
 * 提供类型安全的配置访问和更新
 *
 * @example
 * ```tsx
 * const MyWidget = () => {
 *   const { config, updateConfig } = useWidgetConfig<PomodoroConfig>({
 *     section: 'pomodoro',
 *     defaultConfig: {
 *       work_duration: 25,
 *       short_break_duration: 5,
 *     },
 *     onChange: (newConfig) => {
 *       console.log('Config changed:', newConfig)
 *     }
 *   })
 *
 *   return (
 *     <div>
 *       <input
 *         value={config.work_duration}
 *         onChange={(e) => updateConfig({ work_duration: Number(e.target.value) })}
 *       />
 *     </div>
 *   )
 * }
 * ```
 */
export function useWidgetConfig<T = Record<string, unknown>>(
  options: UseWidgetConfigOptions<T>
): UseWidgetConfigReturn<T> {
  const { section, defaultConfig, onChange } = options
  const globalConfig = useConfig()

  const [config, setConfig] = useState<T>(() => {
    const sectionConfig = (globalConfig as unknown as Record<string, unknown>)[section] as
      | T
      | undefined
    return sectionConfig || (defaultConfig as T)
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 更新配置
   */
  const updateConfig = useCallback(
    async (updates: Partial<T>) => {
      try {
        setLoading(true)
        setError(null)

        const newConfig = { ...config, ...updates }

        // 更新全局配置
        if (window.electronAPI) {
          const fullConfig = await window.electronAPI.loadConfig()
          ;(fullConfig as unknown as Record<string, unknown>)[section] = newConfig
          await window.electronAPI.saveConfig(fullConfig)
        }

        setConfig(newConfig)
        onChange?.(newConfig)

        logger.info(`Config updated for section: ${section}`)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        logger.error(`Failed to update config for section: ${section}`, err as Error)
      } finally {
        setLoading(false)
      }
    },
    [config, section, onChange]
  )

  /**
   * 重置为默认配置
   */
  const resetConfig = useCallback(async () => {
    if (!defaultConfig) {
      logger.warn('No default config provided, cannot reset')
      return
    }

    await updateConfig(defaultConfig)
    logger.info(`Config reset to default for section: ${section}`)
  }, [defaultConfig, updateConfig, section])

  /**
   * 响应全局配置变化
   */
  useEffect(() => {
    const sectionConfig = (globalConfig as unknown as Record<string, unknown>)[section] as
      | T
      | undefined
    if (sectionConfig) {
      setConfig(sectionConfig)
      onChange?.(sectionConfig)
    }
  }, [globalConfig, section, onChange])

  return {
    config,
    updateConfig,
    resetConfig,
    loading,
    error,
  }
}

export default useWidgetConfig
