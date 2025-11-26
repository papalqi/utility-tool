/**
 * 资源监控服务
 * 使用 systeminformation 库获取系统资源使用情况
 * 包含性能优化：并发控制、节流、缓存
 */

import si from 'systeminformation'
import log from './logger'
import type { ResourceUsage, ProcessInfo } from '../../packages/shared/src/resource'

/**
 * 资源监控管理器
 * 防止请求堆积，优化性能
 */
class ResourceMonitor {
  // 并发控制标志
  private isFetchingUsage = false
  private isFetchingProcesses = false

  // 节流控制：某些耗时操作不需要每次都获取
  private lastDiskFetch = 0
  private lastGpuFetch = 0
  private readonly DISK_THROTTLE_MS = 10000 // 磁盘信息每 10 秒更新一次
  private readonly GPU_THROTTLE_MS = 10000 // GPU 信息每 10 秒更新一次

  // 缓存数据
  private cachedDiskData: { used: number; total: number; percent: number } | null = null
  private cachedGpuData: ResourceUsage['gpu'] | undefined

  /**
   * 获取系统资源使用情况
   */
  async getUsage(): Promise<ResourceUsage> {
    // 防止并发请求堆积
    if (this.isFetchingUsage) {
      log.warn('[ResourceMonitor] Skipping duplicate resource usage request')
      return this.createFallbackUsage()
    }

    try {
      this.isFetchingUsage = true
      const now = Date.now()

      // 并行获取 CPU 和内存（这些是快速操作）
      const [cpuLoad, memData] = await Promise.all([si.currentLoad(), si.mem()])

      // CPU 使用率
      const cpu = Math.round(cpuLoad.currentLoad)

      // 内存使用情况
      const memory = {
        used: Math.round((memData.used / 1024 / 1024 / 1024) * 100) / 100, // GB
        total: Math.round((memData.total / 1024 / 1024 / 1024) * 100) / 100, // GB
        percent: Math.round((memData.used / memData.total) * 100),
      }

      // 磁盘使用情况（节流）
      let disk = this.cachedDiskData
      if (!disk || now - this.lastDiskFetch > this.DISK_THROTTLE_MS) {
        try {
          const fsSize = await si.fsSize()
          if (fsSize && fsSize.length > 0) {
            // 获取主磁盘（通常是第一个）
            const mainDisk = fsSize[0]
            disk = {
              used: Math.round((mainDisk.used / 1024 / 1024 / 1024) * 100) / 100, // GB
              total: Math.round((mainDisk.size / 1024 / 1024 / 1024) * 100) / 100, // GB
              percent: Math.round(mainDisk.use),
            }
            this.cachedDiskData = disk
            this.lastDiskFetch = now
          }
        } catch (diskError) {
          log.error('[ResourceMonitor] Failed to fetch disk info:', diskError)
          disk = disk || { used: 0, total: 0, percent: 0 }
        }
      }

      // GPU 使用情况（节流，可选）
      let gpu = this.cachedGpuData
      if (now - this.lastGpuFetch > this.GPU_THROTTLE_MS) {
        try {
          const graphics = await si.graphics()
          if (graphics.controllers && graphics.controllers.length > 0) {
            const mainGpu = graphics.controllers[0]
            // 注意：GPU 使用率和显存信息在某些平台上可能不可用
            gpu = {
              percent: mainGpu.utilizationGpu || 0,
              memory: mainGpu.vram
                ? {
                    used: Math.round(((mainGpu.memoryUsed || 0) / 1024) * 100) / 100, // GB
                    total: Math.round(((mainGpu.vram || 0) / 1024) * 100) / 100, // GB
                  }
                : undefined,
            }
            this.cachedGpuData = gpu
            this.lastGpuFetch = now
          }
        } catch (gpuError) {
          // GPU 信息获取失败是正常的（某些系统不支持）
          log.debug('[ResourceMonitor] Failed to fetch GPU info (may not be supported):', gpuError)
        }
      }

      return {
        cpu,
        memory,
        disk: disk || { used: 0, total: 0, percent: 0 },
        gpu,
        timestamp: now,
      }
    } catch (error) {
      log.error('[ResourceMonitor] Failed to fetch resource usage:', error)
      return this.createFallbackUsage()
    } finally {
      this.isFetchingUsage = false
    }
  }

  /**
   * 获取进程列表（按资源使用排序）
   */
  async getProcesses(limit = 10): Promise<ProcessInfo[]> {
    // 防止并发请求堆积
    if (this.isFetchingProcesses) {
      log.warn('[ResourceMonitor] Skipping duplicate processes list request')
      return []
    }

    try {
      this.isFetchingProcesses = true

      const processes = await si.processes()

      // 过滤并排序进程
      const topProcesses = processes.list
        .filter((p) => p.cpu > 0 || p.mem > 0) // 过滤掉无资源占用的进程
        .sort((a, b) => {
          // 综合排序：CPU 优先，内存次之
          const scoreA = (a.cpu || 0) * 2 + (a.mem || 0)
          const scoreB = (b.cpu || 0) * 2 + (b.mem || 0)
          return scoreB - scoreA
        })
        .slice(0, limit)
        .map((p) => ({
          pid: p.pid,
          name: p.name,
          cpu: Math.round((p.cpu || 0) * 10) / 10,
          memory: Math.round((p.memRss || 0) / 1024 / 1024), // MB
          memPercent: Math.round((p.mem || 0) * 10) / 10,
        }))

      return topProcesses
    } catch (error) {
      log.error('[ResourceMonitor] Failed to fetch processes list:', error)
      return []
    } finally {
      this.isFetchingProcesses = false
    }
  }

  /**
   * 创建降级数据（当获取失败时）
   */
  private createFallbackUsage(): ResourceUsage {
    return {
      cpu: 0,
      memory: { used: 0, total: 0, percent: 0 },
      disk: this.cachedDiskData || { used: 0, total: 0, percent: 0 },
      gpu: this.cachedGpuData,
      timestamp: Date.now(),
    }
  }

  /**
   * 重置缓存（用于强制刷新）
   */
  resetCache(): void {
    this.cachedDiskData = null
    this.cachedGpuData = undefined
    this.lastDiskFetch = 0
    this.lastGpuFetch = 0
  }
}

// 单例导出
export const resourceMonitor = new ResourceMonitor()
