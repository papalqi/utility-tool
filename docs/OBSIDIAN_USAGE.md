# 📝 Obsidian 集成使用指南

## ✅ 优化完成！

Obsidian Manager 已经完全优化，现在提供：
- ✅ 完整的 Markdown 解析（gray-matter）
- ✅ 双向同步 TODO/Calendar/Pomodoro
- ✅ 新 Logger 集成
- ✅ 自动同步支持
- ✅ 错误恢复
- ✅ 模板路径变量
- ✅ Widget 专用 Hook

---

## 🎯 Markdown 格式

### TODO 项

```markdown
## TODO
- [ ] 任务 1 #work @2025-01-10
- [x] 任务 2 #personal
- [ ] 任务 3 #study @2025-01-15
```

**格式说明：**
- `- [ ]` - 未完成任务
- `- [x]` - 已完成任务
- `#category` - 分类标签（可选）
- `@YYYY-MM-DD` - 截止日期（可选）

### Calendar 事件

```markdown
## Calendar
- 2025-01-08 10:00 团队会议 #work
- 2025-01-09 14:30 看牙医 #personal
- 2025-01-10 09:00 项目汇报 #work
```

**格式说明：**
- `YYYY-MM-DD HH:MM` - 日期和时间
- 后面跟事件标题
- `#category` - 分类标签（可选）

### Pomodoro 会话

```markdown
## Pomodoro
- 2025-01-08 09:00-09:25 (25min) 编码功能 A #work
- 2025-01-08 10:00-10:25 (25min) 会议准备 #work
- 2025-01-08 14:00-14:25 (25min) 学习 React #study
```

**格式说明：**
- `YYYY-MM-DD HH:MM-HH:MM` - 开始和结束时间
- `(XXmin)` - 时长（分钟）
- 后面跟任务描述
- `#category` - 分类标签（可选）

### Secrets 文件

```
# API Keys and Secrets

openai_api_key: sk-xxx
deepseek_api_key: sk-xxx
github_token: ghp_xxx
```

**格式说明：**
- 每行一个 key-value 对
- 格式：`key: value`
- `#` 开头的行是注释

---

## 🔧 配置

### config.toml

```toml
[computer.your-hostname.obsidian]
enabled = true
vault_path = "/Users/yourname/Documents/Obsidian/MyVault"
secrets_file = "secrets.md"

[global.obsidian.content_files]
mode = "auto"  # 或 "manual"
template = "{year}-W{week}.md"  # 模板路径
manual_file = "custom.md"  # mode=manual 时使用
```

### 模板变量

支持以下变量：
- `{year}` - 年份 (2025)
- `{month}` - 月份 (01-12)
- `{week}` - ISO 周数 (01-53)
- `{day}` - 日期 (01-31)
- `{date}` - 完整日期 (2025-01-08)

**示例：**
- `{year}-W{week}.md` → `2025-W02.md`
- `{year}/{month}/daily-{date}.md` → `2025/01/daily-2025-01-08.md`
- `Daily/{year}-{month}-{day}.md` → `Daily/2025-01-08.md`

---

## 💻 使用方式

### 方式 1: 基础 Hook (useObsidian)

适用于简单的读写操作：

```tsx
import { useObsidian } from '@/hooks/useObsidian'

const MyWidget = () => {
  const {
    isEnabled,
    syncTodoItems,
    readTodoItems,
    readSecrets,
  } = useObsidian()

  const handleSync = async () => {
    if (!isEnabled) {
      message.warning('Obsidian 未启用')
      return
    }

    await syncTodoItems(todos, '{year}-W{week}.md')
    message.success('已同步到 Obsidian')
  }

  const handleLoad = async () => {
    const items = await readTodoItems('{year}-W{week}.md')
    setTodos(items)
  }

  // 读取 API keys
  const secrets = await readSecrets()
  const apiKey = secrets['openai_api_key']
}
```

### 方式 2: Widget Hook (useWidgetObsidian) - 推荐

提供自动同步、加载状态、错误处理：

