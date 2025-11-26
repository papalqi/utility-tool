# PR Review Prompt for Claude Code

> 本提示词用于指导 Claude Code 审查 PC Utility Tool Electron 项目的 Pull Request。

---

## 审查目标

你是一位资深的 Electron + React + TypeScript 代码审查专家，负责审查 PC Utility Tool 项目的 Pull Request。请从以下维度进行全面、严格的代码审查，确保代码质量、安全性和架构一致性。

---

## 审查检查清单

### 1. 架构合规性 🏗️

#### Widget 架构（如果涉及 Widget 开发/修改）
- [ ] 是否使用了统一的 Hook 架构？
  - ✅ 必须使用：`useWidget`, `useWidgetConfig`, `useWidgetStorage`, `useWidgetActions`
  - ❌ 禁止：直接操作 `obsidianManager`/`configManager` 单例
- [ ] 是否定义了 `WidgetMetadata`？
- [ ] 是否使用了 `WidgetLayout`/`WidgetSection` 布局组件？
- [ ] 生命周期钩子（`onInit`/`onCleanup`）是否正确实现？
- [ ] 日志是否使用 scoped logger（`widgetLogger`）？

#### Electron 进程边界
- [ ] 渲染进程是否**直接导入 Node.js 模块**？（❌ 严重违规）
- [ ] 所有文件/系统操作是否通过 `window.electronAPI`？
- [ ] IPC 通信是否使用了类型化的处理器？
- [ ] 主进程是否验证了所有文件路径（防止路径遍历攻击）？

### 2. 数据存储策略 💾

> **核心原则**：用户数据 → Obsidian，UI 状态 → localStorage，配置 → TOML

#### 存储位置验证
- [ ] **用户内容数据**是否存储在 Obsidian Vault？
  - TODO、Calendar、Pomodoro、工作日志、Secrets、项目元数据
  - ✅ 必须使用：`useWidgetObsidian<T>`
  - ❌ 禁止：存储在 localStorage/SQLite/electron-store
- [ ] **UI 状态**是否存储在 localStorage？
  - 展开/折叠、排序、视图模式
  - ✅ 使用：`useWidgetStorage<T>`
- [ ] **应用配置**是否存储在 TOML？
  - 主题、窗口、快捷键
  - ✅ 使用：`useWidgetConfig<T>`

#### Obsidian 集成检查
- [ ] Obsidian 不可用时，是否提示用户配置而非降级到本地存储？
- [ ] 模板路径是否正确使用占位符（`{year}`, `{week}`, `{date}` 等）？
- [ ] Markdown 格式是否与现有格式兼容（TODO/Calendar/Pomodoro）？
- [ ] 是否优雅处理 Vault 不存在的情况？

### 3. TypeScript 类型安全 🔒

- [ ] 是否存在 `any` 类型？（需要充分的理由）
- [ ] 新增的配置项是否同时更新了类型定义？
  - `electron/main/config.ts` (AppConfig)
  - `src/shared/types.ts`
- [ ] IPC 通信的参数和返回值是否类型化？
- [ ] React 组件的 Props 是否定义了接口？
- [ ] 泛型使用是否合理（如 `useWidgetConfig<T>`）？

### 4. 代码质量与规范 ✨

#### 代码风格
- [ ] 是否通过 `npm run type-check`（无 TypeScript 错误）？
- [ ] 是否通过 `npm run lint`（无 ESLint 错误）？
- [ ] 是否通过 `npm run format`（符合 Prettier 规范）？
- [ ] 缩进是否为 2 空格，是否省略分号（项目约定）？

#### React 最佳实践
- [ ] 是否使用函数式组件（禁止 Class 组件）？
- [ ] 是否正确使用 Hooks（依赖数组、清理函数）？
- [ ] 是否避免了不必要的重渲染（`useMemo`, `useCallback`）？
- [ ] 事件处理器是否正确绑定（避免内存泄漏）？

#### 性能考虑
- [ ] 是否有大量的同步 IPC 调用？（应改为批量/异步）
- [ ] 是否有未清理的定时器/订阅/监听器？
- [ ] 大文件读取是否使用流式处理？

### 5. 安全性 🔐

#### 文件操作安全
- [ ] 用户输入的路径是否经过验证？
- [ ] SSH 私钥处理是否正确？
  - ✅ 文本写入（`writeFile`），不使用 `writeFileBase64`
  - ✅ PEM 格式必须以 `\n` 结尾
  - ✅ 权限设置为 600（Unix）
