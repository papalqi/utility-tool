/**
 * 配置管理 Hook
 * 使用类型安全的 IPC 客户端
 */

import { useState, useCallback, useEffect } from 'react'
import { ipc } from '@/core/ipc-client'
import type { AppConfig } from '../../../packages/shared/src/ipc-channels'

interface UseConfigReturn {
  config: AppConfig | null
  loading: boolean
  error: Error | null
  reload: () => Promise<void>
  save: (config: AppConfig) => Promise<boolean>
  hostname: string | null
}

/**
 * 配置管理 Hook
 * 
 * @example
 * ```tsx
 * function SettingsPage() {
 *   const { config, loading, error, save } = useConfig()
 *   
 *   if (loading) return <Spin />
 *   if (error) return <Alert type="error" message={error.message} />
 *   
 *   return (
 *     <Form initialValues={config} onFinish={save}>
 *       ...
 *     </Form>
 *   )
 * }
 * ```
 */
export function useConfig(): UseConfigReturn {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [hostname, setHostname] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 类型安全：TypeScript 自动推断返回类型为 AppConfig | null
      const loadedConfig = await ipc.invoke('config:load')
      setConfig(loadedConfig)

      // 类型安全：TypeScript 自动推断返回类型为 string
      const host = await ipc.invoke('config:getHostname')
      setHostname(host)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [])

  const save = useCallback(async (newConfig: AppConfig): Promise<boolean> => {
    try {
      // 类型安全：TypeScript 检查参数类型
      const success = await ipc.invoke('config:save', newConfig)
      if (success) {
        setConfig(newConfig)
      }
      return success
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
      return false
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return {
    config,
    loading,
    error,
    reload,
    save,
    hostname,
  }
}
