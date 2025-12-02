# Electron 应用架构重构方案

## 背景与问题

当前项目存在以下架构问题：

### 1. 主进程职责过轻
- `electron/main/` 仅 ~150KB 代码，主要是 IPC 转发
- 大量业务逻辑散落在渲染进程 Widget 中
- 缺乏统一的服务层和数据层

### 2. 渲染进程职责过重
- 单个 Widget 文件超过 40KB（如 `GitHubWidget.tsx` 49KB）
- Widget 混合了 UI、业务逻辑、数据处理
- 直接操作文件系统和外部 API

### 3. 通信层问题
- IPC 通道无类型约束
- 缺乏统一的错误处理
- 没有事件订阅机制

### 4. 数据层问题
- Obsidian 数据访问散落各处
- 无缓存策略
- 离线支持不完善

---

## 重构目标架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        渲染进程 (Renderer)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Widgets   │  │    Pages    │  │  Components │              │
│  │  (UI Only)  │  │  (UI Only)  │  │  (Shared)   │              │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘              │
│         │                │                                       │
│  ┌──────┴────────────────┴──────┐                               │
│  │         Hooks Layer          │  useWidget, useAPI, etc.      │
│  └──────────────┬───────────────┘                               │
│                 │                                                │
│  ┌──────────────┴───────────────┐                               │
│  │      IPC Client Layer        │  类型安全的 IPC 调用           │
│  └──────────────┬───────────────┘                               │
└─────────────────┼───────────────────────────────────────────────┘
                  │ contextBridge / IPC
┌─────────────────┼───────────────────────────────────────────────┐
│                 │           主进程 (Main)                        │
├─────────────────┼───────────────────────────────────────────────┤
│  ┌──────────────┴───────────────┐                               │
│  │       IPC Server Layer       │  路由 + 中间件 + 错误处理      │
│  └──────────────┬───────────────┘                               │
│                 │                                                │
│  ┌──────────────┴───────────────┐                               │
│  │       Services Layer         │  业务逻辑                      │
│  │  ┌─────────┬─────────┬─────┐ │                               │
│  │  │ GitHub  │   AI    │ ... │ │                               │
│  │  │ Service │ Service │     │ │                               │
│  │  └─────────┴─────────┴─────┘ │                               │
│  └──────────────┬───────────────┘                               │
│                 │                                                │
│  ┌──────────────┴───────────────┐                               │
│  │        Data Layer            │  数据访问                      │
│  │  ┌─────────┬─────────┬─────┐ │                               │
│  │  │Obsidian │  Cache  │Store│ │                               │
│  │  │  DAO    │ Manager │     │ │                               │
│  │  └─────────┴─────────┴─────┘ │                               │
│  └──────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 重构阶段

### 阶段 1：IPC 层拆分 ✅ 已完成
将 `electron/main/index.ts`（1785行）拆分为模块化架构。

## 新目录结构

```
electron/main/
├── index.ts                 # 精简入口（~150行）
├── ipc/                     # IPC handlers 按功能域拆分
│   ├── index.ts             # 统一注册入口
│   ├── app.ipc.ts           # app:*, updater:*
│   ├── config.ipc.ts        # config:*
│   ├── file.ipc.ts          # file:*, clipboard:*
│   ├── pty.ipc.ts           # pty:*, terminal:*
│   ├── script.ipc.ts        # script:*
│   ├── env.ipc.ts           # env:*
│   ├── adb.ipc.ts           # adb:*
│   ├── ai.ipc.ts            # ai:*
│   ├── github.ipc.ts        # github:*, git:*
│   ├── window.ipc.ts        # window:*
│   ├── resources.ipc.ts     # resources:*
│   ├── webarchive.ipc.ts    # webarchive:*
│   └── shell.ipc.ts         # shell:*, notification:*, http:*
├── services/                # 业务逻辑层
│   └── env.service.ts       # 环境变量处理逻辑
├── utils/                   # 工具函数
│   ├── encoding.ts          # 控制台编码处理
│   └── markdown-parser.ts   # GitHub Markdown 解析
└── ... (现有文件保持不变)
```

## 架构设计

### 1. IPC Context

```typescript
// ipc/index.ts
export interface IpcContext {
  getMainWindow: () => BrowserWindow | null
}
```

通过 Context 传递共享依赖，避免循环引用。

### 2. 统一注册

```typescript
// 在 index.ts 中
registerAllIpcHandlers({
  getMainWindow: () => mainWindow,
})
```

