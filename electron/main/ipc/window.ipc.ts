/**
 * Window Control IPC handlers
 */

import { ipcMain } from 'electron'
import type { IpcContext } from './index'

export function registerWindowIpc(context: IpcContext): void {
  ipcMain.handle('window:minimize', () => {
    const mainWindow = context.getMainWindow()
    if (mainWindow) {
      mainWindow.minimize()
    }
  })

  ipcMain.handle('window:maximize', () => {
    const mainWindow = context.getMainWindow()
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
    }
  })

  ipcMain.handle('window:close', () => {
    const mainWindow = context.getMainWindow()
    if (mainWindow) {
      mainWindow.close()
    }
  })

  ipcMain.handle('window:isMaximized', () => {
    const mainWindow = context.getMainWindow()
    return mainWindow?.isMaximized() || false
  })
}
