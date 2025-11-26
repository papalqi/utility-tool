# PC Utility Tool - Electron 迁移计划

## 📋 项目概述

将现有的 PyQt6 + Python 项目迁移到 Electron + React + TypeScript 架构。

**原项目路径**: `../PC_Utility_Tool`
**新项目路径**: `./pc-utility-tool-electron`

## ✅ 已完成

### 1. 项目初始化 ✓
- [x] 创建项目文件夹并初始化 Git
- [x] 设置 Electron + Vite + React + TypeScript 构建环境
- [x] 配置 ESLint 和 Prettier
- [x] 创建基础目录结构

### 2. 核心架构 ✓
- [x] **ConfigManager** - TOML 配置文件管理
  - 支持加载、保存、热重载
  - 按主机名分段配置支持
  - 配置订阅机制
- [x] **ThemeManager** - 主题管理系统
  - 亮/暗主题切换
  - 自动时间切换
  - Ant Design 主题集成
- [x] **LogManager** - 日志系统
  - 多级别日志 (DEBUG, INFO, WARN, ERROR, CRITICAL)
  - 日志订阅和导出
- [x] **ObsidianManager** - Obsidian 集成
  - 双向同步支持
  - Secrets 文件管理
  - 模板路径解析

### 3. UI 基础组件 ✓
- [x] **TitleBar** - 自定义标题栏
- [x] **Sidebar** - 导航侧边栏
- [x] **WidgetContainer** - Widget 容器和懒加载

### 4. 自定义 Hooks ✓
- [x] **useConfig** - 配置管理 Hook
- [x] **useTheme** - 主题控制 Hook
- [x] **useObsidian** - Obsidian 集成 Hook

### 5. 类型定义 ✓
- [x] 完整的 TypeScript 类型定义
- [x] 与 Python 版本配置结构保持一致

## 🚧 进行中

### Widget 迁移

所有 Widget 已创建占位组件，接下来需要实现具体功能：

## 📝 待迁移 Widget 列表

### 1. AI CLI Widget
**Python 文件**: `src/widgets/cli_ai_widget.py`

**核心功能**:
- Claude Code 配置管理
- Codex (问问 Code) 配置管理
- 安装脚本执行
- API Key 与 Obsidian 同步
- 配置文件读写 (gaccode.json, 问问code.json)

**迁移要点**:
- 使用 IPC 调用安装脚本
- 实现 JSON 配置文件管理
- Obsidian secrets 双向同步

### 2. TODO Widget
**Python 文件**: `src/widgets/todo_widget.py`

**核心功能**:
- 任务列表 CRUD
- 分类、优先级、标签管理
- Obsidian 双向同步
- AI 剪贴板解析
- 自动保存

**迁移要点**:
- 实现任务数据模型
- 与 ObsidianManager 集成
- AI 解析功能（调用 AI API）
- 剪贴板监控

### 3. Pomodoro Widget
**Python 文件**: `src/widgets/pomodoro_widget.py`

**核心功能**:
- 工作/休息计时器
- 声音提醒
- 与 TODO 任务关联
- 统计记录

**迁移要点**:
- 计时器状态管理
- 系统通知集成
- 音频播放
- 与 TODO Widget 数据联动

### 4. Calendar Widget
**Python 文件**: `src/widgets/calendar_widget.py`

**核心功能**:
- 日历视图
- 拖拽排期
- 分类颜色标识
- 与周报模板联动

**迁移要点**:
- 日历组件选择（react-big-calendar 或 FullCalendar）
- 拖拽功能实现
- 与 Obsidian 周报同步

### 5. Script Runner Widget
**Python 文件**: `src/widgets/script_runner_widget.py`

**核心功能**:
- 批量脚本管理
- 并发执行
- 输出日志显示
- 计划任务

**迁移要点**:
- 使用 IPC 执行系统命令
- 实时输出流捕获
- 进程管理

### 6. Quick Access Widget
**Python 文件**: `src/widgets/quick_access_widget.py`

**核心功能**:
- 应用/URL 快捷方式
- 图标提取和缓存
- 分类管理

**迁移要点**:
- 应用图标提取（Windows/macOS/Linux）
- URL 打开
- 图标缓存策略

### 7. Terminal Widget
**Python 文件**: `src/widgets/console_widget.py`

**核心功能**:
- 内嵌终端
- 命令历史
- 快捷命令

**迁移要点**:
- 使用 xterm.js
- PTY 集成
- 命令历史管理