```tsx
import { useWidgetObsidian } from '@/hooks/useWidgetObsidian'

const TodoWidget = () => {
  const [todos, setTodos] = useState<TodoItem[]>([])

  const {
    isEnabled,
    syncing,
    reading,
    lastSyncTime,
    error,
    sync,
    read,
    clearError,
  } = useWidgetObsidian<TodoItem>({
    widgetId: 'todo',
    dataType: 'todo',
    template: '{year}-W{week}.md',
    autoSync: true,         // 启用自动同步
    syncInterval: 60000,    // 每分钟自动同步
    onSync: () => {
      message.success('已同步到 Obsidian')
    },
    onRead: (data) => {
      console.log('读取了', data.length, '条数据')
    },
    onError: (err) => {
      message.error(`同步失败: ${err.message}`)
    },
  })

  // 从 Obsidian 加载
  const handleLoad = async () => {
    const items = await read()
    setTodos(items)
  }

  // 保存到 Obsidian
  const handleSave = async () => {
    await sync(todos)
  }

  // 每次修改后自动同步
  useEffect(() => {
    if (todos.length > 0) {
      sync(todos)
    }
  }, [todos])

  return (
    <div>
      <Button onClick={handleLoad} loading={reading}>
        从 Obsidian 加载
      </Button>
      <Button onClick={handleSave} loading={syncing}>
        保存到 Obsidian
      </Button>

      {error && (
        <Alert
          message={error}
          type="error"
          closable
          onClose={clearError}
        />
      )}

      {lastSyncTime && (
        <Text type="secondary">
          上次同步: {lastSyncTime.toLocaleString()}
        </Text>
      )}
    </div>
  )
}
```

---

## 📋 完整示例

### TODO Widget 完整实现

```tsx
import React, { useState, useEffect } from 'react'
import { Button, Input, Checkbox, Space, message } from 'antd'
import { useWidget } from '@/hooks/useWidget'
import { useWidgetObsidian } from '@/hooks/useWidgetObsidian'
import { useWidgetStorage } from '@/hooks/useWidgetStorage'
import { WidgetLayout, WidgetSection } from '@/components/widgets'
import { TodoItem } from '@/shared/types'

const TodoWidget: React.FC = () => {
  // 1. Widget 生命周期
  const { state, widgetLogger } = useWidget({
    metadata: {
      id: 'todo',
      displayName: 'TODO',
      icon: <CheckSquareOutlined />,
      description: 'TODO 管理',
      category: 'productivity',
      order: 1,
      enabled: true,
      requiresObsidian: true,
    },
    lifecycle: {
      onInit: async () => {
        widgetLogger.info('Initializing TODO widget')
        // 从 Obsidian 加载
        const items = await readObsidian()
        if (items.length > 0) {
          setTodos(items)
        }
      },
    },
  })

  // 2. 本地存储
  const { value: todos, setValue: setTodos } = useWidgetStorage<TodoItem[]>({
    key: 'todo-items',
    defaultValue: [],
  })

  // 3. Obsidian 同步
  const {
    isEnabled: obsidianEnabled,
    syncing,
    reading,
    lastSyncTime,
    sync: syncObsidian,
    read: readObsidian,
  } = useWidgetObsidian<TodoItem>({
    widgetId: 'todo',
    dataType: 'todo',
    template: '{year}-W{week}.md',
    autoSync: true,
    syncInterval: 60000,
    onSync: () => {
      widgetLogger.info('Synced to Obsidian')
      message.success('已同步到 Obsidian')
    },
    onError: (err) => {
      widgetLogger.error('Sync failed', err)
      message.error(`同步失败: ${err.message}`)
    },
  })

  // 4. 业务逻辑
  const [newTask, setNewTask] = useState('')

  const handleAdd = () => {
    if (!newTask.trim()) return

    const newTodo: TodoItem = {
      id: `${Date.now()}`,
      text: newTask,
      done: false,
      category: 'default',
      dueDate: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const updated = [...todos, newTodo]
    setTodos(updated)
    setNewTask('')

    // 同步到 Obsidian
    if (obsidianEnabled) {
      syncObsidian(updated)
    }
  }

  const handleToggle = (id: string) => {
    const updated = todos.map(todo =>
      todo.id === id ? { ...todo, done: !todo.done, updatedAt: Date.now() } : todo
    )
    setTodos(updated)

    // 同步到 Obsidian
    if (obsidianEnabled) {
      syncObsidian(updated)
    }
  }

  const handleDelete = (id: string) => {
    const updated = todos.filter(todo => todo.id !== id)
    setTodos(updated)

    // 同步到 Obsidian
    if (obsidianEnabled) {
      syncObsidian(updated)
    }
  }

  const handleLoadFromObsidian = async () => {
    const items = await readObsidian()
    setTodos(items)
    message.success(`加载了 ${items.length} 个任务`)
  }

  return (
    <WidgetLayout
      title="TODO"
      icon={<CheckSquareOutlined />}
      loading={state.loading}
      error={state.error}
      showRefresh={true}
      onRefresh={handleLoadFromObsidian}
      actionInProgress={syncing || reading}
    >
      {/* 输入区域 */}
      <WidgetSection title="新建任务">
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="输入任务..."
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onPressEnter={handleAdd}
          />
          <Button type="primary" onClick={handleAdd}>
            添加
          </Button>
        </Space.Compact>
      </WidgetSection>

      {/* 任务列表 */}
      <WidgetSection
        title="任务列表"
        extra={
          <Space>
            {obsidianEnabled && lastSyncTime && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                上次同步: {lastSyncTime.toLocaleTimeString()}
              </Text>
            )}
            <Text type="secondary">{todos.length} 个任务</Text>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {todos.map(todo => (
            <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Checkbox
                checked={todo.done}
                onChange={() => handleToggle(todo.id)}
              />
              <Text delete={todo.done}>{todo.text}</Text>
              {todo.category !== 'default' && (
                <Tag>{todo.category}</Tag>
              )}
              {todo.dueDate && (
                <Text type="secondary">@{todo.dueDate}</Text>
              )}
              <Button
                type="text"
                danger
                size="small"
                onClick={() => handleDelete(todo.id)}
              >
                删除
              </Button>
            </div>
          ))}
        </Space>
      </WidgetSection>
    </WidgetLayout>
  )
}
```

