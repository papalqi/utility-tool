# PC 实用工具 - Electron 版本

基于 Electron + React + TypeScript 的现代化桌面工具集

## 🚀 功能特性

- 🤖 **AI CLI 工具** - 管理 Claude Code 和 Codex 配置
- 📝 **待办事项** - 深度集成 Obsidian
- 🍅 **番茄钟** - 专注计时器，支持任务集成
- 📆 **日历** - 任务调度，支持分类管理
- ⚙️ **脚本运行器** - 执行和管理脚本
- 🚀 **快速访问** - 应用和网址快捷方式
- 💻 **终端** - 内置终端
- 🛠 **RenderDoc** - 渲染调试工具
- 📱 **ADB 管理器** - Android 调试桥工具
- 📁 **项目管理器** - 管理开发项目
- 📎 **附件管理器** - 文件和图片管理

## 🏗️ 技术栈

- **Electron** - 桌面应用框架
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Ant Design** - UI 组件库
- **Zustand** - 状态管理
- **Framer Motion** - 动画库

## 📦 安装步骤

### ⚠️ 重要提示

**请务必使用提供的安装脚本进行安装，直接运行 `npm install` 可能会遇到各种问题！**

安装脚本会自动处理：
- npm 缓存清理
- 依赖冲突解决
- 原生模块编译问题
- 常见错误修复

### 推荐安装方式（使用脚本）

根据你的操作系统选择对应的脚本：

**Windows (PowerShell) - 推荐：**
```powershell
.\install.ps1
```

**Linux/macOS：**
```bash
chmod +x install.sh
./install.sh
```

> 💡 **说明：** 根目录的 `install.ps1`/`install.bat`/`install.sh` 会自动调用 `scripts/install/` 目录下的实际安装脚本。

### ❌ 不推荐的安装方式

**不要直接运行：**
```bash
npm install  # ❌ 可能会遇到各种问题
```

如果你已经运行了 `npm install` 并遇到问题，请：
1. 删除 `node_modules` 文件夹
2. 删除 `package-lock.json` 文件
3. 使用上面的安装脚本重新安装

## 🚀 运行应用

### 开发模式

```bash
# 仅启动 Vite 开发服务器
npm run dev

# 启动完整的 Electron 开发环境（推荐）
npm run electron:dev

# 类型检查
npm run type-check

# 代码检查
npm run lint
```

### 生产构建

```bash
# 完整清理并构建（推荐）
npm run electron:build:clean

# 构建生产版本
npm run electron:build

# 仅构建不打包（用于测试）
npm run build:dir
```

**重要提示：**
- 构建产物统一输出到 `dist-electron/` 目录
- 渲染器构建到 `dist-electron/renderer/`
- 主进程构建到 `dist-electron/main/`
- Preload 脚本构建到 `dist-electron/preload/`
- 打包后的应用在 `release/` 目录

### 发布流程

项目已配置 GitHub Actions 自动构建和发布流程。

#### 自动发布（推荐）

使用发布脚本自动创建 tag 并触发 GitHub Actions：

```powershell
# 使用当前版本发布
npm run release

# 指定新版本号发布
npm run release:version
# 然后输入版本号，例如：1.0.1

# 或者直接指定版本
pwsh -ExecutionPolicy Bypass -File .\scripts\release\publish-electron.ps1 -Version "1.0.1"
```

**发布脚本会自动：**
1. 更新 `package.json` 的版本号（如果指定）
2. 提交未提交的更改
3. 创建版本 tag（例如 `v1.0.1`）
4. 推送代码和 tag 到 GitHub
5. 触发 GitHub Actions 自动构建

**GitHub Actions 会自动：**
1. 在 Windows/macOS/Linux 三个平台构建应用
2. 创建 GitHub Release
3. 上传所有安装包到 Release
4. 自动生成 Release Notes

**构建时间：** 约 10-15 分钟

**查看构建进度：**
```
https://github.com/papalqi/pc-utility-tool-electron/actions
```

#### 手动发布

如果需要手动操作：

```bash
# 1. 更新版本号
# 编辑 package.json 中的 version 字段

# 2. 提交更改
git add .
git commit -m "chore: release v1.0.1"

# 3. 创建 tag
git tag -a v1.0.1 -m "Release v1.0.1"

# 4. 推送
git push origin main
git push origin v1.0.1
```

推送 tag 后会自动触发 GitHub Actions 构建。

#### 本地打包

如果需要在本地打包（用于测试或手动分发）：

```bash
# 完整清理并构建
npm run electron:build:clean

# 构建产物在 release/ 目录
```

**注意：** 本地打包只能生成当前平台的安装包（例如在 Windows 上只能生成 `.exe`）。

### 开发日志采集

如需保留 `npm run dev` 的完整输出日志，可使用以下脚本（日志会保存到 `logs/` 目录）：

```bash
# macOS/Linux
./scripts/dev/dev-loop-with-logs.sh

# Windows PowerShell
pwsh -ExecutionPolicy Bypass -File .\scripts\dev\dev-loop-with-logs.ps1

# Windows CMD
scripts\dev\dev-loop-with-logs.cmd
```

日志文件格式：`logs/npm-dev-YYYYMMDD-HHMMSS.log`

## 配置说明

配置文件使用 TOML 格式，默认保存在根目录的 `config/config.toml`（仓库目录），用户修改会被保存到 `Saved/config.toml` 在 Saved 目录中，Saved 中的每条记录会被用相应条目信息（同键）替换。

主要配置项：

