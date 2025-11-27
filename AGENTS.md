# 仓库指南
---
description: Agent Rule
---
## 核心原则

- 遇到问题必须按照第一性原理抽丝剥茧，定位本质后真正解决，而不是绕开。
- 不要我说一个做一个，我需要完整的功能，多发动主观能动性，而不是我说了一个你就只做这个，多思考。

## 语言与编码
- 沟通使用中文，但代码、文件名与标识符统一使用英文。
- 全项目采用 UTF-8 编码，禁止使用 GB2312 或其他不一致的编码格式。
## 交互与基本约束

- 在 Windows 环境执行命令时必须使用 `pwsh`（禁止 `bash`）；若发现 `powershell -NoLogo/-NoProfile/-Command <script>` 形式，重写为 `pwsh -c <script>` 并移除多余参数。


- 遇到多次复发的问题且已解决时，需要在本文件记录问题与解决方法，精炼描述即可。
- 文档归档在 `docs/`，评估价值后再记录，尽量复用现有文档文件而非频繁新建。


## 测试与类型检查

- 对复杂功能编写单元测试并放入 `test/` 目录，确保功能可验证。
- 每次开发完成后务必执行类型检查，保证无类型错误。


## 日志要求

- 项目完全由 AI 驱动，日志是定位问题的根基；实现功能时要输出足够信息，方便根据日志排查。

## 文件操作与搜索
- 读取文件、列目录优先使用函数工具（`read_file` / `list_dir`）；不得用 `cat`、`Get-Content`、`fd` 等命令替代。
- 查找普通文本使用 `grep_files`，禁止 `rg`/`grep`；查找符号（变量/函数等）优先 `sg (AST-grep)`。
- 需要拆分/提取文本时保持 ASCII，除非原文件已有其它字符集。



## 关于 Agents.md

不要把技术细节或者问题写入 agents.md 你如果要写就写抽线的内容，形而上的，而不是就事论事，写的是方法论。


## 仓库结构速览
- `src/`：React 渲染层。`pages/` 提供完整页面，`widgets/` 为轻量小部件，`hooks/` 存放共享 Hook，Obsidian 集成逻辑位于 `src/core/`。
- `electron/`：主进程（`main/index.ts`、`config.ts`、`pty-manager.ts`）与 `preload/` 桥接脚本。
- `config/` 保存默认 TOML 配置；用户覆盖项写入 `Saved/config.toml`，Saved 中的值优先生效。
- `packages/` 承载 Node 侧扩展（`server/`、`shared/`），`prompts/` 收集 AI/自动化提示，`reports/` 存储审查记录，`docs/` 包含架构/流程/Obsidian/网络存档等指南。
- `release/` 为构建产物，`dist-electron/` 是临时分发目录，`scripts/` 包含安装和日志辅助脚本。

## 构建与运行
- `npm run electron:dev`：Electron+Vite 开发循环（热重载）。
- `npm run dev`：仅 Vite 渲染器，适合纯 UI 开发。
- `npm run type-check`：`tsc --noEmit`。
- `npm run lint` / `npm run format`：ESLint、Prettier。
- `npm run electron:build`：`vite build` + `electron-builder` 生成发布版本；如需复现渲染器日志，使用 `./scripts/dev/dev-loop-with-logs.sh`、`pwsh -ExecutionPolicy Bypass -File .\scripts\dev\dev-loop-with-logs.ps1` 或 `scripts\dev\dev-loop-with-logs.cmd`，日志输出到 `logs/npm-dev-*.log`。

## 编码风格与数据
- 技术栈：TypeScript + React 18 + Ant Design，统一使用函数式组件与 Hooks；缩进两个空格，无分号，由 Prettier/ESLint 控制格式。
- 渲染器禁止直接访问 Node API，所有系统交互都经 `window.electronAPI`。
- Widget 必须使用 Hook 堆栈（`useWidget`、`useWidgetActions`、`useWidgetStorage`、`useWidgetObsidian`、`WidgetLayout`）并在同文件内声明 `WidgetMetadata`。
- 用户数据写入 Obsidian Vault Markdown；UI 状态使用 widget storage/localStorage；配置合并顺序为默认 `config/` -> 用户 `Saved/`；Obsidian 配置按 `config.computer[hostname].obsidian` 区分主机，Vault 缺失时需优雅降级。

## UI 与小部件要求
- **布局稳定性**：状态消息/按钮预留固定宽度或保持渲染（仅禁用）；初次渲染禁用 framer-motion `initial`、Tabs `animated`；无必要时移除 CSS 过渡（`transition: 'none'`）；空状态用 `\u00A0` 等占位；所有状态变化需保持布局不抖动。
- Widget UI 需使用 `WidgetLayout` 包裹并用 `WidgetSection` 拆分逻辑区域。
- 提供 `setStatus`/`setError` 的可视反馈，并通过 `widgetLogger` 记录关键操作；Obsidian 禁用时需暴露模拟数据方便设计验证。
- 小部件副作用统一放在 Hook 中；渲染代码不直接触碰文件系统。

## 测试与验证
- 暂无专用测试框架，依赖 `npm run type-check`、针对性手动测试（Obsidian 启用/禁用、自动同步、IPC、PTY）。
- 若新增测试/脚本，与功能放在同目录（如 `src/widgets/__tests__/`），并在 README 或此文档补充说明。

## 工作流与预期
- 任何范围调整先更新本文件再开发，禁止“默默”变更。
- `pcdev` 为实验分支，每轮同步前需对 `origin/master...origin/pcdev` 差异做书面审查并制定实施计划。
- “剩余组件”（日历、脚本、快速访问、RenderDoc、终端、附件）必须升级为基于 Hook 的完整实现；项目组件仅负责任务编排，终端体验迁移到独立终端组件。
- 锚定在 Obsidian 的数据（项目、脚本目录、AI 配置等）在离线时也能读写 Vault，缓存仅只读副本。

## 审查、提交与文档
- 拉取代码前检查 `origin/master...origin/pcdev`，记录风险、回归和测试缺口；每次运行后更新 `reports/pcdev-review.md`，用严重等级、重现步骤、阻塞/非阻塞标记列出所有变更；审查结果与功能提交分离。
- 提交信息保持命令式、聚焦单一主题；PR 需说明意图、风险区域（Obsidian 同步、IPC、原生模块）及 UI 前后对比，并列出验证步骤（类型检查、lint、本地构建等）。
- 架构/流程/Obsidian/网络归档等扩展说明位于 `docs/`；引用这些文档时保持一致，并在变更前确认其是否需要同步更新。

## TODO 记录与清理
- 仅在明确指令下记录：只有当用户明确要求记录 TODO 时，才将未完成事项写入 `TODO.md`；未要求时不向其中写入。
- `TODO.md` 仅承载“未完成”的内容，不记录已完成事项的历史。
- 当用户要求清理 TODO：
  - 逐条核对并处理每一项；
  - 确认完成后，从 `TODO.md` 中删除对应条目；
  - 全部条目处理完毕后，清空剩余条目，保持文档整洁。
