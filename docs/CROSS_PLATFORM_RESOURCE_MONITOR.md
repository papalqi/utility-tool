# 跨平台资源监控指南

## 概述

PC Utility Tool 的资源监控模块现已支持 **Windows**、**macOS** 和 **Linux** 三大操作系统。使用原生 Node.js API 和系统命令，避免外部依赖产生的兼容性问题。

## 支持的平台和功能

### Windows
- **CPU 使用率**: ✅ Node.js `os.cpus()` API
- **内存使用**: ✅ Node.js `os.totalmem()` / `os.freemem()` API  
- **磁盘使用**: ✅ PowerShell `Get-PSDrive` 命令
- **进程列表**: ✅ PowerShell `Get-Process` 命令
- **GPU 信息**: ⚠️ WMI（仅显存大小，无使用率）

### macOS
- **CPU 使用率**: ✅ Node.js `os.cpus()` API
- **内存使用**: ✅ Node.js `os.totalmem()` / `os.freemem()` API
- **磁盘使用**: ✅ `df` 命令
- **进程列表**: ✅ `ps aux` 命令
- **GPU 信息**: ❌ 需要原生扩展支持

### Linux
- **CPU 使用率**: ✅ Node.js `os.cpus()` API
- **内存使用**: ✅ Node.js `os.totalmem()` / `os.freemem()` API
- **磁盘使用**: ✅ `df` 命令
- **进程列表**: ✅ `ps aux` 命令
- **GPU 信息**: ⚠️ `nvidia-smi`（仅 NVIDIA GPU）

## 实现细节

### 文件结构
```
electron/main/
├── resource-monitor.ts         # 原始实现（使用 systeminformation 库）
├── resource-monitor-native.ts  # 跨平台原生实现（推荐）
└── index.ts                    # 主进程入口，使用原生实现
```

### 核心类: NativeResourceMonitor

#### CPU 监控
```typescript
private getCpuUsage(): number
```
- 使用 Node.js 内置 `os.cpus()` API
- 计算 idle 时间差来获取使用率
- 全平台统一实现

#### 内存监控
```typescript
private getMemoryInfo(): ResourceUsage['memory']
```
- 使用 `os.totalmem()` 和 `os.freemem()`
- 返回已用、总量和百分比
- 全平台统一实现

#### 磁盘监控
```typescript
private async getDiskInfo(): Promise<ResourceUsage['disk']>
```
- **Windows**: PowerShell `Get-PSDrive`
- **macOS/Linux**: `df` 命令
- 包含 10 秒缓存机制减少系统调用

#### 进程监控
```typescript
async getProcesses(): Promise<ProcessInfo[]>
```
- **Windows**: PowerShell `Get-Process`
  - **注意**：按内存占用排序（不是 CPU 使用率）
  - CPU 列显示的是**累积 CPU 时间（秒）**，非实时使用率
  - 内存百分比正确计算（相对于系统总内存）
- **macOS/Linux**: `ps aux`
  - 按 CPU 使用率排序
  - 显示实时 CPU 百分比
- 返回前 10 个进程

#### GPU 监控
```typescript
private async getGpuInfo(): Promise<ResourceUsage['gpu'] | undefined>
```
- **Windows**: WMI `Win32_VideoController`（基础信息）
- **Linux**: `nvidia-smi`（NVIDIA GPU）
- **macOS**: 暂不支持（需要原生扩展）

## 优势

### 1. 避免编码问题
- 不再依赖 `wmic` 等可能产生乱码的命令
- 使用 UTF-8 编码的 PowerShell 输出
- 错误信息静默处理，不污染日志

### 2. 更好的兼容性
- Windows 11/Server 2022 移除了 `wmic`
- 使用各平台的现代命令和 API
- 自动降级处理不支持的功能

### 3. 性能优化
- 磁盘信息 10 秒缓存
- CPU 信息缓存上次状态用于计算
- 错误时返回默认值而非抛出异常

## 使用方法