```toml
[theme]
current = "dark"           # 主题：dark 或 light
auto_switch = false        # 是否自动切换主题

[computer.你的主机名.obsidian]
enabled = true             # 是否启用 Obsidian 集成
vault_path = "/path/to/vault"  # Obsidian Vault 路径
secrets_file = "secrets.md"    # Secrets 文件名

[global.obsidian.content_files]
mode = "auto"              # 文件模式：auto 或 manual
template = "{year}-W{week}.md"  # 文件名模板
```

> **提示：** 首次运行时会自动创建默认配置文件。

## 常见问题

### 遇到问题时的处理步骤

**第一步：查看相关文档**

根据问题类型，查看对应的文档或运行对应的脚本：

1. **安装问题** → 重新运行安装脚本
   ```powershell
   .\install.ps1
   ```

2. **npm 或环境变量问题** → 运行环境检测工具
   ```powershell
   pwsh -ExecutionPolicy Bypass -File .\scripts\tools\env-diagnostics.ps1
   ```
   选择 `[1] 仅清理 npm 配置` 即可解决大部分问题

3. **Obsidian 集成问题** → 查看文档
   - `docs/OBSIDIAN_AUTO_CREATE_FILE.md` - 自动创建文件功能说明

4. **开发环境问题** → 查看日志
   - 使用 `scripts/dev/dev-loop-with-logs.ps1` 采集完整日志
   - 日志保存在 `logs/` 目录

### 具体问题解决方案

#### 问题：运行 `npm run dev` 提示找不到 vite

**解决方案：**
```powershell
# 运行环境检测工具
pwsh -ExecutionPolicy Bypass -File .\scripts\tools\env-diagnostics.ps1

# 选择 [1] 仅清理 npm 配置
# 然后重启终端
```

#### 问题：安装时出现 EINTEGRITY 错误

**解决方案：**
```powershell
# 重新运行安装脚本
.\install.ps1
```

#### 问题：PATH 环境变量过长

**解决方案：**
```powershell
# 运行环境检测工具
pwsh -ExecutionPolicy Bypass -File .\scripts\tools\env-diagnostics.ps1

# 选择 [2] 仅清理 PATH 重复项
# 注意：清理后需要重启计算机
```

#### 问题：打包后程序显示纯白屏

**原因：**
- 渲染器构建路径与主进程加载路径不匹配

**已修复：**
- `vite.config.ts` 中添加了 `build.outDir: 'dist-electron/renderer'`
- 统一所有构建产物到 `dist-electron/` 目录
- 使用 `npm run electron:build:clean` 确保完全清理旧构建

**解决方案（如果还遇到）：**
```bash
# 完全清理并重新构建
npm run clean:build
npm run electron:build
```

#### 问题：应用无法启动

**检查步骤：**
1. 确认 Node.js 版本（推荐 v20.17.0 或更高）
2. 重新运行安装脚本
3. 确保 `config/config.toml` 在根据仓库目录下有读写权限为默认配置，而且 `Saved/config.toml`（如果已存在）也应该不具有覆盖写权限
4. 查看终端错误信息

#### 问题：Obsidian 文件不存在

**说明：**
- 应用会自动创建不存在的模板文件（空文件）
- 详见：`docs/OBSIDIAN_AUTO_CREATE_FILE.md`

### 开发提示

- 提交代码前运行 `npm run type-check` 检查类型错误
- 提交代码前运行 `npm run lint` 检查代码规范
- 使用 Chrome DevTools (F12) 调试渲染进程
- 查看主进程日志了解后台错误

#### UI 稳定性：避免布局抖动

**症状**：组件加载时出现视觉抖动、闪烁、按钮位置移动

**常见原因**：
1. 状态消息文字宽度变化
2. 按钮从无到有的渲染
3. framer-motion 初始动画
4. CSS 过渡效果

**解决方案**：
- 动态内容使用固定宽度（`minWidth`）
- 按钮始终渲染，只在不可用时禁用
- 禁用首次加载动画（`initial={false}`, `animated={false}`）
- 禁用不必要的过渡（`transition: 'none'`）

详见 `CLAUDE.md` 的"UI 稳定性：避免布局抖动"章节。

## 📚 相关文档

- `CLAUDE.md` - Claude AI 开发指南
- `AGENTS.md` - CodeX 开发指南
- `ARCHITECTURE.md` - 架构设计文档
- `GETTING_STARTED.md` - 快速入门指南
- `docs/OBSIDIAN_AUTO_CREATE_FILE.md` - Obsidian 自动创建文件功能
- `docs/ENV_DIAGNOSTICS.md` - 环境检测与清理工具说明
- `docs/OPEN_SOURCE_TODO.md` - 对外开源前的敏感信息检查清单

## 🛠️ 实用工具

项目提供了以下实用工具脚本：

### 安装脚本
- `install.ps1` / `install.bat` / `install.sh` - 自动安装依赖

### 环境工具
- `scripts/tools/env-diagnostics.ps1` - 检测和清理环境问题
  - 检测 PATH 环境变量
  - 检测 npm 配置
  - 清理过时配置
  - 清理 PATH 重复项

### 日志工具
- `scripts/dev/dev-loop-with-logs.ps1` - 采集开发日志

## 📄 许可证

MIT License

## 🔗 相关项目

- Python 原版：`../PC_Utility_Tool`

## 📞 获取帮助

遇到问题时：
1. 查看上面的"常见问题"章节
2. 运行对应的检测或修复脚本
3. 查看相关文档
4. 提交 Issue 并附上错误日志
