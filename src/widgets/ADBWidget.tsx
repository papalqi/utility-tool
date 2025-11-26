import React, { useCallback, useEffect, useState } from 'react'
import {
  AndroidOutlined,
  ReloadOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
  CloudUploadOutlined,
  CloudDownloadOutlined,
  CameraOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Button, Divider, Input, List, Space, Tag, Tabs, Typography, message } from 'antd'
import { WidgetLayout, WidgetSection } from '@/components/widgets'
import { useWidget } from '@/hooks/useWidget'
import { useWidgetActions } from '@/hooks/useWidgetActions'
import { useWidgetConfig } from '@/hooks/useWidgetConfig'
import { useWidgetStorage } from '@/hooks/useWidgetStorage'
import type { WidgetMetadata } from '@/shared/widget-types'
import type { ADBConfig } from '@/shared/types'
import type { ADBDeviceInfo, AdbCheckResponse } from '@/shared/adb'
import { splitCommandLine, joinLocalPath } from '@/utils/commandLine'

const { Text, Paragraph } = Typography

interface CommandHistoryState {
  commands: string[]
}

const metadata: WidgetMetadata = {
  id: 'adb',
  displayName: 'ADB 工具',
  icon: <AndroidOutlined />,
  description: '管理 Android 设备、执行调试命令和文件传输',
  category: 'development',
  order: 6,
  enabled: true,
}

const defaultAdbConfig: ADBConfig = {
  adb_path: 'adb',
  refresh_interval: 10,
  default_download_dir: '',
}

const quickCommandPresets = [
  { label: '设备列表', args: ['devices', '-l'] },
  { label: '重启设备', args: ['reboot'] },
  { label: '查看属性', args: ['shell', 'getprop'] },
  { label: '电量信息', args: ['shell', 'dumpsys', 'battery'] },
  { label: '当前 Activity', args: ['shell', 'dumpsys', 'activity', 'top'] },
]

const statusColorMap: Record<string, string> = {
  device: 'green',
  offline: 'red',
  unauthorized: 'orange',
}

