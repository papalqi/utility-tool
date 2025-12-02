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

import { app, BrowserWindow } from 'electron'
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
  await destroyWorkerResourceMonitor()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  ptyManager.closeAllSessions()
  cleanupAllScripts()
})
