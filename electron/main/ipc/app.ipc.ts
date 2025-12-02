/**
 * App & Updater IPC handlers
 */

import { app, ipcMain } from 'electron'
import log from '../logger'
import { appUpdater } from '../updater'
import type { IpcContext } from './index'

export function registerAppIpc(_context: IpcContext): void {
  // ==================== App Info ====================

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  ipcMain.handle('app:getPlatform', () => {
    return process.platform
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

  // ==================== Updater ====================

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
}