一次调用注册所有 IPC handlers。

### 3. 服务层分离

将复杂业务逻辑（如环境变量管理）从 IPC handler 中抽离到独立服务：

```typescript
// ipc/env.ipc.ts - 只负责 IPC 绑定
ipcMain.handle('env:list', async () => {
  return buildEnvironmentSnapshot() // 调用 service
})

// services/env.service.ts - 核心逻辑
export function buildEnvironmentSnapshot(): EnvironmentSnapshot {
  // 复杂的环境变量收集逻辑
}
```

## 迁移步骤

### 步骤 1: 备份
```powershell
Copy-Item electron/main/index.ts electron/main/index.backup.ts
```

### 步骤 2: 替换入口文件
```powershell
Move-Item electron/main/index.ts electron/main/index.old.ts
Move-Item electron/main/index.new.ts electron/main/index.ts
```

### 步骤 3: 验证
```powershell
npm run type-check
npm run electron:dev
```

### 步骤 4: 清理
```powershell
Remove-Item electron/main/index.old.ts
Remove-Item electron/main/index.backup.ts
```

## 模块职责

| 模块 | IPC Channels | 职责 |
|------|-------------|------|
| `app.ipc` | `app:*`, `updater:*` | 应用信息、自动更新 |
| `config.ipc` | `config:*` | 配置读写 |
| `file.ipc` | `file:*`, `clipboard:*` | 文件操作、剪贴板 |
| `pty.ipc` | `pty:*`, `terminal:*` | 终端会话管理 |
| `script.ipc` | `script:*` | 脚本执行与管理 |
| `env.ipc` | `env:*` | 环境变量 |
| `adb.ipc` | `adb:*` | Android 调试桥 |
| `ai.ipc` | `ai:*` | AI 服务调用 |
| `github.ipc` | `github:*`, `git:*` | GitHub/Git 操作 |
| `window.ipc` | `window:*` | 窗口控制 |
| `resources.ipc` | `resources:*` | 系统资源监控 |
| `webarchive.ipc` | `webarchive:*` | 网页抓取 |
| `shell.ipc` | `shell:*`, `notification:*`, `http:*` | 系统交互 |

## 优势

1. **可维护性**：每个模块职责单一，易于理解和修改
2. **可测试性**：服务层可独立单元测试
3. **扩展性**：新增功能只需添加对应的 `.ipc.ts` 文件
4. **代码复用**：工具函数和服务可被多个模块共享
5. **入口清晰**：`index.ts` 只负责应用生命周期管理

---

## 阶段 2：类型安全的 IPC 层

### 2.1 定义 IPC 通道类型

```typescript
// packages/shared/ipc-types.ts

/** IPC 通道定义 */
export interface IpcChannels {
  // Config
  'config:load': { args: []; return: AppConfig | null }
  'config:save': { args: [config: AppConfig]; return: boolean }
  'config:getHostname': { args: []; return: string }
  
  // File
  'file:read': { args: [path: string]; return: string }
  'file:write': { args: [path: string, content: string]; return: void }
  'file:exists': { args: [path: string]; return: boolean }
  
  // GitHub
  'github:listRepos': { args: [token: string]; return: GitHubRepo[] }
  'github:cloneRepo': { args: [options: CloneOptions]; return: CloneResult }
  
  // ... 其他通道
}

/** 提取通道名称 */
export type IpcChannel = keyof IpcChannels

/** 提取参数类型 */
export type IpcArgs<C extends IpcChannel> = IpcChannels[C]['args']

/** 提取返回类型 */
export type IpcReturn<C extends IpcChannel> = IpcChannels[C]['return']
```

### 2.2 类型安全的 IPC 客户端

```typescript
// src/core/ipc-client.ts

import type { IpcChannel, IpcArgs, IpcReturn } from '@shared/ipc-types'

class IpcClient {
  async invoke<C extends IpcChannel>(
    channel: C,
    ...args: IpcArgs<C>
  ): Promise<IpcReturn<C>> {
    return window.electronAPI.invoke(channel, ...args)
  }
  
  on<C extends IpcChannel>(
    channel: C,
    callback: (data: IpcReturn<C>) => void
  ): () => void {
    return window.electronAPI.on(channel, callback)
  }
}

export const ipc = new IpcClient()

// 使用示例
const config = await ipc.invoke('config:load') // 自动推断返回 AppConfig | null
const repos = await ipc.invoke('github:listRepos', token) // 自动推断返回 GitHubRepo[]
```

