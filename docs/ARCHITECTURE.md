# PC Utility Tool - Electron 架构设计

## 🏗️ 整体架构

```
┌─────────────────────────────────────────────┐
│           Electron Main Process             │
│  ┌──────────────────────────────────────┐   │
│  │  Config / File / IPC / System APIs   │   │
│  └──────────────────────────────────────┘   │
└──────────────────┬──────────────────────────┘
                   │ IPC Communication
┌──────────────────┴──────────────────────────┐
│         Electron Renderer Process           │
│  ┌──────────────────────────────────────┐   │
│  │          React Application           │   │
│  │                                      │   │
│  │  ┌────────────────────────────────┐ │   │
│  │  │   Core Managers                │ │   │
│  │  │  - ConfigManager               │ │   │
│  │  │  - ThemeManager                │ │   │
│  │  │  - LogManager                  │ │   │
│  │  │  - ObsidianManager             │ │   │
│  │  └────────────────────────────────┘ │   │
│  │                                      │   │
│  │  ┌────────────────────────────────┐ │   │
│  │  │   State Management (Zustand)   │ │   │
│  │  └────────────────────────────────┘ │   │
│  │                                      │   │
│  │  ┌────────────────────────────────┐ │   │
│  │  │   UI Components                │ │   │
│  │  │  - Layout (Sidebar, TitleBar)  │ │   │
│  │  │  - Widgets (11 modules)        │ │   │
│  │  └────────────────────────────────┘ │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## 📁 目录结构

```
pc-utility-tool-electron/
├── electron/                  # Electron 主进程
│   ├── main/                 # 主进程代码
│   │   └── index.ts         # 主进程入口
│   └── preload/              # 预加载脚本
│       └── index.ts         # IPC API 暴露
├── src/                      # React 应用
│   ├── components/           # 通用组件
│   │   ├── TitleBar.tsx     # 标题栏
│   │   ├── Sidebar.tsx      # 侧边栏
│   │   └── WidgetContainer.tsx  # Widget 容器
│   ├── widgets/              # Widget 模块
│   │   ├── AICliWidget.tsx
│   │   ├── TodoWidget.tsx
│   │   ├── PomodoroWidget.tsx
│   │   ├── CalendarWidget.tsx
│   │   ├── ScriptsWidget.tsx
│   │   ├── QuickAccessWidget.tsx
│   │   ├── TerminalWidget.tsx
│   │   ├── RenderDocWidget.tsx
│   │   ├── ADBWidget.tsx
│   │   ├── ProjectsWidget.tsx
│   │   └── AttachmentsWidget.tsx
│   ├── core/                 # 核心管理器
│   │   ├── ConfigManager.ts  # 配置管理
│   │   ├── ThemeManager.ts   # 主题管理
│   │   ├── LogManager.ts     # 日志管理
│   │   └── ObsidianManager.ts # Obsidian 集成
│   ├── shared/               # 共享代码
│   │   └── types.ts         # TypeScript 类型定义
│   ├── hooks/                # 自定义 Hooks
│   │   ├── useConfig.ts
│   │   ├── useTheme.ts
│   │   └── useObsidian.ts
│   ├── styles/               # 样式文件
│   │   └── index.css
│   ├── assets/               # 静态资源
│   ├── App.tsx              # 应用根组件
│   └── main.tsx             # 应用入口
├── config/                   # 配置文件
│   └── config.toml          # 应用配置
├── docs/                     # 文档
│   ├── ARCHITECTURE.md      # 架构文档
│   └── MIGRATION_PLAN.md    # 迁移计划
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🔧 核心模块设计

### 1. ConfigManager (配置管理器)

**职责**:
- 加载和保存 TOML 配置文件
- 提供配置订阅机制
- 按主机名分段配置支持

**API**:
```typescript
class ConfigManager {
  initialize(configPath?: string): Promise<void>
  loadConfig(): Promise<AppConfig>
  saveConfig(config: AppConfig): Promise<void>
  getConfig(): AppConfig
  getSection<K>(section: K): AppConfig[K]
  updateSection<K>(section: K, value: AppConfig[K]): Promise<void>
  subscribe(listener: (config: AppConfig) => void): () => void
}
```

**数据流**:
```
TOML File → IPC → ConfigManager → React Components
                         ↓
                    Subscribers
```

### 2. ThemeManager (主题管理器)

**职责**:
- 管理亮/暗主题切换
- 支持自动时间切换
- 与 Ant Design 主题集成

**API**:
```typescript
class ThemeManager {
  initialize(config: ThemeConfig): void
  getTheme(): ThemeMode
  setTheme(theme: ThemeMode): void
  toggleTheme(): void
  getAntdTheme(): ThemeConfig
  subscribe(listener: (theme: ThemeMode) => void): () => void
  enableAutoSwitch(darkStart?: string, lightStart?: string): void
  disableAutoSwitch(): void
}
```

**特性**:
- CSS 变量注入
- Ant Design 主题动态切换
- 定时自动切换（可配置时间）

### 3. LogManager (日志管理器)

**职责**:
- 结构化日志记录
- 多级别日志 (DEBUG, INFO, WARN, ERROR, CRITICAL)
- 日志持久化和导出

**API**:
```typescript
class LogManager {
  setLogLevel(level: LogLevel): void
  debug(message: string, context?: Record<string, unknown>): void
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, error?: Error, context?: Record<string, unknown>): void
  critical(message: string, error?: Error, context?: Record<string, unknown>): void
  getLogs(level?: LogLevel): LogEntry[]
  clearLogs(): void
  subscribe(listener: (entry: LogEntry) => void): () => void
  exportLogs(): string
}
```

