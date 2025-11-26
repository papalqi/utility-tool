/**
 * 资源监控 Worker Thread
 * 在独立线程中执行资源监控，避免阻塞主线程
 */

import { parentPort } from 'worker_threads'
import { nativeResourceMonitor } from './resource-monitor-native'
import type { ResourceUsage, ProcessInfo } from '../../packages/shared/src/resource'

interface WorkerRequest {
  id: string
  action: 'getUsage' | 'getProcesses'
  params?: { limit?: number }
}

interface WorkerResponse {
  id: string
  success: boolean
  data?: ResourceUsage | ProcessInfo[]
  error?: string
}

// Worker 主逻辑
if (parentPort) {
  // 全局错误处理
  process.on('uncaughtException', (error) => {
    console.error('Worker uncaught exception:', error)
    // 不退出进程，继续运行
  })

  process.on('unhandledRejection', (reason) => {
    console.error('Worker unhandled rejection:', reason)
    // 不退出进程，继续运行
  })

  parentPort.on('message', async (request: WorkerRequest) => {
    const response: WorkerResponse = {
      id: request.id,
      success: false
    }

    try {
      switch (request.action) {
        case 'getUsage':
          response.data = await nativeResourceMonitor.getUsage()
          response.success = true
          break

        case 'getProcesses':
          response.data = await nativeResourceMonitor.getProcesses()
          response.success = true
          break

        default:
          response.error = `Unknown action: ${request.action}`
      }
    } catch (error) {
      response.error = error instanceof Error ? error.message : String(error)
      console.error('Worker request failed:', error)
    }

    try {
      parentPort?.postMessage(response)
    } catch (error) {
      console.error('Failed to send response:', error)
    }
  })

  // 通知主线程 Worker 已就绪
  parentPort.postMessage({ id: 'ready', success: true })
} else {
  console.error('This file must be run as a Worker Thread')
  process.exit(1)
}