### 2.3 IPC 中间件系统

```typescript
// electron/main/ipc/middleware.ts

export type IpcMiddleware = (
  channel: string,
  args: unknown[],
  next: () => Promise<unknown>
) => Promise<unknown>

/** 日志中间件 */
export const loggingMiddleware: IpcMiddleware = async (channel, args, next) => {
  const start = Date.now()
  log.debug(`IPC: ${channel} called`, { args })
  try {
    const result = await next()
    log.debug(`IPC: ${channel} completed in ${Date.now() - start}ms`)
    return result
  } catch (error) {
    log.error(`IPC: ${channel} failed`, error)
    throw error
  }
}

/** 错误处理中间件 */
export const errorMiddleware: IpcMiddleware = async (channel, args, next) => {
  try {
    return await next()
  } catch (error) {
    // 统一错误格式
    throw {
      channel,
      message: error instanceof Error ? error.message : String(error),
      code: error instanceof AppError ? error.code : 'UNKNOWN',
      timestamp: Date.now(),
    }
  }
}

/** 应用中间件 */
export function applyMiddleware(
  handler: IpcHandler,
  middlewares: IpcMiddleware[]
): IpcHandler {
  return async (event, ...args) => {
    let index = 0
    const next = async (): Promise<unknown> => {
      if (index < middlewares.length) {
        return middlewares[index++](channel, args, next)
      }
      return handler(event, ...args)
    }
    return next()
  }
}
```

---

## 阶段 3：服务层设计

### 3.1 目录结构

```
electron/main/services/
├── index.ts                 # 服务注册中心
├── base.service.ts          # 服务基类
├── github.service.ts        # GitHub 业务逻辑
├── todo.service.ts          # Todo 业务逻辑
├── calendar.service.ts      # 日历业务逻辑
├── ai.service.ts            # AI 业务逻辑（已有，需增强）
├── file-transfer.service.ts # 文件传输业务逻辑
└── obsidian.service.ts      # Obsidian 集成业务逻辑
```

### 3.2 服务基类

```typescript
// electron/main/services/base.service.ts

import { EventEmitter } from 'events'
import log from '../logger'

export abstract class BaseService extends EventEmitter {
  protected readonly name: string
  protected initialized = false
  
  constructor(name: string) {
    super()
    this.name = name
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return
    log.info(`Initializing service: ${this.name}`)
    await this.onInitialize()
    this.initialized = true
  }
  
  async destroy(): Promise<void> {
    if (!this.initialized) return
    log.info(`Destroying service: ${this.name}`)
    await this.onDestroy()
    this.initialized = false
  }
  
  protected abstract onInitialize(): Promise<void>
  protected abstract onDestroy(): Promise<void>
  
  protected log(message: string, data?: unknown): void {
    log.info(`[${this.name}] ${message}`, data)
  }
  
  protected error(message: string, error?: unknown): void {
    log.error(`[${this.name}] ${message}`, error)
  }
}
```

### 3.3 GitHub 服务示例

```typescript
// electron/main/services/github.service.ts

import { BaseService } from './base.service'
import { obsidianDAO } from '../data/obsidian.dao'
import type { GitHubRepo, CloneResult } from '@shared/github'

export class GitHubService extends BaseService {
  private cachedRepos: Map<string, GitHubRepo[]> = new Map()
  
  constructor() {
    super('GitHubService')
  }
  
  protected async onInitialize(): Promise<void> {
    // 加载缓存的仓库列表
    await this.loadCachedRepos()
  }
  
  protected async onDestroy(): Promise<void> {
    this.cachedRepos.clear()
  }
  
  /** 获取本地仓库列表 */
  async getLocalRepos(hostname: string): Promise<GitHubRepo[]> {
    // 优先返回缓存
    if (this.cachedRepos.has(hostname)) {
      return this.cachedRepos.get(hostname)!
    }
    
    // 从 Obsidian Vault 加载
    const repos = await obsidianDAO.readGitHubRepos(hostname)
    this.cachedRepos.set(hostname, repos)
    return repos
  }
  
  /** 保存本地仓库列表 */
  async saveLocalRepos(hostname: string, repos: GitHubRepo[]): Promise<void> {
    await obsidianDAO.writeGitHubRepos(hostname, repos)
    this.cachedRepos.set(hostname, repos)
    this.emit('repos:updated', { hostname, repos })
  }
  
  /** 克隆仓库 */
  async cloneRepo(url: string, targetPath: string): Promise<CloneResult> {
    this.log(`Cloning ${url} to ${targetPath}`)
    // 实现克隆逻辑...
    return { success: true, path: targetPath }
  }
  
  /** 同步仓库状态 */
  async syncRepoStatus(repos: GitHubRepo[]): Promise<GitHubRepo[]> {
    // 检查每个仓库的 git 状态
    return Promise.all(repos.map(async (repo) => {
      const status = await this.getGitStatus(repo.path)
      return { ...repo, ...status }
    }))
  }
  
  private async loadCachedRepos(): Promise<void> {
    // 从持久化存储加载缓存
  }
  
  private async getGitStatus(path: string): Promise<Partial<GitHubRepo>> {
    // 获取 git 状态
    return {}
  }
}

export const githubService = new GitHubService()
```

