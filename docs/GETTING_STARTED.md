# 🚀 快速开始指南

## 📋 前置要求

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **Git**: 最新版本

## 💻 安装依赖

```bash
cd pc-utility-tool-electron
npm install
```

这将安装所有必要的依赖包，包括：
- Electron
- React 18
- TypeScript
- Vite
- Ant Design
- 其他工具库

## 🏃 运行开发模式

```bash
npm run electron:dev
```

这会：
1. 启动 Vite 开发服务器（端口 5173）
2. 自动启动 Electron 窗口
3. 支持热重载（修改代码自动刷新）

## 🔧 可用命令

| 命令 | 说明 |
|-----|------|
| `npm run dev` | 仅启动 Vite 开发服务器 |
| `npm run electron:dev` | 启动完整的 Electron 开发环境 |
| `npm run build` | 构建生产版本 |
| `npm run electron:build` | 打包 Electron 应用 |
| `npm run type-check` | TypeScript 类型检查 |
| `npm run lint` | ESLint 代码检查 |
| `npm run format` | Prettier 代码格式化 |

## 📂 配置文件

### config/config.toml

应用的主配置文件，与 Python 版本兼容。示例：

```toml
[theme]
current = "dark"
auto_switch = false

[pomodoro]
work_duration = 25
short_break_duration = 5
long_break_duration = 15

[computer.your-hostname.obsidian]
enabled = true
vault_path = "/path/to/your/vault"
secrets_file = "secrets.md"
```

## 🎨 开发工作流

### 1. 创建新 Widget

```typescript
// src/widgets/MyWidget.tsx
import { Card, Typography } from 'antd'

const MyWidget = () => {
  return (
    <div>
      <Typography.Title level={2}>My Widget</Typography.Title>
      <Card>
        <p>Widget content here</p>
      </Card>
    </div>
  )
}

export default MyWidget
```

### 2. 注册到 Sidebar

在 `src/components/Sidebar.tsx` 添加菜单项：

```typescript
{
  key: 'my-widget',
  icon: <YourIcon />,
  label: 'My Widget',
}
```

### 3. 添加到 WidgetContainer

在 `src/components/WidgetContainer.tsx` 添加路由：

```typescript
const MyWidget = lazy(() => import('../widgets/MyWidget'))

// 在 renderWidget 中添加 case
case 'my-widget':
  return <MyWidget />
```

## 🔌 使用核心管理器

### ConfigManager

```typescript
import { useConfig, useConfigUpdate } from '@/hooks/useConfig'

const MyComponent = () => {
  const config = useConfig()
  const { updateSection } = useConfigUpdate()

  const updateTheme = async (theme: 'light' | 'dark') => {
    await updateSection('theme', { ...config.theme, current: theme })
  }

  return <div>Current theme: {config.theme.current}</div>
}
```

### ThemeManager

```typescript
import { useTheme } from '@/hooks/useTheme'

const MyComponent = () => {
  const { theme, toggleTheme, isDark } = useTheme()

  return (
    <button onClick={toggleTheme}>
      Switch to {isDark ? 'light' : 'dark'} mode
    </button>
  )
}
```

### ObsidianManager

```typescript
import { useObsidian } from '@/hooks/useObsidian'

const MyComponent = () => {
  const { syncTodoItems, readSecrets } = useObsidian()

  const sync = async () => {
    await syncTodoItems(items, '{year}-W{week}.md')
  }

  return <button onClick={sync}>Sync to Obsidian</button>
}
```

## 🐛 调试

### 开发者工具

- **打开 DevTools**: `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows/Linux)
- **重新加载**: `Cmd+R` (Mac) / `Ctrl+R` (Windows/Linux)

### 日志查看

```typescript
import { logManager } from '@/core/LogManager'

// 记录日志
logManager.info('Something happened', { data: 'context' })
logManager.error('Error occurred', error)

// 获取日志
const logs = logManager.getLogs()
console.log(logs)
```

## 📦 构建和打包

### 开发构建

```bash
npm run build:dir
```

这会在 `release` 目录生成未打包的应用文件，用于测试。

### 生产打包

```bash
npm run electron:build
```

生成的安装包位于 `release` 目录：
- **Windows**: `.exe` NSIS 安装器
- **macOS**: `.dmg` 磁盘镜像
- **Linux**: `.AppImage` / `.deb`

## 🔗 与 Python 版本的关系

### 配置文件兼容

Electron 版本使用相同的 `config.toml` 格式，可以：
1. 从 Python 版本复制配置文件
2. 两个版本共享同一个配置文件（注意文件路径）

### Obsidian 集成

两个版本可以使用同一个 Obsidian vault：
- 相同的文件模板格式
- 相同的 secrets 文件位置
- 相同的同步机制

## 📚 学习资源

### 官方文档
- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Ant Design](https://ant.design/)

### 项目文档
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 架构设计
- [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) - 迁移计划
- [README.md](./README.md) - 项目概述

## ❓ 常见问题

### 1. 端口被占用

如果 5173 端口被占用，修改 `vite.config.ts`：

```typescript
server: {
  port: 5174  // 改成其他端口
}
```

### 2. Electron 启动失败

检查 Node.js 版本：
```bash
node --version  # 应该 >= 18.0.0
```

### 3. 依赖安装失败

尝试清理缓存：
```bash
rm -rf node_modules package-lock.json
npm install
```

### 4. TypeScript 报错

运行类型检查：
```bash
npm run type-check
```

## 🤝 贡献

查看原 Python 项目的功能，帮助迁移到 Electron：
1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/widget-name`)
3. 提交更改 (`git commit -m 'feat: add widget'`)
4. 推送到分支 (`git push origin feature/widget-name`)
5. 创建 Pull Request

## 📝 下一步

1. **熟悉项目结构**: 浏览 `src/` 目录
2. **运行开发模式**: `npm run electron:dev`
3. **查看迁移计划**: [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)
4. **选择一个 Widget 开始迁移**: 推荐从 TODO Widget 开始

Happy coding! 🎉
