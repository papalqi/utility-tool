/**
 * 自动更新检查组件
 * 显示更新状态、下载进度，并提供更新控制
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, Button, Progress, Typography, Space, Alert, Tag, Divider } from 'antd'
import {
  DownloadOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  CloudDownloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import { useTheme } from '@/contexts/ThemeContext'

const { Title, Text, Paragraph } = Typography

interface UpdateInfo {
  version: string
  releaseNotes: string
  releaseDate: string
}

interface DownloadProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

type UpdateStatus = 
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export default function UpdateChecker() {
  const { colors } = useTheme()
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [currentVersion, setCurrentVersion] = useState<string>('')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')

  // 获取当前版本
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const version = await window.electronAPI.updater.getCurrentVersion()
        setCurrentVersion(version)
      } catch (error) {
        console.error('获取版本失败:', error)
      }
    }
    fetchVersion()
  }, [])

  // 设置事件监听器
  useEffect(() => {
    const unsubChecking = window.electronAPI.updater.onChecking(() => {
      setStatus('checking')
      setErrorMessage('')
    })

    const unsubAvailable = window.electronAPI.updater.onAvailable((info) => {
      setStatus('available')
      setUpdateInfo(info)
    })

    const unsubNotAvailable = window.electronAPI.updater.onNotAvailable(() => {
      setStatus('not-available')
    })

    const unsubProgress = window.electronAPI.updater.onDownloadProgress((progress) => {
      setStatus('downloading')
      setDownloadProgress(progress)
    })

    const unsubDownloaded = window.electronAPI.updater.onDownloaded(() => {
      setStatus('downloaded')
      // updateInfo 已在 onAvailable 时设置，这里只更新状态
    })

    const unsubError = window.electronAPI.updater.onError((error) => {
      setStatus('error')
      setErrorMessage(error.message)
    })

    return () => {
      unsubChecking()
      unsubAvailable()
      unsubNotAvailable()
      unsubProgress()
      unsubDownloaded()
      unsubError()
    }
  }, [])

  // 检查更新
  const handleCheckUpdate = useCallback(async () => {
    try {
      setStatus('checking')
      setErrorMessage('')
      await window.electronAPI.updater.checkForUpdates()
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : '检查更新失败')
    }
  }, [])

  // 下载更新
  const handleDownload = useCallback(async () => {
    try {
      setStatus('downloading')
      await window.electronAPI.updater.downloadUpdate()
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : '下载更新失败')
    }
  }, [])

  // 安装更新
  const handleInstall = useCallback(() => {
    window.electronAPI.updater.installUpdate()
  }, [])

  // 格式化字节大小
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  // 格式化速度
  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`
  }

  return (
    <Card
      style={{
        background: colors.bgSecondary,
        border: `1px solid ${colors.borderPrimary}`,
      }}
      styles={{
        body: { padding: '20px' },
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 标题和当前版本 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0, color: colors.textPrimary }}>
            <CloudDownloadOutlined /> 应用更新
          </Title>
          <Tag color="blue">当前版本: {currentVersion}</Tag>
        </div>

        <Divider style={{ margin: '8px 0' }} />

        {/* 状态显示 */}
        {status === 'idle' && (
          <Alert
            message="点击下方按钮检查更新"
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
          />
        )}

        {status === 'checking' && (
          <Alert message="正在检查更新..." type="info" showIcon icon={<ReloadOutlined spin />} />
        )}

        {status === 'not-available' && (
          <Alert
            message="已是最新版本"
            description={`当前版本 ${currentVersion} 是最新版本`}
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
          />
        )}

        {status === 'available' && updateInfo && (
          <Alert
            message={`发现新版本: ${updateInfo.version}`}
            description={
              <div>
                <Paragraph style={{ marginBottom: 8 }}>
                  <Text strong>发布日期:</Text> {new Date(updateInfo.releaseDate).toLocaleString('zh-CN')}
                </Paragraph>
                {updateInfo.releaseNotes && (
                  <Paragraph style={{ marginBottom: 0 }}>
                    <Text strong>更新内容:</Text>
                    <br />
                    <Text>{updateInfo.releaseNotes}</Text>
                  </Paragraph>
                )}
              </div>
            }
            type="warning"
            showIcon
          />
        )}

        {status === 'downloading' && downloadProgress && (
          <div>
            <Alert message="正在下载更新..." type="info" showIcon icon={<DownloadOutlined />} />
            <div style={{ marginTop: 16 }}>
              <Progress
                percent={Math.round(downloadProgress.percent)}
                status="active"
                strokeColor={colors.primary}
              />
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">
                  {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
                </Text>
                <Text type="secondary">{formatSpeed(downloadProgress.bytesPerSecond)}</Text>
              </div>
            </div>
          </div>
        )}

        {status === 'downloaded' && updateInfo && (
          <Alert
            message={`新版本 ${updateInfo.version} 已下载完成`}
            description="点击下方按钮立即重启应用完成更新"
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
          />
        )}

        {status === 'error' && (
          <Alert
            message="更新失败"
            description={errorMessage}
            type="error"
            showIcon
            closable
            onClose={() => setStatus('idle')}
          />
        )}

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {(status === 'idle' || status === 'not-available' || status === 'error') && (
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleCheckUpdate}
            >
              检查更新
            </Button>
          )}

          {status === 'available' && (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleDownload}
            >
              下载更新
            </Button>
          )}

          {status === 'downloaded' && (
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleInstall}
              danger
            >
              立即重启更新
            </Button>
          )}
        </div>
      </Space>
    </Card>
  )
}
