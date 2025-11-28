// Windows 编码设置必须在最开始
if (process.platform === 'win32') {
  // 设置环境变量，确保子进程使用 UTF-8
  process.env.PYTHONIOENCODING = 'utf-8'
  process.env.CHCP = '65001'
  process.env.LANG = 'en_US.UTF-8'
}

import { app, BrowserWindow, ipcMain, dialog, clipboard, WebContents, shell } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, copyFileSync, unlinkSync, mkdirSync, existsSync } from 'fs'
import { execSync, spawn, ChildProcess, execFileSync } from 'child_process'
import { Buffer } from 'buffer'
import iconv from 'iconv-lite'
import { randomUUID } from 'crypto'
import log, { setupLogger } from './logger'
import { configManager } from './config'
import { ptyManager, PTYSessionOptions } from './pty-manager'
import { adbManager, AdbNotFoundError } from './adb-manager'
import { AdbFileTransferOptions, AdbRunCommandOptions } from '@shared/adb'
import {
  testConnection as aiTestConnection,
  callChatCompletion as aiChatCompletion,
  logConversation as aiLogConversation,
} from './ai-service'
import { GenericAIConfig, AIChatMessage, AIConversationLogEntry } from '@shared/ai'
import type { NotificationPayload } from '@shared/notification'
import type {
  EnvironmentSnapshot,
  EnvironmentMutationPayload,
  EnvironmentDeletePayload,
  PathEntriesPayload,
  EnvironmentVariable,
  EnvironmentCapabilities,
  EnvVarScope,
} from '@shared/system'
import { dispatchNotification } from './notificationHub'
import * as githubService from './github-service'
import { crawlWebPage, crawlMultiplePages, executeCheckIn } from './web-scraper'
import { registerAuthWindowHandlers } from './auth-window'
// import { resourceMonitor } from './resource-monitor' // 旧版本
// import { nativeResourceMonitor as resourceMonitor } from './resource-monitor-native' // 异步版本
import { initWorkerResourceMonitor, destroyWorkerResourceMonitor } from './resource-monitor-facade'
import { appUpdater } from './updater'

// 初始化 Worker 资源监控器
const resourceMonitor = initWorkerResourceMonitor()

// 初始化日志系统
setupLogger()

let mainWindow: BrowserWindow | null = null

