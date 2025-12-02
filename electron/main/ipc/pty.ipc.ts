/**
 * PTY & Terminal IPC handlers
 */

import { ipcMain } from 'electron'
import { execSync } from 'child_process'
import log from '../logger'
import { ptyManager, PTYSessionOptions } from '../pty-manager'
import { decodeConsoleOutput } from '../utils/encoding'
import type { IpcContext } from './index'

export function registerPtyIpc(context: IpcContext): void {
  // ==================== PTY Sessions ====================

  ipcMain.handle('pty:create', async (_event, payload: PTYSessionOptions) => {
    try {
      const mainWindow = context.getMainWindow()
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

  // ==================== Simple Terminal ====================

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
          : error?.message || 'Failed to execute command'
      console.error('Failed to execute command:', message)
      throw new Error(message)
    }
  })

  ipcMain.handle('terminal:execute', async (_event, command: string) => {
    console.log('Execute command:', command)
    return { output: 'Command executed', exitCode: 0 }
  })
}
