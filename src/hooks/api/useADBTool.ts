/**
 * ADB 工具完整 Hook
 * 封装 ADB Widget 的所有业务逻辑
 */

import { useState, useCallback, useEffect } from 'react'
import type { ADBConfig } from '@/shared/types'
import type { ADBDeviceInfo, AdbCheckResponse } from '@/shared/adb'
import { splitCommandLine, joinLocalPath } from '@/utils/commandLine'

// ==================== 类型定义 ====================

export interface TransferState {
  uploadLocalPath: string
  uploadRemotePath: string
  downloadRemotePath: string
  downloadDir: string
}

export interface UseADBToolOptions {
  config: ADBConfig
  onMessage?: (type: 'success' | 'error' | 'warning' | 'info', content: string) => void
  onLog?: (level: 'info' | 'warn' | 'error', message: string, data?: unknown) => void
  onConfigUpdate?: (config: ADBConfig) => Promise<void>
}

interface UseADBToolReturn {
  // 状态
  adbStatus: AdbCheckResponse | null
  devices: ADBDeviceInfo[]
  selectedDeviceId: string | undefined
  loading: boolean
  devicesLoading: boolean
  isCheckingAdb: boolean
  isInstallingApk: boolean
  isRecording: boolean
  outputLines: string[]
  commandInput: string
  pendingAdbPath: string
  transferState: TransferState
  lastScreenshotPath: string | null
  lastLogcat: string | null

  // 设备操作
  checkAdb: () => Promise<AdbCheckResponse | null>
  fetchDevices: () => Promise<ADBDeviceInfo[]>
  selectDevice: (deviceId: string | undefined) => void

  // 命令操作
  setCommandInput: (cmd: string) => void
  runCommand: () => Promise<void>
  appendOutput: (text: string) => void
  clearOutput: () => void

  // 配置操作
  setPendingAdbPath: (path: string) => void
  selectAdbPath: () => Promise<void>
  saveAdbPath: () => Promise<void>

  // 文件传输
  setTransferState: React.Dispatch<React.SetStateAction<TransferState>>
  selectUploadFile: () => Promise<void>
  selectDownloadDir: () => Promise<void>
  pushFile: () => Promise<void>
  pullFile: () => Promise<void>

  // 快捷操作
  installApk: () => Promise<void>
  screenshot: () => Promise<void>
  screenRecord: () => Promise<void>
  logcat: () => Promise<void>
  getDeviceInfo: () => Promise<void>
}

// ==================== Hook 实现 ====================