const createWindow = () => {
  // Create the browser window
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

  // 动态设置 CSP，支持配置的文件传输服务器和 PicGo 服务器
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const config = configManager.getConfig()
    const fileTransferUrl = config?.file_transfer?.server_url || 'http://localhost:3000/api'
    
    // 提取文件传输服务器域名和端口（origin）
    let fileTransferOrigin = 'http://localhost:3000'
    try {
      const url = new URL(fileTransferUrl)
      fileTransferOrigin = url.origin
    } catch {
      // 如果解析失败，使用原始值
    }

    // 提取 PicGo 服务器地址（如果配置了）
    const picgoServerUrl = config?.attachment?.picgo_server_url || 'http://127.0.0.1:36677'
    let picgoOrigin = ''
    try {
      const picgoUrl = new URL(picgoServerUrl)
      picgoOrigin = picgoUrl.origin
    } catch {
      // 如果解析失败，使用默认值
      picgoOrigin = 'http://127.0.0.1:36677'
    }

    // 开发环境需要允许内联脚本和 eval（用于 Vite 热重载和 React DevTools）
    const isDev = process.env.VITE_DEV_SERVER_URL !== undefined
    const scriptSrc = isDev 
      ? "'self' 'unsafe-inline' 'unsafe-eval'"
      : "'self'"

    // connect-src: 包含文件传输服务器地址和 PicGo 服务器地址（支持远程服务器）
    const connectSrc = `'self' ws: wss: ${fileTransferOrigin} ${picgoOrigin}`

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http: ${fileTransferOrigin}; font-src 'self' data:; connect-src ${connectSrc};`
        ]
      }
    })
  })

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    
    // 设置更新器的主窗口引用
    appUpdater.setMainWindow(mainWindow!)
    
    // 启动自动更新检查（每 6 小时检查一次）
    appUpdater.startAutoUpdateCheck(6)
  })

  // Cleanup on close
  mainWindow.on('closed', () => {
    // 清理所有 PTY 会话
    ptyManager.closeAllSessions()
    // 停止自动更新检查
    appUpdater.stopAutoUpdateCheck()
    mainWindow = null
  })
}

// App lifecycle
app.whenReady().then(async () => {
  log.info('App ready, initializing...')

  // 初始化配置管理器
  try {
    await configManager.initialize()
    log.info('Config manager initialized')
  } catch (error) {
    log.error('Failed to initialize config manager', error)
  }

  // 注册身份验证窗口 handlers
  registerAuthWindowHandlers()

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
  await destroyWorkerResourceMonitor()
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // 确保所有资源都被清理
  ptyManager.closeAllSessions()
})

interface RunningScript {
  child: ChildProcess
  webContents: WebContents
}

const runningScripts = new Map<string, RunningScript>()

// IPC Handlers
ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

ipcMain.handle('app:getPlatform', () => {
  return process.platform
})

// 自动更新 handlers
ipcMain.handle('updater:check', async () => {
  try {
    await appUpdater.checkForUpdates()
  } catch (error) {
    log.error('检查更新失败', error)
    throw error
  }
})

ipcMain.handle('updater:download', async () => {
  try {
    await appUpdater.downloadUpdate()
  } catch (error) {
    log.error('下载更新失败', error)
    throw error
  }
})

ipcMain.handle('updater:install', () => {
  appUpdater.quitAndInstall()
})

ipcMain.handle('updater:getCurrentVersion', () => {
  return appUpdater.getCurrentVersion()
})

// Config handlers
ipcMain.handle('config:load', async () => {
  try {
    log.debug('IPC: Loading config')
    return configManager.getConfig()
  } catch (error) {
    log.error('IPC: Failed to load config', error)
    return null
  }
})

ipcMain.handle('config:save', async (_event, config) => {
  try {
    log.debug('IPC: Saving config')
    await configManager.saveConfig(config)
    return true
  } catch (error) {
    log.error('IPC: Failed to save config', error)
    throw error
  }
})

ipcMain.handle('config:getHostname', () => {
  try {
    return configManager.getHostname()
  } catch (error) {
    log.error('IPC: Failed to get hostname', error)
    throw error
  }
})

ipcMain.handle('config:getSection', async (_event, section: string) => {
  try {
    log.debug(`IPC: Get config section: ${section}`)
    return configManager.getSection(section as keyof typeof configManager.getConfig)
  } catch (error) {
    log.error(`IPC: Failed to get config section: ${section}`, error)
    return null
  }
})

ipcMain.handle('config:getObsidian', async () => {
  return configManager.getObsidianConfig()
})

ipcMain.handle('config:getSavedPath', async () => {
  try {
    return configManager.getSavedConfigPath()
  } catch (error) {
    log.error('IPC: Failed to get saved config path', error)
    return null
  }
})

// File handlers
ipcMain.handle('file:select', async (_event, options) => {
  try {
    if (!mainWindow) {
      throw new Error('Main window is not available')
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      ...(options as any),
    })
    return result.canceled ? undefined : result.filePaths[0]
  } catch (error) {
    log.error('Failed to show file select dialog', error)
    throw error
  }
})

ipcMain.handle('file:selectFolder', async (_event, options) => {
  try {
    console.log('=== file:selectFolder 调用 ===')
    console.log('Options:', options)

    if (!mainWindow) {
      throw new Error('Main window is not available')
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      ...(options as any),
    })
    console.log('Dialog result:', result)
    const selectedPath = result.canceled ? undefined : result.filePaths[0]
    console.log('返回路径:', selectedPath)
    return selectedPath
  } catch (error) {
    console.error('file:selectFolder error:', error)
    log.error('Failed to show folder select dialog', error)
    throw error
  }
})

ipcMain.handle('file:read', async (_event, path: string) => {
  try {
    return readFileSync(path, 'utf-8')
  } catch (error: any) {
    // 对于 ENOENT（文件不存在）这种预期场景（例如存在性探测），不打印噪声日志
    if (!(error && (error as NodeJS.ErrnoException).code === 'ENOENT')) {
      console.error('Failed to read file:', error)
    }
    throw error
  }
})

ipcMain.handle('file:write', async (_event, path: string, content: string) => {
  try {
    writeFileSync(path, content, 'utf-8')
  } catch (error) {
    console.error('Failed to write file:', error)
    throw error
  }
})

ipcMain.handle('file:ensureDir', async (_event, path: string) => {
  try {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true })
    }
  } catch (error) {
    console.error('Failed to create directory:', error)
    throw error
  }
})

// 文件是否存在（避免通过 read 触发 ENOENT 噪声日志）
ipcMain.handle('file:exists', async (_event, path: string) => {
  try {
    return existsSync(path)
  } catch (error) {
    // existsSync 理论上不会抛错，但稳妥起见保留错误路径
    console.error('Failed to check file existence:', error)
    throw error
  }
})

ipcMain.handle('clipboard:readText', async () => {
  try {
    return clipboard.readText()
  } catch (error) {
    console.error('Failed to read clipboard:', error)
    throw error
  }
})

ipcMain.handle('clipboard:writeText', async (_event, text: string) => {
  try {
    clipboard.writeText(text ?? '')
    return true
  } catch (error) {
    console.error('Failed to write clipboard:', error)
    throw error
  }
})

ipcMain.handle('file:copy', async (_event, source: string, target: string) => {
  try {
    copyFileSync(source, target)
  } catch (error) {
    console.error('Failed to copy file:', error)
    throw error
  }
})

ipcMain.handle('file:delete', async (_event, path: string) => {
  try {
    if (existsSync(path)) {
      unlinkSync(path)
    }
  } catch (error) {
    console.error('Failed to delete file:', error)
    throw error
  }
})

ipcMain.handle('file:readBase64', async (_event, path: string) => {
  try {
    const buffer = readFileSync(path)
    return buffer.toString('base64')
  } catch (error) {
    console.error('Failed to read file as base64:', error)
    throw error
  }
})

ipcMain.handle('file:writeBase64', async (_event, path: string, base64Data: string) => {
  try {
    const buffer = Buffer.from(base64Data, 'base64')
    writeFileSync(path, buffer)
  } catch (error) {
    console.error('Failed to write file from base64:', error)
    throw error
  }
})

ipcMain.handle('file:getTempDir', async () => {
  try {
    return app.getPath('temp')
  } catch (error) {
    console.error('Failed to get temp directory:', error)
    throw error
  }
})

ipcMain.handle('app:getAppPath', async () => {
  try {
    // 在打包环境中，scripts 等资源文件位于 resourcesPath
    // 在开发环境中，使用 app.getAppPath()
    if (app.isPackaged) {
      return process.resourcesPath
    }
    return app.getAppPath()
  } catch (error) {
    console.error('Failed to get app path:', error)
    throw error
  }
})

ipcMain.handle('app:getResourcesPath', async () => {
  try {
    // 返回资源文件路径（打包后为 resourcesPath，开发环境为项目根目录）
    return app.isPackaged ? process.resourcesPath : app.getAppPath()
  } catch (error) {
    console.error('Failed to get resources path:', error)
    throw error
  }
})

ipcMain.handle('app:getPath', async (_event, name: Parameters<typeof app.getPath>[0]) => {
  try {
    return app.getPath(name)
  } catch (error) {
    console.error('Failed to get app path by name:', error)
    throw error
  }
})

// 查找文件（支持通配符）
ipcMain.handle('app:findFiles', async (_event, pattern: string) => {
  try {
    // 兼容 glob@10+ 的 ESM 导出；在 Windows 上允许空格路径且大小写不敏感
    const { glob } = await import('glob')
    const matches = await glob(pattern, {
      windowsPathsNoEscape: true,
      nocase: process.platform === 'win32',
    })
    return matches
  } catch (error) {
    console.error('Failed to find files:', error)
    throw error
  }
})

// Best‑effort decode for Windows console outputs to avoid garbled text
const decodeConsoleOutput = (buf: Buffer): string => {
  if (!Buffer.isBuffer(buf)) return String(buf ?? '')
  if (process.platform === 'win32') {
    // Try UTF‑8 first; if we see replacement chars or common mojibake, try GBK
    const asUtf8 = buf.toString('utf-8')
    if (asUtf8.includes('\uFFFD') || asUtf8.includes('锟')) {
      try {
        return iconv.decode(buf, 'gbk')
      } catch {
        return asUtf8
      }
    }
    return asUtf8
  }
  return buf.toString('utf-8')
}

ipcMain.handle('terminal:exec', async (_event, command: string) => {
  try {
    const result: Buffer = execSync(command, { encoding: 'buffer' }) as unknown as Buffer
    return decodeConsoleOutput(result)
  } catch (error: any) {
    // Prefer stderr if present
    const stderr: Buffer | string | undefined = error?.stderr
    const message: string = Buffer.isBuffer(stderr)
      ? decodeConsoleOutput(stderr)
      : typeof stderr === 'string'
        ? stderr
        : (error?.message || 'Failed to execute command')
    console.error('Failed to execute command:', message)
    throw new Error(message)
  }
})

// PTY handlers
ipcMain.handle('pty:create', async (_event, payload: PTYSessionOptions) => {
  try {
    if (!mainWindow) throw new Error('Main window not found')
    if (!payload?.id) throw new Error('PTY session id is required')
    const sessionId = ptyManager.createSession(payload, mainWindow)
    log.info(`PTY session created: ${sessionId}`)
    return sessionId
  } catch (error: any) {
    log.error('Failed to create PTY session:', error)
    throw error
  }
})

ipcMain.handle('pty:write', async (_event, id: string, data: string) => {
  try {
    const success = ptyManager.writeToSession(id, data)
    if (!success) {
      throw new Error(`PTY session not found: ${id}`)
    }
    return success
  } catch (error: any) {
    log.error('Failed to write to PTY:', error)
    throw error
  }
})

ipcMain.handle('pty:resize', async (_event, id: string, cols: number, rows: number) => {
  try {
    const success = ptyManager.resizeSession(id, cols, rows)
    // 静默处理会话不存在的情况（可能已经关闭）
    if (!success) {
      log.debug(`PTY resize skipped - session not found: ${id}`)
    }
    return success
  } catch (error: any) {
    log.error('Failed to resize PTY:', error)
    throw error
  }
})

ipcMain.handle('pty:close', async (_event, id: string) => {
  try {
    const success = ptyManager.closeSession(id)
    log.info(`PTY session closed: ${id}`)
    return success
  } catch (error: any) {
    log.error('Failed to close PTY:', error)
    throw error
  }
})

// Obsidian handlers (placeholder)
ipcMain.handle('obsidian:sync', async (_event, data) => {
  console.log('Obsidian sync:', data)
  return true
})

ipcMain.handle('obsidian:readVault', async (_event, path: string) => {
  console.log('Read Obsidian vault:', path)
  return {}
})

// Script execution handlers (placeholder)
type RunScriptOptions = {
  command: string
  args?: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
  shell?: boolean
}

ipcMain.handle('script:run', async (event, payload: string | RunScriptOptions, legacyArgs?: string[]) => {
  const options: RunScriptOptions =
    typeof payload === 'string'
      ? {
          command: payload,
          args: legacyArgs,
        }
      : payload

  if (!options.command) {
    throw new Error('script:run 需要提供 command')
  }

  const id = randomUUID()
  const child = spawn(options.command, options.args ?? [], {
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...(options.env || {}) },
    shell: options.shell ?? false,
  })

  runningScripts.set(id, {
    child,
    webContents: event.sender,
  })

  const sendEvent = (channel: string, data: Record<string, unknown>) => {
    const target = event.sender
    if (!target.isDestroyed()) {
      target.send(channel, { id, ...data })
    }
  }

  child.stdout?.on('data', (chunk) => {
    sendEvent('script:output', { type: 'stdout', data: chunk.toString() })
  })

  child.stderr?.on('data', (chunk) => {
    sendEvent('script:output', { type: 'stderr', data: chunk.toString() })
  })

  child.on('error', (error) => {
    sendEvent('script:error', { message: error.message })
  })

  child.on('exit', (code, signal) => {
    sendEvent('script:exit', { code, signal })
    runningScripts.delete(id)
  })

  return { success: true, id, pid: child.pid }
})

ipcMain.handle('script:kill', async (_event, identifier: { id?: string; pid?: number } | string | number) => {
  let targetId: string | undefined
  let targetPid: number | undefined

  if (typeof identifier === 'string') {
    targetId = identifier
  } else if (typeof identifier === 'number') {
    targetPid = identifier
  } else if (identifier) {
    targetId = identifier.id
    targetPid = identifier.pid
  }

  let record: RunningScript | undefined

  if (targetId) {
    record = runningScripts.get(targetId)
  } else if (typeof targetPid === 'number') {
    for (const entry of runningScripts.values()) {
      if (entry.child.pid === targetPid) {
        record = entry
        break
      }
    }
  }

  if (!record) {
    return false
  }

  record.child.kill()

  for (const [id, entry] of runningScripts.entries()) {
    if (entry === record) {
      runningScripts.delete(id)
      break
    }
  }

  return true
})

// Terminal handlers
ipcMain.handle('terminal:execute', async (_event, command: string) => {
  console.log('Execute command:', command)
  return { output: 'Command executed', exitCode: 0 }
})

// HTTP request handler
ipcMain.handle('http:get', async (_event, url: string) => {
  try {
    const https = await import('https')
    const http = await import('http')

    const protocol = url.startsWith('https:') ? https : http

    return new Promise((resolve, reject) => {
      protocol
        .get(url, (res) => {
          let data = ''
          res.on('data', (chunk) => {
            data += chunk
          })
          res.on('end', () => {
            resolve({
              ok: res.statusCode === 200,
              status: res.statusCode,
              data: data,
            })
          })
        })
        .on('error', (error) => {
          reject(error)
        })
    })
  } catch (error) {
    log.error('HTTP GET request failed', error)
    throw error
  }
})

// Environment variable handlers
ipcMain.handle('env:list', async () => {
  try {
    return buildEnvironmentSnapshot()
  } catch (error) {
    log.error('Failed to load environment variables', error)
    throw error
  }
})

ipcMain.handle('env:set', async (_event, payload: EnvironmentMutationPayload) => {
  try {
    return await applyEnvironmentMutation(payload)
  } catch (error) {
    log.error(`Failed to set environment variable ${payload?.key}`, error)
    throw error
  }
})

ipcMain.handle('env:delete', async (_event, payload: EnvironmentDeletePayload) => {
  try {
    await deleteEnvironmentVariable(payload)
    return true
  } catch (error) {
    log.error(`Failed to delete environment variable ${payload?.key}`, error)
    throw error
  }
})

ipcMain.handle('env:setPathEntries', async (_event, payload: PathEntriesPayload) => {
  try {
    await applyPathEntries(payload)
    return true
  } catch (error) {
    log.error(`Failed to update PATH entries for ${payload?.scope}`, error)
    throw error
  }
})

// Resolve an executable on PATH (cross‑platform "which")
const resolveExecutable = (command: string): string | null => {
  if (!command || /[\\/]/.test(command)) {
    // Do not resolve paths with separators here
    return null
  }
  const pathVar = process.env.PATH || ''
  const dirs = pathVar.split(process.platform === 'win32' ? ';' : ':').filter(Boolean)

  if (process.platform === 'win32') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path') as typeof import('path')
    const exts = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD')
      .split(';')
      .filter(Boolean)
    const hasExt = /\.[^.]+$/.test(command)
    for (const dir of dirs) {
      if (!hasExt) {
        for (const ext of exts) {
          const full = path.join(dir, command + ext)
          try {
            if (fs.existsSync(full)) return full
          } catch {
            // Ignore errors when checking file existence
          }
        }
      } else {
        const full = path.join(dir, command)
        try {
          if (fs.existsSync(full)) return full
        } catch {
          // Ignore errors when checking file existence
        }
      }
    }
    return null
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path') as typeof import('path')
    for (const dir of dirs) {
      const full = path.join(dir, command)
      try {
        // Check executable bit for owner/group/others
        fs.accessSync(full, fs.constants.X_OK)
        return full
      } catch {
        // Ignore errors when checking file permissions
      }
    }
    return null
  }
}

ipcMain.handle('env:which', async (_event, command: string) => {
  try {
    return resolveExecutable(command)
  } catch (error) {
    log.error('Failed to resolve executable', error)
    return null
  }
})

// ==================== ADB IPC ====================

const notifyAdbMissing = async (message: string) => {
  try {
    await dispatchNotification({
      channel: 'auto',
      severity: 'warning',
      title: 'ADB 未配置',
      message,
    })
  } catch (error) {
    log.warn('Failed to send ADB missing notification', error)
  }
}

ipcMain.handle('adb:check', async (_event, options: { adbPath?: string }) => {
  try {
    const result = await adbManager.checkVersion(options?.adbPath)
    if (result.code === 0) {
      const versionLine = result.stdout.split('\n')[0] || 'ADB is available'
      return {
        ok: true,
        message: versionLine,
        version: result.stdout,
      }
    }

    return {
      ok: false,
      message: result.stderr || 'ADB command failed',
    }
  } catch (error) {
    if (error instanceof AdbNotFoundError) {
      log.warn('ADB check skipped: adb not found')
      await notifyAdbMissing(error.message)
      return {
        ok: false,
        message: error.message,
        missing: true,
      }
    }
    log.error('ADB check failed', error)
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
})

ipcMain.handle('adb:listDevices', async (_event, options: { adbPath?: string }) => {
  try {
    return await adbManager.listDevices(options?.adbPath)
  } catch (error) {
    if (error instanceof AdbNotFoundError) {
      log.warn('ADB list devices skipped: adb not found')
      await notifyAdbMissing(error.message)
      return []
    }
    log.error('ADB list devices failed', error)
    throw error
  }
})

ipcMain.handle('adb:runCommand', async (_event, options: AdbRunCommandOptions) => {
  try {
    if (!options?.args || options.args.length === 0) {
      throw new Error('ADB command arguments are required')
    }

    return await adbManager.runUserCommand(options)
  } catch (error) {
    if (error instanceof AdbNotFoundError) {
      log.warn('ADB command skipped: adb not found')
      await notifyAdbMissing(error.message)
      return {
        stdout: '',
        stderr: error.message,
        code: -1,
      }
    }
    log.error('ADB command execution failed', error)
    throw error
  }
})

ipcMain.handle('adb:push', async (_event, options: AdbFileTransferOptions) => {
  try {
    if (!options?.deviceId) {
      throw new Error('Device ID is required for push operation')
    }
    if (!options.localPath || !options.remotePath) {
      throw new Error('Local and remote paths are required for push operation')
    }

    return await adbManager.pushFile(options)
  } catch (error) {
    if (error instanceof AdbNotFoundError) {
      log.warn('ADB push skipped: adb not found')
      await notifyAdbMissing(error.message)
      return {
        stdout: '',
        stderr: error.message,
        code: -1,
      }
    }
    log.error('ADB push failed', error)
    throw error
  }
})

ipcMain.handle('adb:pull', async (_event, options: AdbFileTransferOptions) => {
  try {
    if (!options?.deviceId) {
      throw new Error('Device ID is required for pull operation')
    }
    if (!options.localPath || !options.remotePath) {
      throw new Error('Local and remote paths are required for pull operation')
    }

    return await adbManager.pullFile(options)
  } catch (error) {
    if (error instanceof AdbNotFoundError) {
      log.warn('ADB pull skipped: adb not found')
      await notifyAdbMissing(error.message)
      return {
        stdout: '',
        stderr: error.message,
        code: -1,
      }
    }
    log.error('ADB pull failed', error)
    throw error
  }
})

ipcMain.handle(
  'adb:screenshot',
  async (_event, options: { adbPath?: string; deviceId: string; outputDir?: string }) => {
    try {
      if (!options?.deviceId) {
        throw new Error('Device ID is required for screenshot')
      }

      return await adbManager.captureScreenshot(options)
    } catch (error) {
      if (error instanceof AdbNotFoundError) {
        log.warn('ADB screenshot skipped: adb not found')
        await notifyAdbMissing(error.message)
        return {
          filePath: '',
          size: 0,
        }
      }
      log.error('ADB screenshot failed', error)
      throw error
    }
  }
)

ipcMain.handle(
  'adb:logcat',
  async (_event, options: { adbPath?: string; deviceId: string; filter?: string }) => {
    try {
      if (!options?.deviceId) {
        throw new Error('Device ID is required for logcat')
      }

      return await adbManager.dumpLogcat(options)
    } catch (error) {
      if (error instanceof AdbNotFoundError) {
        log.warn('ADB logcat skipped: adb not found')
        await notifyAdbMissing(error.message)
        return {
          log: '',
          length: 0,
        }
      }
      log.error('ADB logcat failed', error)
      throw error
    }
  }
)

// ==================== AI IPC ====================

ipcMain.handle('ai:testConnection', async (_event, config: GenericAIConfig) => {
  return aiTestConnection(config)
})

ipcMain.handle(
  'ai:chatCompletion',
  async (
    _event,
    payload: {
      config: GenericAIConfig
      messages: AIChatMessage[]
      temperature?: number
      maxTokens?: number
      feature?: string
      metadata?: Record<string, unknown>
      log?: boolean
    }
  ) => {
    return aiChatCompletion(payload)
  }
)

ipcMain.handle('ai:logConversation', async (_event, entry: AIConversationLogEntry) => {
  return aiLogConversation(entry)
})

ipcMain.handle('notification:dispatch', async (_event, payload: NotificationPayload) => {
  return dispatchNotification(payload)
})

// ==================== GitHub IPC ====================

ipcMain.handle('github:verifyToken', async (_event, token: string) => {
  return githubService.verifyGitHubToken(token)
})

ipcMain.handle('github:listRepos', async (_event, token: string) => {
  return githubService.listUserRepositories(token)
})

ipcMain.handle('github:cloneRepo', async (_event, options: { url: string; targetPath: string }) => {
  return githubService.cloneRepository(options.url, options.targetPath)
})

ipcMain.handle('git:getInfo', async (_event, repoPath: string) => {
  return githubService.getGitInfo(repoPath)
})

ipcMain.handle('git:execCommand', async (_event, repoPath: string, command: string) => {
  return githubService.execGitCommand(repoPath, command)
})

ipcMain.handle('shell:openPath', async (_event, path: string) => {
  return shell.openPath(path)
})

ipcMain.handle('shell:openExternal', async (_event, target: string) => {
  return shell.openExternal(target)
})

// Obsidian GitHub repositories management
ipcMain.handle('github:loadLocalRepos', async (_event, hostname: string) => {
  try {
    const obsidianConfig = configManager.getObsidianConfig()
    if (!('vault_path' in obsidianConfig) || !obsidianConfig.vault_path) {
      throw new Error('Obsidian vault path not configured')
    }

    const content = await readFileSync(
      `${obsidianConfig.vault_path}/github-repos.md`,
      'utf-8'
    )
    // 简单解析 Markdown 表格（需要更完善的实现）
    return parseGitHubReposMarkdown(content, hostname)
  } catch (error) {
    log.debug('Failed to load GitHub repos, file may not exist yet')
    return []
  }
})

ipcMain.handle('github:saveLocalRepos', async (_event, hostname: string, repos: any[]) => {
  try {
    const obsidianConfig = configManager.getObsidianConfig()
    if (!('vault_path' in obsidianConfig) || !obsidianConfig.vault_path) {
      throw new Error('Obsidian vault path not configured')
    }
    const vaultPath = obsidianConfig.vault_path
    if (!vaultPath) {
      throw new Error('Obsidian vault path not configured')
    }

    const filePath = `${vaultPath}/github-repos.md`

    // 读取现有内容
    let content = ''
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      content = '# GitHub Local Repositories\n\n'
    }

    // 更新指定计算机的仓库列表
    content = updateGitHubReposMarkdown(content, hostname, repos)

    // 写回文件
    writeFileSync(filePath, content, 'utf-8')
    log.info('GitHub repos saved', { hostname, count: repos.length })
    return true
  } catch (error) {
    log.error('Failed to save GitHub repos', error)
    throw error
  }
})

ipcMain.handle('github:loadFavorites', async () => {
  try {
    const obsidianConfig = configManager.getObsidianConfig()
    if (!('vault_path' in obsidianConfig) || !obsidianConfig.vault_path) {
      throw new Error('Obsidian vault path not configured')
    }

    const vaultPath = obsidianConfig.vault_path
    const filePath = `${vaultPath}/github-repos.md`

    if (!existsSync(filePath)) {
      return []
    }

    const content = readFileSync(filePath, 'utf-8')
    return parseGitHubFavoritesSection(content)
  } catch (error) {
    log.debug('Failed to load GitHub favorites, section may not exist yet')
    return []
  }
})

ipcMain.handle('github:saveFavorites', async (_event, favorites: string[]) => {
  try {
    const obsidianConfig = configManager.getObsidianConfig()
    if (!('vault_path' in obsidianConfig) || !obsidianConfig.vault_path) {
      throw new Error('Obsidian vault path not configured')
    }
    const vaultPath = obsidianConfig.vault_path
    const filePath = `${vaultPath}/github-repos.md`

    const sanitized = Array.from(
      new Set(
        (Array.isArray(favorites) ? favorites : [])
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item.length > 0)
      )
    )

    let content = ''
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      content = '# GitHub Local Repositories\n\n'
    }

    const updatedContent = updateGitHubFavoritesSection(content, sanitized)
    writeFileSync(filePath, updatedContent, 'utf-8')
    log.info('GitHub favorites saved', { count: sanitized.length })
    return true
  } catch (error) {
    log.error('Failed to save GitHub favorites', error)
    throw error
  }
})

// Helper functions for parsing GitHub repos Markdown
function parseGitHubReposMarkdown(content: string, hostname: string): any[] {
  const repos: any[] = []
  const lines = content.split('\n')

  let inSection = false
  let headerFound = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // 查找对应主机名的章节
    if (line === `## ${hostname}`) {
      inSection = true
      headerFound = false
      continue
    }

    // 遇到下一个章节标题，停止解析
    if (inSection && line.startsWith('##') && line !== `## ${hostname}`) {
      break
    }

    // 跳过表头
    if (inSection && line.startsWith('|') && line.includes('Name')) {
      headerFound = true
      i++ // 跳过分隔行
      continue
    }

    // 解析表格行
    if (inSection && headerFound && line.startsWith('|')) {
      const parts = line.split('|').map((p) => p.trim()).filter(Boolean)
      if (parts.length >= 4) {
        repos.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: parts[0],
          path: parts[1],
          remoteUrl: parts[2] || undefined,
          branch: parts[3] || undefined,
          tags: parts[4] ? parts[4].split(',').map((t) => t.trim()) : [],
          favorite: parts[5] === '⭐',
        })
      }
    }
  }

  return repos
}

