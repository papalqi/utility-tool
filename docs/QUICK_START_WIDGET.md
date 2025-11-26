# 🚀 Widget 开发快速入门

## 5 分钟创建你的第一个 Widget

### 步骤 1: 复制示例模板

```bash
cd src/widgets
cp ExampleWidget.tsx MyWidget.tsx
```

### 步骤 2: 修改元数据

```tsx
const metadata: WidgetMetadata = {
  id: 'my-widget',              // 唯一 ID
  displayName: '我的 Widget',    // 显示名称
  icon: <Icon />,                // 图标
  description: '描述文字',       // 描述
  category: 'productivity',      // 分类
  order: 1,                      // 排序
  enabled: true,                 // 是否启用
}
```

### 步骤 3: 定义数据类型

```tsx
interface MyWidgetData {
  // 定义你的数据结构
  items: string[]
  selectedId: string | null
}
```

### 步骤 4: 实现核心逻辑

```tsx
export const MyWidget: React.FC = () => {
  // 1. 生命周期管理
  const { state, widgetLogger } = useWidget({
    metadata,
    lifecycle: {
      onInit: async () => {
        // 初始化时执行
        widgetLogger.info('Initializing...')
      },
    },
  })

  // 2. 本地存储（可选）
  const { value: data, setValue: setData } = useWidgetStorage<MyWidgetData>({
    key: 'my-widget-data',
    defaultValue: {
      items: [],
      selectedId: null,
    },
  })

  // 3. 操作管理（可选）
  const { refresh } = useWidgetActions({
    widgetId: metadata.id,
    onRefresh: async () => {
      // 刷新逻辑
    },
  })

  // 4. 业务逻辑
  const handleAdd = () => {
    setData({
      ...data,
      items: [...data.items, 'New Item'],
    })
  }

  return (
    <WidgetLayout
      title={metadata.displayName}
      icon={metadata.icon}
      loading={state.loading}
      error={state.error}
      onRefresh={refresh}
    >
      <WidgetSection title="内容">
        <Button onClick={handleAdd}>添加</Button>
        {data.items.map((item, i) => (
          <div key={i}>{item}</div>
        ))}
      </WidgetSection>
    </WidgetLayout>
  )
}
```

### 步骤 5: 注册 Widget

#### 5.1 添加到 WidgetContainer

编辑 `src/components/WidgetContainer.tsx`:

```tsx
// 导入
const MyWidget = lazy(() => import('../widgets/MyWidget'))

// 添加到 switch
case 'my-widget':
  return <MyWidget />
```

#### 5.2 添加到侧边栏

编辑 `src/components/Sidebar.tsx`:

```tsx
// 添加到 menuItems
{
  key: 'my-widget',
  icon: <Icon />,
  label: '我的 Widget',
}
```

### 完成！

现在你的 Widget 已经可以使用了。运行 `npm run dev` 查看效果。

---

## 常用功能

### 使用配置

```tsx
const { config, updateConfig } = useWidgetConfig<MyConfig>({
  section: 'my_widget',
  defaultConfig: { setting: true },
})

// 读取配置
console.log(config.setting)

// 更新配置
await updateConfig({ setting: false })
```

### 添加操作按钮

```tsx
<WidgetLayout
  showRefresh={true}
  onRefresh={handleRefresh}
  showSave={true}
  onSave={handleSave}
  showExport={true}
  onExport={handleExport}
>
```

### 使用分组

```tsx
<WidgetSection
  title="分组标题"
  icon={<Icon />}
  collapsible={true}
>
  {/* 内容 */}
</WidgetSection>
```

### 显示空状态

```tsx
{items.length === 0 && (
  <WidgetEmpty
    description="还没有数据"
    actionText="创建"
    onAction={handleCreate}
  />
)}
```

---

## 调试技巧

### 查看日志

```tsx
const { widgetLogger } = useWidget({ ... })

widgetLogger.info('Normal log')
widgetLogger.debug('Debug info', { data })
widgetLogger.error('Error', error)
```

### 查看状态

```tsx
const { state } = useWidget({ ... })

console.log('Loading:', state.loading)
console.log('Error:', state.error)
console.log('Status:', state.statusMessage)
console.log('Initialized:', state.initialized)
```

---

## 示例参考

- **完整示例**: `src/widgets/ExampleWidget.tsx`
- **详细文档**: `WIDGET_ARCHITECTURE.md`