### 在主进程中
```typescript
import { nativeResourceMonitor } from './resource-monitor-native'

// 获取资源使用情况
const usage = await nativeResourceMonitor.getUsage()
// 返回: { cpu, memory, disk, gpu?, timestamp }

// 获取进程列表
const processes = await nativeResourceMonitor.getProcesses()
// 返回: ProcessInfo[]
```

### IPC 处理
```typescript
ipcMain.handle('resources:getUsage', async () => {
  try {
    return await resourceMonitor.getUsage()
  } catch (error) {
    // 返回默认值而非抛出错误
    return {
      cpu: 0,
      memory: { used: 0, total: 0, percent: 0 },
      disk: { used: 0, total: 0, percent: 0 },
      timestamp: Date.now()
    }
  }
})
```

## 扩展建议

### GPU 监控增强
1. **Windows**: 可集成 DirectX 诊断工具
2. **macOS**: 可使用 Metal Performance Shaders API
3. **Linux**: 可支持 AMD GPU（rocm-smi）

### 网络监控
可添加网络接口和流量监控：
- 使用 `os.networkInterfaces()` 获取网络接口
- 定期采样计算流量速率

### 温度监控
- **Windows**: WMI `MSAcpi_ThermalZoneTemperature`
- **macOS**: `osx-temperature-sensor` 库
- **Linux**: `/sys/class/thermal/` 文件系统

## 故障排除

### Windows 进程列表显示为空
**问题原因**: 
- PowerShell 版本不匹配（pwsh vs powershell）
- PowerShell 命令引号嵌套问题

**解决方案**:
1. 代码已实现自动检测可用的 PowerShell 版本（pwsh > powershell）
2. 简化 PowerShell 命令避免复杂的表达式嵌套
3. 在 Node.js 层面处理数据格式化

**检查方法**:
```powershell
# 测试 PowerShell Core
pwsh -NoProfile -Command "Get-Process | Select-Object -First 3 Id, ProcessName, CPU, WorkingSet | ConvertTo-Json"

# 测试 Windows PowerShell
powershell -NoProfile -Command "Get-Process | Select-Object -First 3 Id, ProcessName, CPU, WorkingSet | ConvertTo-Json"
```

### Windows CPU 数据显示异常（数值过大）
**问题原因**:
- `Get-Process` 的 `CPU` 属性是**累积的 CPU 时间（秒）**，不是实时使用率百分比
- 长时间运行的进程会显示很大的累积时间值

**当前方案**:
1. 进程列表改为**按内存占用排序**（更实用）
2. CPU 列标题改为"CPU 时间 (s)"避免误导
3. 保留 CPU 时间作为辅助参考信息

**获取实时 CPU 百分比的替代方案**（未实现）:
- 使用 WMI `Win32_PerfFormattedData_PerfProc_Process`（性能开销较大）
- 采样两次 `Get-Process` 计算差值（需要延迟）
- 使用 `typeperf` 性能计数器（命令较复杂）

### Windows 乱码问题
如果仍出现乱码：
1. 确保环境变量设置：`CHCP=65001`
2. PowerShell 使用 `-NoProfile` 参数
3. 检查系统区域设置

### Linux 权限问题
某些命令可能需要权限：
- `nvidia-smi`: 需要 NVIDIA 驱动正确安装
- 温度监控: 可能需要 root 权限

### macOS 安全限制
- 某些系统信息访问可能需要用户授权
- 考虑在 Info.plist 中声明权限需求

## 测试方法

```bash
# Windows
npm run electron:dev

# macOS
npm run electron:dev

# Linux
npm run electron:dev

# 检查日志输出
tail -f ~/AppData/Roaming/pc-utility-tool-electron/logs/main.log  # Windows
tail -f ~/Library/Logs/pc-utility-tool-electron/main.log           # macOS
tail -f ~/.config/pc-utility-tool-electron/logs/main.log           # Linux
```

## 相关文件

- [架构文档](./ARCHITECTURE.md)
- [依赖管理](./DEPENDENCY_MANAGEMENT.md)
- [构建状态](./BUILD_STATUS.md)