### 4. ObsidianManager (Obsidian 集成)

**职责**:
- 与 Obsidian vault 双向同步
- 管理 secrets 文件
- 模板路径解析

**API**:
```typescript
class ObsidianManager {
  initialize(vaultPath: string, secretsFile: string): Promise<void>
  isEnabled(): boolean
  readSecrets(): Promise<Record<string, string>>
  writeSecrets(secrets: Record<string, string>): Promise<void>
  syncTodoItems(items: TodoItem[], template: string): Promise<void>
  readTodoItems(template: string): Promise<TodoItem[]>
  syncCalendarEvents(events: CalendarEvent[], template: string): Promise<void>
  syncPomodoroSessions(sessions: PomodoroSession[], template: string): Promise<void>
}
```

**同步策略**:
- 使用模板路径 (`{year}-W{week}.md`)
- 按章节组织内容 (## TODO, ## Calendar, ## Pomodoro)
- 支持自动和手动模式

## 🎨 UI 组件架构

### 组件层次

```
App
├── TitleBar
└── Layout
    ├── Sidebar
    └── WidgetContainer
        └── [Current Widget]
```

### Widget 接口

所有 Widget 遵循统一接口:

```typescript
interface Widget {
  id: string
  name: string
  icon: ReactNode
  component: ComponentType
}
```

### Widget 生命周期

1. **懒加载**: 使用 `React.lazy()` 延迟加载
2. **初始化**: Widget 挂载时从 ConfigManager 获取配置
3. **状态管理**: 使用 Zustand 或 React State
4. **清理**: 组件卸载时清理订阅和定时器

## 🔄 IPC 通信设计

### Preload Script

暴露安全的 API 给渲染进程:

```typescript
window.electronAPI = {
  // 应用信息
  getVersion: () => Promise<string>
  getPlatform: () => Promise<string>

  // 配置管理
  loadConfig: () => Promise<unknown>
  saveConfig: (config: unknown) => Promise<void>

  // 文件操作
  selectFile: (options: unknown) => Promise<string | undefined>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>

  // Obsidian 集成
  syncWithObsidian: (data: unknown) => Promise<void>

  // 脚本执行
  runScript: (scriptPath: string, args?: string[]) => Promise<unknown>

  // 终端
  executeCommand: (command: string) => Promise<unknown>

  // 事件监听
  on: (channel: string, callback: Function) => () => void
}
```

### 主进程处理器

```typescript
// electron/main/index.ts
ipcMain.handle('config:load', async () => {
  // 从文件加载 TOML 配置
})

ipcMain.handle('config:save', async (event, config) => {
  // 保存配置到文件
})

ipcMain.handle('file:read', async (event, path) => {
  // 读取文件
})

// ... 其他处理器
```

## 🗃️ 状态管理

### Zustand Store 设计

```typescript
// Widget 各自的 Store
interface TodoStore {
  items: TodoItem[]
  addItem: (item: TodoItem) => void
  updateItem: (id: string, updates: Partial<TodoItem>) => void
  deleteItem: (id: string) => void
  syncWithObsidian: () => Promise<void>
}

interface PomodoroStore {
  session: PomodoroSession | null
  startSession: (type: SessionType, taskId?: string) => void
  pauseSession: () => void
  endSession: () => void
  getSessions: () => PomodoroSession[]
}
```

### 数据持久化

1. **配置数据**: 通过 ConfigManager → TOML 文件
2. **Widget 数据**: Zustand + electron-store
3. **日志数据**: LogManager → 日志文件
4. **Obsidian 数据**: ObsidianManager → Markdown 文件

## 🔐 安全设计

1. **Context Isolation**: 启用上下文隔离
2. **Node Integration**: 禁用 Node 集成
3. **Preload Script**: 只暴露必要的 API
4. **IPC Validation**: 验证所有 IPC 消息
5. **Secrets 管理**: 敏感信息存储在 Obsidian vault 或系统密钥链

## 📊 性能优化

1. **代码分割**:
   - Widget 懒加载
   - 动态导入大型库

2. **渲染优化**:
   - React.memo 缓存组件
   - useCallback / useMemo
   - 虚拟列表 (长列表场景)

3. **资源优化**:
   - 图片压缩和缓存
   - Icon 按需加载
   - Bundle 大小优化

4. **内存管理**:
   - 及时清理订阅
   - 限制日志条数
   - 缓存淘汰策略

## 🧪 测试策略

1. **单元测试**: Jest + React Testing Library
2. **集成测试**: Widget 与 Core Managers 集成
3. **E2E 测试**: Spectron (Electron 测试框架)
4. **手动测试**: 跨平台兼容性测试

## 📦 构建和发布

### 开发模式
```bash
npm run electron:dev
```
- Vite 开发服务器 (热重载)
- Electron 主进程 (自动重启)

### 生产构建
```bash
npm run electron:build
```
- Vite 构建优化
- Electron Builder 打包
- 代码签名 (macOS/Windows)

### 平台支持
- **Windows**: NSIS 安装器 / 便携版
- **macOS**: DMG / ZIP
- **Linux**: AppImage / DEB

## 🔮 未来扩展

1. **插件系统**: 支持自定义 Widget
2. **云同步**: 除 Obsidian 外的云服务
3. **多语言**: i18n 国际化
4. **快捷键**: 全局快捷键支持
5. **通知系统**: 系统原生通知
6. **自动更新**: electron-updater 集成
