/**
 * ADB IPC handlers
 */

import { ipcMain } from 'electron'
import log from '../logger'
import { adbManager, AdbNotFoundError } from '../adb-manager'
import { dispatchNotification } from '../notificationHub'
import type { AdbFileTransferOptions, AdbRunCommandOptions } from '@shared/adb'
import type { IpcContext } from './index'

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

export function registerAdbIpc(_context: IpcContext): void {
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
}
