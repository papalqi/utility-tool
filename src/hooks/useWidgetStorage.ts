/**
 * useWidgetStorage Hook
 * 为 Widget 提供本地存储管理
 *
 * 支持 localStorage 持久化，自动序列化/反序列化
 */

import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/core/Logger'

interface UseWidgetStorageOptions<T> {
  /** 存储键名 */
  key: string
  /** 默认值 */
  defaultValue: T
  /** 是否启用持久化 */
  persist?: boolean
}

interface UseWidgetStorageReturn<T> {
  /** 当前值 */
  value: T
  /** 设置值 */
  setValue: (value: T | ((prev: T) => T)) => void
  /** 重置为默认值 */
  reset: () => void
  /** 清除存储 */
  clear: () => void
  /** 是否正在加载 */
  loading: boolean
}

/**
 * Widget 本地存储 Hook
 *
 * 提供类型安全的本地存储管理
 * 自动处理序列化和反序列化
 *
 * @example
 * ```tsx
 * const MyWidget = () => {
 *   const { value, setValue } = useWidgetStorage({
 *     key: 'my-widget-data',
 *     defaultValue: { count: 0 },
 *     persist: true
 *   })
 *
 *   return (
 *     <div>
 *       <p>Count: {value.count}</p>
 *       <button onClick={() => setValue({ count: value.count + 1 })}>
 *         Increment
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useWidgetStorage<T>(
  options: UseWidgetStorageOptions<T>
): UseWidgetStorageReturn<T> {
  const { key, defaultValue, persist = true } = options
  const [loading, setLoading] = useState(true)

  /**
   * 初始化状态，从 localStorage 加载
   */
  const [value, setStateValue] = useState<T>(() => {
    if (!persist) {
      return defaultValue
    }

    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        return JSON.parse(stored) as T
      }
    } catch (error) {
      logger.error(`Failed to load storage for key: ${key}`, error as Error)
    }

    return defaultValue
  })

  /**
   * 设置值并持久化
   */
  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      try {
        setStateValue((prevValue) => {
          const valueToStore = newValue instanceof Function ? newValue(prevValue) : newValue

          if (persist) {
            localStorage.setItem(key, JSON.stringify(valueToStore))
          }

          logger.debug(`Storage updated for key: ${key}`)
          return valueToStore
        })
      } catch (error) {
        logger.error(`Failed to save storage for key: ${key}`, error as Error)
      }
    },
    [key, persist]
  )

  /**
   * 重置为默认值
   */
  const reset = useCallback(() => {
    setValue(defaultValue)
    logger.debug(`Storage reset to default for key: ${key}`)
  }, [key, defaultValue, setValue])

  /**
   * 清除存储
   */
  const clear = useCallback(() => {
    try {
      if (persist) {
        localStorage.removeItem(key)
      }
      setStateValue(defaultValue)
      logger.debug(`Storage cleared for key: ${key}`)
    } catch (error) {
      logger.error(`Failed to clear storage for key: ${key}`, error as Error)
    }
  }, [key, defaultValue, persist])

  /**
   * 监听其他窗口的存储变化
   */
  useEffect(() => {
    if (!persist) {
      setLoading(false)
      return
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          const newValue = JSON.parse(e.newValue) as T
          setStateValue(newValue)
          logger.debug(`Storage synced from other window for key: ${key}`)
        } catch (error) {
          logger.error(`Failed to sync storage for key: ${key}`, error as Error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    setLoading(false)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [key, persist])

  return {
    value,
    setValue,
    reset,
    clear,
    loading,
  }
}

export default useWidgetStorage
