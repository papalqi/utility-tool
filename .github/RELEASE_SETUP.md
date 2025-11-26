# GitHub Actions 自动发布配置说明

## 配置完成

项目已成功配置 GitHub Actions 自动构建和发布流程。

## 配置文件

### 1. `.github/workflows/release.yml`
GitHub Actions 工作流配置文件，负责：
- ✅ 在 Windows/macOS/Linux 三个平台并行构建
- ✅ 自动编译原生模块（node-pty 等）
- ✅ 打包应用程序
- ✅ 创建 GitHub Release
- ✅ 上传所有安装包
- ✅ 自动生成 Release Notes

### 2. `scripts/release/publish-electron.ps1`
发布脚本，负责：
- ✅ 更新版本号
- ✅ 提交更改
- ✅ 创建 Git tag
- ✅ 推送到 GitHub
- ✅ 触发 GitHub Actions

### 3. `package.json`
更新的配置：
- ✅ 添加 `asarUnpack` 配置，确保 Worker 文件不被打包进 asar
- ✅ 包含 `scripts/` 和 `prompts/` 目录到打包文件

### 4. `vite.config.ts`
更新的配置：
- ✅ Worker 文件（resource-monitor-worker.ts）的构建配置
- ✅ 正确的 external 依赖配置

### 5. `electron/main/resource-monitor-facade.ts`
修复打包后路径问题：
- ✅ 根据 `app.isPackaged` 动态确定 Worker 文件路径
- ✅ 支持开发和生产环境

## 使用方法

### 快速发布

```powershell
# 使用当前版本发布
npm run release

# 指定新版本发布
npm run release:version
```

### 查看构建进度

```
https://github.com/papalqi/pc-utility-tool-electron/actions
```

### 查看发布

```
https://github.com/papalqi/pc-utility-tool-electron/releases
```

## 技术细节

### 构建平台

**Windows** (windows-latest)
- 生成 `.exe` 安装包
- 使用 NSIS 打包
- 安装 Python 3.11（编译原生模块需要）

**macOS** (macos-latest)
- 生成 `.dmg` 安装包
- 生成 `.zip` 压缩包

**Linux** (ubuntu-latest)
- 生成 `.AppImage` 便携版
- 生成 `.deb` 安装包
- 安装 libxtst-dev 和 libpng++-dev

### 原生模块处理

项目依赖的原生模块：
- `@homebridge/node-pty-prebuilt-multiarch` - 终端仿真
- `systeminformation` - 系统资源监控（已弃用）

**构建步骤：**
1. 安装依赖 (`npm ci`)
2. 重建原生模块 (`npm run rebuild:all`)
3. 构建应用 (`npm run electron:build`)

### Worker 线程处理

资源监控使用 Worker 线程：
- Worker 文件：`electron/main/resource-monitor-worker.js`
- 通过 `asarUnpack` 配置解包，确保运行时可访问
- 动态路径判断：开发环境使用 `__dirname`，生产环境使用 `process.resourcesPath`

## 已修复的问题

### 1. 打包后资源监控无反应
**原因：** Worker 文件路径在打包后不正确

**修复：**
- 添加 `asarUnpack` 配置
- 修改 `resource-monitor-facade.ts` 动态判断路径
- 添加 Worker 文件的 external 配置

### 2. TypeScript 类型冲突
**原因：** `src/global.d.ts` 和 `electron/preload/index.ts` 的类型定义冲突

**修复：**
- 将 `UpdaterAPI` 类型定义移到 `preload/index.ts`
- 清空 `global.d.ts` 的冲突定义

### 3. 构建配置不完整
**原因：** 缺少完整的构建平台配置

**修复：**
- 升级 Actions 版本到最新
- 添加平台特定的依赖安装步骤
- 添加错误处理和日志输出

## 验证清单

发布前确认：
- [x] 类型检查通过 (`npm run type-check`)
- [x] GitHub Actions 配置文件存在
- [x] Worker 文件打包配置正确
- [x] 发布脚本可用
- [x] 文档已更新

## 相关文档

- `README.md` - 包含发布流程说明
- `docs/RELEASE.md` - 详细的发布指南
- `.github/workflows/release.yml` - Actions 配置

## 下一步

1. 测试发布流程：创建一个测试 tag 验证 Actions 是否正常工作
2. 监控首次构建：确保所有平台都能成功构建
3. 验证安装包：下载并测试各平台的安装包

## 注意事项

- 推送 tag 会立即触发构建，请确保代码已测试
- 构建时间约 10-15 分钟
- GitHub Actions 有使用限额，请合理使用
- 首次构建可能需要更长时间（下载依赖）
