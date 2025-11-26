import { useState, useEffect } from 'react'
import { Layout, Space, Typography } from 'antd'
import { CloseOutlined, MinusOutlined, BorderOutlined } from '@ant-design/icons'
import { GlobalToolbar } from './GlobalToolbar'

const { Header } = Layout
const { Text } = Typography

const TitleBar = () => {
  const [platform, setPlatform] = useState<string>('unknown')

  useEffect(() => {
    // Get platform info from Electron API or user agent
    const getPlatform = async () => {
      if (window.electronAPI) {
        try {
          const platformInfo = await window.electronAPI.getPlatform()
          setPlatform(platformInfo)
        } catch (error) {
          console.error('Failed to get platform:', error)
        }
      } else {
        // Fallback for browser testing
        const ua = navigator.userAgent.toLowerCase()
        if (ua.includes('mac')) setPlatform('darwin')
        else if (ua.includes('win')) setPlatform('win32')
        else if (ua.includes('linux')) setPlatform('linux')
      }
    }
    getPlatform()
  }, [])

  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimizeWindow()
    }
  }

  const handleMaximize = async () => {
    if (window.electronAPI) {
      await window.electronAPI.maximizeWindow()
    }
  }

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.closeWindow()
    }
  }

  const isDarwin = platform === 'darwin'

  const renderDefaultControls = () => (
    <Space size={0}>
      <button
        onClick={handleMinimize}
        style={{
          width: '46px',
          height: '40px',
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <MinusOutlined />
      </button>
      <button
        onClick={handleMaximize}
        style={{
          width: '46px',
          height: '40px',
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <BorderOutlined />
      </button>
      <button
        onClick={handleClose}
        style={{
          width: '46px',
          height: '40px',
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#e81123')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <CloseOutlined />
      </button>
    </Space>
  )

  return (
    <Header
      className="titlebar glass-panel"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isDarwin ? 'flex-start' : 'space-between',
        padding: `0 ${isDarwin ? 16 : 16}px`,
        paddingLeft: isDarwin ? 72 : 16,
        height: '40px',
        borderBottom: 0, // Glass panel handles border
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <Text strong style={{ color: 'var(--color-text-primary)', fontSize: '14px' }}>
        PC Utility Tool
      </Text>
      <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
        <GlobalToolbar />
        {!isDarwin && platform !== 'unknown' && renderDefaultControls()}
      </div>
    </Header>
  )
}

export default TitleBar