function updateGitHubReposMarkdown(content: string, hostname: string, repos: any[]): string {
  const lines = content.split('\n')
  const result: string[] = []

  let inSection = false
  let sectionFound = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed === `## ${hostname}`) {
      inSection = true
      sectionFound = true
      result.push(line)

      // 添加表头
      result.push('')
      result.push('| Name | Path | Remote | Branch | Tags | Favorite |')
      result.push('|------|------|--------|--------|------|----------|')

      // 添加仓库数据
      for (const repo of repos) {
        const row = [
          repo.name,
          repo.path,
          repo.remoteUrl || '',
          repo.branch || '',
          repo.tags?.join(',') || '',
          repo.favorite ? '⭐' : '',
        ]
        result.push(`| ${row.join(' | ')} |`)
      }

      result.push('')
      continue
    }

    if (inSection && trimmed.startsWith('##')) {
      inSection = false
    }

    if (!inSection || !sectionFound) {
      result.push(line)
    }
  }

  // 如果章节不存在，在末尾添加
  if (!sectionFound) {
    result.push('')
    result.push(`## ${hostname}`)
    result.push('')
    result.push('| Name | Path | Remote | Branch | Tags | Favorite |')
    result.push('|------|------|--------|--------|------|----------|')

    for (const repo of repos) {
      const row = [
        repo.name,
        repo.path,
        repo.remoteUrl || '',
        repo.branch || '',
        repo.tags?.join(',') || '',
        repo.favorite ? '⭐' : '',
      ]
      result.push(`| ${row.join(' | ')} |`)
    }
    result.push('')
  }

  return result.join('\n')
}

