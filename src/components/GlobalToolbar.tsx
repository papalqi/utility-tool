import React, { useEffect, useState } from 'react'
import { Button, Tooltip, Progress, Space } from 'antd'
import {
  SettingOutlined,
  CloudDownloadOutlined,
  SyncOutlined,
  ArrowUpOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import { useAppContext } from '../context/AppContext'
import { useTheme } from '../contexts/ThemeContext'

const UpdateStatusIcon: React.FC = () => {
  const { colors } = useTheme()
  const [status, setStatus] = useState<string>('idle')
  const [progress, setProgress] = useState<number>(0)
  const [version, setVersion] = useState<string>('')

  useEffect(() => {
    if (!window.electronAPI) return

    const unsubChecking = window.electronAPI.updater.onChecking(() => setStatus('checking'))
    const unsubAvailable = window.electronAPI.updater.onAvailable((info) => {
      setStatus('available')
      setVersion(info.version)
    })
    const unsubNotAvailable = window.electronAPI.updater.onNotAvailable(() => setStatus('idle'))
    const unsubProgress = window.electronAPI.updater.onDownloadProgress((p) => {
      setStatus('downloading')
      setProgress(p.percent)
    })
    const unsubDownloaded = window.electronAPI.updater.onDownloaded(() => setStatus('downloaded'))
    const unsubError = window.electronAPI.updater.onError(() => setStatus('error'))

    // Check on mount
    window.electronAPI.updater.checkForUpdates().catch(() => {})

    return () => {
      unsubChecking()
      unsubAvailable()
      unsubNotAvailable()
      unsubProgress()
      unsubDownloaded()
      unsubError()
    }
  }, [])

  const handleAction = () => {
    if (status === 'available') {
      window.electronAPI.updater.downloadUpdate()
    } else if (status === 'downloaded') {
      window.electronAPI.updater.installUpdate()
    } else {
      // If idle or checking, maybe just open settings -> about?
      // Or trigger check
      if (status === 'idle' || status === 'error') {
         window.electronAPI.updater.checkForUpdates().catch(() => {})
      }
    }
  }

  if (status === 'idle' && !version) return null

  let icon = <CloudDownloadOutlined />
  const color = colors.textSecondary
  let tooltip = '检查更新'

  if (status === 'checking') {
    icon = <SyncOutlined spin />
    tooltip = '正在检查更新...'
  } else if (status === 'available') {
    icon = <CloudDownloadOutlined style={{ color: '#1890ff' }} />
    tooltip = `新版本 ${version} 可用，点击下载`
  } else if (status === 'downloading') {
    icon = (
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Progress type="circle" percent={Math.round(progress)} width={18} strokeWidth={12} showInfo={false} />
      </div>
    )
    tooltip = `正在下载... ${Math.round(progress)}%`
  } else if (status === 'downloaded') {
    icon = <ArrowUpOutlined style={{ color: '#52c41a' }} />
    tooltip = '更新已就绪，点击重启'
  } else if (status === 'error') {
    icon = <InfoCircleOutlined style={{ color: '#ff4d4f' }} />
    tooltip = '更新出错'
  }

  return (
    <Tooltip title={tooltip}>
      <Button
        type="text"
        icon={icon}
        onClick={handleAction}
        style={{ color: color }}
      />
    </Tooltip>
  )
}

export const GlobalToolbar: React.FC = () => {
  const { setIsSettingsOpen } = useAppContext()
  const { colors } = useTheme()

  return (
    <Space size="small" style={{ marginRight: 8 }}>
      <UpdateStatusIcon />
      <Tooltip title="设置">
        <Button
          type="text"
          icon={<SettingOutlined />}
          onClick={() => setIsSettingsOpen(true)}
          style={{ color: colors.textPrimary }}
        />
      </Tooltip>
    </Space>
  )
}
