# Widget 迁移计划

> 将 Widget 业务逻辑迁移到 Hooks，实现 UI 与逻辑分离

## 迁移目标

- **代码精简**：Widget 组件只负责 UI 渲染，业务逻辑封装到 Hooks
- **复用性提升**：Hooks 可在多个组件间共享
- **可测试性**：业务逻辑独立，便于单元测试
- **维护性**：职责分离，代码更易理解

---

## 已完成 ✅

| Widget | 原行数 | 新行数 | 节省 | Hook |
|--------|--------|--------|------|------|
| GitHubWidget | 1553 | 615 | 60% | `useGitHub` |
| ADBWidget | 932 | 278 | 70% | `useADBTool` |

---

## 待迁移

### 🔴 高优先级（>1000行）

| Widget | 行数 | 预估节省 | 需创建 Hook | 难度 | 状态 |
|--------|------|----------|-------------|------|------|
| AICliWidget | 1274 | ~65% | `useAICli` | 高 | 🔲 |
| WebArchiveWidget | 1222 | ~60% | `useWebArchive` | 中 | 🔲 |
| CalendarWidget | 1141 | ~65% | `useCalendar` | 中 | 🔲 |
| TerminalWidget | 1089 | ~50% | `useTerminal` | 高 | 🔲 |
| FileTransferWidget | 1074 | ~60% | `useFileTransfer` | 中 | 🔲 |

### 🟡 中优先级（400-1000行）

| Widget | 行数 | 预估节省 | 需创建 Hook | 难度 | 状态 |
|--------|------|----------|-------------|------|------|
| EnvironmentWidget | 953 | ~65% | `useEnvironment` | 中 | 🔲 |
| DashboardWidget | 449 | ~50% | 已有 `useResourceMonitor` | 低 | 🔲 |
| GenericAIWidget | 377 | ~50% | 复用 `useAI` | 低 | 🔲 |

### 🟢 低优先级（<300行）

| Widget | 行数 | 说明 | 状态 |
|--------|------|------|------|
| ExampleWidget | 291 | 示例代码，保留 | ⏸️ |
| AIChatWidget | 217 | 可复用 `useAI` | 🔲 |
| TestWidget | 143 | 测试用，跳过 | ⏸️ |
| TodoWidget | 20 | 占位符 | ⏸️ |
| AttachmentsWidget | 19 | 占位符 | ⏸️ |
| PomodoroWidget | 19 | 占位符 | ⏸️ |
| QuickAccessWidget | 19 | 占位符 | ⏸️ |
| RenderDocWidget | 17 | 占位符 | ⏸️ |
| ScriptsWidget | 17 | 占位符 | ⏸️ |
| ProjectsWidget | 8 | 占位符 | ⏸️ |

---

## 迁移批次

```
第1批（立即）
├── DashboardWidget      # 已有 useResourceMonitor
└── GenericAIWidget      # 复用 useAI

第2批（短期）
├── EnvironmentWidget    # 环境变量管理
├── FileTransferWidget   # 文件传输
└── CalendarWidget       # 日历事件

第3批（中期）
├── WebArchiveWidget     # 网页存档
└── AICliWidget          # AI 命令行

第4批（长期）
└── TerminalWidget       # PTY 终端（复杂）
```

---

## 迁移步骤（每个 Widget）

1. **分析现有代码**
   - 识别状态变量
   - 提取业务逻辑函数
   - 确定 IPC 调用

2. **创建 Hook**
   ```
   src/hooks/api/use[WidgetName].ts
   ```
   - 封装所有状态管理
   - 封装所有业务逻辑
   - 提供消息回调接口

3. **重写 Widget**
   ```
   src/widgets/[WidgetName].tsx
   ```
   - 调用 Hook 获取状态和方法
   - 只保留 UI 渲染逻辑
   - 处理用户交互事件

4. **测试验证**
   - 功能测试
   - 类型检查
   - 清理旧文件

---

## Hook 设计规范

### 命名约定

```typescript
// 文件名
src/hooks/api/use[Feature].ts

// Hook 名称
export function use[Feature](options: Use[Feature]Options): Use[Feature]Return
```

### 标准结构

```typescript
// 类型定义
export interface Use[Feature]Options {
  config?: Config
  onMessage?: (type: 'success' | 'error' | 'warning' | 'info', content: string) => void
  onLog?: (level: 'info' | 'warn' | 'error', message: string, data?: unknown) => void
}

interface Use[Feature]Return {
  // 状态
  loading: boolean
  error: Error | null
  data: DataType[]
  
  // 操作
  load: () => Promise<void>
  save: (data: DataType) => Promise<void>
  // ...
}

// Hook 实现
export function use[Feature](options: Use[Feature]Options): Use[Feature]Return {
  const { onMessage, onLog } = options
  
  // 状态
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<DataType[]>([])
  
  // 操作
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await ipc.invoke('channel:action')
      setData(result)
    } catch (e) {
      setError(e as Error)
      onMessage?.('error', '加载失败')
    } finally {
      setLoading(false)
    }
  }, [onMessage])
  
  // 初始化
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  return { loading, error, data, load }
}
```

---

## 预期收益

| 指标 | 当前 | 迁移后 | 提升 |
|------|------|--------|------|
| 总代码行数 | ~9,200 行 | ~3,500 行 | **62%** |
| 平均组件大小 | ~600 行 | ~230 行 | **62%** |
| 可复用 Hooks | 2 | 12+ | **+10** |
| 测试覆盖率 | - | 可测试 | ✅ |

---

## 注意事项

1. **避免无限循环**
   - useEffect 依赖项不要包含回调函数
   - 使用 `eslint-disable-next-line` 注释

2. **可选链访问**
   - API 返回数据可能为 undefined
   - 使用 `?.` 安全访问属性

3. **类型断言**
   - IPC 返回值需要类型断言
   - 使用 `as unknown as Type` 双重断言

4. **保留旧文件**
   - 迁移完成后保留 `.old.tsx` 备份
   - 确认稳定后再删除

---

## 更新记录

| 日期 | 更新内容 |
|------|----------|
| 2025-12-03 | 完成 GitHubWidget、ADBWidget 迁移 |
| 2025-12-03 | 创建迁移计划文档 |