- [ ] 临时文件是否正确清理？

#### IPC 安全
- [ ] 预加载脚本是否使用 `contextBridge`（不直接暴露 Node API）？
- [ ] 主进程是否验证来自渲染进程的参数？
- [ ] 敏感操作是否有权限检查？

#### Secrets 管理
- [ ] API Keys 是否存储在 Obsidian Vault（`secrets.md`）？
- [ ] 是否有硬编码的密钥/密码？（❌ 严重违规）
- [ ] 日志中是否打印了敏感信息？

### 6. 错误处理与调试 🐛

#### 错误处理
- [ ] 是否有完整的错误处理（try-catch）？
- [ ] 错误处理是否"掩盖问题"（不理解原因的多层 try-catch）？
- [ ] 错误消息是否对用户友好且可操作？
- [ ] 是否记录了详细的错误日志（堆栈、上下文）？

#### 调试友好性
- [ ] 关键操作是否有日志（使用 `widgetLogger`）？
- [ ] 是否有必要的状态提示（loading/error/success）？
- [ ] 开发者工具中是否有清晰的错误信息？

#### 调试原则（参考 CLAUDE.md）
- [ ] 是否遵循"文档优先"原则（集成第三方服务时）？
- [ ] 是否定位了根本原因而非处理表象？
- [ ] 是否避免了盲目添加 fallback 逻辑？

### 7. 测试与验证 ✅

#### 必须测试的场景
- [ ] Obsidian 启用/禁用两种情况
- [ ] 配置热重载（运行时修改 TOML）
- [ ] Widget 激活/停用和状态持久化
- [ ] 跨窗口同步（localStorage 事件）
- [ ] 跨平台兼容性（macOS/Windows/Linux）
- [ ] 终端操作（Unix bash vs Windows cmd.exe）

#### UI/UX 验证
- [ ] 空状态是否有友好提示（使用 `WidgetEmpty`）？
- [ ] 加载状态是否有视觉反馈？
- [ ] 错误状态是否有操作指引？
- [ ] 主题切换是否正常（亮色/暗色）？

### 8. 文档与可维护性 📚

- [ ] 复杂逻辑是否有注释说明？
- [ ] 新增的功能是否更新了 `CLAUDE.md`？
- [ ] 新增的配置项是否有说明？
- [ ] 是否有 JSDoc（公共 API/复杂函数）？
- [ ] Commit 信息是否清晰（遵循 Conventional Commits）？

### 9. 兼容性与迁移 🔄

- [ ] 配置格式是否与 Python 版本兼容（TOML）？
- [ ] Obsidian Markdown 格式是否向后兼容？
- [ ] 是否破坏了现有的 API 接口？
- [ ] 数据库/文件格式变更是否有迁移脚本？

---

## 审查输出格式

请按以下格式输出审查结果：

### 📊 审查概览

- **PR 标题**: [PR 标题]
- **涉及文件**: [数量] 个文件，+[新增行数] -[删除行数]
- **主要变更**: [简述 1-2 句话]
- **风险等级**: 🟢 低 / 🟡 中 / 🔴 高

### ✅ 优点

- [列出代码中做得好的地方]
- [例如：遵循了 Widget 架构，类型安全]

### ⚠️ 问题与建议

#### 🔴 阻塞性问题（Blocking）
- [ ] **[文件名:行号]** [问题描述]
  - **原因**: [为什么这是问题]
  - **建议**: [具体的修复建议]
  - **代码示例**:
    ```typescript
    // ❌ 错误
    const data = localStorage.getItem('todos')

    // ✅ 正确
    const { items } = useWidgetObsidian<TodoItem>({
      widgetId: 'todo',
      dataType: 'todo'
    })
    ```

#### 🟡 非阻塞性建议（Non-blocking）
- [ ] **[文件名:行号]** [建议]
  - **优化点**: [为什么应该改进]
  - **可选方案**: [可能的替代方案]

### 🧪 测试建议

- [ ] 测试场景 1：[描述]
- [ ] 测试场景 2：[描述]

### 📝 文档更新需求

- [ ] 是否需要更新 `CLAUDE.md`？
- [ ] 是否需要更新 `AGENTS.md`？
- [ ] 是否需要更新 README？

### 🎯 总结

**批准建议**: ✅ 批准 / ⚠️ 批准（有建议）/ ❌ 需要修改

**理由**: [简述审查结论]

---

## 关键设计原则提醒

### 数据存储决策树

