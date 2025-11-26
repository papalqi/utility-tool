# Worker Threads 资源监控优化

## 概述

使用 Node.js Worker Threads 将资源监控任务完全移到独立线程，彻底消除主线程阻塞，实现真正的并发执行。

## 架构

### 传统方案（已废弃）
```
主线程 → execSync(PowerShell) → 阻塞 100-300ms → 返回结果
```
**问题**：即使使用异步 `exec`，仍会占用主线程事件循环资源

### Worker Threads 方案（当前）
```
主线程 → 发送消息到 Worker
  ↓
Worker Thread → 异步执行 PowerShell → 返回结果
  ↓
主线程 ← 接收结果（完全非阻塞）
```
**优势**：
- ✅ 主线程零阻塞
- ✅ CPU 密集型任务隔离
- ✅ 自动负载均衡（Worker 内部队列）
- ✅ 更好的错误隔离

## 文件结构

```
electron/main/
├── resource-monitor-native.ts      # 核心监控逻辑（在 Worker 中运行）
├── resource-monitor-worker.ts      # Worker Thread 入口
├── resource-monitor-facade.ts      # 主线程门面（消息通信）
└── index.ts                        # 主进程（使用门面）
```

## 实现细节

### 1. Worker Thread 入口（resource-monitor-worker.ts）

```typescript
import { parentPort } from 'worker_threads'
import { nativeResourceMonitor } from './resource-monitor-native'

parentPort.on('message', async (request) => {
  // 在独立线程中执行资源监控
  const data = await nativeResourceMonitor.getUsage()
  parentPort.postMessage({ success: true, data })
})
```

### 2. 主线程门面（resource-monitor-facade.ts）

```typescript
export class WorkerResourceMonitor {
  private worker: Worker
  
  async getUsage(): Promise<ResourceUsage> {
    return new Promise((resolve) => {
      // 发送请求到 Worker
      this.worker.postMessage({ action: 'getUsage' })
      // 等待 Worker 响应
      this.worker.once('message', (response) => {
        resolve(response.data)
      })
    })
  }
}
```

### 3. 主进程使用（index.ts）

```typescript
import { initWorkerResourceMonitor } from './resource-monitor-facade'

const resourceMonitor = initWorkerResourceMonitor()

// IPC 处理（完全不阻塞）
ipcMain.handle('resources:getUsage', () => resourceMonitor.getUsage())
```

## 性能对比

| 指标 | 同步版本 | 异步版本 | Worker Threads |
|------|---------|---------|---------------|
| 主线程阻塞 | ~200ms | ~0ms* | **0ms** |
| 事件循环影响 | 高 | 中 | **无** |
| CPU 隔离 | ❌ | ❌ | **✅** |
| 错误隔离 | ❌ | 部分 | **✅** |
| 并发请求处理 | 串行 | 队列 | **独立线程** |

*注：异步版本虽然不阻塞主线程，但仍占用事件循环资源

## 错误处理

### Worker 崩溃恢复
```typescript
this.worker.on('error', (error) => {
  log.error('Worker error:', error)
  // 拒绝所有待处理请求
  this.pendingRequests.forEach(p => p.reject(error))
})

this.worker.on('exit', (code) => {
  if (code !== 0) {
    // 可选：自动重启 Worker
  }
})
```

### 请求超时保护
```typescript
setTimeout(() => {
  if (this.pendingRequests.has(id)) {
    this.pendingRequests.delete(id)
    reject(new Error('Worker request timeout'))
  }
}, 30000) // 30 秒超时
```

## 配置优化

### 缓存策略
```typescript
// 磁盘信息：30 秒缓存
private readonly DISK_THROTTLE_MS = 30000

// GPU 信息：30 秒缓存
private readonly GPU_THROTTLE_MS = 30000
```

### 轮询频率
```typescript
// ResourceMonitorCard.tsx
setTimeout(..., 10000) // 10 秒刷新一次
```

## 构建注意事项

### TypeScript 配置
Worker 文件会被编译为独立的 `.js` 文件：
```
dist-electron/main/
├── resource-monitor-native.js
├── resource-monitor-worker.js      # Worker 入口
└── resource-monitor-facade.js
```

### 路径解析
```typescript
const workerPath = path.join(__dirname, 'resource-monitor-worker.js')
// 生产环境：dist-electron/main/resource-monitor-worker.js
// 开发环境：.vite/build/resource-monitor-worker.js
```

## 测试方法

### 开发环境测试
```bash
npm run electron:dev
```

**观察点**：
1. ✅ 控制台日志显示 "Resource monitor worker is ready"
2. ✅ 仪表盘每 10 秒更新，无卡顿
3. ✅ 主进程 CPU 占用 < 3%
4. ✅ 任务管理器显示独立的 Node.js Worker 进程

### 生产构建测试
```bash
npm run electron:build:clean
.\release\win-unpacked\pc-utility-tool-electron.exe
```

检查：
- Worker 文件正确打包
- 路径解析正确
- 性能符合预期

## 故障排除

### Worker 初始化失败
**症状**：日志显示 "Worker initialization timeout"

**原因**：
1. Worker 文件未正确编译
2. 路径解析错误
3. 依赖缺失

**解决**：
```bash
# 检查编译产物
ls dist-electron/main/resource-monitor-worker.js

# 查看日志
tail -f ~/AppData/Roaming/pc-utility-tool-electron/logs/main.log
```

### 请求一直挂起
**症状**：资源监控数据不更新

**原因**：
1. Worker 消息处理循环阻塞
2. 请求 ID 未正确匹配

**解决**：
- 检查 Worker 日志输出
- 添加调试日志追踪消息流

### 内存泄漏
**症状**：长时间运行后内存持续增长

**原因**：
1. `pendingRequests` Map 未清理
2. Worker 消息监听器未移除

**解决**：
- 确保所有请求都有超时机制
- 应用退出时调用 `destroyWorkerResourceMonitor()`

## 后续优化方向

### 1. Worker 池
如果监控频率进一步提高，可考虑使用 Worker 池：
```typescript
class WorkerPool {
  private workers: Worker[] = []
  private roundRobinIndex = 0
  
  getWorker(): Worker {
    const worker = this.workers[this.roundRobinIndex]
    this.roundRobinIndex = (this.roundRobinIndex + 1) % this.workers.length
    return worker
  }
}
```

### 2. 共享内存
使用 `SharedArrayBuffer` 在主线程和 Worker 间共享数据：
```typescript
const buffer = new SharedArrayBuffer(1024)
worker.postMessage({ type: 'init', buffer })
```

### 3. 自动重启
Worker 崩溃时自动重启：
```typescript
worker.on('exit', () => {
  log.warn('Worker exited, restarting...')
  this.initWorker()
})
```

## 参考资料

- [Node.js Worker Threads 文档](https://nodejs.org/api/worker_threads.html)
- [Electron 多线程指南](https://www.electronjs.org/docs/latest/tutorial/multithreading)
- [CROSS_PLATFORM_RESOURCE_MONITOR.md](./CROSS_PLATFORM_RESOURCE_MONITOR.md)
