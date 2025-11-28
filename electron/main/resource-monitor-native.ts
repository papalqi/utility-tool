/**
 * 原生资源监控模块
 * 使用 Node.js 内置 API 获取系统资源，避免外部命令调用产生的错误
 */

import os from 'os'
import type { ResourceUsage, ProcessInfo } from '../../packages/shared/src/resource'
import log from './logger'
import { systemCommandRunner } from './system/system-command-runner'

/**
 * 使用原生 Node.js API 的资源监控器
 * 完全避免使用可能产生错误的外部命令
 */
interface CpuInfo {
  times: {
    user: number
    nice: number
    sys: number
    idle: number
    irq: number
  }
}

interface PowerShellProcess {
  Id: number
  ProcessName?: string
  CPU?: number
  WorkingSet?: number
}

export class NativeResourceMonitor {
  private lastCpuInfo: CpuInfo[] | null = null
  private cachedGpuData: ResourceUsage['gpu'] | null = null
  private lastGpuFetch = 0
  private readonly GPU_THROTTLE_MS = 30000 // GPU 缓存 30 秒
  private requestQueue: Promise<ResourceUsage> = Promise.resolve({
    cpu: 0,
    memory: { used: 0, total: 0, percent: 0 },
    disk: { used: 0, total: 0, percent: 0 },
    timestamp: Date.now()
  }) // 请求队列（disk 保留为默认值，不再获取）

  /**
   * 获取 CPU 使用率
   */
  private getCpuUsage(): number {
    const cpus = os.cpus()
    
    if (!this.lastCpuInfo) {
      this.lastCpuInfo = cpus
      return 0
    }

    let idleDiff = 0
    let totalDiff = 0

    for (let i = 0; i < cpus.length; i++) {
      const cpu = cpus[i]
      const lastCpu = this.lastCpuInfo[i]
      
      const total = Object.values(cpu.times).reduce((acc, val) => acc + val, 0)
      const lastTotal = Object.values(lastCpu.times).reduce((acc, val) => acc + val, 0)
      
      totalDiff += total - lastTotal
      idleDiff += cpu.times.idle - lastCpu.times.idle
    }

    this.lastCpuInfo = cpus
    
    const usage = totalDiff === 0 ? 0 : Math.round((1 - idleDiff / totalDiff) * 100)
    return Math.max(0, Math.min(100, usage))
  }

  /**
   * 获取内存信息
   */
  private getMemoryInfo(): ResourceUsage['memory'] {
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem

    return {
      used: Math.round((usedMem / 1024 / 1024 / 1024) * 100) / 100,
      total: Math.round((totalMem / 1024 / 1024 / 1024) * 100) / 100,
      percent: Math.round((usedMem / totalMem) * 100)
    }
  }


  /**
   * 获取进程列表（跨平台）
   */
  async getProcesses(): Promise<ProcessInfo[]> {
    try {
      let parseResult: ((result: string) => ProcessInfo[]) | null = null
      let outputEncoding: BufferEncoding = 'utf8'
      let fetchResult: (() => Promise<string | null>) | null = null
      let debugCommand: string | null = null
      
      switch (process.platform) {
        case 'win32': {
          // Windows: 使用 PowerShell（优先 pwsh，回退到 powershell）
          // 注意：Get-Process 的 CPU 属性是累积 CPU 时间（秒），不是实时使用率
          // 这里按工作集（内存）排序更有实用价值
          const psCmd = await systemCommandRunner.getPowerShellCommand()
          outputEncoding = psCmd === 'powershell' ? 'utf16le' : 'utf8'
          const script =
            '"Get-Process | Sort-Object -Property WorkingSet -Descending | Select-Object -First 10 Id, ProcessName, CPU, WorkingSet | ConvertTo-Json"'
          const totalMemoryGB = os.totalmem() / 1024 / 1024 / 1024
          fetchResult = async () => {
            const result = await systemCommandRunner.execPowerShell(script, { encoding: outputEncoding })
            if (!result) {
              log.warn('[ProcessInfo] Skipping fetch: PowerShell is unavailable')
            }
            return result
          }
          debugCommand = script
          parseResult = (result) => {
            try {
              log.debug('Raw PowerShell output:', result.substring(0, 200))
              let processes = JSON.parse(result)
              // PowerShell 可能返回对象而非数组
              if (!Array.isArray(processes)) {
                processes = [processes]
              }
              const parsed = processes
                .filter((p: PowerShellProcess) => p && p.Id) // 过滤无效数据
                .map((p: PowerShellProcess) => {
                  const memoryMB = Math.round((p.WorkingSet || 0) / 1024 / 1024)
                  const memoryGB = memoryMB / 1024
                  return {
                    pid: p.Id,
                    name: p.ProcessName || 'unknown',
                    // CPU 显示为累积时间（秒），前端应该理解这不是百分比
                    cpu: typeof p.CPU === 'number' ? Math.round(p.CPU * 10) / 10 : 0,
                    memory: memoryMB,
                    memPercent: Math.round((memoryGB / totalMemoryGB) * 1000) / 10 // 保留一位小数
                  }
                })
              log.debug(`Parsed ${parsed.length} processes`)
              return parsed
            } catch (e) {
              log.error('Failed to parse PowerShell JSON:', e)
              return []
            }
          }
          break
        }
          
        case 'darwin': {
          // macOS: 使用 ps 命令
          const command = `ps aux | head -11 | tail -10`
          debugCommand = command
          fetchResult = () => systemCommandRunner.exec(command, { encoding: outputEncoding })
          parseResult = (result) => {
            const lines = result.trim().split('\n')
            return lines.map(line => {
              const parts = line.trim().split(/\s+/)
              if (parts.length >= 11) {
                return {
                  pid: parseInt(parts[1]) || 0,
                  name: parts[10] || 'unknown',
                  cpu: parseFloat(parts[2]) || 0,
                  memory: parseFloat(parts[3]) || 0,
                  memPercent: parseFloat(parts[3]) || 0
                }
              }
              return null
            }).filter(p => p !== null) as ProcessInfo[]
          }
          break
        }
          
        case 'linux': {
          // Linux: 使用 ps 命令
          const command = `ps aux --sort=-%cpu | head -11 | tail -10`
          debugCommand = command
          fetchResult = () => systemCommandRunner.exec(command, { encoding: outputEncoding })
          parseResult = (result) => {
            const lines = result.trim().split('\n')
            return lines.map(line => {
              const parts = line.trim().split(/\s+/)
              if (parts.length >= 11) {
                return {
                  pid: parseInt(parts[1]) || 0,
                  name: parts[10] || 'unknown',
                  cpu: parseFloat(parts[2]) || 0,
                  memory: parseInt(parts[5]) / 1024 || 0, // KB to MB
                  memPercent: parseFloat(parts[3]) || 0
                }
              }
              return null
            }).filter(p => p !== null) as ProcessInfo[]
          }
          break
        }
          
        default:
          return []
      }
      
      if (!fetchResult || !parseResult) {
        return []
      }
      
      if (debugCommand) {
        log.debug(`[ProcessInfo] Executing command: ${debugCommand}`)
      }
      const result = await fetchResult()
      if (!result) {
        return []
      }
      log.debug(`Command output length: ${result.length}`)
      return parseResult(result)
    } catch (error) {
      log.error('Failed to get processes:', error)
    }
    
    return []
  }

