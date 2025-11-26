# Open Source Sanitization Checklist

为公开此仓库，需要提前检查并清理以下硬编码信息，确保不会泄露内部路径、账户或服务器地址。

## 1. Saved/config.toml
- 当前 `Saved/config.toml` 作为示例配置存在，但最终应 **删除或替换为模板文件**，避免把真实机器主机名、Obsidian 路径或个人分类暴露在仓库里。
- 如果需要保留样例，可重命名为 `Saved/config.example.toml` 并在 README 中说明拷贝方式。
- 所有 `computer.*.obsidian`、`web_archive.*`、`file_transfer.server_url` 等字段必须确认已经替换为示例值（本仓库已改为本地示例，发布前仍建议再次确认）。

## 2. 项目构建脚本（scripts/project-tools/mha）
- `build-unreal-target.bat`、`compile-typescript.bat`、`open-in-rider.bat`、`revert-perforce.bat`、`sync-perforce.bat` 仍需要用户在本地替换为真实的工作区路径、P4 服务器等信息。
- 在 README 或 Wiki 中明确说明这些脚本的配置项及敏感字段（P4 用户名、服务器地址、工作目录）应保存在私有环境变量或由用户自行填写。

## 3. Release & CI
- `scripts/release/publish-electron.ps1` / `.sh` 会在发布时读取 `package.json` 并推送 tag，确保 CI 中没有硬编码的个人 Git 远程。
- 如果内部仍有 `Saved/` 目录或其他私有文件夹，请在 `.gitignore` 中忽略并在文档中强调。

## 4. 账号 / Token 管理
- 本项目依赖的 API Key（如 Claude、OpenAI）必须从环境变量或 Obsidian secrets 中读取，**不要** 提供默认值或测试 key。
- 检查 `prompts/`、`docs/`、`scripts/` 中是否包含演示 token/账号，如有请改成 `<YOUR_API_KEY>` 形式。

## 5. 二进制产物
- 确认 `logs/`、`release/`、`dist-electron/` 等目录在 `.gitignore` 中，防止上传包含调试日志或构建产物。

完成以上检查后，再执行一次全局搜索（IP、域名、用户名、路径等关键字）验证仓库中不再含有隐私信息。
