# 网页存档身份验证指南

## 概述

网页存档组件现已支持身份验证功能，可以抓取需要登录的网页内容。

## 支持的验证方式

### 1. Cookie 方式（推荐）

**适用场景**：大多数需要登录的网站

**操作步骤**：
1. 在浏览器中登录目标网站
2. 打开浏览器开发者工具（F12）
3. 切换到 **Network** 标签
4. 刷新页面，点击任意请求
5. 在 **Headers** 中找到 `Cookie` 字段
6. 复制完整的 Cookie 值
7. 在网页存档的"身份验证配置"中选择"Cookie"
8. 粘贴 Cookie 值

**示例**：
```
session_id=abc123def456; user_token=xyz789; remember_me=true
```

### 2. Bearer Token 方式

**适用场景**：使用 API Token 的服务（如 GitHub、GitLab）

**操作步骤**：
1. 从服务提供商获取 API Token
2. 在"身份验证配置"中选择"Bearer Token"
3. 粘贴 Token 值（无需添加 "Bearer " 前缀，系统会自动添加）

**示例**：
```
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. 自定义 Headers 方式

**适用场景**：需要特殊 HTTP Headers 的 API 或服务

**操作步骤**：
1. 在"身份验证配置"中选择"自定义 Headers"
2. 输入 JSON 格式的 Headers

**示例**：
```json
{
  "Authorization": "Bearer token123",
  "X-API-Key": "your-api-key",
  "X-Custom-Header": "custom-value"
}
```

## 如何获取 Cookie（详细步骤）

### Chrome / Edge 浏览器

1. 访问并登录目标网站
2. 按 `F12` 打开开发者工具
3. 切换到 **Network** 标签
4. 刷新页面（`F5` 或 `Ctrl+R`）
5. 在请求列表中点击第一个请求（通常是网页主文档）
6. 在右侧面板的 **Headers** 部分向下滚动
7. 找到 **Request Headers** 下的 `Cookie:` 字段
8. 右键点击值，选择"Copy value"

### Firefox 浏览器

1. 访问并登录目标网站
2. 按 `F12` 打开开发者工具
3. 切换到 **网络** 标签
4. 刷新页面
5. 点击任意请求
6. 在右侧找到 **请求头**
7. 找到 `Cookie` 字段并复制

## 安全注意事项

⚠️ **重要提醒**：

1. **Cookie 和 Token 是敏感信息** - 不要与他人分享
2. **定期更新** - 某些网站的 Cookie 会过期，需要重新获取
3. **本地存储** - 身份验证信息存储在本地，不会上传到云端
4. **账号安全** - 建议使用专门的账号进行自动化抓取
5. **遵守网站条款** - 确保您的抓取行为符合目标网站的使用条款

## 常见问题

### Q: Cookie 失效怎么办？
A: 重新在浏览器中登录，获取新的 Cookie 并更新配置。

### Q: 抓取仍然显示未登录？
A: 
1. 确认 Cookie 完整复制（包括所有字段）
2. 检查网站是否需要额外的验证头（如 User-Agent）
3. 尝试使用"自定义 Headers"方式，添加更多必要的 Headers

### Q: 如何验证配置是否正确？
A: 点击"抓取"按钮手动测试，查看返回的内容是否正确。

### Q: 支持双因素认证（2FA）吗？
A: 可以。在浏览器完成 2FA 后，复制 Cookie 即可。Cookie 中已包含认证信息。

## 最佳实践

1. **测试优先** - 添加新网页后先手动抓取一次，确认配置正确
2. **备注说明** - 在"描述"字段记录 Cookie 获取时间和有效期
3. **批量配置** - 同一网站的多个页面可以使用相同的身份验证配置
4. **定期检查** - 如果自动刷新失败，检查是否需要更新 Cookie

## 技术实现

- 身份验证信息存储在 `WebArchiveItem.headers` 字段
- 抓取时自动将 headers 添加到 HTTP 请求中
- 支持所有标准 HTTP Headers
- 使用 Node.js 原生 `fetch` API 进行请求

## 示例：抓取 GitHub 私有仓库

1. 生成 GitHub Personal Access Token：
   - Settings → Developer settings → Personal access tokens → Generate new token
   - 选择 `repo` 权限
   
2. 配置存档：
   - URL: `https://github.com/username/private-repo`
   - 验证方式: Bearer Token
   - Token: 粘贴您的 PAT

3. 保存并抓取

## 支持与反馈

如有问题或建议，请在项目仓库提交 Issue。
