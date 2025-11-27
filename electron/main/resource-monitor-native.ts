/**
 * 原生资源监控模块
 * 使用 Node.js 内置 API 获取系统资源，避免外部命令调用产生的错误
 */

import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { ResourceUsage, ProcessInfo } from '../../packages/shared/src/resource'
import log from './logger'

const execAsync = promisify(exec)

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

export class NativeResourceMonitor {
  private lastCpuInfo: CpuInfo[] | null = null
  private cachedDiskData: { used: number; total: number; percent: number } | null = null
  private lastDiskFetch = 0
  private readonly DISK_THROTTLE_MS = 30000 // 延长至 30 秒
  private cachedGpuData: ResourceUsage['gpu'] | null = null
  private lastGpuFetch = 0
  private readonly GPU_THROTTLE_MS = 30000 // GPU 缓存 30 秒
  private powershellCommand: string | null = null
  private requestQueue: Promise<ResourceUsage> = Promise.resolve({
    cpu: 0,
    memory: { used: 0, total: 0, percent: 0 },
    disk: { used: 0, total: 0, percent: 0 },
    timestamp: Date.now()
  }) // 请求队列

  /**
   * 检测可用的 PowerShell 命令（Windows）
   */
  private async getPowerShellCommand(): Promise<string | null> {
    if (this.powershellCommand) return this.powershellCommand
    
    // 优先使用 pwsh (PowerShell Core)，回退到 powershell (Windows PowerShell)
    try {
      await execAsync('pwsh -NoProfile -Command "exit 0"')
      this.powershellCommand = 'pwsh'
      log.debug('Using PowerShell Core (pwsh)')
      return 'pwsh'
    } catch {
      try {
        await execAsync('powershell -NoProfile -Command "exit 0"')
        this.powershellCommand = 'powershell'
        log.debug('Using Windows PowerShell (powershell)')
        return 'powershell'
      } catch {
        log.error('No PowerShell found on system')
        this.powershellCommand = null
        return null
      }
    }
  }

  private async execAndDecode(cmd: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    const { stdout } = await execAsync(cmd, { 
      encoding: 'buffer',
      maxBuffer: 1024 * 1024 // 1MB 缓冲区
    })
    // stdout 在 encoding: 'buffer' 模式下是 Buffer 类型
    return (stdout as unknown as Buffer).toString(encoding)
  }

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
   * 获取磁盘信息（跨平台）
   */
  private async getDiskInfo(): Promise<ResourceUsage['disk']> {
    const now = Date.now()
    
    // 使用缓存
    if (this.cachedDiskData && now - this.lastDiskFetch < this.DISK_THROTTLE_MS) {
      return this.cachedDiskData
    }

    try {
      let cmd = ''
      let parseResult: (result: string) => { used: number; total: number } | null
      let outputEncoding: BufferEncoding = 'utf8'
      
      switch (process.platform) {
        case 'win32': {
          // Windows: 使用 PowerShell (动态选择 pwsh 或 powershell)
          const psCmd = await this.getPowerShellCommand()
          if (!psCmd) {
            log.warn('[DiskInfo] Skipping fetch: PowerShell is unavailable')
            return this.cachedDiskData || { used: 0, total: 0, percent: 0 }
          }
          cmd = `${psCmd} -NoProfile -Command "$drive = Get-PSDrive -PSProvider FileSystem | Where-Object {$_.Root -eq 'C:\\'}; @{Used=$drive.Used; Total=($drive.Used + $drive.Free)} | ConvertTo-Json"`
          outputEncoding = 'utf8' // 改用 utf8 编码
          parseResult = (result) => {
            try {
              log.debug('[DiskInfo] Raw PowerShell output:', result.substring(0, 200))
              const data = JSON.parse(result.trim())
              if (data && data.Used !== undefined && data.Total !== undefined) {
                const used = data.Used / 1024 / 1024 / 1024
                const total = data.Total / 1024 / 1024 / 1024
                log.debug(`[DiskInfo] Parsed: used=${used.toFixed(2)}GB, total=${total.toFixed(2)}GB`)
                return { used, total }
              }
              log.warn('[DiskInfo] Invalid data structure:', data)
            } catch (e) {
              log.error('[DiskInfo] Failed to parse JSON:', e, 'Raw:', result.substring(0, 100))
            }
            return null
          }
          break
        }
          
        case 'darwin':
          // macOS: 使用 df 命令
          cmd = `df -k / | tail -1`
          parseResult = (result) => {
            const parts = result.trim().split(/\s+/)
            if (parts.length >= 4) {
              const total = parseInt(parts[1]) / 1024 / 1024 // KB to GB
              const used = parseInt(parts[2]) / 1024 / 1024
              return { used, total }
            }
            return null
          }
          break
          
        case 'linux':
          // Linux: 使用 df 命令
          cmd = `df -B1 / | tail -1`
          parseResult = (result) => {
            const parts = result.trim().split(/\s+/)
            if (parts.length >= 4) {
              const total = parseInt(parts[1]) / 1024 / 1024 / 1024 // Bytes to GB
              const used = parseInt(parts[2]) / 1024 / 1024 / 1024
              return { used, total }
            }
            return null
          }
          break
          
        default:
          return this.cachedDiskData || { used: 0, total: 0, percent: 0 }
      }
      
      const result = await this.execAndDecode(cmd, outputEncoding)
      const diskData = parseResult(result)
      
      if (diskData) {
        this.cachedDiskData = {
          used: Math.round(diskData.used * 100) / 100,
          total: Math.round(diskData.total * 100) / 100,
          percent: Math.round((diskData.used / diskData.total) * 100)
        }
        this.lastDiskFetch = now
        log.info(`[DiskInfo] Updated cache: ${JSON.stringify(this.cachedDiskData)}`)
        return this.cachedDiskData
      } else {
        log.warn('[DiskInfo] parseResult returned null')
      }
    } catch (error) {
      log.error('[DiskInfo] Failed to get disk info:', error)
    }

    return this.cachedDiskData || { used: 0, total: 0, percent: 0 }
  }

