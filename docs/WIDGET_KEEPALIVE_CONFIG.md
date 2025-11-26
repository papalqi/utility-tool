# Widget KeepAlive 配置说明

## 概述

`keepAlive` 属性控制 widget 在切换 tab 后是否继续在后台运行。

- **`keepAlive: true`** - widget 始终保持运行，仅隐藏 UI（使用 `display: none`）
- **`keepAlive: false`** - widget 切换时完全卸载，不参与 React 协调

---

## 当前配置

### 🟢 后台运行 (keepAlive: true)

| Widget | 原因 |
|--------|------|
| **Terminal** | 终端进程需要持续运行，命令执行不能中断 |
| **File Transfer** | 文件传输任务需要在后台继续进行 |
| **ADB** | ADB 连接和设备监控需要保持 |
| **Pomodoro** | 计时器需要持续倒计时 |
| **AI Chat** | 需要保持对话会话状态 |

### 🔵 按需加载 (keepAlive: false)

| Widget | 原因 |
|--------|------|
| **Dashboard** | 纯展示类，数据可重新加载 |
| **Settings** | 配置页面，无状态需求 |
| **TODO** | 数据从 Obsidian 读取，可重新加载 |
| **Calendar** | 日程数据可重新渲染 |
| **Projects** | 项目列表可重新加载 |
| **GitHub** | GitHub 数据可重新获取 |
| **Web Archive** | 网页存档展示，可重新加载 |
| **RenderDoc** | 渲染文档工具，无状态 |
| **Scripts** | 脚本列表，可重新加载 |
| **Environment** | 环境变量展示，可重新读取 |
| **AI CLI** | 配置页面，无状态需求 |
| **Generic AI** | AI 配置页面，无状态需求 |

---

## 性能影响

### keepAlive: true 的影响
- ✅ **优点**：状态完全保持，用户体验好
- ❌ **缺点**：占用内存，参与 React 协调（但 UI 隐藏）

### keepAlive: false 的影响
- ✅ **优点**：节省内存，完全不参与协调
- ❌ **缺点**：切换回来时需要重新加载数据

---

## 如何修改配置

编辑 `src/components/WidgetContainer.tsx`：

```typescript
const BASE_WIDGETS: WidgetEntry[] = [
  // 示例：将 TODO 设置为后台运行
  { key: 'todo', Component: TodoWidget, keepAlive: true },
  
  // 示例：将 Terminal 设置为按需加载（不推荐）
  { key: 'terminal', Component: TerminalWidget, keepAlive: false },
]
```

---

## 配置建议

### 应该设置 keepAlive: true 的场景
1. **有长时间运行的任务**（终端、文件传输）
2. **有计时器或定时任务**（Pomodoro）
3. **需要保持连接状态**（ADB、WebSocket）
4. **用户正在编辑的内容**（表单、聊天）

### 应该设置 keepAlive: false 的场景
1. **纯数据展示**（Dashboard、列表页）
2. **数据可从服务端/文件快速重新获取**
3. **无用户输入状态**
4. **组件较大且占用内存较多**

---

## 性能对比

### 示例：Dashboard → TODO → Dashboard

#### keepAlive: false (当前配置)
```
切换到 TODO:
  1. Dashboard 卸载 ✅ (释放内存)
  2. TODO 挂载 ✅ (加载数据)

切换回 Dashboard:
  1. TODO 卸载 ✅ (释放内存)
  2. Dashboard 重新挂载 ✅ (重新加载数据)
```

#### keepAlive: true (旧配置)
```
切换到 TODO:
  1. Dashboard 隐藏 ❌ (仍占用内存，参与协调)
  2. TODO 挂载

切换回 Dashboard:
  1. TODO 隐藏 ❌ (仍占用内存，参与协调)
  2. Dashboard 显示 ✅ (状态保持)
```

---

## 监控建议

可在开发者工具中验证：

1. **React DevTools Profiler** - 查看重渲染的组件数量
2. **Performance Monitor** - 监控内存使用
3. **浏览器任务管理器** - 查看整体内存占用

---

## 未来优化

- [ ] 支持用户在 Settings 中自定义 keepAlive 配置
- [ ] 自动监控内存，动态调整 keepAlive 策略
- [ ] 提供 API 允许 widget 自己控制 keepAlive 行为
