# 🏗️ Widget 架构设计文档

## 📋 目录

- [概述](#概述)
- [设计目标](#设计目标)
- [架构组成](#架构组成)
- [核心 Hooks](#核心-hooks)
- [通用组件](#通用组件)
- [工具函数](#工具函数)
- [使用示例](#使用示例)
- [最佳实践](#最佳实践)
- [迁移指南](#迁移指南)

---

## 概述

### 问题背景

在 Python 版本中，每个 Widget 都有大量重复代码：
- **BaseWidget**: ~1400 行
- **TodoWidget**: ~1672 行
- **PomodoroWidget**: ~831 行
- **每个 Widget 都重复实现**：配置管理、主题响应、日志记录、线程管理等

### 解决方案

采用 **React Hooks + 组合模式**，将通用功能抽象为可复用的 Hooks 和组件：

```
新架构 = 核心 Hooks + 通用组件 + 工具函数
```

**代码量对比**：
- Python BaseWidget: ~1400 行
- React useWidget Hook: ~224 行
- **减少 84% 重复代码**

---

## 设计目标

### ✅ 核心目标

1. **消除重复代码** - 将通用功能提取为可复用的 Hooks
2. **统一生命周期管理** - 自动处理初始化、挂载、卸载等
3. **类型安全** - 完整的 TypeScript 类型支持
4. **易于维护** - 清晰的关注点分离
5. **快速开发** - 新 Widget 只需 100-200 行代码

### 🎯 设计原则

- **组合优于继承** - 使用 Hooks 组合功能
- **关注点分离** - 每个 Hook 只负责一件事
- **声明式 API** - 简洁直观的使用方式
- **渐进式增强** - 可选的高级功能

---

## 架构组成

```
src/
├── hooks/                      # 核心 Hooks
│   ├── useWidget.ts           # 生命周期管理
│   ├── useWidgetConfig.ts     # 配置管理
│   ├── useWidgetStorage.ts    # 本地存储
│   └── useWidgetActions.ts    # 操作管理
│
├── components/widgets/         # 通用组件
│   ├── WidgetLayout.tsx       # 统一布局
│   ├── WidgetHeader.tsx       # 标题组件
│   ├── WidgetSection.tsx      # 分组区域
│   └── WidgetEmpty.tsx        # 空状态
│
├── utils/                      # 工具函数
│   └── widget-helpers.ts      # 辅助函数
│
├── shared/                     # 类型定义
│   └── widget-types.ts        # Widget 类型
│
└── widgets/                    # Widget 实现
    ├── ExampleWidget.tsx      # 示例 Widget
    ├── TodoWidget.tsx         # TODO Widget
    └── ...                    # 其他 Widgets
```

---

## 核心 Hooks

### 1. useWidget - 生命周期管理

**位置**: `src/hooks/useWidget.ts`

**功能**：
- ✅ 自动初始化和清理
- ✅ 统一的状态管理
- ✅ 配置和主题响应
- ✅ Scoped Logger
- ✅ 错误处理

**使用示例**：

```tsx
import { useWidget } from '@/hooks/useWidget'

const MyWidget = () => {
  const { state, setStatus, widgetLogger } = useWidget({
    metadata: {
      id: 'my-widget',
      displayName: 'My Widget',
      icon: <Icon />,
      description: 'Widget description',
      category: 'productivity',
      order: 1,
      enabled: true,
    },
    lifecycle: {
      onInit: async () => {
        // 初始化逻辑（自动调用）
        await fetchData()
      },
      onMount: () => {
        // 组件挂载时
        setStatus('就绪')
      },
      onUnmount: () => {
        // 组件卸载时清理
        cleanup()
      },
      onConfigChange: () => {
        // 配置变化时自动触发
        reloadData()
      },
      onThemeChange: () => {
        // 主题变化时自动触发
        updateStyles()
      },
    },
    autoInit: true,  // 自动初始化
  })

  // state 包含: loading, error, statusMessage, initialized
  if (state.loading) return <Spin />
  if (state.error) return <Alert message={state.error} />

  return <div>{/* Widget 内容 */}</div>
}
```

**返回值**：
```typescript
{
  state: {
    loading: boolean
    error: string | null
    statusMessage: string
    initialized: boolean
  }
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setStatus: (status: string) => void
  initialize: () => Promise<void>
  widgetLogger: ScopedLogger  // 带作用域的日志器
}
```

---

### 2. useWidgetConfig - 配置管理

**位置**: `src/hooks/useWidgetConfig.ts`

**功能**：
- ✅ 类型安全的配置访问
- ✅ 自动订阅配置变化
- ✅ 配置更新和重置
- ✅ 加载状态和错误处理

**使用示例**：

```tsx
import { useWidgetConfig } from '@/hooks/useWidgetConfig'

interface PomodoroConfig {
  work_duration: number
  short_break_duration: number
  long_break_duration: number
}

const PomodoroWidget = () => {
  const { config, updateConfig, resetConfig } = useWidgetConfig<PomodoroConfig>({
    section: 'pomodoro',
    defaultConfig: {
      work_duration: 25,
      short_break_duration: 5,
      long_break_duration: 15,
    },
    onChange: (newConfig) => {
      console.log('Config updated:', newConfig)
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

**返回值**：
```typescript
{
  config: T  // 类型安全的配置
  updateConfig: (updates: Partial<T>) => Promise<void>
  resetConfig: () => Promise<void>
  loading: boolean
  error: string | null
}
```

---

### 3. useWidgetStorage - 本地存储

**位置**: `src/hooks/useWidgetStorage.ts`

**功能**：
- ✅ localStorage 持久化
- ✅ 自动序列化/反序列化
- ✅ 跨窗口同步
- ✅ 类型安全

**使用示例**：

```tsx
import { useWidgetStorage } from '@/hooks/useWidgetStorage'

interface TodoData {
  todos: Array<{ id: string; text: string; done: boolean }>
  filter: 'all' | 'active' | 'completed'
}

const TodoWidget = () => {
  const { value, setValue, reset } = useWidgetStorage<TodoData>({
    key: 'todo-widget-data',
    defaultValue: {
      todos: [],
      filter: 'all',
    },
    persist: true,  // 启用持久化
  })

  const addTodo = (text: string) => {
    setValue({
      ...value,
      todos: [...value.todos, { id: generateId(), text, done: false }],
    })
  }

  return <div>{/* 渲染 todos */}</div>
}
```

**返回值**：
```typescript
{
  value: T
  setValue: (value: T | ((prev: T) => T)) => void
  reset: () => void
  clear: () => void
  loading: boolean
}
```

---

### 4. useWidgetActions - 操作管理

**位置**: `src/hooks/useWidgetActions.ts`

**功能**：
- ✅ 统一操作接口（刷新、保存、导出、重置）
- ✅ 自动加载状态管理
- ✅ 错误处理
- ✅ 日志记录

**使用示例**：

```tsx
import { useWidgetActions } from '@/hooks/useWidgetActions'

const MyWidget = () => {
  const { refresh, save, export: exportData, isActionInProgress } = useWidgetActions({
    widgetId: 'my-widget',
    onRefresh: async () => {
      await fetchLatestData()
    },
    onSave: async () => {
      await saveToServer(data)
    },
    onExport: () => {
      downloadFile(data)
    },
    onReset: () => {
      clearAllData()
    },
  })

  return (
    <Space>
      <Button onClick={refresh} loading={isActionInProgress}>刷新</Button>
      <Button onClick={save} loading={isActionInProgress}>保存</Button>
      <Button onClick={exportData}>导出</Button>
    </Space>
  )
}
```

**返回值**：
```typescript
{
  refresh?: () => Promise<void>
  save?: () => Promise<void>
  export?: () => void
  reset?: () => void
  isActionInProgress: boolean
  actionError: string | null
  clearError: () => void
}
```

---

## 通用组件

### 1. WidgetLayout - 统一布局

**位置**: `src/components/widgets/WidgetLayout.tsx`

**功能**：
- ✅ 标题栏（带图标）
- ✅ 操作按钮（刷新、保存、导出、设置）
- ✅ 加载状态
- ✅ 错误显示
- ✅ 统一样式

**使用示例**：

```tsx
import { WidgetLayout } from '@/components/widgets'

const MyWidget = () => {
  return (
    <WidgetLayout
      title="我的 Widget"
      icon={<Icon />}
      loading={loading}
      error={error}
      showRefresh={true}
      onRefresh={handleRefresh}
      showSave={true}
      onSave={handleSave}
      showExport={true}
      onExport={handleExport}
      actionInProgress={saving}
    >
      {/* Widget 内容 */}
    </WidgetLayout>
  )
}
```

**Props**：
```typescript
{
  title: string
  icon?: ReactNode
  children: ReactNode
  loading?: boolean
  error?: string | null
  showRefresh?: boolean
  onRefresh?: () => void
  showSave?: boolean
  onSave?: () => void
  showExport?: boolean
  onExport?: () => void
  showSettings?: boolean
  onSettings?: () => void
  extra?: ReactNode
  bordered?: boolean
  actionInProgress?: boolean
}
```

---

### 2. WidgetSection - 分组区域

**位置**: `src/components/widgets/WidgetSection.tsx`

**功能**：
- ✅ 内容分组
- ✅ 可折叠
- ✅ 自定义标题和图标

**使用示例**：

```tsx
import { WidgetSection } from '@/components/widgets'

<WidgetSection
  title="配置选项"
  icon={<SettingOutlined />}
  collapsible={true}
  defaultCollapsed={false}
>
  {/* 配置内容 */}
</WidgetSection>
```

---

### 3. WidgetHeader - 标题组件

**位置**: `src/components/widgets/WidgetHeader.tsx`

**功能**：
- ✅ 简洁的标题显示
- ✅ 描述文字
- ✅ 右侧额外内容

**使用示例**：

```tsx
import { WidgetHeader } from '@/components/widgets'

<WidgetHeader
  title="任务列表"
  icon={<CheckSquareOutlined />}
  description="管理你的待办事项"
  extra={<Button>新建</Button>}
/>
```

---

### 4. WidgetEmpty - 空状态

**位置**: `src/components/widgets/WidgetEmpty.tsx`

**功能**：
- ✅ 空状态提示
- ✅ 操作按钮

**使用示例**：

```tsx
import { WidgetEmpty } from '@/components/widgets'

{todos.length === 0 && (
  <WidgetEmpty
    description="还没有任务"
    actionText="创建第一个任务"
    actionIcon={<PlusOutlined />}
    onAction={handleCreate}
  />
)}
```

---

## 工具函数

**位置**: `src/utils/widget-helpers.ts`

### 常用函数

```typescript
// 时间格式化
formatTimestamp(Date.now(), 'datetime')  // "2025-11-08 09:23:45"

// 防抖和节流
const debouncedSave = debounce(saveData, 500)
const throttledScroll = throttle(handleScroll, 100)

// 深拷贝
const copy = deepClone(originalObject)

// 生成唯一 ID
const id = generateId('todo')  // "todo-1699432225-a3x9k2"

// 文件大小格式化
formatFileSize(1024 * 1024)  // "1.00 MB"

// 延迟执行
await sleep(1000)

// 重试机制
await retry(fetchData, { retries: 3, delay: 1000 })

// 安全的 JSON 解析
const data = safeJsonParse(jsonString, defaultValue)

// 复制到剪贴板
await copyToClipboard(text)

// 从剪贴板读取
const text = await readFromClipboard()

// Widget 排序和过滤
const sorted = sortWidgets(widgets)
const enabled = getEnabledWidgets(widgets)
const widget = findWidgetById(widgets, 'my-widget')
```

---

## 使用示例

### 完整的 Widget 示例

参考 `src/widgets/ExampleWidget.tsx`，这是一个完整的示例：

```tsx
import React from 'react'
import { useWidget } from '@/hooks/useWidget'
import { useWidgetStorage } from '@/hooks/useWidgetStorage'
import { useWidgetActions } from '@/hooks/useWidgetActions'
import { WidgetLayout, WidgetSection } from '@/components/widgets'

const MyWidget: React.FC = () => {
  // 1. 生命周期管理
  const { state, widgetLogger } = useWidget({
    metadata: {
      id: 'my-widget',
      displayName: 'My Widget',
      // ...
    },
    lifecycle: {
      onInit: async () => {
        await initialize()
      },
    },
  })

  // 2. 本地存储
  const { value, setValue } = useWidgetStorage({
    key: 'my-widget-data',
    defaultValue: { count: 0 },
  })

  // 3. 操作管理
  const { refresh, save } = useWidgetActions({
    widgetId: 'my-widget',
    onRefresh: async () => await fetchData(),
    onSave: async () => await saveData(),
  })

  // 4. 渲染
  return (
    <WidgetLayout
      title="My Widget"
      loading={state.loading}
      error={state.error}
      onRefresh={refresh}
      onSave={save}
    >
      <WidgetSection title="内容">
        {/* Widget 内容 */}
      </WidgetSection>
    </WidgetLayout>
  )
}
```

---

## 最佳实践

### 1. Hook 使用顺序

建议按以下顺序调用 Hooks：

```tsx
const MyWidget = () => {
  // 1. 核心生命周期
  const { state, widgetLogger } = useWidget({ ... })

  // 2. 配置管理
  const { config } = useWidgetConfig({ ... })

  // 3. 本地存储
  const { value, setValue } = useWidgetStorage({ ... })

  // 4. 操作管理
  const { refresh, save } = useWidgetActions({ ... })

  // 5. 本地状态
  const [localState, setLocalState] = useState(...)

  // 6. 副作用
  useEffect(() => { ... }, [])

  // 7. 渲染
  return <WidgetLayout>...</WidgetLayout>
}
```

### 2. 错误处理

```tsx
const { state, setError } = useWidget({ ... })

try {
  await riskyOperation()
} catch (error) {
  setError(error instanceof Error ? error.message : '操作失败')
}
```

### 3. 日志记录

```tsx
const { widgetLogger } = useWidget({ ... })

widgetLogger.info('Operation started')
widgetLogger.debug('Debug info', { data })
widgetLogger.error('Error occurred', error)
```

### 4. 配置更新

```tsx
const { config, updateConfig } = useWidgetConfig({ ... })

// 只更新部分配置
await updateConfig({ work_duration: 30 })
```

### 5. 存储管理

```tsx
const { value, setValue } = useWidgetStorage({ ... })

// 使用函数式更新
setValue(prev => ({ ...prev, count: prev.count + 1 }))
```

---

## 迁移指南

### 从 Python BaseWidget 迁移

#### Python 版本
```python
class MyWidget(BaseWidget):
    def __init__(self):
        super().__init__()
        self.config = self.config_manager.get_section('my_widget')
        self.init_ui()
        self.connect_signals()

    def init_ui(self):
        # UI 初始化

    def on_config_changed(self):
        # 配置变化处理

    def on_theme_changed(self):
        # 主题变化处理
```

#### React 版本
```tsx
const MyWidget = () => {
  const { state } = useWidget({
    metadata: { ... },
    lifecycle: {
      onInit: async () => { /* 初始化 */ },
      onConfigChange: () => { /* 配置变化 */ },
      onThemeChange: () => { /* 主题变化 */ },
    },
  })

  const { config } = useWidgetConfig({
    section: 'my_widget',
  })

  return <WidgetLayout>{/* UI */}</WidgetLayout>
}
```

### 代码量对比

| 功能 | Python 代码行数 | React 代码行数 | 减少 |
|------|----------------|---------------|------|
| 基础框架 | ~1400 | ~224 | **84%** |
| 配置管理 | ~200 | ~50 | **75%** |
| 主题管理 | ~150 | ~30 | **80%** |
| 日志记录 | ~100 | ~20 | **80%** |
| **总计** | **~1850** | **~324** | **82%** |

---

## 性能优化

### 1. 懒加载

所有 Widget 都使用 `React.lazy` 懒加载：

```tsx
const MyWidget = lazy(() => import('./MyWidget'))
```

### 2. 防抖和节流

对频繁操作使用防抖/节流：

```tsx
import { debounce } from '@/utils/widget-helpers'

const debouncedSave = debounce(save, 500)
```

### 3. 避免不必要的重渲染

使用 `useCallback` 和 `useMemo`：

```tsx
const handleClick = useCallback(() => {
  // ...
}, [dependencies])

const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data)
}, [data])
```

---

## 总结

### ✅ 优势

1. **大幅减少重复代码** - 从 1400+ 行减少到 200+ 行
2. **统一的开发体验** - 所有 Widget 使用相同的模式
3. **类型安全** - 完整的 TypeScript 支持
4. **易于维护** - 清晰的关注点分离
5. **快速开发** - 新 Widget 只需 100-200 行代码

### 📝 新 Widget 开发流程

1. 复制 `ExampleWidget.tsx` 作为模板
2. 修改 metadata（id、displayName、icon 等）
3. 实现 lifecycle 钩子（onInit、onMount 等）
4. 使用 `useWidgetConfig` 管理配置
5. 使用 `useWidgetStorage` 管理本地数据
6. 使用 `WidgetLayout` 和 `WidgetSection` 构建 UI
7. 完成！

### 🚀 下一步

- 参考 `ExampleWidget.tsx` 开发第一个真实 Widget
- 逐步迁移其他 11 个 Widget
- 根据需要添加更多通用 Hooks 和组件

---

## 附录

### 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 整体架构设计
- [MODULES_OPTIMIZATION.md](./MODULES_OPTIMIZATION.md) - 模块优化说明
- [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) - 迁移计划

### 问题反馈

如果在使用新架构时遇到问题，请查看 `ExampleWidget.tsx` 或提交 Issue。
