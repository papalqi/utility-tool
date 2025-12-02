/**
 * Shell & Notification IPC handlers
 */

import { ipcMain, shell, Notification } from 'electron'
import log from '../logger'
import { dispatchNotification } from '../notificationHub'
import type { NotificationPayload } from '@shared/notification'
import type { IpcContext } from './index'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerShellIpc(_context: IpcContext): void {
  // ==================== Shell Operations ====================

  ipcMain.handle('shell:openPath', async (_event, path: string) => {
    return shell.openPath(path)
  })

  ipcMain.handle('shell:openExternal', async (_event, target: string) => {
    return shell.openExternal(target)
  })

  // ==================== Notifications ====================

  ipcMain.handle('notification:dispatch', async (_event, payload: NotificationPayload) => {
    return dispatchNotification(payload)
  })

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

  // ==================== HTTP Request ====================

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

  // ==================== Obsidian Placeholder ====================

  ipcMain.handle('obsidian:sync', async (_event, data) => {
    console.log('Obsidian sync:', data)
    return true
  })

  ipcMain.handle('obsidian:readVault', async (_event, path: string) => {
    console.log('Read Obsidian vault:', path)
    return {}
  })
}
