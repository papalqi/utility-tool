import { useState, useEffect, useCallback } from 'react'
import { Layout, App as AntApp } from 'antd'
import Sidebar from './components/Sidebar'
import WidgetContainer from './components/WidgetContainer'
import TitleBar from './components/TitleBar'
import { GlobalSettingsDrawer } from './components/settings/GlobalSettingsDrawer'
import { configManager } from './core/ConfigManager'
import { obsidianManager } from './core/ObsidianManager'
import { AppProvider } from './context/AppContext'
import { NavigationProvider, useNavigation } from './context/NavigationContext'
import type { AppConfig } from './shared/types'
import { DEFAULT_VISIBLE_TABS } from './config/widgetKeys'

const { Content } = Layout

function AppContent() {
  const { activeWidget, setActiveWidget } = useNavigation()
  const [configLoaded, setConfigLoaded] = useState(false)
  const [configData, setConfigData] = useState<AppConfig | null>(null)

  const initObsidianFromConfig = useCallback(async () => {
    try {
      const config = configManager.getConfig()
      const hostname = await window.electronAPI.getHostname()
      const obsidianConfig = config.computer?.[hostname]?.obsidian

      if (obsidianConfig?.enabled && obsidianConfig.vault_path) {
        await obsidianManager.initialize(
          obsidianConfig.vault_path,
          obsidianConfig.secrets_file || 'secrets.md'
        )
        console.log('ObsidianManager initialized/updated')
      }
    } catch (error) {
      console.error('Failed to initialize Obsidian manager from config:', error)
    }
  }, [])

  // Initialize config manager and obsidian manager on app start
  useEffect(() => {
    const initConfig = async () => {
      try {
        await configManager.initialize()
        console.log('ConfigManager initialized, config loaded:', configManager.getConfig())

        // ��ʼ�� Obsidian Manager
        await initObsidianFromConfig()

        setConfigData(configManager.getConfig())
        setConfigLoaded(true)
      } catch (error) {
        console.error('Failed to initialize config manager:', error)
        setConfigData(configManager.getConfig())
        setConfigLoaded(true) // Continue anyway with default config
      }
    }
    void initConfig()
  }, [initObsidianFromConfig])

  // ���ñ��ʱ��ˢ�� Obsidian ״̬������ȫ���ػ�
  useEffect(() => {
    const unsubscribe = configManager.subscribe(() => {
      setConfigData(configManager.getConfig())
      void initObsidianFromConfig()
    })
    return unsubscribe
  }, [initObsidianFromConfig])

  useEffect(() => {
    if (!configData) return
    const visibleTabs = configData.ui?.visible_tabs?.length
      ? configData.ui.visible_tabs
      : DEFAULT_VISIBLE_TABS

    if (!visibleTabs.includes(activeWidget)) {
      setActiveWidget(visibleTabs[0])
    }
  }, [activeWidget, configData, setActiveWidget])

  // Don't render until config is loaded
  if (!configLoaded) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        Loading...
      </div>
    )
  }

  return (
    <AntApp>
      <Layout className="app-layout">
        <TitleBar />
        <GlobalSettingsDrawer />
        <Layout className="main-content-layout">
          <Sidebar
            activeWidget={activeWidget}
            onWidgetChange={setActiveWidget}
            config={configData}
          />
          <Content className="floating-content">
            <WidgetContainer activeWidget={activeWidget} />
          </Content>
        </Layout>
      </Layout>
    </AntApp>
  )
}

import { ThemeProvider } from './contexts/ThemeContext'

function App() {
  return (
    <ThemeProvider>
      <NavigationProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </NavigationProvider>
    </ThemeProvider>
  )
}

export default App