### 8. RenderDoc Widget
**Python 文件**: `src/widgets/renderdoc_widget.py`

**核心功能**:
- RenderDoc 工具管理
- 捕获文件浏览
- 快捷启动

**迁移要点**:
- 外部工具启动
- 文件系统操作
- 配置管理

### 9. ADB Widget
**Python 文件**: `src/widgets/adb_widget.py`

**核心功能**:
- 设备列表
- 文件传输
- 日志查看
- 截图录屏

**迁移要点**:
- ADB 命令封装
- 设备状态监控
- 文件上传下载进度

### 10. Project Manager Widget
**Python 文件**: `src/widgets/project_widget.py`

**核心功能**:
- 项目列表管理
- 构建配置
- 快捷操作

**迁移要点**:
- 项目数据模型
- 外部工具集成
- 自动同步

### 11. Attachment Widget
**Python 文件**: `src/widgets/attachment_widget.py`

**核心功能**:
- 文件上传
- PicGo 集成
- Markdown 格式化
- 图片预览

**迁移要点**:
- 文件拖拽上传
- PicGo API 调用
- 图片预览组件

## 🎯 迁移策略

### 按优先级迁移

**Phase 1 - 核心功能** (已完成)
1. ✅ 项目基础架构
2. ✅ 核心管理模块
3. ✅ UI 框架

**Phase 2 - 高优先级 Widget**
1. TODO Widget (最常用)
2. Pomodoro Widget (与 TODO 联动)
3. Calendar Widget (与 TODO 联动)
4. Quick Access Widget (高频使用)

**Phase 3 - 中优先级 Widget**
1. AI CLI Widget
2. Script Runner Widget
3. Terminal Widget

**Phase 4 - 低优先级 Widget**
1. RenderDoc Widget
2. ADB Widget
3. Project Manager Widget
4. Attachment Widget

### 迁移步骤（每个 Widget）

1. **分析 Python 代码**
   - 理解核心逻辑
   - 识别依赖关系
   - 提取数据模型

2. **设计 React 组件**
   - 定义组件结构
   - 设计状态管理
   - 规划 UI 布局

3. **实现功能**
   - 创建 UI 组件
   - 实现业务逻辑
   - IPC 通信（如需要）

4. **集成和测试**
   - 与核心模块集成
   - 功能测试
   - Bug 修复

5. **文档和优化**
   - 编写使用文档
   - 性能优化
   - 代码审查

## 🔧 技术映射

| Python/PyQt6 | Electron/React |
|-------------|----------------|
| QWidget | React Component |
| Signal/Slot | EventEmitter / Callback |
| QSettings | electron-store |
| QThread | Web Worker / IPC |
| QPushButton | antd Button |
| QLineEdit | antd Input |
| QTextEdit | antd TextArea |
| QTimer | setInterval/setTimeout |
| QFileDialog | electron dialog |
| subprocess | child_process (IPC) |
| TOML | @toml-tools/parser |

## 📚 依赖库

### 已添加
- antd - UI 组件库
- zustand - 状态管理
- framer-motion - 动画
- dayjs - 日期处理
- electron-store - 持久化存储

### 待添加（按需）
- xterm.js - 终端模拟
- react-beautiful-dnd - 拖拽
- react-big-calendar - 日历
- monaco-editor - 代码编辑器
- react-markdown - Markdown 渲染

## 🎨 UI 设计原则

1. **现代化**: 使用 Ant Design 5 设计语言
2. **一致性**: 保持与原项目功能逻辑一致
3. **响应式**: 支持不同窗口大小
4. **流畅性**: 使用 Framer Motion 实现平滑动画
5. **无障碍**: 考虑键盘导航和屏幕阅读器

## 📊 进度追踪

- **总进度**: 6/17 完成 (35%)
- **核心架构**: 6/6 完成 (100%)
- **Widget 迁移**: 0/11 完成 (0%)

## 🚀 下一步

1. 开始迁移 TODO Widget
2. 实现 Obsidian 双向同步测试
3. 添加必要的依赖库
4. 创建开发和构建脚本

## 📝 注意事项

1. **配置兼容性**: 保持与 Python 版本的 config.toml 格式兼容
2. **数据迁移**: 考虑从 Python 版本迁移用户数据
3. **跨平台**: 确保 Windows/macOS/Linux 都能正常运行
4. **性能**: Electron 相比 PyQt6 内存占用更大，需要优化
5. **打包**: 使用 electron-builder 统一打包策略
