# 📝 Obsidian & Config 使用指南

## 🎯 当前状态

### ✅ Config 管理 - 完善且方便

#### 主进程配置管理 (`electron/main/config.ts`)

**特性：**
- ✅ 完整的 TOML 解析（@iarna/toml）
- ✅ 自动文件监控（chokidar）
- ✅ 主机名配置支持
- ✅ 保存/重载冲突防止
- ✅ 类型安全

**配置文件路径：**
```
开发环境: ./config/config.toml
生产环境: ~/Library/Application Support/pc-utility-tool-electron/config.toml
```

#### 渲染进程 Hooks

提供 **3 种使用方式**，由简到细：

##### 1. useConfig() - 全局配置

```tsx
import { useConfig } from '@/hooks/useConfig'

const MyComponent = () => {
  const config = useConfig()  // 自动订阅所有配置变化

  return <div>主题: {config.theme.current}</div>
}
```

**优点：** 简单直接
**缺点：** 任何配置变化都会触发重渲染

##### 2. useConfigSection() - 段落配置

```tsx
import { useConfigSection } from '@/hooks/useConfig'

const PomodoroWidget = () => {
  // 只订阅 pomodoro 段落的变化
  const pomodoro = useConfigSection('pomodoro')

  return <div>工作时长: {pomodoro.work_duration}分钟</div>
}
```

**优点：** 性能更好，只订阅需要的部分
**缺点：** 仍然是只读，需要手动更新

##### 3. useWidgetConfig() - Widget 配置（推荐）

```tsx
import { useWidgetConfig } from '@/hooks/useWidgetConfig'

interface PomodoroConfig {
  work_duration: number
  short_break_duration: number
  long_break_duration: number
}

const PomodoroWidget = () => {
  const { config, updateConfig, resetConfig, loading } = useWidgetConfig<PomodoroConfig>({
    section: 'pomodoro',
    defaultConfig: {
      work_duration: 25,
      short_break_duration: 5,
      long_break_duration: 15,
    },
    onChange: (newConfig) => {
      console.log('配置已更新:', newConfig)
    },
  })

  return (
    <div>
      <InputNumber
        value={config.work_duration}
        onChange={(val) => updateConfig({ work_duration: val })}
      />
      <Button onClick={resetConfig}>重置</Button>
    </div>
  )
}
```

**优点：**
- ✅ 类型安全（泛型支持）
- ✅ 读写一体
- ✅ 自动订阅变化
- ✅ 默认值支持
- ✅ 加载状态和错误处理

#### 配置更新

```tsx
import { useConfigUpdate } from '@/hooks/useConfig'

const SettingsPage = () => {
  const { updateConfig, updateSection } = useConfigUpdate()

  // 更新整个配置
  const handleSaveAll = async () => {
    await updateConfig(newConfig)
  }

  // 只更新某个段落
  const handleSaveTheme = async () => {
    await updateSection('theme', {
      current: 'dark',
      auto_switch: true,
    })
  }
}
```

---

## ⚠️ Obsidian 管理 - 需要优化

### 当前实现 (`src/core/ObsidianManager.ts`)

**已实现：**
- ✅ 基础框架
- ✅ vault 路径管理
- ✅ 启用/禁用检查
- ✅ secrets 文件读写

**需要改进：**
1. ❌ 使用旧的 LogManager（应该用新的 Logger）
2. ⚠️ TODO/Calendar/Pomodoro 解析逻辑只是占位
3. ⚠️ 缺少错误恢复（文件不存在时没有自动创建）
4. ⚠️ 没有 Widget 专用 Hook（应该类似 useWidgetConfig）

### 当前使用方式