export function useADBTool(options: UseADBToolOptions): UseADBToolReturn {
  const { config, onMessage, onLog, onConfigUpdate } = options

  // 状态
  const [adbStatus, setAdbStatus] = useState<AdbCheckResponse | null>(null)
  const [devices, setDevices] = useState<ADBDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [isCheckingAdb, setIsCheckingAdb] = useState(false)
  const [isInstallingApk, setIsInstallingApk] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [outputLines, setOutputLines] = useState<string[]>([])
  const [commandInput, setCommandInput] = useState('shell getprop ro.product.model')
  const [pendingAdbPath, setPendingAdbPath] = useState(config.adb_path || 'adb')
  const [downloadsDir, setDownloadsDir] = useState('')
  const [transferState, setTransferState] = useState<TransferState>({
    uploadLocalPath: '',
    uploadRemotePath: '/sdcard/Download/',
    downloadRemotePath: '/sdcard/Download/example.txt',
    downloadDir: '',
  })
  const [lastScreenshotPath, setLastScreenshotPath] = useState<string | null>(null)
  const [lastLogcat, setLastLogcat] = useState<string | null>(null)

  // 工具函数
  const getErrorMessage = useCallback(
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
    []
  )

  const appendOutput = useCallback((text: string) => {
    setOutputLines((prev) => [...prev, text])
  }, [])

  const clearOutput = useCallback(() => {
    setOutputLines([])
  }, [])

  const ensureDeviceSelected = useCallback(() => {
    if (!selectedDeviceId) {
      onMessage?.('warning', '请先选择一台设备')
      return false
    }
    return true
  }, [selectedDeviceId, onMessage])

  // ========== 设备操作 ==========

  const checkAdb = useCallback(async (): Promise<AdbCheckResponse | null> => {
    if (!window.electronAPI?.adbCheck) {
      onMessage?.('error', 'ADB IPC 接口不可用')
      return null
    }

    setIsCheckingAdb(true)
    try {
      const result = await window.electronAPI.adbCheck({ adbPath: config.adb_path })
      setAdbStatus(result)

      if (result.ok) {
        onLog?.('info', result.message)
      } else {
        onLog?.('error', result.message)
      }

      return result
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      onMessage?.('error', `检查 ADB 失败: ${errorMessage}`)
      onLog?.('error', 'ADB check failed', error)
      return null
    } finally {
      setIsCheckingAdb(false)
    }
  }, [config.adb_path, getErrorMessage, onMessage, onLog])

  const fetchDevices = useCallback(async (): Promise<ADBDeviceInfo[]> => {
    if (!window.electronAPI?.adbListDevices) {
      onMessage?.('error', 'ADB IPC 接口不可用')
      return []
    }

    setDevicesLoading(true)
    try {
      const list = await window.electronAPI.adbListDevices({ adbPath: config.adb_path })
      setDevices(list)

      if (list.length > 0) {
        if (!selectedDeviceId || !list.some((device) => device.id === selectedDeviceId)) {
          setSelectedDeviceId(list[0].id)
        }
      } else {
        setSelectedDeviceId(undefined)
      }

      onLog?.('info', `Detected ${list.length} device(s)`)
      return list
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      onMessage?.('error', `刷新设备列表失败: ${errorMessage}`)
      onLog?.('error', 'Failed to refresh device list', error)
      return []
    } finally {
      setDevicesLoading(false)
    }
  }, [config.adb_path, selectedDeviceId, getErrorMessage, onMessage, onLog])

  const selectDevice = useCallback((deviceId: string | undefined) => {
    setSelectedDeviceId(deviceId)
  }, [])

  // ========== 命令操作 ==========

  const runCommand = useCallback(async () => {
    if (!window.electronAPI?.adbRunCommand) {
      onMessage?.('error', '当前环境不支持执行 ADB 命令')
      return
    }

    if (!commandInput.trim()) {
      onMessage?.('warning', '请输入要执行的命令')
      return
    }

    if (!selectedDeviceId) {
      onMessage?.('warning', '请选择一台设备')
      return
    }

    const args = splitCommandLine(commandInput)
    if (args.length === 0) {
      onMessage?.('warning', '命令格式无效')
      return
    }

    appendOutput(`$ adb -s ${selectedDeviceId} ${args.join(' ')}`)

    try {
      const result = await window.electronAPI.adbRunCommand({
        adbPath: config.adb_path,
        deviceId: selectedDeviceId,
        args,
      })

      if (result.stdout) appendOutput(result.stdout)
      if (result.stderr) appendOutput(result.stderr)
      appendOutput(`↳ 退出码: ${result.code}`)

      if (result.code !== 0) {
        onMessage?.('error', '命令执行失败，请查看输出')
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      appendOutput(`命令执行出错: ${errorMessage}`)
      onMessage?.('error', `命令执行失败：${errorMessage}`)
    }
  }, [config.adb_path, appendOutput, commandInput, getErrorMessage, selectedDeviceId, onMessage])

  // ========== 配置操作 ==========

  const selectAdbPath = useCallback(async () => {
    if (!window.electronAPI?.selectFile) return
    const filePath = await window.electronAPI.selectFile({ title: '选择 ADB 可执行文件' })
    if (filePath) setPendingAdbPath(filePath)
  }, [])

  const saveAdbPath = useCallback(async () => {
    if (!pendingAdbPath.trim()) {
      onMessage?.('warning', '请输入有效的 ADB 路径')
      return
    }

    await onConfigUpdate?.({ ...config, adb_path: pendingAdbPath.trim() })
    onMessage?.('success', 'ADB 路径已更新')
    await checkAdb()
  }, [config, checkAdb, pendingAdbPath, onConfigUpdate, onMessage])

  // ========== 文件传输 ==========

  const selectUploadFile = useCallback(async () => {
    if (!window.electronAPI?.selectFile) return
    const filePath = await window.electronAPI.selectFile({ title: '选择本地文件' })
    if (filePath) setTransferState((prev) => ({ ...prev, uploadLocalPath: filePath }))
  }, [])

  const selectDownloadDir = useCallback(async () => {
    if (!window.electronAPI?.selectFolder) return
    const folder = await window.electronAPI.selectFolder({ title: '选择保存目录' })
    if (folder) setTransferState((prev) => ({ ...prev, downloadDir: folder }))
  }, [])

  const pushFile = useCallback(async () => {
    if (!ensureDeviceSelected()) return
    if (!transferState.uploadLocalPath || !transferState.uploadRemotePath) {
      onMessage?.('warning', '请填写完整的上传路径')
      return
    }
    if (!window.electronAPI?.adbPush) return

    appendOutput(`上传 ${transferState.uploadLocalPath} → ${transferState.uploadRemotePath}`)
    try {
      const result = await window.electronAPI.adbPush({
        adbPath: config.adb_path,
        deviceId: selectedDeviceId!,
        localPath: transferState.uploadLocalPath,
        remotePath: transferState.uploadRemotePath,
      })

      appendOutput(result.stdout || '上传完成')
      if (result.code === 0) {
        onMessage?.('success', '上传成功')
      } else {
        onMessage?.('error', result.stderr || '上传失败')
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      appendOutput(`上传失败: ${errorMessage}`)
      onMessage?.('error', `上传失败: ${errorMessage}`)
    }
  }, [config.adb_path, appendOutput, ensureDeviceSelected, getErrorMessage, selectedDeviceId, transferState, onMessage])

  const pullFile = useCallback(async () => {
    if (!ensureDeviceSelected()) return
    if (!transferState.downloadRemotePath) {
      onMessage?.('warning', '请填写远程路径')
      return
    }

    const remoteName = transferState.downloadRemotePath.split('/').filter(Boolean).pop() || `download-${Date.now()}`
    const targetDir = transferState.downloadDir || config.default_download_dir || downloadsDir

    if (!targetDir) {
      onMessage?.('warning', '请先选择本地保存目录')
      return
    }

    const localPath = joinLocalPath(targetDir, remoteName)
    if (!window.electronAPI?.adbPull) return

    appendOutput(`下载 ${transferState.downloadRemotePath} → ${localPath}`)
    try {
      const result = await window.electronAPI.adbPull({
        adbPath: config.adb_path,
        deviceId: selectedDeviceId!,
        remotePath: transferState.downloadRemotePath,
        localPath,
      })

      appendOutput(result.stdout || '下载完成')
      if (result.code === 0) {
        onMessage?.('success', `已保存到 ${localPath}`)
      } else {
        onMessage?.('error', result.stderr || '下载失败')
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      appendOutput(`下载失败: ${errorMessage}`)
      onMessage?.('error', `下载失败: ${errorMessage}`)
    }
  }, [config.adb_path, config.default_download_dir, appendOutput, downloadsDir, ensureDeviceSelected, getErrorMessage, selectedDeviceId, transferState, onMessage])

  // ========== 快捷操作 ==========

  const installApk = useCallback(async () => {
    if (!ensureDeviceSelected()) return
    if (!window.electronAPI?.selectFile || !window.electronAPI?.adbRunCommand) return

    try {
      setIsInstallingApk(true)
      const apkPath = await window.electronAPI.selectFile({
        title: '选择 APK 文件',
        filters: [{ name: 'Android Package', extensions: ['apk'] }],
      })

      if (!apkPath) {
        setIsInstallingApk(false)
        return
      }

      appendOutput(`开始安装 APK: ${apkPath}`)
      const result = await window.electronAPI.adbRunCommand({
        adbPath: config.adb_path,
        deviceId: selectedDeviceId!,
        args: ['install', '-r', apkPath],
      })

      appendOutput(result.stdout || '安装完成')
      if (result.code === 0) {
        onMessage?.('success', 'APK 安装成功')
      } else {
        onMessage?.('error', result.stderr || 'APK 安装失败')
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      appendOutput(`安装 APK 失败: ${errorMessage}`)
      onMessage?.('error', `安装失败：${errorMessage}`)
    } finally {
      setIsInstallingApk(false)
    }
  }, [config.adb_path, appendOutput, ensureDeviceSelected, getErrorMessage, selectedDeviceId, onMessage])

  const screenshot = useCallback(async () => {
    if (!ensureDeviceSelected()) return
    if (!window.electronAPI?.adbScreenshot) return

    appendOutput(`截取 ${selectedDeviceId} 的屏幕`)
    try {
      const result = await window.electronAPI.adbScreenshot({
        adbPath: config.adb_path,
        deviceId: selectedDeviceId!,
        outputDir: downloadsDir || undefined,
      })

      setLastScreenshotPath(result.filePath)
      appendOutput(`截图保存至: ${result.filePath}`)
      onMessage?.('success', '屏幕截图完成')
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      appendOutput(`截图失败: ${errorMessage}`)
      onMessage?.('error', `截图失败: ${errorMessage}`)
    }
  }, [config.adb_path, appendOutput, downloadsDir, ensureDeviceSelected, getErrorMessage, selectedDeviceId, onMessage])

  const logcat = useCallback(async () => {
    if (!ensureDeviceSelected()) return
    if (!window.electronAPI?.adbLogcat) return

    appendOutput(`收集 ${selectedDeviceId} 的 logcat 日志`)
    try {
      const result = await window.electronAPI.adbLogcat({
        adbPath: config.adb_path,
        deviceId: selectedDeviceId!,
      })

      setLastLogcat(result.log)
      appendOutput(result.log.slice(0, 2_000) || '日志已捕获')
      onMessage?.('success', 'logcat 已捕获，显示前 2000 字符')
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      appendOutput(`logcat 失败: ${errorMessage}`)
      onMessage?.('error', `logcat 失败: ${errorMessage}`)
    }
  }, [config.adb_path, appendOutput, ensureDeviceSelected, getErrorMessage, selectedDeviceId, onMessage])

  const screenRecord = useCallback(async () => {
    if (!ensureDeviceSelected()) return
    if (!window.electronAPI?.adbRunCommand) return

    const remotePath = `/sdcard/screenrecord-${Date.now()}.mp4`
    appendOutput(`开始录屏（最长 30 秒）: ${remotePath}`)
    setIsRecording(true)
    try {
      await window.electronAPI.adbRunCommand({
        adbPath: config.adb_path,
        deviceId: selectedDeviceId!,
        args: ['shell', 'screenrecord', remotePath, '--time-limit', '30'],
        timeout: 35_000,
      })
      appendOutput('录屏完成，准备下载文件...')

      const targetDir = transferState.downloadDir || config.default_download_dir || downloadsDir
      if (targetDir && window.electronAPI?.adbPull) {
        const localPath = joinLocalPath(targetDir, remotePath.split('/').pop() || 'record.mp4')
        const pullResult = await window.electronAPI.adbPull({
          adbPath: config.adb_path,
          deviceId: selectedDeviceId!,
          remotePath,
          localPath,
        })
        if (pullResult.code === 0) {
          onMessage?.('success', `录屏已保存到 ${localPath}`)
          appendOutput(`录屏文件已保存：${localPath}`)
        } else {
          onMessage?.('error', '录屏文件保存失败')
          appendOutput(pullResult.stderr || '录屏文件保存失败')
        }
      } else {
        onMessage?.('warning', '未配置本地保存目录，录屏文件仍保存在设备中')
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      appendOutput(`录屏失败: ${errorMessage}`)
      onMessage?.('error', `录屏失败：${errorMessage}`)
    } finally {
      setIsRecording(false)
    }
  }, [config.adb_path, config.default_download_dir, appendOutput, downloadsDir, ensureDeviceSelected, getErrorMessage, selectedDeviceId, transferState.downloadDir, onMessage])

  const getDeviceInfo = useCallback(async () => {
    if (!ensureDeviceSelected()) return
    if (!window.electronAPI?.adbRunCommand) return

    const infoCommands = [
      { label: '设备型号', args: ['shell', 'getprop', 'ro.product.model'] },
      { label: '制造商', args: ['shell', 'getprop', 'ro.product.manufacturer'] },
      { label: 'Android 版本', args: ['shell', 'getprop', 'ro.build.version.release'] },
      { label: 'SDK', args: ['shell', 'getprop', 'ro.build.version.sdk'] },
      { label: '分辨率', args: ['shell', 'wm', 'size'] },
      { label: '密度', args: ['shell', 'wm', 'density'] },
    ]

    appendOutput('=== 设备信息 ===')
    try {
      for (const item of infoCommands) {
        const result = await window.electronAPI.adbRunCommand({
          adbPath: config.adb_path,
          deviceId: selectedDeviceId!,
          args: item.args,
        })
        const value = result.stdout.trim() || '未知'
        appendOutput(`${item.label}: ${value}`)
      }
      onMessage?.('success', '设备信息已输出到终端')
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      appendOutput(`读取设备信息失败: ${errorMessage}`)
      onMessage?.('error', `读取失败：${errorMessage}`)
    }
  }, [config.adb_path, appendOutput, ensureDeviceSelected, getErrorMessage, selectedDeviceId, onMessage])

  // ========== 初始化 ==========

  useEffect(() => {
    if (config.adb_path) setPendingAdbPath(config.adb_path)
  }, [config.adb_path])

  useEffect(() => {
    let active = true
    if (window.electronAPI?.getPath) {
      window.electronAPI.getPath('downloads').then((dir) => {
        if (active && dir) {
          setDownloadsDir(dir)
          setTransferState((prev) => ({
            ...prev,
            downloadDir: prev.downloadDir || config.default_download_dir || dir,
          }))
        }
      })
    }
    return () => { active = false }
  }, [config.default_download_dir])

  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      try {
        setLoading(true)
        await checkAdb()
        if (!cancelled) await fetchDevices()
      } catch {
        // 错误已在 checkAdb/fetchDevices 中处理
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    // 状态
    adbStatus,
    devices,
    selectedDeviceId,
    loading,
    devicesLoading,
    isCheckingAdb,
    isInstallingApk,
    isRecording,
    outputLines,
    commandInput,
    pendingAdbPath,
    transferState,
    lastScreenshotPath,
    lastLogcat,

    // 设备操作
    checkAdb,
    fetchDevices,
    selectDevice,

    // 命令操作
    setCommandInput,
    runCommand,
    appendOutput,
    clearOutput,

    // 配置操作
    setPendingAdbPath,
    selectAdbPath,
    saveAdbPath,

    // 文件传输
    setTransferState,
    selectUploadFile,
    selectDownloadDir,
    pushFile,
    pullFile,

    // 快捷操作
    installApk,
    screenshot,
    screenRecord,
    logcat,
    getDeviceInfo,
  }
}