const ADBWidget: React.FC = () => {
  const [adbStatus, setAdbStatus] = useState<AdbCheckResponse | null>(null)
  const [devices, setDevices] = useState<ADBDeviceInfo[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>()
  const [commandInput, setCommandInput] = useState('shell getprop ro.product.model')
  const [outputLines, setOutputLines] = useState<string[]>([])
  const [isCheckingAdb, setIsCheckingAdb] = useState(false)
  const [pendingAdbPath, setPendingAdbPath] = useState('')
  const [downloadsDir, setDownloadsDir] = useState('')
  const [transferState, setTransferState] = useState({
    uploadLocalPath: '',
    uploadRemotePath: '/sdcard/Download/',
    downloadRemotePath: '/sdcard/Download/example.txt',
    downloadDir: '',
  })
  const [lastScreenshotPath, setLastScreenshotPath] = useState<string | null>(null)
  const [lastLogcat, setLastLogcat] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('devices')
  const [isInstallingApk, setIsInstallingApk] = useState(false)
  const [isRecording, setIsRecording] = useState(false)

  const { value: commandHistory, setValue: setCommandHistory } =
    useWidgetStorage<CommandHistoryState>({
      key: 'adb-command-history',
      defaultValue: { commands: [] },
      persist: true,
    })

  const { config: adbConfig, updateConfig } = useWidgetConfig<ADBConfig>({
    section: 'adb',
    defaultConfig: defaultAdbConfig,
  })

  const { state, setStatus, setError, setLoading, initialize, widgetLogger } = useWidget({
    metadata,
    autoInit: false,
  })

  const getErrorMessage = useCallback(
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
    []
  )

  const checkAdb = useCallback(async () => {
    if (!window.electronAPI?.adbCheck) {
      throw new Error('ADB IPC 接口不可用')
    }

    setIsCheckingAdb(true)
    try {
      const result = await window.electronAPI.adbCheck({ adbPath: adbConfig.adb_path })
      setAdbStatus(result)

      if (result.ok) {
        setStatus(result.message)
        widgetLogger.info(result.message)
      } else {
        setError(result.message)
        widgetLogger.error(result.message)
      }

      return result
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      setError(`检查 ADB 失败: ${errorMessage}`)
      widgetLogger.error('ADB check failed', error as Error)
      throw error
    } finally {
      setIsCheckingAdb(false)
    }
  }, [adbConfig.adb_path, setError, setStatus, widgetLogger])

  const fetchDevices = useCallback(async () => {
    if (!window.electronAPI?.adbListDevices) {
      throw new Error('ADB IPC 接口不可用')
    }

    setDevicesLoading(true)
    try {
      const list = await window.electronAPI.adbListDevices({ adbPath: adbConfig.adb_path })
      setDevices(list)

      if (list.length > 0) {
        if (!selectedDeviceId || !list.some((device) => device.id === selectedDeviceId)) {
          setSelectedDeviceId(list[0].id)
        }
      } else {
        setSelectedDeviceId(undefined)
      }

      setStatus(`已检测到 ${list.length} 台设备`)
      widgetLogger.info(`Detected ${list.length} device(s)`)
      return list
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      setError(`刷新设备列表失败: ${errorMessage}`)
      message.error(`刷新设备失败：${errorMessage}`)
      widgetLogger.error('Failed to refresh device list', error as Error)
      return []
    } finally {
      setDevicesLoading(false)
    }
  }, [adbConfig.adb_path, selectedDeviceId, setError, setStatus, widgetLogger])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        setLoading(true)
        await checkAdb()
        if (!cancelled) {
          await fetchDevices()
        }
        if (!cancelled) {
          setStatus('ADB 工具已就绪')
          await initialize()
        }
      } catch (error) {
        if (!cancelled) {
          const errorMessage = getErrorMessage(error)
          setError(`初始化失败: ${errorMessage}`)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [checkAdb, fetchDevices, getErrorMessage, initialize, setError, setLoading, setStatus])

  useEffect(() => {
    let active = true
    if (window.electronAPI?.getPath) {
      window.electronAPI.getPath('downloads').then((dir) => {
        if (active && dir) {
          setDownloadsDir(dir)
          setTransferState((prev) => ({
            ...prev,
            downloadDir: prev.downloadDir || adbConfig.default_download_dir || dir,
          }))
        }
      })
    }

    return () => {
      active = false
    }
  }, [adbConfig.default_download_dir])

  useEffect(() => {
    if (adbConfig.adb_path) {
      setPendingAdbPath(adbConfig.adb_path)
    }
  }, [adbConfig.adb_path])

  const { refresh, isActionInProgress } = useWidgetActions({
    widgetId: metadata.id,
    onRefresh: async () => {
      await checkAdb()
      await fetchDevices()
    },
  })

  const appendOutput = useCallback((text: string) => {
    setOutputLines((prev) => [...prev, text])
  }, [])

  const updateCommandHistory = useCallback(
    (command: string) => {
      if (!command.trim()) return

      setCommandHistory((prev) => {
        const uniqueCommands = [
          command.trim(),
          ...prev.commands.filter((item) => item !== command.trim()),
        ]
        return {
          commands: uniqueCommands.slice(0, 10),
        }
      })
    },
    [setCommandHistory]
  )

  const handleRunCommand = useCallback(async () => {
    if (!window.electronAPI?.adbRunCommand) {
      message.error('当前环境不支持执行 ADB 命令')
      return
    }

    if (!commandInput.trim()) {
      message.warning('请输入要执行的命令')
      return
    }

    if (!selectedDeviceId) {
      message.warning('请选择一台设备')
      return
    }

    const args = splitCommandLine(commandInput)
    if (args.length === 0) {
      message.warning('命令格式无效')
      return
    }

    appendOutput(`$ adb -s ${selectedDeviceId} ${args.join(' ')}`)
    updateCommandHistory(commandInput)

    try {
      const result = await window.electronAPI.adbRunCommand({
        adbPath: adbConfig.adb_path,
        deviceId: selectedDeviceId,
        args,
      })

      if (result.stdout) {
        appendOutput(result.stdout)
      }

      if (result.stderr) {
        appendOutput(result.stderr)
      }

      appendOutput(`↳ 退出码: ${result.code}`)

      if (result.code !== 0) {
        message.error('命令执行失败，请查看输出')
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      appendOutput(`命令执行出错: ${errorMessage}`)
      message.error(`命令执行失败：${errorMessage}`)
    }
  }, [
    adbConfig.adb_path,
    appendOutput,
    commandInput,
    getErrorMessage,
    selectedDeviceId,
    updateCommandHistory,
  ])

  const handleSelectAdbPath = useCallback(async () => {
    if (!window.electronAPI?.selectFile) return
    const filePath = await window.electronAPI.selectFile({
      title: '选择 ADB 可执行文件',
    })
    if (filePath) {
      setPendingAdbPath(filePath)
    }
  }, [])

  const handleSaveAdbPath = useCallback(async () => {
    if (!pendingAdbPath.trim()) {
      message.warning('请输入有效的 ADB 路径')
      return
    }

    await updateConfig({
      ...adbConfig,
      adb_path: pendingAdbPath.trim(),
    })

    message.success('ADB 路径已更新')
    await checkAdb()
  }, [adbConfig, checkAdb, pendingAdbPath, updateConfig])

  const handleSelectUploadFile = useCallback(async () => {
    if (!window.electronAPI?.selectFile) return
    const filePath = await window.electronAPI.selectFile({
      title: '选择本地文件',
    })
    if (filePath) {
      setTransferState((prev) => ({ ...prev, uploadLocalPath: filePath }))
    }
  }, [])

  const handleSelectDownloadDir = useCallback(async () => {
    if (!window.electronAPI?.selectFolder) return
    const folder = await window.electronAPI.selectFolder({
      title: '选择保存目录',
    })
    if (folder) {
      setTransferState((prev) => ({ ...prev, downloadDir: folder }))
    }
  }, [])

  const ensureDeviceSelected = useCallback(() => {
    if (!selectedDeviceId) {
      message.warning('请先选择一台设备')
      return false
    }
    return true
  }, [selectedDeviceId])

  const handlePushFile = useCallback(async () => {
    if (!ensureDeviceSelected()) return
    if (!transferState.uploadLocalPath || !transferState.uploadRemotePath) {
      message.warning('请填写完整的上传路径')
      return
    }

    if (!window.electronAPI?.adbPush) return

    appendOutput(`上传 ${transferState.uploadLocalPath} → ${transferState.uploadRemotePath}`)
    try {
      const result = await window.electronAPI.adbPush({
        adbPath: adbConfig.adb_path,
        deviceId: selectedDeviceId!,
        localPath: transferState.uploadLocalPath,
        remotePath: transferState.uploadRemotePath,
      })

      appendOutput(result.stdout || '上传完成')
      if (result.code === 0) {
        message.success('上传成功')
      } else {
        message.error(result.stderr || '上传失败')
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      appendOutput(`上传失败: ${errorMessage}`)
      message.error(`上传失败: ${errorMessage}`)
    }
  }, [
    adbConfig.adb_path,
    appendOutput,
    ensureDeviceSelected,
    getErrorMessage,
    selectedDeviceId,
    transferState.uploadLocalPath,
    transferState.uploadRemotePath,
  ])

  const handlePullFile = useCallback(async () => {
    if (!ensureDeviceSelected()) return

    if (!transferState.downloadRemotePath) {
      message.warning('请填写远程路径')
      return
    }

    const remoteName =
      transferState.downloadRemotePath.split('/').filter(Boolean).pop() || `download-${Date.now()}`
    const targetDir = transferState.downloadDir || adbConfig.default_download_dir || downloadsDir

    if (!targetDir) {
      message.warning('请先选择本地保存目录')
      return
    }

    const localPath = joinLocalPath(targetDir, remoteName)
    if (!window.electronAPI?.adbPull) return

    appendOutput(`下载 ${transferState.downloadRemotePath} → ${localPath}`)
    try {
      const result = await window.electronAPI.adbPull({
        adbPath: adbConfig.adb_path,
        deviceId: selectedDeviceId!,
        remotePath: transferState.downloadRemotePath,
        localPath,
      })

      appendOutput(result.stdout || '下载完成')
      if (result.code === 0) {
        message.success(`已保存到 ${localPath}`)
      } else {
        message.error(result.stderr || '下载失败')
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      appendOutput(`下载失败: ${errorMessage}`)
      message.error(`下载失败: ${errorMessage}`)
    }
  }, [
    adbConfig.adb_path,
    adbConfig.default_download_dir,
    appendOutput,
    downloadsDir,
    ensureDeviceSelected,
    getErrorMessage,
    selectedDeviceId,
    transferState.downloadDir,
    transferState.downloadRemotePath,
  ])

  const handleInstallApk = useCallback(async () => {
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
        adbPath: adbConfig.adb_path,
        deviceId: selectedDeviceId!,
        args: ['install', '-r', apkPath],
      })

      appendOutput(result.stdout || '安装完成')
      if (result.code === 0) {
        message.success('APK 安装成功')
      } else {
        message.error(result.stderr || 'APK 安装失败')
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      appendOutput(`安装 APK 失败: ${errorMessage}`)
      message.error(`安装失败：${errorMessage}`)
    } finally {
      setIsInstallingApk(false)
    }
  }, [adbConfig.adb_path, appendOutput, ensureDeviceSelected, getErrorMessage, selectedDeviceId])

  const handleDeviceInfo = useCallback(async () => {
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
          adbPath: adbConfig.adb_path,
          deviceId: selectedDeviceId!,
          args: item.args,
        })
        const value = result.stdout.trim() || '未知'
        appendOutput(`${item.label}: ${value}`)
      }
      message.success('设备信息已输出到终端')
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      appendOutput(`读取设备信息失败: ${errorMessage}`)
      message.error(`读取失败：${errorMessage}`)
    }
  }, [adbConfig.adb_path, appendOutput, ensureDeviceSelected, getErrorMessage, selectedDeviceId])

  const handleScreenshot = useCallback(async () => {
    if (!ensureDeviceSelected()) return
    if (!window.electronAPI?.adbScreenshot) return

    appendOutput(`截取 ${selectedDeviceId} 的屏幕`)
    try {
      const result = await window.electronAPI.adbScreenshot({
        adbPath: adbConfig.adb_path,
        deviceId: selectedDeviceId!,
        outputDir: downloadsDir || undefined,
      })

      setLastScreenshotPath(result.filePath)
      appendOutput(`截图保存至: ${result.filePath}`)
      message.success('屏幕截图完成')
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      appendOutput(`截图失败: ${errorMessage}`)
      message.error(`截图失败: ${errorMessage}`)
    }
  }, [
    adbConfig.adb_path,
    appendOutput,
    downloadsDir,
    ensureDeviceSelected,
    getErrorMessage,
    selectedDeviceId,
  ])

  const handleLogcat = useCallback(async () => {
    if (!ensureDeviceSelected()) return
    if (!window.electronAPI?.adbLogcat) return

    appendOutput(`收集 ${selectedDeviceId} 的 logcat 日志`)
    try {
      const result = await window.electronAPI.adbLogcat({
        adbPath: adbConfig.adb_path,
        deviceId: selectedDeviceId!,
      })

      setLastLogcat(result.log)
      appendOutput(result.log.slice(0, 2_000) || '日志已捕获')
      message.success('logcat 已捕获，显示前 2000 字符')
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      appendOutput(`logcat 失败: ${errorMessage}`)
      message.error(`logcat 失败: ${errorMessage}`)
    }
  }, [adbConfig.adb_path, appendOutput, ensureDeviceSelected, getErrorMessage, selectedDeviceId])

  const handleScreenRecord = useCallback(async () => {
    if (!ensureDeviceSelected()) return
    if (!window.electronAPI?.adbRunCommand) return

    const remotePath = `/sdcard/screenrecord-${Date.now()}.mp4`
    appendOutput(`开始录屏（最长 30 秒）: ${remotePath}`)
    setIsRecording(true)
    try {
      await window.electronAPI.adbRunCommand({
        adbPath: adbConfig.adb_path,
        deviceId: selectedDeviceId!,
        args: ['shell', 'screenrecord', remotePath, '--time-limit', '30'],
        timeout: 35_000,
      })
      appendOutput('录屏完成，准备下载文件...')

      const targetDir = transferState.downloadDir || adbConfig.default_download_dir || downloadsDir
      if (targetDir && window.electronAPI?.adbPull) {
        const localPath = joinLocalPath(targetDir, remotePath.split('/').pop() || 'record.mp4')
        const pullResult = await window.electronAPI.adbPull({
          adbPath: adbConfig.adb_path,
          deviceId: selectedDeviceId!,
          remotePath,
          localPath,
        })
        if (pullResult.code === 0) {
          message.success(`录屏已保存到 ${localPath}`)
          appendOutput(`录屏文件已保存：${localPath}`)
        } else {
          message.error('录屏文件保存失败')
          appendOutput(pullResult.stderr || '录屏文件保存失败')
        }
      } else {
        message.warning('未配置本地保存目录，录屏文件仍保存在设备中')
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      appendOutput(`录屏失败: ${errorMessage}`)
      message.error(`录屏失败：${errorMessage}`)
    } finally {
      setIsRecording(false)
    }
  }, [
    adbConfig.adb_path,
    adbConfig.default_download_dir,
    appendOutput,
    downloadsDir,
    ensureDeviceSelected,
    getErrorMessage,
    selectedDeviceId,
    transferState.downloadDir,
  ])

  const layoutLoading = state.loading || devicesLoading

  const tabContentStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  } as const

  const deviceTab = (
    <div style={tabContentStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Space size="small">
          <Text type="secondary">ADB 状态</Text>
          {adbStatus ? (
            <Tag color={adbStatus.ok ? 'green' : 'red'}>{adbStatus.message}</Tag>
          ) : (
            <Tag>未检测</Tag>
          )}
        </Space>
        <Button icon={<ReloadOutlined />} onClick={fetchDevices} loading={devicesLoading}>
          刷新设备
        </Button>
      </div>
      <List
        rowKey={(device) => device.id}
        dataSource={devices}
        locale={{ emptyText: adbStatus?.ok ? '尚未检测到设备' : '请先检查 ADB 状态' }}
        renderItem={(device) => (
          <List.Item
            onClick={() => setSelectedDeviceId(device.id)}
            style={{
              cursor: 'pointer',
              border:
                selectedDeviceId === device.id ? '1px solid #1677ff' : '1px solid transparent',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <Space direction="vertical" size={4}>
              <Space>
                <Text strong>{device.id}</Text>
                <Tag color={statusColorMap[device.status] || 'cyan'}>{device.status}</Tag>
              </Space>
              <Text type="secondary">
                {device.manufacturer || 'Unknown'} {device.model || ''}
              </Text>
              {device.androidVersion && (
                <Text type="secondary">Android {device.androidVersion}</Text>
              )}
            </Space>
          </List.Item>
        )}
      />
    </div>
  )

  const commandTab = (
    <div style={tabContentStyle}>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder="shell getprop ro.product.model"
        />
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleRunCommand}>
          执行
        </Button>
      </Space.Compact>

      <Space wrap>
        {quickCommandPresets.map((preset) => (
          <Button
            key={preset.label}
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => {
              const command = preset.args.join(' ')
              setCommandInput(command)
              message.success(`自动填充命令: ${command}`)
            }}
          >
            {preset.label}
          </Button>
        ))}
      </Space>

      {commandHistory.commands.length > 0 && (
        <>
          <Divider orientation="left" plain>
            历史命令
          </Divider>
          <Space wrap>
            {commandHistory.commands.map((command) => (
              <Tag
                key={command}
                color="geekblue"
                style={{ cursor: 'pointer' }}
                onClick={() => setCommandInput(command)}
              >
                {command}
              </Tag>
            ))}
          </Space>
        </>
      )}

      <Divider orientation="left" plain>
        输出
      </Divider>
      <div
        style={{
          background: '#0b1522',
          color: '#c5f4ff',
          minHeight: 200,
          maxHeight: 320,
          overflowY: 'auto',
          borderRadius: 8,
          padding: 12,
          fontFamily: 'Consolas, monospace',
          fontSize: 13,
        }}
      >
        {outputLines.length === 0 ? (
          <Text type="secondary">等待命令执行...</Text>
        ) : (
          outputLines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
        )}
      </div>
    </div>
  )

  const fileTab = (
    <div style={tabContentStyle}>
      <div>
        <Text strong>上传文件</Text>
        <Space.Compact style={{ width: '100%', marginTop: 8 }}>
          <Input
            value={transferState.uploadLocalPath}
            placeholder="选择本地文件"
            onChange={(e) =>
              setTransferState((prev) => ({ ...prev, uploadLocalPath: e.target.value }))
            }
          />
          <Button onClick={handleSelectUploadFile}>选择</Button>
        </Space.Compact>
        <Input
          style={{ marginTop: 8 }}
          value={transferState.uploadRemotePath}
          placeholder="/sdcard/Download/"
          onChange={(e) =>
            setTransferState((prev) => ({ ...prev, uploadRemotePath: e.target.value }))
          }
        />
        <Button
          type="primary"
          icon={<CloudUploadOutlined />}
          style={{ marginTop: 8 }}
          onClick={handlePushFile}
        >
          上传
        </Button>
      </div>

      <Divider />

      <div>
        <Text strong>下载文件</Text>
        <Input
          style={{ marginTop: 8 }}
          value={transferState.downloadRemotePath}
          placeholder="/sdcard/Download/example.txt"
          onChange={(e) =>
            setTransferState((prev) => ({ ...prev, downloadRemotePath: e.target.value }))
          }
        />
        <Space.Compact style={{ width: '100%', marginTop: 8 }}>
          <Input
            value={transferState.downloadDir}
            placeholder="本地保存目录"
            onChange={(e) => setTransferState((prev) => ({ ...prev, downloadDir: e.target.value }))}
          />
          <Button onClick={handleSelectDownloadDir}>选择目录</Button>
        </Space.Compact>
        <Button icon={<CloudDownloadOutlined />} style={{ marginTop: 8 }} onClick={handlePullFile}>
          下载
        </Button>
      </div>
    </div>
  )

  const quickActionsTab = (
    <div style={tabContentStyle}>
      <Space wrap>
        <Button icon={<CloudUploadOutlined />} onClick={handleInstallApk} loading={isInstallingApk}>
          安装 APK
        </Button>
        <Button icon={<CameraOutlined />} onClick={handleScreenshot}>
          截图
        </Button>
        <Button icon={<PlayCircleOutlined />} onClick={handleScreenRecord} loading={isRecording}>
          屏幕录制
        </Button>
        <Button icon={<FileTextOutlined />} onClick={handleLogcat}>
          导出 Logcat
        </Button>
        <Button icon={<FolderOpenOutlined />} onClick={() => setActiveTab('files')}>
          文件传输
        </Button>
        <Button icon={<AndroidOutlined />} onClick={handleDeviceInfo}>
          设备信息
        </Button>
      </Space>

      {lastScreenshotPath && (
        <Paragraph copyable ellipsis={{ rows: 2 }}>
          最近截图：{lastScreenshotPath}
        </Paragraph>
      )}

      {lastLogcat && (
        <Paragraph
          copyable
          style={{
            marginTop: 8,
            maxHeight: 150,
            overflow: 'auto',
            background: '#111',
            color: '#9ef',
            padding: 12,
            borderRadius: 6,
            fontFamily: 'Consolas, monospace',
          }}
        >
          {lastLogcat.slice(0, 500)} {lastLogcat.length > 500 ? '...' : ''}
        </Paragraph>
      )}
    </div>
  )

  const tabItems = [
    { key: 'devices', label: '设备管理', children: deviceTab },
    { key: 'commands', label: 'Shell 命令', children: commandTab },
    { key: 'files', label: '文件传输', children: fileTab },
    { key: 'quick', label: '快捷操作', children: quickActionsTab },
  ]

  return (
    <WidgetLayout
      title={metadata.displayName}
      icon={metadata.icon}
      loading={layoutLoading}
      error={state.error}
      showRefresh
      onRefresh={refresh}
      actionInProgress={isActionInProgress}
    >
      <WidgetSection title="ADB 配置" icon={<AndroidOutlined />}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              value={pendingAdbPath}
              onChange={(e) => setPendingAdbPath(e.target.value)}
              placeholder="adb 或完整路径"
            />
            <Button icon={<FolderOpenOutlined />} onClick={handleSelectAdbPath}>
              浏览
            </Button>
            <Button type="primary" onClick={handleSaveAdbPath}>
              保存
            </Button>
          </Space.Compact>

          <Space>
            <Button icon={<ReloadOutlined />} onClick={checkAdb} loading={isCheckingAdb}>
              检查 ADB
            </Button>
            {adbStatus && <Tag color={adbStatus.ok ? 'green' : 'red'}>{adbStatus.message}</Tag>}
          </Space>
        </Space>
      </WidgetSection>

      <WidgetSection title="ADB 控制台" icon={<ThunderboltOutlined />}>
        <Tabs
          type="card"
          destroyInactiveTabPane={false}
          items={tabItems}
          style={{ width: '100%' }}
          activeKey={activeTab}
          onChange={setActiveTab}
        />
      </WidgetSection>
    </WidgetLayout>
  )
}

export default ADBWidget
