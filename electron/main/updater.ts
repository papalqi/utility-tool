/**
 * 自动更新管理器
 * 使用 electron-updater 实现应用自动更新
 */

import { autoUpdater } from 'electron-updater'
import { BrowserWindow, dialog } from 'electron'
import log from 'electron-log'

// 配置日志
log.transports.file.level = 'info'
autoUpdater.logger = log

// 开发模式下禁用自动更新
const isDev = process.env.NODE_ENV === 'development'

export interface UpdateInfo {
  version: string
  releaseNotes: string
  releaseDate: string
}

export interface UpdateProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export class AppUpdater {
  private mainWindow: BrowserWindow | null = null
  private updateCheckInterval: NodeJS.Timeout | null = null

  constructor() {
    // 配置更新服务器
    if (isDev) {
      // 开发模式：禁用自动更新
      autoUpdater.autoDownload = false
      autoUpdater.autoInstallOnAppQuit = false
      log.info('[Updater] 开发模式，自动更新已禁用')
    } else {
      // 生产模式：配置自动更新
      autoUpdater.autoDownload = false // 手动控制下载
      autoUpdater.autoInstallOnAppQuit = true
      autoUpdater.allowDowngrade = false
      autoUpdater.allowPrerelease = false

      // 设置更新源（GitHub Releases）
      // autoUpdater.setFeedURL({
      //   provider: 'github',
      //   owner: 'papalqi',
      //   repo: 'pc-utility-tool-electron',
      // })
    }

    this.setupEventHandlers()
  }

  /**
   * 设置主窗口引用
   */
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers() {
    // 检查更新时
    autoUpdater.on('checking-for-update', () => {
      log.info('[Updater] 正在检查更新...')
      this.sendToRenderer('update-checking')
    })

    // 发现新版本
    autoUpdater.on('update-available', (info) => {
      log.info('[Updater] 发现新版本:', info.version)
      this.sendToRenderer('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate,
      })
    })

    // 没有新版本
    autoUpdater.on('update-not-available', (info) => {
      log.info('[Updater] 当前已是最新版本:', info.version)
      this.sendToRenderer('update-not-available', {
        version: info.version,
      })
    })

    // 下载进度
    autoUpdater.on('download-progress', (progress) => {
      log.info(
        `[Updater] 下载进度: ${progress.percent.toFixed(2)}% (${(progress.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s)`
      )
      this.sendToRenderer('update-download-progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      })
    })

    // 下载完成
    autoUpdater.on('update-downloaded', (info) => {
      log.info('[Updater] 更新下载完成:', info.version)
      this.sendToRenderer('update-downloaded', {
        version: info.version,
      })

      // 询问用户是否立即重启安装
      this.promptInstall(info.version)
    })

    // 更新错误
    autoUpdater.on('error', (error) => {
      log.error('[Updater] 更新错误:', error)
      this.sendToRenderer('update-error', {
        message: error.message,
      })
    })
  }

  /**
   * 发送消息到渲染进程
   */
  private sendToRenderer(channel: string, data?: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  /**
   * 检查更新
   */
  async checkForUpdates(): Promise<void> {
    if (isDev) {
      log.info('[Updater] 开发模式，跳过更新检查')
      this.sendToRenderer('update-not-available', {
        version: process.env.npm_package_version || '1.0.0',
      })
      return
    }

    try {
      log.info('[Updater] 手动检查更新')
      await autoUpdater.checkForUpdates()
    } catch (error) {
      log.error('[Updater] 检查更新失败:', error)
      this.sendToRenderer('update-error', {
        message: error instanceof Error ? error.message : '检查更新失败',
      })
    }
  }

  /**
   * 开始下载更新
   */
  async downloadUpdate(): Promise<void> {
    if (isDev) {
      log.info('[Updater] 开发模式，跳过下载')
      return
    }

    try {
      log.info('[Updater] 开始下载更新')
      await autoUpdater.downloadUpdate()
    } catch (error) {
      log.error('[Updater] 下载更新失败:', error)
      this.sendToRenderer('update-error', {
        message: error instanceof Error ? error.message : '下载更新失败',
      })
    }
  }

  /**
   * 安装更新并重启应用
   */
  quitAndInstall(): void {
    if (isDev) {
      log.info('[Updater] 开发模式，跳过安装')
      return
    }

    log.info('[Updater] 退出并安装更新')
    autoUpdater.quitAndInstall(false, true)
  }

  /**
   * 提示用户安装更新
   */
  private async promptInstall(version: string) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return
    }

    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: '更新已就绪',
      message: `新版本 ${version} 已下载完成`,
      detail: '是否立即重启应用以完成更新？',
      buttons: ['稍后重启', '立即重启'],
      defaultId: 1,
      cancelId: 0,
    })

    if (result.response === 1) {
      this.quitAndInstall()
    } else {
      log.info('[Updater] 用户选择稍后重启')
    }
  }

  /**
   * 启动自动更新检查（每6小时检查一次）
   */
  startAutoUpdateCheck(intervalHours: number = 6) {
    if (isDev) {
      log.info('[Updater] 开发模式，不启动自动更新检查')
      return
    }

    // 清除现有定时器
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval)
    }

    // 立即检查一次
    this.checkForUpdates()

    // 设置定时检查
    const intervalMs = intervalHours * 60 * 60 * 1000
    this.updateCheckInterval = setInterval(() => {
      log.info('[Updater] 定时检查更新')
      this.checkForUpdates()
    }, intervalMs)

    log.info(`[Updater] 已启动自动更新检查，间隔 ${intervalHours} 小时`)
  }

  /**
   * 停止自动更新检查
   */
  stopAutoUpdateCheck() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval)
      this.updateCheckInterval = null
      log.info('[Updater] 已停止自动更新检查')
    }
  }

  /**
   * 获取当前版本
   */
  getCurrentVersion(): string {
    return autoUpdater.currentVersion?.version || process.env.npm_package_version || '1.0.0'
  }
}

// 导出单例
export const appUpdater = new AppUpdater()