const WINDOWS_USER_ENV_REG_PATH = 'HKCU\\Environment'
const WINDOWS_SYSTEM_ENV_REG_PATH =
  'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'
const WINDOWS_EXECUTABLE_CACHE = new Map<string, string | null>()
const ENV_SCOPE_ORDER: Record<EnvVarScope, number> = {
  system: 0,
  user: 1,
  process: 2,
}

function buildEnvironmentSnapshot(): EnvironmentSnapshot {
  const platform = process.platform
  const variables: EnvironmentVariable[] = []
  const scopes: EnvVarScope[] = []
  const registryKeys = new Set<string>()
  const pathEntries = {
    user: [] as string[],
    system: [] as string[],
    process: getProcessPathEntries(),
  }

  const addScope = (scope: EnvVarScope) => {
    if (!scopes.includes(scope)) {
      scopes.push(scope)
    }
  }

  if (platform === 'win32') {
    const regExecutable = resolveWindowsExecutablePath('reg.exe')

    if (regExecutable) {
      const systemVars = readWindowsEnvironmentVariables('system', regExecutable)
      if (systemVars.length) {
        addScope('system')
        systemVars.forEach((entry) => registryKeys.add(normalizeEnvKey(entry.key)))
        variables.push(...systemVars)
        pathEntries.system = extractPathEntries(systemVars)
      }

      const userVars = readWindowsEnvironmentVariables('user', regExecutable)
      if (userVars.length) {
        addScope('user')
        userVars.forEach((entry) => registryKeys.add(normalizeEnvKey(entry.key)))
        variables.push(...userVars)
        pathEntries.user = extractPathEntries(userVars)
      }
    } else {
      log.warn('reg.exe not available, falling back to process environment variables only')
    }
  }

  const processVars: EnvironmentVariable[] = []
  for (const [key, value] of Object.entries(process.env)) {
    if (!key) {
      continue
    }

    if (platform === 'win32' && registryKeys.has(normalizeEnvKey(key))) {
      continue
    }

    processVars.push({
      key,
      value: value ?? '',
      scope: 'process',
      source: 'process',
    })
  }

  if (processVars.length) {
    addScope('process')
    variables.push(...processVars)
  }

  variables.sort((a, b) => {
    if (a.scope !== b.scope) {
      return ENV_SCOPE_ORDER[a.scope] - ENV_SCOPE_ORDER[b.scope]
    }
    return a.key.localeCompare(b.key)
  })

  return {
    variables,
    platform,
    scopes,
    capabilities: resolveEnvironmentCapabilities(platform),
    pathEntries,
    generatedAt: Date.now(),
  }
}

