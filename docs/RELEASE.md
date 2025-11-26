# 发布流程指南

本文档说明如何发布新版本的 PC Utility Tool。

## 快速发布（推荐）

```powershell
# 方式 1: 使用当前版本发布
npm run release

# 方式 2: 指定新版本发布
npm run release:version
# 然后按提示输入版本号

# 方式 3: 直接指定版本
pwsh -ExecutionPolicy Bypass -File .\scripts\release\publish-electron.ps1 -Version "1.0.1" -Message "修复资源监控问题"
```

## 完整流程说明

### 1. 准备发布

**检查代码状态：**
```bash
# 类型检查
npm run type-check

# 代码规范检查
npm run lint

# 本地测试构建
npm run electron:build:clean
```

**确认版本号：**
- 遵循语义化版本规范（Semantic Versioning）
- 格式：`主版本.次版本.修订号`（例如 `1.2.3`）
- 主版本：不兼容的 API 修改
- 次版本：向下兼容的功能性新增
- 修订号：向下兼容的问题修正

### 2. 执行发布

**使用发布脚本：**

```powershell
# 指定版本号和发布信息
pwsh -ExecutionPolicy Bypass -File .\scripts\release\publish-electron.ps1 -Version "1.2.3" -Message "新增 XX 功能，修复 YY 问题"
```

**脚本会自动完成：**
1. ✅ 更新 `package.json` 的版本号
2. ✅ 提示处理未提交的更改
3. ✅ 创建 Git tag（例如 `v1.2.3`）
4. ✅ 推送代码和 tag 到 GitHub
5. ✅ 触发 GitHub Actions 自动构建

### 3. GitHub Actions 自动构建

推送 tag 后，GitHub Actions 会自动：

**构建平台：**
- ✅ Windows（生成 `.exe` 安装包）
- ✅ macOS（生成 `.dmg` 安装包）
- ✅ Linux（生成 `.AppImage` 和 `.deb` 包）

**自动操作：**
1. 在三个平台并行构建
2. 编译原生模块（node-pty 等）
3. 打包应用程序
4. 创建 GitHub Release
5. 上传所有安装包
6. 自动生成 Release Notes

**构建时间：** 约 10-15 分钟

### 4. 查看构建进度

**GitHub Actions 页面：**
```
https://github.com/papalqi/pc-utility-tool-electron/actions
```

**发布页面：**
```
https://github.com/papalqi/pc-utility-tool-electron/releases
```

### 5. 验证发布

构建完成后，检查：

1. **Release 页面**
   - 版本号正确
   - Release Notes 完整
   - 所有平台的安装包都已上传

2. **下载测试**
   - 下载对应平台的安装包
   - 安装并运行
   - 验证核心功能正常

3. **版本信息**
   - 应用内显示的版本号正确

## 手动发布流程

如果需要手动控制发布流程：

```bash
# 1. 修改版本号
# 编辑 package.json，更新 version 字段

# 2. 提交更改
git add .
git commit -m "chore: release v1.2.3"

# 3. 创建 tag
git tag -a v1.2.3 -m "Release v1.2.3"

# 4. 推送到 GitHub
git push origin main
git push origin v1.2.3
```

## 本地打包（仅测试用）

本地打包只能生成当前平台的安装包：

```bash
# 完整清理并构建
npm run electron:build:clean

# 构建产物在 release/ 目录
```

**限制：**
- Windows 只能打包 `.exe`
- macOS 只能打包 `.dmg`
- Linux 只能打包 `.AppImage` 和 `.deb`

## 常见问题

### 构建失败

**问题：** GitHub Actions 构建失败

**解决方案：**
1. 查看 Actions 日志，找到具体错误
2. 常见原因：
   - TypeScript 类型错误 → 运行 `npm run type-check`
   - 依赖问题 → 检查 `package.json`
   - 原生模块编译失败 → 检查 `.github/workflows/release.yml`

### Tag 已存在

**问题：** 推送 tag 时提示已存在

**解决方案：**
```bash
# 删除本地 tag
git tag -d v1.2.3

# 删除远程 tag
git push origin :refs/tags/v1.2.3

# 重新创建并推送
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3
```

或者使用发布脚本，它会自动处理：
```powershell
pwsh -ExecutionPolicy Bypass -File .\scripts\release\publish-electron.ps1 -Version "1.2.3"
# 提示 tag 已存在时选择 'y' 删除并重建
```

### 构建超时

**问题：** Actions 构建超时

**解决方案：**
- GitHub Actions 有时会因网络问题导致构建超时
- 在 Actions 页面点击"Re-run jobs"重新运行

## 发布检查清单

发布前确认：

- [ ] 代码已提交并推送
- [ ] 通过类型检查（`npm run type-check`）
- [ ] 通过代码规范检查（`npm run lint`）
- [ ] 本地测试构建成功
- [ ] 版本号遵循语义化版本规范
- [ ] Release Notes 准备完整

发布后确认：

- [ ] GitHub Actions 构建成功
- [ ] 所有平台的安装包已上传
- [ ] Release Notes 自动生成正确
- [ ] 下载并测试安装包
- [ ] 版本号显示正确

## 参考资料

- [语义化版本规范](https://semver.org/lang/zh-CN/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [electron-builder 文档](https://www.electron.build/)