### 3.4 服务注册中心

```typescript
// electron/main/services/index.ts

import { githubService } from './github.service'
import { todoService } from './todo.service'
import { calendarService } from './calendar.service'
import { aiService } from './ai.service'
import { obsidianService } from './obsidian.service'

const services = [
  githubService,
  todoService,
  calendarService,
  aiService,
  obsidianService,
]

export async function initializeServices(): Promise<void> {
  for (const service of services) {
    await service.initialize()
  }
}

export async function destroyServices(): Promise<void> {
  for (const service of services.reverse()) {
    await service.destroy()
  }
}

export {
  githubService,
  todoService,
  calendarService,
  aiService,
  obsidianService,
}
```

---

## 阶段 4：数据访问层

### 4.1 目录结构

```
electron/main/data/
├── index.ts                 # 数据层入口
├── obsidian.dao.ts          # Obsidian Vault 数据访问
├── cache.manager.ts         # 缓存管理器
├── store.ts                 # 本地持久化存储
└── types.ts                 # 数据类型定义
```

### 4.2 Obsidian DAO

```typescript
// electron/main/data/obsidian.dao.ts

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { configManager } from '../config'
import { parseMarkdownTable, generateMarkdownTable } from '../utils/markdown-parser'
import type { GitHubRepo, TodoItem, CalendarEvent } from '@shared/types'

class ObsidianDAO {
  private vaultPath: string | null = null
  
  /** 初始化 Vault 路径 */
  initialize(): void {
    const config = configManager.getObsidianConfig()
    this.vaultPath = config?.vault_path || null
  }
  
  /** 检查 Vault 是否可用 */
  isAvailable(): boolean {
    return this.vaultPath !== null && existsSync(this.vaultPath)
  }
  
  /** 获取 Vault 路径 */
  getVaultPath(): string {
    if (!this.vaultPath) {
      throw new Error('Obsidian vault not configured')
    }
    return this.vaultPath
  }
  
  // ==================== GitHub Repos ====================
  
  async readGitHubRepos(hostname: string): Promise<GitHubRepo[]> {
    const filePath = join(this.getVaultPath(), 'github-repos.md')
    if (!existsSync(filePath)) return []
    
    const content = readFileSync(filePath, 'utf-8')
    return parseMarkdownTable(content, hostname)
  }
  
  async writeGitHubRepos(hostname: string, repos: GitHubRepo[]): Promise<void> {
    const filePath = join(this.getVaultPath(), 'github-repos.md')
    let content = ''
    
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      content = '# GitHub Local Repositories\n\n'
    }
    
    const updated = generateMarkdownTable(content, hostname, repos)
    writeFileSync(filePath, updated, 'utf-8')
  }
  
  // ==================== Todo Items ====================
  
  async readTodoItems(): Promise<TodoItem[]> {
    const filePath = join(this.getVaultPath(), 'todo.md')
    if (!existsSync(filePath)) return []
    
    const content = readFileSync(filePath, 'utf-8')
    return this.parseTodoMarkdown(content)
  }
  
  async writeTodoItems(items: TodoItem[]): Promise<void> {
    const filePath = join(this.getVaultPath(), 'todo.md')
    const content = this.generateTodoMarkdown(items)
    writeFileSync(filePath, content, 'utf-8')
  }
  
  // ==================== Calendar Events ====================
  
  async readCalendarEvents(year: number, month: number): Promise<CalendarEvent[]> {
    const fileName = `calendar-${year}-${String(month).padStart(2, '0')}.md`
    const filePath = join(this.getVaultPath(), 'calendar', fileName)
    if (!existsSync(filePath)) return []
    
    const content = readFileSync(filePath, 'utf-8')
    return this.parseCalendarMarkdown(content)
  }
  
  // ... 私有解析方法
  private parseTodoMarkdown(content: string): TodoItem[] { /* ... */ }
  private generateTodoMarkdown(items: TodoItem[]): string { /* ... */ }
  private parseCalendarMarkdown(content: string): CalendarEvent[] { /* ... */ }
}

export const obsidianDAO = new ObsidianDAO()
```

