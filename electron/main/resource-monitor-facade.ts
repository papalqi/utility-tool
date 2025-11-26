/**
 * 资源监控门面 - 使用 Worker Threads
 * 主线程接口，将实际工作委托给 Worker Thread
 */

import { Worker } from 'worker_threads'
import path from 'path'
import { app } from 'electron'
import { existsSync } from 'fs'
import type { ResourceUsage, ProcessInfo } from '../../packages/shared/src/resource'
import log from './logger'

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

const WORKER_RELATIVE_PATH = path.join('dist-electron', 'main', 'resource-monitor-worker.js')

/**
 * Worker Thread 资源监控器
 * 在独立线程中执行资源监控，完全不阻塞主线程
 */
export class WorkerResourceMonitor {
  private worker: Worker | null = null
  private requestId = 0
  private pendingRequests = new Map<string, {
    resolve: (value: ResourceUsage | ProcessInfo[]) => void
    reject: (reason: Error) => void
  }>()
  private isReady = false
  private readyPromise: Promise<void>

  constructor() {
    this.readyPromise = this.initWorker()
  }

  /**
   * 初始化 Worker Thread
   */
  private async initWorker(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const workerPath = this.resolveWorkerPath()
        log.debug(`Initializing resource monitor worker: ${workerPath} (packaged: ${app.isPackaged})`)

        this.worker = new Worker(workerPath)

        // 监听 Worker 消息
        this.worker.on('message', (response: WorkerResponse) => {
          if (response.id === 'ready') {
            log.info('Resource monitor worker is ready')
            this.isReady = true
            resolve()
            return
          }

          const pending = this.pendingRequests.get(response.id)
          if (pending) {
            this.pendingRequests.delete(response.id)

            if (response.success && response.data) {
              pending.resolve(response.data)
            } else {
              pending.reject(new Error(response.error || 'Unknown worker error'))
            }
          }
        })

        // Worker 错误处理
        this.worker.on('error', (error) => {
          log.error('Worker error:', error)
          // 拒绝所有待处理请求
          for (const [id, pending] of this.pendingRequests.entries()) {
            pending.reject(error)
            this.pendingRequests.delete(id)
          }
          reject(error)
        })

        // Worker 退出处理
        this.worker.on('exit', (code) => {
          if (code !== 0) {
            const error = new Error(`Worker stopped with exit code ${code}`)
            log.error('Worker exited:', error)
            // 拒绝所有待处理请求
            for (const [id, pending] of this.pendingRequests.entries()) {
              pending.reject(error)
              this.pendingRequests.delete(id)
            }
          }
        })

        // 超时保护
        setTimeout(() => {
          if (!this.isReady) {
            reject(new Error('Worker initialization timeout'))
          }
        }, 5000)
      } catch (error) {
        log.error('Failed to create worker:', error)
        reject(error)
      }
    })
  }

  /**
   * ���ݲ�ͬ����ģʽ���� Worker �ű�·��
   */
  private resolveWorkerPath(): string {
    if (!app.isPackaged) {
      return path.join(__dirname, 'resource-monitor-worker.js')
    }

    const candidates = [
      path.join(process.resourcesPath, 'app.asar.unpacked', WORKER_RELATIVE_PATH),
      path.join(process.resourcesPath, 'app.asar', WORKER_RELATIVE_PATH),
      path.join(process.resourcesPath, WORKER_RELATIVE_PATH),
      path.join(__dirname, 'resource-monitor-worker.js'),
    ]

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate
      }
    }

    const message = `Resource monitor worker script not found. Checked paths: ${candidates.join(', ')}`
    log.error(message)
    throw new Error(message)
  }

  /**
   * 发送请求到 Worker
   */
  private async sendRequest<T = ResourceUsage | ProcessInfo[]>(
    action: 'getUsage' | 'getProcesses',
    params?: { limit?: number }
  ): Promise<T> {
    // 等待 Worker 就绪
    if (!this.isReady) {
      await this.readyPromise
    }

    if (!this.worker) {
      throw new Error('Worker not initialized')
    }

    return new Promise((resolve, reject) => {
      const id = `req_${++this.requestId}_${Date.now()}`
      const request: WorkerRequest = { id, action, params }

      // 注册请求回调
      this.pendingRequests.set(id, {
        resolve: resolve as (value: ResourceUsage | ProcessInfo[]) => void,
        reject
      })

      // 发送到 Worker
      this.worker!.postMessage(request)

      // 请求超时（30 秒）
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error('Worker request timeout'))
        }
      }, 30000)
    })
  }

  /**
   * 获取资源使用情况
   */
  async getUsage(): Promise<ResourceUsage> {
    try {
      return await this.sendRequest<ResourceUsage>('getUsage')
    } catch (error) {
      log.error('Failed to get resource usage from worker:', error)
      // 返回默认值而非抛出错误
      return {
        cpu: 0,
        memory: { used: 0, total: 0, percent: 0 },
        disk: { used: 0, total: 0, percent: 0 },
        timestamp: Date.now()
      }
    }
  }

  /**
   * 获取进程列表
   */
  async getProcesses(limit = 10): Promise<ProcessInfo[]> {
    try {
      return await this.sendRequest<ProcessInfo[]>('getProcesses', { limit })
    } catch (error) {
      log.error('Failed to get processes from worker:', error)
      return []
    }
  }

  /**
   * 销毁 Worker
   */
  async destroy(): Promise<void> {
    if (this.worker) {
      log.info('Terminating resource monitor worker')
      await this.worker.terminate()
      this.worker = null
      this.isReady = false
      this.pendingRequests.clear()
    }
  }
}

// 导出单例（但不自动初始化，等待主进程显式创建）
export let workerResourceMonitor: WorkerResourceMonitor | null = null

/**
 * 初始化 Worker 资源监控器
 */
export function initWorkerResourceMonitor(): WorkerResourceMonitor {
  if (!workerResourceMonitor) {
    workerResourceMonitor = new WorkerResourceMonitor()
  }
  return workerResourceMonitor
}

/**
 * 销毁 Worker 资源监控器
 */
export async function destroyWorkerResourceMonitor(): Promise<void> {
  if (workerResourceMonitor) {
    await workerResourceMonitor.destroy()
    workerResourceMonitor = null
  }
}
