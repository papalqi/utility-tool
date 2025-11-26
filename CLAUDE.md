# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 本文档为 Claude Code 提供项目指南。基于 `.claude/memory.md` 和 `.claude/debugging-principles.md`。

## 项目概述

**PC Utility Tool** - 从 Python/PyQt6 迁移到 Electron + React + TypeScript 的生产力工具集。

**核心特性**:
- 10 个已接入的 Widget（AI CLI、TODO、番茄钟、Projects、脚本等，部分仍在进行占位开发）
- 深度 Obsidian 集成（双向同步）
- TOML 配置管理（与 Python 版本兼容）
- 跨平台支持（macOS/Windows/Linux）

**当前状态**: 🟡 核心架构完成，Widget 正在迁移到统一 Hook 架构（useWidget/useWidgetObsidian）

---

> 🔴 **关键设计原则**：本应用的绝大部分用户数据应该存储在 **Obsidian Vault** 中（Markdown 格式），而不是应用内数据库或 localStorage。这确保了数据所有权、跨设备同步、可读性和长期可用性。详见 [数据存储策略](#%EF%B8%8F-数据存储策略重要) 章节。

---

## 常用命令

```bash
# 开发模式（热重载）
npm run electron:dev

# 仅 Vite 开发服务器
npm run dev

# 类型检查
npm run type-check

# 代码检查
npm run lint

# 代码格式化
npm run format

# 生产构建
npm run electron:build

# 构建但不打包（测试用）
npm run build:dir
```

### 开发日志采集

调试渲染端问题并需要完整的 `npm run dev` 输出时，请使用仓库提供的脚本启动 Vite，它会同时在终端打印并写入 `logs/npm-dev-*.log`：

- macOS/Linux：`./scripts/dev/dev-loop-with-logs.sh`
- Windows（PowerShell）：`pwsh -ExecutionPolicy Bypass -File .\scripts\dev\dev-loop-with-logs.ps1`
- Windows（CMD）：`scripts\dev\dev-loop-with-logs.cmd`

如需分享日志给其他同事，请直接附上对应的 `logs/` 文件即可。

## 核心架构

### 1. Electron 进程模型

**主进程** (`electron/main/index.ts`):
- 窗口管理、IPC 处理器
- 管理单例：`configManager`、`ptyManager`
- 使用 `node-pty` 进行终端模拟（需要原生模块重建）

**预加载脚本** (`electron/preload/index.ts`):
- 通过 `contextBridge` 暴露安全的 `window.electronAPI`
- 所有文件操作、系统调用都通过此 API
- 类型定义确保渲染进程的类型安全

**渲染进程** (`src/`):
- React 应用，基于 Widget 架构
- **不能直接访问 Node.js API**，必须通过 `window.electronAPI`

### 2. 配置系统（双层架构）

**主进程** (`electron/main/config.ts`):
- 处理 TOML 文件 I/O（使用 `@iarna/toml`）
- 文件监控（`chokidar`）自动重载
- 按主机名分段配置（`config.computer[hostname]`）
- λ�ã����Ŀ����� `config/config.toml` ΪĬ��ģ�壬ʵʱ����д�� `Saved/config.toml` ��Ŀ¼���������У��������й��̻� Saved �е����ý����۱�������ͬһ�����ã�������ϵͳ���ϻ��� `userData/Saved/config.toml`��

**渲染进程** (`src/core/ConfigManager.ts`):
- 通过 IPC 与主进程通信
- 提供订阅机制（配置变更通知）
- **不要直接使用此文件**，使用 Hooks

**推荐用法**:
```typescript
// ✅ Widget 专用（推荐）
const { config, updateConfig } = useWidgetConfig<T>({
  section: 'pomodoro',
  defaultConfig: { ... }
})

// ✅ 只读全局配置
const config = useConfig()

// ✅ 只读某个段落
const pomodoro = useConfigSection('pomodoro')
```

### 3. Obsidian 集成 (`src/core/ObsidianManager.ts`)

> ⚠️ **关键设计决策**：Obsidian 是本应用的**核心数据存储层**，而不是可选的同步功能。绝大部分用户数据（TODO、日历、番茄钟、工作日志等）都应该存储在 Obsidian Vault 中。

**核心功能**:
- 双向同步 TODO/Calendar/Pomodoro（**这是用户数据的主要存储位置**）
- Secrets 管理（API Keys 存储在 Vault）
- 项目元数据管理（支持按计算机存储项目列表）
- 模板路径解析：`{year}`、`{month}`、`{week}`、`{day}`、`{date}`
- Markdown 解析（支持 front-matter）

**TODO 格式示例**:
```markdown
# TODO List
### 📁 分类名称
#### 🔴 高优先级
- [ ] 🔴 🏷️健康 任务内容 ⏰2025-01-08 10:00 📝笔记 ✅结论 📎![name](path)
```

**Obsidian 配置位置**: `config.computer[hostname].obsidian`
- `enabled`: 是否启用
- `vault_path`: Vault 路径
- `secrets_file`: Secrets 文件名（通常是 `secrets.md`）

**推荐用法**:
```typescript
// ✅ Widget 专用（自动同步）
const { sync, read } = useWidgetObsidian<TodoItem>({
  widgetId: 'todo',
  dataType: 'todo',
  template: '{year}-W{week}.md',
  autoSync: true,
  syncInterval: 60000
})

// ✅ 手动同步
const { syncTodoItems, readTodoItems } = useObsidian()
```

### 4. Widget 架构

**统一接口**:
```typescript
interface Widget {
  id: string
  name: string
  icon: ReactNode
  component: ComponentType
}
```

**Widget 开发模板** - 参考 `src/widgets/ExampleWidget.tsx`:
```typescript
import { useWidget } from '@/hooks/useWidget'
import { useWidgetStorage } from '@/hooks/useWidgetStorage'
import { WidgetLayout, WidgetSection } from '@/components/widgets'

const MyWidget: React.FC = () => {
  // 1. 生命周期管理
  const { state, widgetLogger } = useWidget({
    metadata: { id: 'my-widget', displayName: 'My Widget', ... },
    lifecycle: {
      onInit: async () => { /* 初始化 */ },
      onCleanup: () => { /* 清理 */ }
    }
  })

  // 2. 本地存储
  const { value, setValue } = useWidgetStorage({
    key: 'my-widget-data',
    defaultValue: { ... }
  })

  return (
    <WidgetLayout title="My Widget" loading={state.loading}>
      <WidgetSection title="内容">
        {/* Widget 内容 */}
      </WidgetSection>
    </WidgetLayout>
  )
}
```

**核心 Hooks**:
- `useWidget` - 生命周期、日志、错误处理
- `useWidgetConfig<T>` - 配置管理（类型安全）
- `useWidgetStorage<T>` - 本地存储（localStorage + 跨窗口同步）
- `useWidgetActions` - 统一操作接口（刷新、保存、导出、重置）
- `useWidgetObsidian<T>` - Obsidian 自动同步

> ⚠️ **迁移要求**：所有新增或重构的 Widget 必须使用上述 Hook 组合。现有 `src/pages/TodoWidget.tsx`、`src/pages/PomodoroWidget.tsx` 等旧结构正在逐步迁移，提交新代码时不要再直接操作 `obsidianManager`/`configManager`，而是通过 Hook 封装。

**已提供的通用组件**:
- `WidgetLayout` - 统一布局
- `WidgetSection` - 分组区域
- `WidgetHeader` - 标题
- `WidgetEmpty` - 空状态

**工具函数**: `src/utils/widget-helpers.ts` (40+ 个工具函数)

### 5. 终端实现

**PTY Manager** (`electron/main/pty-manager.ts`):
- 管理 PTY 会话（每个终端一个唯一 ID）
- 跨平台支持（Unix: bash, Windows: cmd.exe）
- 会话生命周期管理（create/write/resize/close）

**Terminal Widget** (`src/widgets/TerminalWidget.tsx`):
- （当前为占位 UI）需迁移到 `src/components/Terminal.tsx` 提供的 xterm + IPC 封装
- 真实的 `@xterm/xterm` + `@xterm/addon-fit` 使用示例位于 `src/pages/ProjectWidget.tsx` 的多标签终端
- 集成时必须在组件卸载时清理会话，并复用 `window.electronAPI.pty*` API

**平台差异**:
- Windows: 使用 `cmd.exe`，需要手动写入命令和 `exit`
- Unix: 使用 `bash`，直接执行命令

### 6. 主题管理

**位置**: `src/contexts/ThemeContext.tsx`（React Context + Ant Design）

**特性**:
- 亮/暗主题切换
- 自动时间切换（可配置）
- CSS Variables 注入
- 与 Ant Design ConfigProvider 集成

### 7. 日志系统

**主进程**: `electron/main/logger.ts` (使用 `electron-log`)
**渲染进程**: `src/core/Logger.ts`

**特性**:
- Scoped Logger（按模块分离日志）
- 日志历史记录
- 订阅模式（实时监听日志）
- 自动轮转

**用法**:
```typescript
const widgetLogger = logger.createScope('MyWidget')
widgetLogger.info('Something happened', { context: 'data' })
```

## ⚠️ 数据存储策略（重要）

### 核心原则：Obsidian 优先

**绝大部分用户个人数据应该存储在 Obsidian Vault 中**，而不是本地数据库或 localStorage。

### 数据存储分类

#### 1. 必须存储在 Obsidian 的数据 ✅

**用户内容数据**（这些是用户的核心资产）：
- ✅ **TODO 任务** - 完整的任务列表、笔记、附件
- ✅ **Calendar 事件** - 日程安排、会议记录
- ✅ **Pomodoro 会话** - 工作记录、时间统计
- ✅ **Secrets/API Keys** - 敏感信息（OpenAI、DeepSeek 等 API Key）
- ✅ **项目元数据** - 项目列表、P4 配置、构建设置
- ✅ **工作日志** - Markdown 格式的工作记录

**为什么？**
1. **数据所有权** - 用户完全控制自己的数据
2. **跨设备同步** - Obsidian 提供云同步（iCloud、Sync 等）
3. **可读性** - Markdown 格式，人类可读，永不过时
4. **备份简单** - Vault 就是文件夹，易于备份
5. **工具无关** - 即使不用本工具，数据仍可访问

#### 2. 可以存储在本地的数据 ⚙️

**应用配置数据**（非用户内容）：
- ⚙️ **Ӧ������** - Ĭ�ϲ����� `config/config.toml` ����ֵ����ʵ�ʱ༭�� `Saved/config.toml` ����(�����⡢���ڴ�С���)
- ⚙️ **Widget 状态** - UI 状态、展开/折叠状态（localStorage）
- ⚙️ **临时缓存** - 图标缓存、最近使用记录
- ⚙️ **日志文件** - 应用运行日志（electron-log）

**为什么？**
1. **性能考虑** - UI 状态需要快速读写
2. **临时性质** - 丢失不影响用户核心数据
3. **机器特定** - 每台设备的设置可能不同

#### 3. 不应该存储的数据 ❌

- ❌ 不要在应用内部创建 SQLite/LevelDB 等数据库存储用户内容
- ❌ 不要在 localStorage 存储 TODO/Calendar 等核心数据
- ❌ 不要在 electron-store 存储用户工作内容
- ❌ 不要创建私有的数据格式（如二进制文件）

### 实现指南

#### Widget 开发时的数据存储决策

```typescript
// ✅ 正确：用户内容数据存储在 Obsidian
const TodoWidget = () => {
  const { items, sync } = useWidgetObsidian<TodoItem>({
    widgetId: 'todo',
    dataType: 'todo',
    template: '{year}-W{week}.md',
    autoSync: true,  // 自动同步到 Obsidian
  })

  // 数据存储在 Obsidian Vault 的 Markdown 文件中
}

// ✅ 正确：UI 状态存储在 localStorage
const TodoWidget = () => {
  const { value: uiState, setValue } = useWidgetStorage({
    key: 'todo-ui-state',
    defaultValue: { expandedCategories: [], sortBy: 'priority' }
  })

  // 仅存储 UI 相关的临时状态
}

// ❌ 错误：不要把用户内容存储在 localStorage
const TodoWidget = () => {
  const { value: todos, setValue } = useWidgetStorage({
    key: 'todo-items',  // ❌ 错误！
    defaultValue: []
  })
  // 这样数据无法跨设备同步，用户会丢失数据
}
```

#### 数据流向

```
用户操作
    ↓
Widget 组件（React State）
    ↓
useWidgetObsidian
    ↓
ObsidianManager
    ↓
Markdown 文件（Vault）
    ↓
Obsidian Sync/iCloud（跨设备）
```

#### Obsidian 不可用时的降级策略

```typescript
const TodoWidget = () => {
  const { items, sync, isEnabled } = useWidgetObsidian<TodoItem>({
    widgetId: 'todo',
    dataType: 'todo',
    template: '{year}-W{week}.md',
    autoSync: true,
  })

  if (!isEnabled) {
    // ✅ 正确：提示用户启用 Obsidian
    return (
      <Alert
        type="warning"
        message="请在设置中配置 Obsidian Vault 路径以使用 TODO 功能"
      />
    )
  }

  // ❌ 错误：不要自动降级到 localStorage
  // 这会导致数据分散在两个地方，用户困惑
}
```

### 关键原则总结

1. **用户内容 = Obsidian**
   - TODO、日历、番茄钟、工作日志 → Markdown 文件
   - API Keys、项目配置 → secrets.md

2. **应用设置 = TOML 配置**
   - ��⡢���ڴ�С���ӷ��̵ȵȣ�→ Saved/config.toml (�ȼ��� `config/config.toml`)

3. **UI 状态 = localStorage**
   - 展开/折叠、排序方式、视图模式 → localStorage

4. **临时数据 = 内存/缓存**
   - 图标、最近使用 → 临时缓存，可清理

5. **永远不要创建私有数据格式**
   - 用户的数据应该是 Markdown，可以用任何文本编辑器打开
   - 即使应用被删除，用户的数据仍然完整可用

### 检查清单

开发新 Widget 时，问自己：

- [ ] 这个数据是用户创建的内容吗？→ 存储在 Obsidian
- [ ] 这个数据需要跨设备同步吗？→ 存储在 Obsidian
- [ ] 丢失这个数据会让用户不开心吗？→ 存储在 Obsidian
- [ ] 这个数据只是 UI 显示状态吗？→ localStorage
- [ ] ��������ǻ����ض���������ȡ？→ Saved/config.toml
- [ ] 这个数据可以重新生成或下载吗？→ 临时缓存

## 路径别名

```typescript
'@/*' → 'src/*'
'@main/*' → 'electron/main/*'
'@renderer/*' → 'src/*'
'@shared/*' → 'src/shared/*'
```

## 重要实现细节

### UI 稳定性：避免布局抖动

> ⚠️ **重要教训**：React 状态变化会触发重新渲染，必须确保渲染时布局稳定，避免视觉抖动。

**问题案例**（2025-11-23 修复）：
- **问题**：TodoWidget 标签页打开时，右上角的"保存"按钮会从左往右闪过去（抖动）
- **根本原因**：
  1. 状态消息文字宽度变化（`""` → `"正在从 Obsidian 读取 TODO..."` → `"已加载 18 个任务"`）把右侧按钮往右挤
  2. 按钮从无到有的渲染（`showSave={Boolean(save)}` 导致按钮初始化前不渲染）
  3. framer-motion 的初始动画（`initial={{ opacity: 0, y: 10 }}`）在组件挂载时执行

**正确的解决方案**：

```typescript
// 1. 固定状态消息宽度，始终占据空间
extra={
  <Text 
    type="secondary" 
    style={{ 
      minWidth: '200px',        // 固定最小宽度
      display: 'inline-block'   // 让 minWidth 生效
    }}
  >
    {state.statusMessage || '\u00A0'}  // 空消息时显示不可见空格
  </Text>
}

// 2. 按钮始终渲染，只在不可用时禁用
showRefresh={true}          // 始终显示
showSave={true}             // 始终显示
onRefresh={refresh}         // 直接传递函数
onSave={save}               // 直接传递函数

// WidgetLayout 中：
if (showSave) {
  actions.push(
    <Button disabled={!onSave}>  // 禁用而非隐藏
      保存
    </Button>
  )
}

// 3. 禁用初始动画
<motion.div initial={false}>  // 不执行入场动画
<Tabs animated={false} />     // 禁用标签页切换动画

// 4. 禁用 CSS 过渡
<Card style={{ transition: 'none' }} />
```

**关键原则**：
1. ✅ **状态变化无法避免，但要保证重新渲染时布局稳定**
2. ✅ **始终占据空间** - 使用固定宽度、始终渲染（禁用而非隐藏）
3. ✅ **禁用初始动画** - `initial={false}` 和 `animated={false}`
4. ✅ **禁用过渡效果** - `transition: 'none'`
5. ✅ **空内容占位** - 使用不可见空格 `\u00A0` 保持元素存在

**调试技巧**：
- 问自己：哪个状态变化导致了布局变化？
- 使用浏览器 DevTools 的 Performance 录制查看重新渲染时机
- 检查 CSS 过渡和动画是否意外触发
- 确保动态内容（文字、按钮）始终占据固定空间

**参考文件**：
- `src/pages/TodoWidget.tsx` - 状态消息固定宽度
- `src/components/widgets/WidgetLayout.tsx` - 按钮始终渲染逻辑
- `src/pages/todo/components/TodoListPanel.tsx` - 禁用初始动画
- `src/styles/index.css` - 全局禁用 Card 头部动画

### 配置修改
1. 同时更新类型定义：`electron/main/config.ts` (AppConfig) 和 `src/shared/types.ts`
2. 更新两处默认配置（主进程和渲染进程 ConfigManager）
3. 使用 `configManager.updateSection()` 而非直接文件写入

### Obsidian 集成

> ⚠️ **数据存储原则**：用户的核心数据（TODO、日历、番茄钟等）**必须存储在 Obsidian**，不要存储在 localStorage 或应用内数据库。

- 模板路径从 `global.obsidian.content_files.template` 读取（如 `{year}-W{week}.md`）
- TODO 自动保存遵循 `global.obsidian.todo.auto_save` 和 `save_interval`
- **始终优雅处理错误**（Vault 可能不存在，要提示用户配置）
- Secrets 文件格式：简单键值对 + Projects 章节（Markdown 表格）
- 如果 Obsidian 未启用，Widget 应显示配置提示，**而不是降级到本地存储**

### 项目管理
- 项目存储在 Obsidian vault (`secrets.md`) 的 `# Projects / ## {hostname}` 下
- 支持 P4（Perforce）配置：server、user、charset、workspace
- 字段映射：中文列名 → 英文属性（参见 `PROJECT_FIELD_MAPPING`）

### SSH 私钥处理

> 🔐 **重要教训**：处理 SSH 私钥时要特别注意文件格式要求。

**问题案例**（2025-11-09 修复）：
- **问题**：SSH 私钥从 Obsidian 存储后无法连接，报错 `invalid format`
- **根本原因**：
  1. 使用 `writeFileBase64()` 二进制写入破坏了 PEM 文本格式
  2. OpenSSH 私钥文件**必须以换行符 `\n` 结尾**（这是隐藏的严格要求）

**正确的处理流程**：
```typescript
// 1. 存储时：规范化并编码
const normalized = normalizeOpenSSHPem(rawKey)  // 必须添加末尾 \n
const base64 = btoa(normalized)  // 编码存储到 Obsidian

// 2. 使用时：解码并文本写入
const pemContent = atob(base64)  // 解码为原始文本
await window.electronAPI.writeFile(keyPath, pemContent)  // ✅ 文本模式
await window.electronAPI.execCommand(`chmod 600 "${keyPath}"`)  // 设置权限
```

**关键要点**：
- ✅ SSH 私钥是**纯文本文件**（UTF-8），不是二进制
- ✅ 必须以换行符 `\n` 结尾（OpenSSH 严格要求）
- ✅ Base64 行每行最多 70 字符
- ✅ 文件权限必须是 600（Unix）
- ❌ 不要使用 `writeFileBase64()`（会再次解码导致格式错误）
- ❌ 不要忘记末尾换行符（`ssh-keygen` 会报 `not a key file`）

**验证方法**：
```bash
# 验证密钥格式
ssh-keygen -l -f /path/to/key

# 检查文件末尾
xxd -l 100 /path/to/key  # 应该看到 0x0a (换行符)
```

**调试经验**：
1. 理解数据的**真实格式**（文本 vs 二进制），不要盲目转换编码
2. 注意**隐藏字符**（如换行符）可能是关键要求
3. 用工具**验证每一步**（如 `ssh-keygen -l`）
4. 查阅**官方文档**了解格式规范（OpenSSH 私钥格式）

**参考**：
- 位置：`src/widgets/TerminalWidget.tsx`
- 函数：`normalizeOpenSSHPem()` (607-648行), `createEphemeralKeyFileFromBase64()` (650-673行)

### IPC 通信
- 所有文件操作必须通过 IPC（渲染进程不能直接访问 fs）
- 使用预加载脚本中定义的类型化处理器
- 主进程验证所有文件路径（安全性）
- 批量操作以减少 IPC 开销

### 生产构建
- `npm run electron:build` 打包当前平台
- 原生模块（node-pty）需要重建：devDependencies 中的 `@electron/rebuild`
- 输出目录：`release/`
- 构建配置：`package.json` 的 `build` 字段

## 调试原则（来自 `.claude/debugging-principles.md`）

### 集成第三方服务的黄金法则

1. **文档优先 (Documentation First)**
   - 永远先查阅官方文档，不要凭经验或猜测
   - RTFM (Read The F***ing Manual)

2. **理解架构本质 (Understand Architecture)**
   - 思考工具的设计理念和工作原理
   - 例：桌面应用的 HTTP 接口通常处理本地资源（文件路径），而非传输大量数据（base64）

### 正确的调试流程

1. ✅ **读取完整错误信息**（不只看类型，要看堆栈和提示）
2. ✅ **查看详细日志**（错误提示指向日志文件时，立即查看）
3. ✅ **定位根本原因**（不要急于修改代码）
4. ✅ **最小化修改**（针对根本原因精准修复）
5. ✅ **测试验证**（确认有效后再优化）

### ❌ 错误的做法

- ❌ 不看日志就猜测问题
- ❌ 盲目添加 fallback 逻辑
- ❌ 在不确定原因的情况下一次性修改多处
- ❌ 只处理表象，不找根本原因

### 错误处理原则

- ✅ **好的容错**：处理预期内的异常（网络超时、文件不存在）
- ❌ **掩盖问题**：在不理解错误原因时添加多层 try-catch
- **原则**：只为理解清楚的场景添加容错逻辑

## 关键文件位置

### 主进程
- `electron/main/index.ts` - 入口，IPC 处理器
- `electron/main/config.ts` - 配置管理（TOML 文件 I/O）
- `electron/main/pty-manager.ts` - PTY 会话管理
- `electron/main/logger.ts` - 日志系统
- `electron/preload/index.ts` - IPC 桥接（contextBridge）

### 渲染进程
- `src/App.tsx` - 应用入口
- `src/core/Logger.ts` - 日志器（渲染进程）
- `src/core/ObsidianManager.ts` - Obsidian 集成（~1,300 行，包含 Secrets/TODO/Projects 等逻辑）
- `src/contexts/ThemeContext.tsx` - 主题管理（React Context）

### Hooks
- `src/hooks/useWidget.ts` - 核心生命周期
- `src/hooks/useWidgetConfig.ts` - 配置管理
- `src/hooks/useWidgetStorage.ts` - 本地存储
- `src/hooks/useWidgetActions.ts` - 操作管理
- `src/hooks/useWidgetObsidian.ts` - Obsidian 同步
- `src/hooks/useConfig.ts` - 全局配置
- `src/hooks/useObsidian.ts` - 基础 Obsidian

### 组件
- `src/components/widgets/` - Widget 通用组件
- `src/widgets/ExampleWidget.tsx` - **示例 Widget（推荐参考）**

### 类型
- `src/shared/types.ts` - 全局类型定义
- `src/shared/widget-types.ts` - Widget 类型

## 测试注意事项

- 测试配置热重载：运行时编辑 TOML 文件
- 测试 Obsidian 同步：包括存在和不存在的 Vault 路径
- 测试终端：Unix 和 Windows 的 PTY 行为不同
- 验证 IPC 通信不暴露安全漏洞
- 测试 Widget 激活/停用和状态持久化

## 下一步行动

推荐开发顺序（来自 `.claude/memory.md`）:

1. **TODO Widget** - 最简单，验证架构
2. **Pomodoro Widget** - 验证 Obsidian 同步
3. **Calendar Widget** - 验证复杂数据
4. 其他 8 个 Widget

开发流程:
1. 复制 `ExampleWidget.tsx` 作为模板
2. 修改 metadata
3. **确定数据存储策略**（用户数据 → Obsidian，UI 状态 → localStorage）
4. 实现 lifecycle 钩子
5. 使用 `useWidgetObsidian` 集成 Obsidian（**核心数据必须**）
6. 添加到 `WidgetContainer` 和 `Sidebar`
7. 测试（包括 Obsidian 未配置时的提示）

## 相关文档

- `.claude/memory.md` - 项目状态和进度
- `.claude/debugging-principles.md` - 调试哲学
- `ARCHITECTURE.md` - 详细架构设计
- `MIGRATION_PLAN.md` - 从 Python 迁移计划
- `GETTING_STARTED.md` - 快速开始指南
- `README.md` - 项目概述

---

**项目成就** (来自 `.claude/memory.md`):
- ✅ 代码减少 84%（1400+ → 200+ 行）
- ✅ 完整类型安全
- ✅ 生产级 Obsidian 集成
- ✅ 统一 Widget 架构（ExampleWidget + Hooks 完成验证）
- 🚧 核心 Widget 正在迁移到统一架构，部分仍为占位页