### 4.3 缓存管理器

```typescript
// electron/main/data/cache.manager.ts

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class CacheManager {
  private cache = new Map<string, CacheEntry<unknown>>()
  private defaultTTL = 5 * 60 * 1000 // 5分钟
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    if (!entry) return null
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }
  
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    })
  }
  
  invalidate(pattern: string | RegExp): void {
    for (const key of this.cache.keys()) {
      if (typeof pattern === 'string' ? key.startsWith(pattern) : pattern.test(key)) {
        this.cache.delete(key)
      }
    }
  }
  
  clear(): void {
    this.cache.clear()
  }
}

export const cacheManager = new CacheManager()
```

---

## 阶段 5：渲染进程重构

### 5.1 Widget 职责瘦身原则

**Before（现状）**：
```typescript
// GitHubWidget.tsx - 49KB
function GitHubWidget() {
  // 状态管理
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(false)
  
  // 业务逻辑（应该在主进程）
  const loadRepos = async () => {
    const content = await window.electronAPI.file.read(...)
    const parsed = parseMarkdownTable(content) // 解析逻辑在前端
    setRepos(parsed)
  }
  
  const syncStatus = async () => {
    for (const repo of repos) {
      const result = await window.electronAPI.git.getInfo(repo.path)
      // 处理逻辑...
    }
  }
  
  // UI 渲染
  return <div>...</div>
}
```

**After（目标）**：
```typescript
// GitHubWidget.tsx - <500行
function GitHubWidget() {
  const { repos, loading, error, refresh, syncStatus } = useGitHubRepos()
  
  // 只负责 UI 渲染
  return (
    <WidgetLayout title="GitHub" loading={loading} error={error}>
      <RepoList repos={repos} onSync={syncStatus} />
    </WidgetLayout>
  )
}

// hooks/useGitHubRepos.ts
function useGitHubRepos() {
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      // 调用主进程服务，业务逻辑已在主进程完成
      const data = await ipc.invoke('github:getLocalRepos', hostname)
      setRepos(data)
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }, [hostname])
  
  // 订阅主进程事件
  useEffect(() => {
    return ipc.on('github:repos:updated', setRepos)
  }, [])
  
  return { repos, loading, error, refresh }
}
```

### 5.2 Hooks 层设计

```
src/hooks/
├── api/                     # IPC API Hooks
│   ├── useGitHubRepos.ts
│   ├── useTodoItems.ts
│   ├── useCalendarEvents.ts
│   ├── useAIChat.ts
│   └── useFileTransfer.ts
├── widget/                  # Widget 通用 Hooks
│   ├── useWidget.ts
│   ├── useWidgetStorage.ts
│   └── useWidgetObsidian.ts
└── system/                  # 系统 Hooks
    ├── useConfig.ts
    ├── useNotification.ts
    └── useResourceMonitor.ts
```

---

## 实施计划

| 阶段 | 内容 | 工作量 | 状态 |
|------|------|--------|------|
| 1 | IPC 层拆分 | 1天 | ✅ 已完成 |
| 2 | 类型安全的 IPC | 2天 | 🔲 待开始 |
| 3 | 服务层设计 | 3天 | 🔲 待开始 |
| 4 | 数据访问层 | 2天 | 🔲 待开始 |
| 5 | 渲染进程重构 | 5天 | 🔲 待开始 |

**总计**：约 13 个工作日

---

## 迁移策略

### 渐进式迁移

1. **新功能**：所有新功能按新架构实现
2. **修复 Bug**：修复时顺带重构涉及的代码
3. **优先级**：先重构使用频率高的 Widget

### 向后兼容

- 保留现有 IPC 通道，逐步迁移
- 服务层提供与旧 API 兼容的适配器
- 渲染进程 Hooks 封装差异

---

## 风险与对策

| 风险 | 对策 |
|------|------|
| 重构周期长 | 分阶段实施，每阶段可独立交付 |
| 破坏现有功能 | 充分测试，保持向后兼容 |
| 团队适应成本 | 编写清晰文档，代码评审 |
| 性能影响 | IPC 调用批量化，合理使用缓存 |