  /**
   * 获取 GPU 信息（可选，仅部分平台支持，带缓存）
   */
  private async getGpuInfo(): Promise<ResourceUsage['gpu'] | undefined> {
    const now = Date.now()
    
    // 使用缓存
    if (this.cachedGpuData !== null && now - this.lastGpuFetch < this.GPU_THROTTLE_MS) {
      return this.cachedGpuData
    }

    try {
      let gpuData: ResourceUsage['gpu'] | undefined
      
      switch (process.platform) {
        case 'win32':
          // Windows: 使用 PowerShell 和 WMI
          try {
            const script =
              '"Get-WmiObject Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json"'
            const result = await systemCommandRunner.execPowerShell(script, { encoding: 'utf16le' })
            if (!result) {
              log.warn('[GPU] Skipping fetch: PowerShell is unavailable')
              break
            }
            const gpu = JSON.parse(result)
            if (gpu && gpu.AdapterRAM) {
              gpuData = {
                percent: 0, // Windows 原生不提供 GPU 使用率
                memory: {
                  used: 0,
                  total: Math.round(gpu.AdapterRAM / 1024 / 1024 / 1024)
                }
              }
            }
          } catch {
            // WMI 可能不可用
          }
          break
          
        case 'darwin':
          // macOS: GPU 信息获取较复杂，暂时返回 undefined
          // 可以通过 Metal Performance Shaders 或 IOKit 获取，但需要原生扩展
          gpuData = undefined
          break
          
        case 'linux':
          // Linux: 尝试使用 nvidia-smi（仅 NVIDIA GPU）
          try {
            const cmd = `nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits`
            const result = await systemCommandRunner.exec(cmd, { encoding: 'utf8' })
            const parts = result.trim().split(',').map(s => s.trim())
            if (parts.length >= 3) {
              gpuData = {
                percent: parseInt(parts[0]) || 0,
                memory: {
                  used: parseInt(parts[1]) / 1024 || 0, // MB to GB
                  total: parseInt(parts[2]) / 1024 || 0
                }
              }
            }
          } catch {
            // nvidia-smi 可能不存在
          }
          break
      }
      
      // 更新缓存
      this.cachedGpuData = gpuData
      this.lastGpuFetch = now
      return gpuData
    } catch {
      // GPU 信息获取失败是正常的
    }
    
    return this.cachedGpuData || undefined
  }

  /**
   * 获取资源使用情况（带请求队列防止并发）
   */
  async getUsage(): Promise<ResourceUsage> {
    // 使用队列机制，确保请求串行执行
    this.requestQueue = this.requestQueue.then(() => this._getUsageImpl()).catch(() => this._getUsageImpl())
    return this.requestQueue
  }

  /**
   * 内部实现：获取资源使用情况
   */
  private async _getUsageImpl(): Promise<ResourceUsage> {
    const [cpu, memory, gpu] = await Promise.all([
      Promise.resolve(this.getCpuUsage()),
      Promise.resolve(this.getMemoryInfo()),
      this.getGpuInfo()
    ])

    return {
      cpu,
      memory,
      disk: { used: 0, total: 0, percent: 0 }, // 磁盘信息已禁用，返回默认值
      gpu,
      timestamp: Date.now()
    }
  }
}

// 导出单例
export const nativeResourceMonitor = new NativeResourceMonitor()
