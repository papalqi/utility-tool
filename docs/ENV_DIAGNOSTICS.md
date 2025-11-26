# 环境检测与清理工具（env-diagnostics.ps1）

> 位置：`scripts/tools/env-diagnostics.ps1`

该脚本用于快速排查和修复本地开发环境（尤其是 Node.js / npm）常见问题，主要覆盖以下场景：

- PATH 变量超长、重复或缺少 Node.js 路径导致命令不可用
- npm `script-shell` / `shell` 被改写，造成 `npm run` 异常
- npm 遗留 `msbuild-path`、`python` 等历史配置影响依赖安装
- Node.js / npm 版本确认

## 基本用法

```powershell
# 交互模式运行
pwsh -ExecutionPolicy Bypass -File .\scripts\tools\env-diagnostics.ps1

# 仅执行“清理 npm 配置”（等价菜单选项 [1]）
pwsh -ExecutionPolicy Bypass -File .\scripts\tools\env-diagnostics.ps1 -AutoClean

# 恢复之前自动备份的 PATH
pwsh -ExecutionPolicy Bypass -File .\scripts\tools\env-diagnostics.ps1 -Restore
```

执行脚本后会依次显示：

1. PATH 长度、数量、是否超限或包含重复
2. Node.js 是否在 PATH 中
3. npm `script-shell` / `shell` / 过时配置项检测
4. Node.js 与 npm 版本
5. 系统 / 用户 PATH 统计信息

当检测到问题时，脚本会给出可选的修复动作。

## 菜单说明

在交互模式下，根据提示可以执行下列操作：

| 选项 | 说明 |
| ---- | ---- |
| `[1]` | 仅清理 npm 配置（推荐的默认方案） |
| `[2]` | 仅清理 PATH 重复项（需要管理员权限时会提示） |
| `[3]` | 同时执行 npm 配置与 PATH 清理 |
| `[0]` | 退出脚本，不做任何修改 |

> `-AutoClean` 参数等价于直接选择 `[1]`，方便通过自动化脚本调用。

## PATH 备份与恢复

执行 PATH 清理时，脚本会自动把用户 / 系统 PATH 备份到 `scripts/tools/备份/` 目录，文件名包含时间戳。例如：

- `system-path-20241125-220000.txt`
- `user-path-20241125-220000.txt`

若需要恢复旧 PATH，可运行：

```powershell
pwsh -ExecutionPolicy Bypass -File .\scripts\tools\env-diagnostics.ps1 -Restore
```

随后按照提示选择备份文件即可，也可以通过 `-RestoreFile` 指定完整文件名实现无人值守恢复。

## 常见问题排查流程

1. `npm run dev` 提示找不到 `vite` / `ts-node` / `electron`
   - 运行脚本并选择 `[1]` 清理 npm 配置
   - 重启终端后再执行 `npm install`
2. 安装依赖时报 `node-gyp`/`msbuild` 等奇怪错误
   - 运行脚本，检查是否存在历史配置（`msbuild-path`、`python` 等）
3. 终端提示命令不存在，但实际已经安装
   - 选择 `[2]` 清理 PATH 重复项，或检查 Node.js 是否在 PATH 中
4. 修改 PATH 后出现系统级问题
   - 使用 `-Restore` 从备份中恢复

## 日志与支持

- 所有输出均为彩色提示，方便复制粘贴到 issue / IM 用于排查
- 需要扩展检测项或新增自动化动作时，请在更新脚本的同时同步维护本文档

