/**
 * File & Clipboard IPC handlers
 */

import { app, ipcMain, dialog, clipboard } from 'electron'
import { readFileSync, writeFileSync, copyFileSync, unlinkSync, mkdirSync, existsSync } from 'fs'
import { Buffer } from 'buffer'
import log from '../logger'
import type { IpcContext } from './index'

export function registerFileIpc(context: IpcContext): void {
  // ==================== File Dialogs ====================

  ipcMain.handle('file:select', async (_event, options) => {
    try {
      const mainWindow = context.getMainWindow()
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

      const mainWindow = context.getMainWindow()
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

  // ==================== File Operations ====================

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

  // ==================== Clipboard ====================

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
}
