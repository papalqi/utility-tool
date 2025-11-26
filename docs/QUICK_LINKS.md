# 快捷链接功能

快捷链接卡片允许你在 Dashboard 上添加常用网址，点击即可快速打开。

## 功能特性

### ✨ 核心功能
- **添加链接**：自定义标题、网址、图标、颜色和描述
- **快速打开**：点击卡片直接用系统浏览器打开
- **编辑/删除**：支持修改和删除已添加的链接
- **本地存储**：数据保存在 localStorage，无需网络

### 🎨 自定义选项

#### 1. 基本信息
- **标题**：链接显示名称（必填）
- **网址**：完整的 URL 地址（必填，需包含 `http://` 或 `https://`）

#### 2. 视觉效果
- **图标**：支持任意 Emoji（如 🔗、🌐、📚）
- **颜色**：图标背景色，支持十六进制颜色（如 `#1890ff`）
- **描述**：简短说明，鼠标悬停时显示

## 使用方法

### 添加新链接
1. 点击卡片右上角的「添加」按钮
2. 填写链接信息：
   ```
   标题：GitHub
   网址：https://github.com
   图标：🐙
   颜色：#333333
   描述：Code hosting platform
   ```
3. 点击「保存」

### 编辑链接
1. 点击链接右侧的 ✏️ 编辑按钮
2. 修改信息
3. 点击「保存」

### 删除链接
1. 点击链接右侧的 🗑️ 删除按钮
2. 确认删除

### 打开链接
- 直接点击链接卡片即可在系统默认浏览器中打开

## 默认链接

首次使用时，系统会自动添加以下默认链接：

| 标题 | 网址 | 图标 |
|------|------|------|
| GitHub | https://github.com | 🐙 |
| Stack Overflow | https://stackoverflow.com | 📚 |
| MDN | https://developer.mozilla.org | 📖 |

你可以根据需要编辑或删除这些默认链接。

## 常见用例

### 开发工具
```
🐙 GitHub          https://github.com
📦 npm             https://npmjs.com
📚 Stack Overflow  https://stackoverflow.com
📖 MDN Docs        https://developer.mozilla.org
🎨 Ant Design      https://ant.design
```

### 设计资源
```
🎨 Figma           https://figma.com
🌈 Coolors         https://coolors.co
📐 Flaticon        https://flaticon.com
✨ Dribbble        https://dribbble.com
```

### 生产力工具
```
📝 Notion          https://notion.so
✅ Todoist         https://todoist.com
📅 Google Calendar https://calendar.google.com
📧 Gmail           https://mail.google.com
```

### AI 工具
```
🤖 ChatGPT         https://chat.openai.com
🎯 Claude          https://claude.ai
🔮 Perplexity      https://perplexity.ai
```

## 技术实现

### 数据存储
- 位置：`localStorage`
- Key: `quick_links`
- 格式：JSON 数组

```typescript
interface QuickLink {
  id: string           // 唯一标识
  title: string        // 标题
  url: string          // 网址
  icon?: string        // 图标 Emoji
  color?: string       // 背景色
  description?: string // 描述
}
```

### 打开链接
使用 Electron 的 `shell.openExternal()` API 在系统浏览器中打开链接：

```typescript
await window.electronAPI.openExternal(url)
```

## 位置

- **组件**：`src/components/widgets/QuickLinksCard.tsx`
- **集成**：`src/widgets/DashboardWidget.tsx`
- **位置**：Dashboard 侧边栏，Tasks 下方

## 数据备份

由于数据存储在 localStorage，建议定期备份：

### 导出数据
打开浏览器控制台（F12），执行：
```javascript
const links = localStorage.getItem('quick_links')
console.log(links)
// 复制输出的 JSON 字符串保存到文件
```

### 导入数据
```javascript
const backupData = '[...]' // 你的备份 JSON
localStorage.setItem('quick_links', backupData)
// 刷新页面
```

## 未来增强

可能的改进方向：
- 🔍 链接搜索和过滤
- 📁 分组/分类管理
- 🔄 云同步（Obsidian 集成）
- 📊 访问统计
- 🎯 智能推荐常用链接
- 🖼️ 支持自定义图标（URL 图片）
- 📤 导入/导出功能
- 🔐 私密链接加密

## 相关文件

- [Dashboard Widget](../src/widgets/DashboardWidget.tsx)
- [Quick Links Component](../src/components/widgets/QuickLinksCard.tsx)
- [架构文档](./ARCHITECTURE.md)