```tsx
import { useObsidian } from '@/hooks/useObsidian'

const TodoWidget = () => {
  const {
    isEnabled,
    syncTodoItems,
    readTodoItems,
    readSecrets
  } = useObsidian()

  const handleSync = async () => {
    if (!isEnabled) {
      message.warning('Obsidian 未启用')
      return
    }

    await syncTodoItems(todos, '{year}-W{week}.md')
  }

  // 读取 secrets（API keys 等）
  const secrets = await readSecrets()
  const apiKey = secrets['openai_api_key']
}
```

---

## 🚀 推荐的优化方案

### 优化 1: 更新 ObsidianManager 使用新 Logger

```typescript
// src/core/ObsidianManager.ts
import { logger } from '@/core/Logger'

class ObsidianManager {
  private logger = logger.createScope('Obsidian')

  async initialize() {
    this.logger.info('Initializing...', { vaultPath })
  }

  async syncTodoItems() {
    this.logger.debug('Syncing TODO items')
    // ...
  }
}
```

### 优化 2: 创建 useWidgetObsidian Hook

类似 `useWidgetConfig`，创建更便捷的 Hook：

```typescript
// src/hooks/useWidgetObsidian.ts
interface UseWidgetObsidianOptions<T> {
  widgetId: string
  dataType: 'todo' | 'calendar' | 'pomodoro'
  template?: string
  autoSync?: boolean
  syncInterval?: number
}

export function useWidgetObsidian<T>(options: UseWidgetObsidianOptions<T>) {
  const { isEnabled } = useObsidian()
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const sync = useCallback(async (data: T[]) => {
    if (!isEnabled) return

    setSyncing(true)
    try {
      await obsidianManager.sync(options.dataType, data, options.template)
      setLastSync(new Date())
    } finally {
      setSyncing(false)
    }
  }, [isEnabled, options])

  const read = useCallback(async (): Promise<T[]> => {
    if (!isEnabled) return []
    return await obsidianManager.read(options.dataType, options.template)
  }, [isEnabled, options])

  // 自动同步
  useEffect(() => {
    if (options.autoSync && options.syncInterval) {
      const timer = setInterval(() => sync(data), options.syncInterval)
      return () => clearInterval(timer)
    }
  }, [options.autoSync, options.syncInterval])

  return {
    isEnabled,
    sync,
    read,
    syncing,
    lastSync,
  }
}
```

**使用示例：**
```tsx
const TodoWidget = () => {
  const { sync, read, syncing, lastSync } = useWidgetObsidian<TodoItem>({
    widgetId: 'todo',
    dataType: 'todo',
    template: '{year}-W{week}.md',
    autoSync: true,
    syncInterval: 60000,  // 每分钟自动同步
  })

  const handleSave = async () => {
    await sync(todos)
  }

  const handleLoad = async () => {
    const items = await read()
    setTodos(items)
  }

  return (
    <div>
      <Button onClick={handleSave} loading={syncing}>
        同步到 Obsidian
      </Button>
      <Text type="secondary">
        上次同步: {lastSync?.toLocaleString()}
      </Text>
    </div>
  )
}
```

### 优化 3: 完善 Markdown 解析

使用成熟的 Markdown 解析库：

```bash
npm install remark remark-parse remark-stringify gray-matter
```

```typescript
import { remark } from 'remark'
import matter from 'gray-matter'

class ObsidianManager {
  /**
   * 解析 Markdown 文件
   */
  private async parseMarkdownFile(filePath: string) {
    const content = await window.electronAPI.readFile(filePath)

    // 解析 Front Matter
    const { data: frontMatter, content: markdown } = matter(content)

    // 解析 Markdown AST
    const ast = remark().parse(markdown)

    return { frontMatter, ast, markdown }
  }

  /**
   * 从 Markdown 中提取 TODO 项
   */
  async readTodoItems(template: string): Promise<TodoItem[]> {
    const filePath = this.resolveTemplatePath(template)
    const { markdown } = await this.parseMarkdownFile(filePath)

    const todos: TodoItem[] = []
    const lines = markdown.split('\n')

    for (const line of lines) {
      // 匹配 TODO 格式: - [ ] Task name #category @due
      const match = line.match(/^- \[([ x])\] (.+?)(?:#(\w+))?(?:@(\d{4}-\d{2}-\d{2}))?$/)
      if (match) {
        todos.push({
          id: generateId(),
          text: match[2].trim(),
          done: match[1] === 'x',
          category: match[3] || 'default',
          dueDate: match[4] || null,
        })
      }
    }

    return todos
  }
}
```

