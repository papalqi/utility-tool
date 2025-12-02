/**
 * Resource Monitor IPC handlers
 */

import { ipcMain } from 'electron'
import log from '../logger'
import type { IpcContext } from './index'

// 资源监控器将在注册时通过参数传入
let resourceMonitor: {
  getUsage: () => Promise<{
    cpu: number
    memory: { used: number; total: number; percent: number }
    disk: { used: number; total: number; percent: number }
    timestamp: number
  }>
  getProcesses: () => Promise<unknown[]>
} | null = null

/**
 * 设置资源监控器实例
 */
export function setResourceMonitor(monitor: typeof resourceMonitor): void {
  resourceMonitor = monitor
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerResourcesIpc(_context: IpcContext): void {
  ipcMain.handle('resources:getUsage', async () => {
    try {
      if (!resourceMonitor) {
        throw new Error('Resource monitor not initialized')
      }
      return await resourceMonitor.getUsage()
    } catch (error) {
      log.error('IPC: Failed to get resource usage', error)
      // 返回默认值而非抛出错误
      return {
        cpu: 0,
        memory: { used: 0, total: 0, percent: 0 },
        disk: { used: 0, total: 0, percent: 0 },
        timestamp: Date.now(),
      }
    }
  })

  ipcMain.handle('resources:getProcesses', async (_event, limit?: number) => {
    try {
      if (!resourceMonitor) {
        throw new Error('Resource monitor not initialized')
      }
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
}