  /**
   * 获取进程列表（跨平台）
   */
  async getProcesses(): Promise<ProcessInfo[]> {
    try {
      let cmd = ''
      let parseResult: (result: string) => ProcessInfo[]
      let outputEncoding: BufferEncoding = 'utf8'
      
      switch (process.platform) {
        case 'win32': {
          // Windows: 使用 PowerShell（优先 pwsh，回退到 powershell）
          // 注意：Get-Process 的 CPU 属性是累积 CPU 时间（秒），不是实时使用率
          // 这里按工作集（内存）排序更有实用价值
          const psCmd = await this.getPowerShellCommand()
          if (!psCmd) {
            log.warn('[ProcessInfo] Skipping fetch: PowerShell is unavailable')
            return []
          }
          cmd = `${psCmd} -NoProfile -Command "Get-Process | Sort-Object -Property WorkingSet -Descending | Select-Object -First 10 Id, ProcessName, CPU, WorkingSet | ConvertTo-Json"`
          outputEncoding = 'utf8'
          
          // 获取系统总内存用于计算百分比
          const totalMemoryGB = os.totalmem() / 1024 / 1024 / 1024
          
          parseResult = (result) => {
            try {
              log.debug('Raw PowerShell output:', result.substring(0, 200))
              let processes = JSON.parse(result)
              // PowerShell 可能返回对象而非数组
              if (!Array.isArray(processes)) {
                processes = [processes]
              }
              const parsed = processes
                .filter((p: any) => p && p.Id) // 过滤无效数据
                .map((p: any) => {
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
          
        case 'darwin':
          // macOS: 使用 ps 命令
          cmd = `ps aux | head -11 | tail -10`
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
          
        case 'linux':
          // Linux: 使用 ps 命令
          cmd = `ps aux --sort=-%cpu | head -11 | tail -10`
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
          
        default:
          return []
      }
      
      log.debug(`Executing command: ${cmd}`)
      const result = await this.execAndDecode(cmd, outputEncoding)
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
            const cmd = `powershell -NoProfile -Command "Get-WmiObject Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json"`
            const result = await this.execAndDecode(cmd, 'utf16le')
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
            const result = await this.execAndDecode(cmd, 'utf8')
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
    const [cpu, memory, disk, gpu] = await Promise.all([
      Promise.resolve(this.getCpuUsage()),
      Promise.resolve(this.getMemoryInfo()),
      this.getDiskInfo(),
      this.getGpuInfo()
    ])

    return {
      cpu,
      memory,
      disk,
      gpu,
      timestamp: Date.now()
    }
  }
}

// 导出单例
export const nativeResourceMonitor = new NativeResourceMonitor()