---

## 📊 对比总结

### Config 管理

| 功能 | 实现状态 | 便捷程度 | 建议 |
|------|---------|---------|------|
| TOML 解析 | ✅ 完善 | ⭐⭐⭐⭐⭐ | 无需改进 |
| 文件监控 | ✅ 完善 | ⭐⭐⭐⭐⭐ | 无需改进 |
| Hook 支持 | ✅ 完善 | ⭐⭐⭐⭐⭐ | 3 种方式满足不同需求 |
| 类型安全 | ✅ 完善 | ⭐⭐⭐⭐⭐ | 完整的 TypeScript 支持 |
| **总体评价** | **优秀** | **非常方便** | ✅ 可直接使用 |

### Obsidian 管理

| 功能 | 实现状态 | 便捷程度 | 建议 |
|------|---------|---------|------|
| 基础框架 | ✅ 完成 | ⭐⭐⭐ | 已可用 |
| Logger | ⚠️ 使用旧版 | ⭐⭐ | 需更新到新 Logger |
| Markdown 解析 | ⚠️ 占位实现 | ⭐⭐ | 需完善解析逻辑 |
| Widget Hook | ❌ 缺失 | ⭐⭐ | 需创建 useWidgetObsidian |
| 错误恢复 | ⚠️ 基础 | ⭐⭐ | 需增强错误处理 |
| **总体评价** | **可用但需优化** | **中等** | ⚠️ 建议优化后使用 |

---

## 🎯 推荐使用方式

### 立即可用

#### 1. Config 管理（推荐直接使用）

```tsx
// Widget 中使用配置
const { config, updateConfig } = useWidgetConfig<YourConfig>({
  section: 'your_section',
  defaultConfig: { /* 默认值 */ },
})

// 读取配置
const value = config.some_field

// 更新配置
await updateConfig({ some_field: newValue })
```

#### 2. Obsidian 基础功能（可用）

```tsx
// 读写 Secrets
const { readSecrets, writeSecrets } = useObsidian()

const secrets = await readSecrets()
const apiKey = secrets['your_api_key']

await writeSecrets({ your_api_key: 'new_key' })
```

### 需要优化后使用

#### 1. TODO/Calendar/Pomodoro 同步

**当前：** 只有占位实现
**建议：** 等待优化完成，或参考上面的方案自行完善

#### 2. 高级 Obsidian 功能

**建议顺序：**
1. 先使用 Config 管理开发 Widget 基础功能
2. 如需 Obsidian 集成，先使用 secrets 读写
3. 等待 Markdown 解析优化完成后使用完整同步功能

---

## ✅ 结论

### Config 管理
- ✅ **完善且方便**，可直接使用
- ✅ 提供 3 种 Hook，满足不同场景
- ✅ 类型安全，自动订阅，使用体验优秀

### Obsidian 管理
- ⚠️ **基础可用，但建议优化**
- ✅ Secrets 读写功能完善
- ⚠️ TODO/Calendar/Pomodoro 需要完善解析逻辑
- 💡 建议创建 `useWidgetObsidian` Hook 提升便捷性

### 下一步行动

如果你想让我优化 Obsidian 管理，我可以：
1. 更新 ObsidianManager 使用新 Logger
2. 实现完整的 Markdown 解析逻辑
3. 创建 useWidgetObsidian Hook
4. 添加自动同步和错误恢复

**是否需要我现在进行这些优化？**