function resolveEnvironmentCapabilities(platform: NodeJS.Platform): EnvironmentCapabilities {
  const isWindows = platform === 'win32'
  if (!isWindows) {
    return {
      supportsEditing: false,
      canEditUser: false,
      canEditSystem: false,
      canDelete: false,
      notes: 'Currently only supports viewing environment variables, cross-platform write support coming soon',
    }
  }

  const regExecutable = resolveWindowsExecutablePath('reg.exe')
  const setxExecutable = resolveWindowsExecutablePath('setx.exe')
  const supportsEditing = Boolean(regExecutable && setxExecutable)

  return {
    supportsEditing,
    canEditUser: Boolean(setxExecutable),
    canEditSystem: Boolean(setxExecutable),
    canDelete: Boolean(regExecutable),
    notes: supportsEditing
      ? undefined
      : 'reg.exe or setx.exe not found, automatically downgraded to read-only mode',
  }
}

async function applyEnvironmentMutation(
  payload: EnvironmentMutationPayload
): Promise<EnvironmentVariable> {
  if (!payload || !payload.key?.trim()) {
    throw new Error('Environment variable name cannot be empty')
  }

  const key = payload.key.trim()
  const serializedValue = `${payload.value ?? ''}`

  if (process.platform !== 'win32') {
    throw new Error('Currently only supports modifying environment variables on Windows')
  }

  const scope: Exclude<EnvVarScope, 'process'> = payload.scope === 'system' ? 'system' : 'user'
  const args = [key, serializedValue]
  if (scope === 'system') {
    args.push('/M')
  }

  const setxExecutable = resolveWindowsExecutablePath('setx.exe')
  if (!setxExecutable) {
    throw new Error('setx.exe not available, cannot set environment variable')
  }

  try {
    execFileSync(setxExecutable, args, { windowsHide: true })
    process.env[key] = serializedValue
    return {
      key,
      value: serializedValue,
      scope,
      source: 'registry',
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to write environment variable ${key}: ${reason}`)
  }
}

async function deleteEnvironmentVariable(payload: EnvironmentDeletePayload): Promise<void> {
  if (!payload || !payload.key?.trim()) {
    throw new Error('Environment variable name cannot be empty')
  }

  if (process.platform !== 'win32') {
    throw new Error('Currently only supports deleting environment variables on Windows')
  }

  const key = payload.key.trim()
  const scope: Exclude<EnvVarScope, 'process'> = payload.scope === 'system' ? 'system' : 'user'
  const hive = scope === 'system' ? WINDOWS_SYSTEM_ENV_REG_PATH : WINDOWS_USER_ENV_REG_PATH
  const regExecutable = resolveWindowsExecutablePath('reg.exe')
  if (!regExecutable) {
    throw new Error('reg.exe not available, cannot delete environment variable')
  }

  try {
    execFileSync(regExecutable, ['delete', hive, '/v', key, '/f'], { windowsHide: true })
    delete process.env[key]
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to delete environment variable ${key}: ${reason}`)
  }
}

