import { useState, useEffect } from 'react'
import { configManager } from '../core/ConfigManager'
import { AppConfig } from '../shared/types'

/**
 * Hook to access and subscribe to app configuration
 */
export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(configManager.getConfig())

  useEffect(() => {
    const unsubscribe = configManager.subscribe((newConfig) => {
      setConfig(newConfig)
    })

    return unsubscribe
  }, [])

  return config
}

/**
 * Hook to access a specific config section
 */
export function useConfigSection<K extends keyof AppConfig>(section: K): AppConfig[K] {
  const [value, setValue] = useState<AppConfig[K]>(configManager.getSection(section))

  useEffect(() => {
    const unsubscribe = configManager.subscribe((newConfig) => {
      setValue(newConfig[section])
    })

    return unsubscribe
  }, [section])

  return value
}

/**
 * Hook to update config
 */
export function useConfigUpdate() {
  const updateConfig = async (config: AppConfig) => {
    await configManager.saveConfig(config)
  }

  const updateSection = async <K extends keyof AppConfig>(section: K, value: AppConfig[K]) => {
    await configManager.updateSection(section, value)
  }

  return { updateConfig, updateSection }
}
