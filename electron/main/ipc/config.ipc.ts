/**
 * Config IPC handlers
 */

import { ipcMain } from 'electron'
import log from '../logger'
import { configManager } from '../config'
import type { IpcContext } from './index'

export function registerConfigIpc(_context: IpcContext): void {
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
}