async function applyPathEntries(payload: PathEntriesPayload): Promise<void> {
  if (!payload.scope || !payload.entries) {
    throw new Error('PATH update parameters incomplete')
  }

  if (process.platform !== 'win32') {
    throw new Error('Currently only supports modifying PATH on Windows')
  }

  const sanitized = payload.entries
    .map((entry) => entry.trim())
    .filter((entry, index, array) => entry.length > 0 && array.indexOf(entry) === index)

  await applyEnvironmentMutation({
    key: 'PATH',
    value: sanitized.join(';'),
    scope: payload.scope,
  })
}

function readWindowsEnvironmentVariables(
  scope: Exclude<EnvVarScope, 'process'>,
  regExecutable: string
): EnvironmentVariable[] {
  const hive = scope === 'system' ? WINDOWS_SYSTEM_ENV_REG_PATH : WINDOWS_USER_ENV_REG_PATH
  try {
    const output = execFileSync(regExecutable, ['query', hive], { encoding: 'utf8' })
    const lines = output.split(/\r?\n/)
    const entries: EnvironmentVariable[] = []

    for (const rawLine of lines) {
      const line = rawLine.trim()

      if (!line || line.startsWith('HKEY')) {
        continue
      }

      const parts = line.split(/\s{2,}/).filter(Boolean)
      if (parts.length < 3) {
        continue
      }

      const [name, , ...valueParts] = parts
      const value = valueParts.join('  ').replace(/\0/g, ';')
      entries.push({
        key: name,
        value,
        scope,
        source: 'registry',
      })
    }

    return entries
  } catch (error) {
    log.warn(`Failed to read ${scope} environment variables`, error)
    return []
  }
}

