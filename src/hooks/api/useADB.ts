/**
 * ADB 操作 Hook
 * 封装 Android Debug Bridge 相关的 IPC 调用
 */

import { useState, useCallback, useEffect } from 'react'
import { ipc } from '@/core/ipc-client'

// ==================== 类型定义 ====================

export interface ADBDevice {
  id: string
  status: string
  product?: string
  model?: string
  device?: string
  transportId?: string
}

export interface ADBCommandResult {
  stdout: string
  stderr: string
  code: number
}

interface UseADBReturn {
  devices: ADBDevice[]
  selectedDevice: ADBDevice | null
  loading: boolean
  error: Error | null
  adbAvailable: boolean
  refreshDevices: () => Promise<void>
  selectDevice: (device: ADBDevice | null) => void
  runCommand: (args: string[]) => Promise<ADBCommandResult>
  pushFile: (localPath: string, remotePath: string) => Promise<void>
  pullFile: (remotePath: string, localPath: string) => Promise<void>
  takeScreenshot: (outputDir?: string) => Promise<string>
  getLogcat: (filter?: string) => Promise<string>
}

interface UseADBOptions {
  adbPath?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

// ==================== Hook 实现 ====================

/**
 * ADB 操作 Hook
 * 
 * @example
 * ```tsx
 * function ADBWidget() {
 *   const { 
 *     devices, 
 *     selectedDevice, 
 *     selectDevice, 
 *     runCommand,
 *     takeScreenshot 
 *   } = useADB()
 *   
 *   const handleScreenshot = async () => {
 *     const path = await takeScreenshot()
 *     console.log('Screenshot saved:', path)
 *   }
 *   
 *   return (
 *     <div>
 *       <Select onChange={selectDevice}>
 *         {devices.map(d => <Option key={d.id}>{d.model}</Option>)}
 *       </Select>
 *       <Button onClick={handleScreenshot}>Screenshot</Button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useADB(options: UseADBOptions = {}): UseADBReturn {
  const { adbPath, autoRefresh = false, refreshInterval = 5000 } = options

  const [devices, setDevices] = useState<ADBDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<ADBDevice | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [adbAvailable, setAdbAvailable] = useState(false)

  // 检查 ADB 是否可用
  const checkAdb = useCallback(async () => {
    try {
      const result = await ipc.invoke('adb:check', { adbPath })
      const check = result as { ok: boolean }
      setAdbAvailable(check.ok)
      return check.ok
    } catch {
      setAdbAvailable(false)
      return false
    }
  }, [adbPath])

  // 刷新设备列表
  const refreshDevices = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const available = await checkAdb()
      if (!available) {
        setDevices([])
        return
      }

      const deviceList = await ipc.invoke('adb:listDevices', { adbPath })
      setDevices(deviceList as ADBDevice[])

      // 如果当前选中的设备不在列表中，清除选择
      if (selectedDevice) {
        const stillExists = (deviceList as ADBDevice[]).some(
          (d) => d.id === selectedDevice.id
        )
        if (!stillExists) {
          setSelectedDevice(null)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
      setDevices([])
    } finally {
      setLoading(false)
    }
  }, [adbPath, checkAdb, selectedDevice])

  // 选择设备
  const selectDevice = useCallback((device: ADBDevice | null) => {
    setSelectedDevice(device)
  }, [])

  // 运行 ADB 命令
  const runCommand = useCallback(
    async (args: string[]): Promise<ADBCommandResult> => {
      if (!selectedDevice) {
        throw new Error('No device selected')
      }

      const result = await ipc.invoke('adb:runCommand', {
        adbPath,
        deviceId: selectedDevice.id,
        args,
      })
      return result as ADBCommandResult
    },
    [adbPath, selectedDevice]
  )

  // 推送文件
  const pushFile = useCallback(
    async (localPath: string, remotePath: string): Promise<void> => {
      if (!selectedDevice) {
        throw new Error('No device selected')
      }

      await ipc.invoke('adb:push', {
        adbPath,
        deviceId: selectedDevice.id,
        localPath,
        remotePath,
      })
    },
    [adbPath, selectedDevice]
  )

  // 拉取文件
  const pullFile = useCallback(
    async (remotePath: string, localPath: string): Promise<void> => {
      if (!selectedDevice) {
        throw new Error('No device selected')
      }

      await ipc.invoke('adb:pull', {
        adbPath,
        deviceId: selectedDevice.id,
        localPath,
        remotePath,
      })
    },
    [adbPath, selectedDevice]
  )

  // 截图
  const takeScreenshot = useCallback(
    async (outputDir?: string): Promise<string> => {
      if (!selectedDevice) {
        throw new Error('No device selected')
      }

      const result = await ipc.invoke('adb:screenshot', {
        adbPath,
        deviceId: selectedDevice.id,
        outputDir,
      })
      const screenshot = result as { filePath: string }
      return screenshot.filePath
    },
    [adbPath, selectedDevice]
  )

  // 获取 Logcat
  const getLogcat = useCallback(
    async (filter?: string): Promise<string> => {
      if (!selectedDevice) {
        throw new Error('No device selected')
      }

      const result = await ipc.invoke('adb:logcat', {
        adbPath,
        deviceId: selectedDevice.id,
        filter,
      })
      const logcat = result as { log: string }
      return logcat.log
    },
    [adbPath, selectedDevice]
  )

  // 初始化
  useEffect(() => {
    refreshDevices()
  }, [refreshDevices])

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(refreshDevices, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, refreshDevices])

  return {
    devices,
    selectedDevice,
    loading,
    error,
    adbAvailable,
    refreshDevices,
    selectDevice,
    runCommand,
    pushFile,
    pullFile,
    takeScreenshot,
    getLogcat,
  }
}