---

## 🚀 高级功能

### 1. 自动同步

```tsx
const { sync } = useWidgetObsidian({
  autoSync: true,
  syncInterval: 60000,  // 每分钟
})
```

### 2. 手动同步

```tsx
const { sync, forceSync } = useWidgetObsidian({ ... })

// 同步指定数据
await sync(todos)

// 重新同步上次的数据
forceSync()
```

### 3. 错误处理

```tsx
const { error, clearError } = useWidgetObsidian({
  onError: (err) => {
    console.error('Sync error:', err)
    notification.error({
      message: '同步失败',
      description: err.message,
    })
  },
})
```

### 4. 加载状态

```tsx
const { syncing, reading } = useWidgetObsidian({ ... })

<Button loading={syncing || reading}>
  保存
</Button>
```

---

## 📊 对比总结

| 功能 | 优化前 | 优化后 | 改进 |
|------|-------|-------|------|
| **Logger** | 旧 LogManager | 新 Logger (Scoped) | ✅ 100% |
| **Markdown 解析** | 占位实现 | gray-matter 完整解析 | ✅ 100% |
| **TODO 同步** | 无 | 完整双向同步 | ✅ 新增 |
| **Calendar 同步** | 无 | 完整双向同步 | ✅ 新增 |
| **Pomodoro 同步** | 无 | 完整双向同步 | ✅ 新增 |
| **自动同步** | 无 | 支持 | ✅ 新增 |
| **错误处理** | 基础 | 完善 | ✅ 100% |
| **Widget Hook** | 无 | useWidgetObsidian | ✅ 新增 |
| **模板变量** | 基础 | 5 种变量 | ✅ 100% |
| **文件自动创建** | 无 | 支持 | ✅ 新增 |

---

## ✅ 结论

Obsidian 集成现在已经**完全可用**且**非常方便**！

**推荐使用：**
1. ✅ Config 管理 - 直接使用
2. ✅ Obsidian 同步 - 直接使用
3. ✅ useWidgetObsidian - 推荐用于 Widget

**下一步：**
开始开发真实的 Widget（TODO、Pomodoro、Calendar），充分利用 Obsidian 集成！