function normalizeEnvKey(key: string): string {
  return process.platform === 'win32' ? key.toUpperCase() : key
}

function getProcessPathEntries(): string[] {
  const raw = process.env.PATH || process.env.Path || process.env.path || ''
  return splitPath(raw)
}

function extractPathEntries(entries: EnvironmentVariable[]): string[] {
  const pathEntry = entries.find((entry) => normalizeEnvKey(entry.key) === 'PATH')
  return pathEntry ? splitPath(pathEntry.value) : []
}

function splitPath(value: string): string[] {
  if (!value) {
    return []
  }

  return value
    .split(';')
    .map((segment) => segment.trim())
    .filter((segment) => Boolean(segment))
}

function resolveWindowsExecutablePath(executable: string): string | null {
  if (process.platform !== 'win32') {
    return null
  }

  if (WINDOWS_EXECUTABLE_CACHE.has(executable)) {
    return WINDOWS_EXECUTABLE_CACHE.get(executable) || null
  }

  const systemRoot = process.env.SystemRoot || 'C:\\Windows'
  const candidate = join(systemRoot, 'System32', executable)
  if (existsSync(candidate)) {
    WINDOWS_EXECUTABLE_CACHE.set(executable, candidate)
    return candidate
  }

  // Last resort: trust PATH
  WINDOWS_EXECUTABLE_CACHE.set(executable, null)
  return null
}

