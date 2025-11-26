# 资源监控功能

## 概述

在仪表盘中集成了系统资源监控面板，实时显示 CPU、内存、磁盘、GPU 使用率曲线图，支持点击查看进程排行。

## 技术实现

### 后端服务
- **文件**: `electron/main/resource-monitor.ts`
- **库**: `systeminformation` - 跨平台系统信息获取
- **性能优化**:
  - 并发控制：使用 `isFetching` 标志防止请求堆积
  - 节流机制：磁盘和 GPU 信息每 10 秒更新一次（缓存）
  - 快速数据：CPU 和内存每次都实时获取

### IPC 通信
- **Handlers**:
  - `resources:getUsage` - 获取资源使用情况
  - `resources:getProcesses` - 获取进程列表（Top N）
- **Preload API**:
  - `window.electronAPI.getResourceUsage()`
  - `window.electronAPI.getTopProcesses(limit?: number)`

### 前端组件
- **文件**: `src/components/widgets/ResourceMonitorCard.tsx`
- **功能**:
  - 实时显示 CPU、内存、磁盘、GPU 使用率（进度条）
  - 历史曲线图（Recharts LineChart，最多保留 30 个数据点）
  - 进程排行弹窗（可排序表格）
- **性能优化**:
  - 使用 `setTimeout` 递归调度，避免 `setInterval` 导致的请求堆积
  - 轮询间隔：3 秒
  - 组件卸载时清理定时器

### 集成位置
- **仪表盘**: `src/widgets/DashboardWidget.tsx`
- 位于侧边栏，"Tasks" 和 "Today's Schedule" 之间

## 数据结构

```typescript
interface ResourceUsage {
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

interface ProcessInfo {
  pid: number // 进程 ID
  name: string // 进程名称
  cpu: number // CPU 使用率百分比
  memory: number // 内存使用量 (MB)
  memPercent: number // 内存使用率百分比
}
```

## 性能考虑

1. **后端防抖**: 如果上一次请求还在进行中，直接返回降级数据
2. **节流缓存**: 耗时操作（磁盘、GPU）使用缓存，降低系统负载
3. **前端调度**: 使用 `setTimeout` 递归而非 `setInterval`，确保请求串行
4. **数据限制**: 历史记录最多保留 30 个点，避免内存泄漏

## 使用说明

1. 进入仪表盘自动启动监控
2. 每 3 秒自动刷新数据
3. 点击 "进程排行" 查看资源占用 Top 10 进程
4. 进程列表支持按 CPU、内存排序
