/**
 * 资源监控相关类型定义
 */

export interface ResourceUsage {
  cpu: number // CPU 使用率百分比
  memory: {
    used: number // 已使用内存 (GB)
    total: number // 总内存 (GB)
    percent: number // 使用率百分比
  }
  disk: {
    used: number // 已使用磁盘空间 (GB)
    total: number // 总磁盘空间 (GB)
    percent: number // 使用率百分比
  }
  gpu?: {
    percent: number // GPU 使用率百分比
    memory?: {
      used: number // 已使用显存 (GB)
      total: number // 总显存 (GB)
    }
  }
  timestamp: number // 采集时间戳
}

export interface ProcessInfo {
  pid: number // 进程 ID
  name: string // 进程名称
  cpu: number // CPU 使用率百分比
  memory: number // 内存使用量 (MB)
  memPercent: number // 内存使用率百分比
}

export interface ResourceMonitorData {
  usage: ResourceUsage
  processes: ProcessInfo[]
}
