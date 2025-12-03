/**
 * Electron 主进程入口
 * 重构后的精简版本，IPC handlers 已按功能域拆分到 ipc/ 目录
 */

// Windows 编码设置必须在最开始
if (process.platform === 'win32') {
  process.env.PYTHONIOENCODING = 'utf-8'
  process.env.CHCP = '65001'
  process.env.LANG = 'en_US.UTF-8'
}

import { app, BrowserWindow, globalShortcut } from 'electron'
import { join } from 'path'
import log, { setupLogger } from './logger'
import { configManager } from './config'
import { ptyManager } from './pty-manager'
import { registerAuthWindowHandlers } from './auth-window'
import { initWorkerResourceMonitor, destroyWorkerResourceMonitor } from './resource-monitor-facade'
import { appUpdater } from './updater'
import { registerAllIpcHandlers } from './ipc'
import { setResourceMonitor } from './ipc/resources.ipc'
import { cleanupAllScripts } from './ipc/script.ipc'
import { initializeServices, destroyServices } from './services'
import { initializeDataLayer, cleanupDataLayer } from './data'

// 初始化日志系统
setupLogger()

// 初始化 Worker 资源监控器
const resourceMonitor = initWorkerResourceMonitor()
setResourceMonitor(resourceMonitor)

let mainWindow: BrowserWindow | null = null

/**
 * 创建主窗口
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin',
    show: false,
  })

  // 动态设置 CSP
  setupContentSecurityPolicy(mainWindow)

  // 加载应用
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 注册缩放快捷键
  setupZoomShortcuts(mainWindow)

  // 窗口准备就绪后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    appUpdater.setMainWindow(mainWindow!)
    appUpdater.startAutoUpdateCheck(6)
  })

  // 窗口关闭时清理
  mainWindow.on('closed', () => {
    ptyManager.closeAllSessions()
    appUpdater.stopAutoUpdateCheck()
    mainWindow = null
  })
}

/**
 * 设置缩放快捷键
 * 使用 globalShortcut 注册缩放快捷键，确保在所有平台上都能正常工作
 */
function setupZoomShortcuts(window: BrowserWindow): void {
  // 等待应用就绪后注册快捷键
  const registerShortcuts = () => {
    // Ctrl + = (放大) - 某些键盘布局
    const zoomIn1 = globalShortcut.register('CommandOrControl+=', () => {
      const currentZoom = window.webContents.getZoomLevel()
      window.webContents.setZoomLevel(currentZoom + 0.5)
      log.debug(`Zoom in: ${currentZoom} -> ${currentZoom + 0.5}`)
    })

    // Ctrl + Shift + = (放大) - 标准键盘布局，+ 需要 Shift
    const zoomIn2 = globalShortcut.register('CommandOrControl+Shift+=', () => {
      const currentZoom = window.webContents.getZoomLevel()
      window.webContents.setZoomLevel(currentZoom + 0.5)
      log.debug(`Zoom in (Shift): ${currentZoom} -> ${currentZoom + 0.5}`)
    })

    // Ctrl + - (缩小)
    const zoomOut = globalShortcut.register('CommandOrControl+-', () => {
      const currentZoom = window.webContents.getZoomLevel()
      window.webContents.setZoomLevel(currentZoom - 0.5)
      log.debug(`Zoom out: ${currentZoom} -> ${currentZoom - 0.5}`)
    })

    // Ctrl + 0 (重置缩放)
    const zoomReset = globalShortcut.register('CommandOrControl+0', () => {
      window.webContents.setZoomLevel(0)
      log.debug('Zoom reset to 0')
    })

    if (!zoomIn1) log.warn('Failed to register CommandOrControl+=')
    if (!zoomIn2) log.warn('Failed to register CommandOrControl+Shift+=')
    if (!zoomOut) log.warn('Failed to register CommandOrControl+-')
    if (!zoomReset) log.warn('Failed to register CommandOrControl+0')

    if (zoomIn1 || zoomIn2 || zoomOut || zoomReset) {
      log.info('Zoom shortcuts registered successfully')
    }
  }

  if (app.isReady()) {
    registerShortcuts()
  } else {
    app.whenReady().then(registerShortcuts)
  }
}

/**
 * 设置内容安全策略
 */
function setupContentSecurityPolicy(window: BrowserWindow): void {
  window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const config = configManager.getConfig()
    const fileTransferUrl = config?.file_transfer?.server_url || 'http://localhost:3000/api'

    let fileTransferOrigin = 'http://localhost:3000'
    try {
      const url = new URL(fileTransferUrl)
      fileTransferOrigin = url.origin
    } catch {
      // 使用默认值
    }

    const isDev = process.env.VITE_DEV_SERVER_URL !== undefined
    const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'"
    const connectSrc = `'self' ws: wss: ${fileTransferOrigin}`

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http: ${fileTransferOrigin}; font-src 'self' data:; connect-src ${connectSrc};`,
        ],
      },
    })
  })
}

/**
 * 应用生命周期管理
 */
app.whenReady().then(async () => {
  log.info('App ready, initializing...')

  // 初始化配置管理器
  try {
    await configManager.initialize()
    log.info('Config manager initialized')
  } catch (error) {
    log.error('Failed to initialize config manager', error)
  }

  // 初始化数据层
  try {
    initializeDataLayer()
    log.info('Data layer initialized')
  } catch (error) {
    log.error('Failed to initialize data layer', error)
  }

  // 初始化服务层
  try {
    await initializeServices()
    log.info('Services initialized')
  } catch (error) {
    log.error('Failed to initialize services', error)
  }

  // 注册所有 IPC handlers
  registerAllIpcHandlers({
    getMainWindow: () => mainWindow,
  })

  // 注册身份验证窗口 handlers
  registerAuthWindowHandlers()

  // 创建主窗口
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', async () => {
  // 清理所有资源
  ptyManager.closeAllSessions()
  cleanupAllScripts()
  await destroyServices()
  cleanupDataLayer()
  await destroyWorkerResourceMonitor()

  // 注销所有全局快捷键
  globalShortcut.unregisterAll()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  ptyManager.closeAllSessions()
  cleanupAllScripts()
})
