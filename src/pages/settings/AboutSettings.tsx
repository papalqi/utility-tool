import React, { useEffect, useState } from 'react'
import { Card, Descriptions, Button, Space, Typography, Divider, Tag } from 'antd'
import { GithubOutlined, InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { useTheme } from '../../contexts/ThemeContext'

const { Title, Text, Paragraph, Link } = Typography

export const AboutSettings: React.FC = () => {
  const { colors } = useTheme()
  const [appVersion, setAppVersion] = useState<string>('')
  const [platform, setPlatform] = useState<string>('')
  const [electronVersion, setElectronVersion] = useState<string>('')
  const [chromeVersion, setChromeVersion] = useState<string>('')

  useEffect(() => {
    const loadVersions = async () => {
      if (window.electronAPI) {
        try {
          const version = await window.electronAPI.updater.getCurrentVersion()
          setAppVersion(version)
          
          const platformInfo = await window.electronAPI.getPlatform()
          setPlatform(platformInfo)
        } catch (error) {
          console.error('Failed to get app info:', error)
        }
      }

      // Get Electron/Chrome versions from navigator.userAgent
      const ua = navigator.userAgent
      const electronMatch = ua.match(/Electron\/([\d.]+)/)
      const chromeMatch = ua.match(/Chrome\/([\d.]+)/)
      
      setElectronVersion(electronMatch ? electronMatch[1] : 'N/A')
      setChromeVersion(chromeMatch ? chromeMatch[1] : 'N/A')
    }

    loadVersions()
  }, [])

  const handleCheckUpdate = () => {
    if (window.electronAPI) {
      window.electronAPI.updater.checkForUpdates().catch(() => {})
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 应用信息卡片 */}
      <Card
        style={{
          background: colors.bgSecondary,
          border: `1px solid ${colors.borderPrimary}`,
        }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Title level={2} style={{ margin: 0, color: colors.textPrimary }}>
              PC Utility Tool
            </Title>
            <Text type="secondary" style={{ fontSize: 16 }}>
              高效的桌面工具集合
            </Text>
            <div style={{ marginTop: 16 }}>
              <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                v{appVersion || '1.0.0'}
              </Tag>
            </div>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="应用版本">{appVersion || '1.0.0'}</Descriptions.Item>
            <Descriptions.Item label="Electron">{electronVersion}</Descriptions.Item>
            <Descriptions.Item label="Chrome">{chromeVersion}</Descriptions.Item>
            <Descriptions.Item label="平台">{platform || 'N/A'}</Descriptions.Item>
          </Descriptions>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleCheckUpdate}
              type="primary"
            >
              检查更新
            </Button>
          </div>
        </Space>
      </Card>

      {/* 项目信息卡片 */}
      <Card
        title={
          <Space>
            <InfoCircleOutlined />
            <span>项目信息</span>
          </Space>
        }
        style={{
          background: colors.bgSecondary,
          border: `1px solid ${colors.borderPrimary}`,
        }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>开发者：</Text>
            <Text> Your Name</Text>
          </div>

          <div>
            <Text strong>许可证：</Text>
            <Text> MIT License</Text>
          </div>

          <div>
            <Text strong>项目地址：</Text>
            <br />
            <Link href="https://github.com/yourusername/pc-utility-tool-electron" target="_blank">
              <Space>
                <GithubOutlined />
                <span>GitHub Repository</span>
              </Space>
            </Link>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <Paragraph type="secondary" style={{ margin: 0 }}>
            PC Utility Tool 是一个集成了多种实用功能的桌面应用，包括 AI 助手、任务管理、
            番茄钟、终端工具等。旨在提升开发者的日常工作效率。
          </Paragraph>
        </Space>
      </Card>

      {/* 致谢卡片 */}
      <Card
        title="致谢"
        style={{
          background: colors.bgSecondary,
          border: `1px solid ${colors.borderPrimary}`,
        }}
      >
        <Paragraph type="secondary">
          感谢以下开源项目：
        </Paragraph>
        <ul style={{ color: colors.textSecondary }}>
          <li>Electron - 跨平台桌面应用框架</li>
          <li>React - 用户界面库</li>
          <li>Ant Design - UI 组件库</li>
          <li>Vite - 前端构建工具</li>
          <li>Obsidian - 知识管理灵感来源</li>
        </ul>
      </Card>
    </Space>
  )
}

export default AboutSettings