function parseGitHubFavoritesSection(content: string): string[] {
  const favorites = new Set<string>()
  const lines = content.split('\n')
  let inSection = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === '## Favorites') {
      inSection = true
      continue
    }

    if (inSection && line.startsWith('##')) {
      break
    }

    if (!inSection || !line) {
      continue
    }

    const normalized = line.startsWith('-') || line.startsWith('*')
      ? line.replace(/^[-*]\s*/, '').trim()
      : line

    if (normalized) {
      favorites.add(normalized)
    }
  }

  return Array.from(favorites)
}

function updateGitHubFavoritesSection(content: string, favorites: string[]): string {
  const lines = content.split('\n')
  const result: string[] = []

  let inSection = false
  let sectionFound = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed === '## Favorites') {
      inSection = true
      sectionFound = true

      if (favorites.length > 0) {
        result.push('## Favorites')
        result.push('')
        for (const fav of favorites) {
          result.push(`- ${fav}`)
        }
        result.push('')
      }
      continue
    }

    if (inSection && trimmed.startsWith('##') && trimmed !== '## Favorites') {
      inSection = false
    }

    if (inSection) {
      continue
    }

    result.push(line)
  }

  if (!sectionFound && favorites.length > 0) {
    if (result.length && result[result.length - 1].trim() !== '') {
      result.push('')
    }
    result.push('## Favorites')
    result.push('')
    for (const fav of favorites) {
      result.push(`- ${fav}`)
    }
    result.push('')
  }

  return result.join('\n')
}

// System notification handler with fallback to dispatcher
ipcMain.handle('notification:show', async (_event, options: { title: string; body: string }) => {
  const fallbackNotify = async () => {
    const fallback = await dispatchNotification({
      title: options.title,
      message: options.body,
      channel: 'system',
    })
    if (!fallback.delivered) {
      log.error('Failed to show notification via dispatcher', fallback.error)
      return false
    }
    return true
  }

  try {
    const { Notification } = await import('electron')

    if (Notification.isSupported()) {
      const notification = new Notification({
        title: options.title,
        body: options.body,
      })
      notification.show()
      return true
    }

    return fallbackNotify()
  } catch (error) {
    log.error('Failed to show notification', error)
    return fallbackNotify()
  }
})

// Window control handlers
ipcMain.handle('window:minimize', () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.handle('window:close', () => {
  if (mainWindow) {
    mainWindow.close()
  }
})

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() || false
})

// Resource Monitor handlers
ipcMain.handle('resources:getUsage', async () => {
  try {
    return await resourceMonitor.getUsage()
  } catch (error) {
    log.error('IPC: Failed to get resource usage', error)
    // 返回默认值而非抛出错误
    return {
      cpu: 0,
      memory: { used: 0, total: 0, percent: 0 },
      disk: { used: 0, total: 0, percent: 0 },
      timestamp: Date.now()
    }
  }
})

ipcMain.handle('resources:getProcesses', async (_event, limit?: number) => {
  try {
    log.debug(`IPC: Getting processes (limit: ${limit || 'all'})`)
    const processes = await resourceMonitor.getProcesses()
    log.debug(`IPC: Got ${processes.length} processes`)
    return processes
  } catch (error) {
    log.error('IPC: Failed to get processes', error)
    // 返回空数组而非抛出错误
    return []
  }
})

// Web Archive / Scraper handlers
ipcMain.handle('webarchive:crawl', async (_event, request) => {
  try {
    log.debug('IPC: Crawling web page', request)
    return await crawlWebPage(request)
  } catch (error) {
    log.error('IPC: Failed to crawl web page', error)
    throw error
  }
})

ipcMain.handle('webarchive:crawlMultiple', async (_event, requests) => {
  try {
    log.debug('IPC: Crawling multiple pages', { count: requests.length })
    const results = await crawlMultiplePages(requests)
    return Object.fromEntries(results)
  } catch (error) {
    log.error('IPC: Failed to crawl multiple pages', error)
    throw error
  }
})

ipcMain.handle('webarchive:checkIn', async (_event, request) => {
  try {
    log.debug('IPC: Executing check-in', request)
    return await executeCheckIn(request)
  } catch (error) {
    log.error('IPC: Failed to execute check-in', error)
    throw error
  }
})