```
这个数据是用户创建的内容吗？
├─ 是 → 存储在 Obsidian (Markdown)
│      例：TODO、日历、工作日志、API Keys
└─ 否 → 这个数据需要跨设备同步吗？
       ├─ 是 → 存储在 Obsidian
       └─ 否 → 这是 UI 显示状态吗？
              ├─ 是 → localStorage (useWidgetStorage)
              └─ 否 → 这是机器特定配置吗？
                     ├─ 是 → config.toml (useWidgetConfig)
                     └─ 否 → 临时缓存/内存
```

### 渲染进程操作决策树

```
需要操作文件/系统吗？
├─ 是 → 通过 window.electronAPI (IPC)
└─ 否 → 需要持久化数据吗？
       ├─ 用户数据 → useWidgetObsidian
       ├─ UI 状态 → useWidgetStorage
       ├─ 配置 → useWidgetConfig
       └─ 临时 → React State
```

### 错误处理决策树

```
遇到错误了吗？
├─ 是 → 这个错误是预期内的吗？
│      ├─ 是（网络超时、文件不存在）→ 添加容错逻辑
│      └─ 否（未知错误）→ 先定位根本原因
│             ├─ 查看完整错误信息（堆栈）
│             ├─ 查看详细日志
│             ├─ 理解错误原因
│             └─ 针对性修复（不盲目添加 fallback）
└─ 否 → 继续开发
```

---

## 参考资源

- **项目指南**: `CLAUDE.md`
- **开发规范**: `AGENTS.md`
- **架构文档**: `ARCHITECTURE.md`
- **示例代码**: `src/widgets/ExampleWidget.tsx`
- **调试原则**: `.claude/debugging-principles.md`

---

## 常见问题示例

### ❌ 错误示例 1：数据存储违规

```typescript
// ❌ 将 TODO 数据存储在 localStorage
const TodoWidget = () => {
  const [todos, setTodos] = useState([])

  useEffect(() => {
    const saved = localStorage.getItem('todos')
    setTodos(JSON.parse(saved || '[]'))
  }, [])
}
```

**问题**：
- 用户数据存储在本地，无法跨设备同步
- 数据格式私有，不符合 Markdown 原则
- 违反了 Obsidian 优先的核心原则

**修复**：
```typescript
// ✅ 使用 Obsidian 存储
const TodoWidget = () => {
  const { items, sync } = useWidgetObsidian<TodoItem>({
    widgetId: 'todo',
    dataType: 'todo',
    template: '{year}-W{week}.md',
    autoSync: true
  })
}
```

### ❌ 错误示例 2：渲染进程直接文件操作

```typescript
// ❌ 在渲染进程导入 Node.js 模块
import fs from 'fs'

const readConfig = () => {
  return fs.readFileSync('/path/to/config.toml', 'utf-8')
}
```

**问题**：
- 渲染进程无法直接访问 Node.js API
- 破坏了 Electron 的安全模型
- 会导致打包后运行失败

**修复**：
```typescript
// ✅ 通过 IPC 调用
const readConfig = async () => {
  return await window.electronAPI.readFile('/path/to/config.toml')
}
```

### ❌ 错误示例 3：错误处理掩盖问题

```typescript
// ❌ 不理解原因就添加多层 try-catch
const syncData = async () => {
  try {
    try {
      try {
        await doSync()
      } catch (e) {
        console.log('Sync failed, retrying...')
      }
    } catch (e) {
      console.log('Retry failed, using cache...')
    }
  } catch (e) {
    console.log('Everything failed, ignoring...')
  }
}
```

**问题**：
- 掩盖了真实的错误原因
- 用户不知道发生了什么
- 无法追踪和修复 bug

**修复**：
```typescript
// ✅ 理解错误并针对性处理
const syncData = async () => {
  try {
    await doSync()
  } catch (error) {
    if (error.code === 'ENOENT') {
      // 预期内：Vault 路径不存在
      widgetLogger.warn('Obsidian vault not found', { error })
      setError('请在设置中配置 Obsidian Vault 路径')
    } else if (error.code === 'NETWORK_ERROR') {
      // 预期内：网络问题
      widgetLogger.error('Network error during sync', { error })
      setError('同步失败，请检查网络连接')
    } else {
      // 未预期：需要修复的 bug
      widgetLogger.error('Unexpected sync error', { error })
      throw error // 不掩盖未知错误
    }
  }
}
```

---

**审查时请严格遵循以上清单，确保代码质量、安全性和架构一致性。**
