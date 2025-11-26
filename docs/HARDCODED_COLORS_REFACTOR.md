# 硬编码颜色重构报告

本文档记录了项目中需要重构到 ThemeContext 的硬编码颜色。

## 📊 概览

- **总计发现**: 108+ 个十六进制颜色，36+ 个 rgba 颜色
- **涉及文件**: 23+ 个文件
- **重构优先级**: 高、中、低

---

## 🔴 高优先级（影响用户体验）

### 1. Terminal 组件 (`src/components/Terminal.tsx`)
**问题**: xterm.js 主题硬编码，不跟随全局主题切换
**颜色数量**: 20+ 个
**影响**: 终端始终是暗色，即使全局主题切换到亮色也不变

```typescript
theme: {
  background: '#1e1e1e',     // 应该用 colors.bgSecondary
  foreground: '#cccccc',     // 应该用 colors.textPrimary
  cursor: '#ffffff',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  // ... 等等
}
```

**建议重构**:
1. 在 `ThemeColors` 中添加 `terminal` 命名空间
2. 为亮色和暗色主题分别定义完整的终端颜色方案
3. 暴露 CSS 变量或直接在组件中使用 `useTheme()`

---

### 2. CalendarWidget (`src/widgets/CalendarWidget.tsx`)
**问题**: 事件渲染颜色硬编码
**颜色数量**: 11 个
**影响**: 日历事件显示不统一

```typescript
// 行 748-755: 事件内容渲染
<span style={{ fontSize: 12, color: '#fff', opacity: 0.85 }}>  // 应该用变量
<strong style={{ color: '#fff' }}>                             // 应该用变量
<span style={{ fontSize: 11, color: '#f5f5f5', opacity: 0.9 }}> // 应该用变量

// 行 878: 即将开始事件背景
background: '#1f1f1f33'  // 应该用 colors.bgTertiary + opacity

// 行 1121-1124: 周报预览
background: '#0f0f0f'    // 应该用 colors.bgPrimary
color: '#f5f5f5'         // 应该用 colors.textPrimary

// 行 137, 201: 默认分类颜色
color: '#546E7A'         // 可以保留或用 colors.textSecondary

// 行 178: 新增分类默认颜色
'#1890ff'                // 应该用 colors.primary
```

**建议重构**:
- 事件内容文字使用 `colors.textPrimary`
- 背景色使用 `colors.bgTertiary` + rgba
- 默认分类颜色可考虑使用 `colors.primary`

---

### 3. GitHub Widget (`src/widgets/GitHubWidget.tsx`)
**问题**: 星标颜色硬编码
**颜色数量**: 3 个
**影响**: 不遵循品牌色系统

```typescript
// 行 925, 1036, 1162
<StarFilled style={{ color: '#faad14' }} />  // 应该定义 colors.starYellow
```

**建议重构**:
在 `ThemeColors` 中添加:
```typescript
starYellow: string  // 亮色: '#faad14', 暗色: '#fbbf24'
```

---

## 🟡 中优先级（影响一致性）

### 4. Pomodoro Widget (`src/pages/PomodoroWidget.tsx`)
**问题**: 文字颜色和边框硬编码
**颜色数量**: 6 个

```typescript
color: '#888'     // 应该用 colors.textSecondary
color: '#666'     // 应该用 colors.textSecondary
borderTop: '1px solid #f0f0f0'  // 应该用 colors.borderPrimary
```

---

### 5. FileTransfer Widget (`src/widgets/FileTransferWidget.tsx`)
**颜色数量**: 8 个
**建议**: 使用 `colors.success`, `colors.warning`, `colors.danger`

---

### 6. ADB Widget (`src/widgets/ADBWidget.tsx`)
**颜色数量**: 5 个
**建议**: 设备连接状态颜色使用 `colors.success` / `colors.danger`

---

### 7. AI Widgets
- **AICliWidget**: 4 个颜色
- **AIChatWidget**: 3 个颜色
**建议**: 消息气泡背景使用 theme 颜色

---

## 🟢 低优先级（可延后）

### 8. 组件级别
- `TitleBar.tsx`: 1 个
- `Sidebar.tsx`: 1 个
- `AttachmentThumbnail.tsx`: 1 个
- `ObsidianSettings.tsx`: 1 个
- `DashboardWidget.tsx`: 1 个
- `EnvironmentWidget.tsx`: 1 个

这些文件颜色使用较少，可在重构其他组件时一并处理。

---

## 📝 建议的 ThemeColors 扩展

```typescript
interface ThemeColors {
  // ... 现有字段 ...

  // Terminal colors
  terminalBg: string
  terminalFg: string
  terminalCursor: string
  terminalBlack: string
  terminalRed: string
  terminalGreen: string
  terminalYellow: string
  terminalBlue: string
  terminalMagenta: string
  terminalCyan: string
  terminalWhite: string
  terminalBrightBlack: string
  terminalBrightRed: string
  terminalBrightGreen: string
  terminalBrightYellow: string
  terminalBrightBlue: string
  terminalBrightMagenta: string
  terminalBrightCyan: string
  terminalBrightWhite: string
  terminalSelectionBg: string

  // Special colors
  starYellow: string       // 星标/收藏
  codeBg: string           // 代码块背景
  codeText: string         // 代码块文字

  // Event/Status colors (可选，已有部分)
  eventTextPrimary: string
  eventTextSecondary: string
  eventBg: string
}
```

---

## 🎯 重构步骤建议

### 阶段 1: ThemeContext 扩展 ✅ 已完成
- [x] Calendar 颜色配置
- [x] Terminal 颜色配置（20+ 个颜色）
- [x] Special 颜色配置（starYellow, codeBg, codeText, eventText 等）
- [x] CSS 变量注入

### 阶段 2: 高优先级组件 ✅ 已完成
1. [x] **Terminal 组件** - 20+ 个颜色已重构
2. [x] **CalendarWidget** - 事件渲染、背景、代码块等已重构
3. [x] **GitHubWidget** - 星标颜色已重构（3处）

### 阶段 3: 中优先级组件 ⏳ 部分完成
4. [x] **Pomodoro Widget** - 文字和边框颜色已重构（6处）
5. [ ] FileTransfer Widget
6. [ ] ADB Widget
7. [ ] AI Widgets

### 阶段 4: 低优先级组件
8. [ ] 其他零散组件

---

## 🔧 重构模板

### 组件重构示例

**Before:**
```typescript
<div style={{ color: '#888', background: '#1f1f1f' }}>
  内容
</div>
```

**After:**
```typescript
import { useTheme } from '@/contexts/ThemeContext'

const MyComponent = () => {
  const { colors } = useTheme()
  
  return (
    <div style={{ color: colors.textSecondary, background: colors.bgSecondary }}>
      内容
    </div>
  )
}
```

---

## ⚠️ 注意事项

1. **不要改变语义**: 颜色名称应该反映用途，不是具体值
2. **保持向后兼容**: 如果某些颜色有特殊含义（如星标金色），应保留
3. **测试两种主题**: 每次重构后都要测试亮色和暗色主题
4. **渐进式重构**: 不要一次改太多，分批 PR
5. **文档同步**: 更新 AGENTS.md 记录新的颜色规范

---

## 📅 预计工作量

- **Terminal 组件**: 2-3 小时
- **Calendar Widget**: 1 小时
- **GitHub Widget**: 30 分钟
- **中优先级组件**: 2-3 小时
- **低优先级组件**: 1-2 小时

**总计**: 6-9 小时

---

生成时间: 2025-11-23
状态: 待重构
