/**
 * Script Execution IPC handlers
 */

import { ipcMain, WebContents } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import type { IpcContext } from './index'

interface RunningScript {
  child: ChildProcess
  webContents: WebContents
}

const runningScripts = new Map<string, RunningScript>()

type RunScriptOptions = {
  command: string
  args?: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
  shell?: boolean
}

export function registerScriptIpc(_context: IpcContext): void {
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
}

/**
 * 获取所有运行中的脚本
 * 用于在应用退出时清理
 */
export function getRunningScripts(): Map<string, RunningScript> {
  return runningScripts
}

/**
 * 清理所有运行中的脚本
 */
export function cleanupAllScripts(): void {
  for (const [id, record] of runningScripts.entries()) {
    try {
      record.child.kill()
    } catch {
      // Ignore errors when killing
    }
    runningScripts.delete(id)
  }
}
