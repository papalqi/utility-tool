# 文件传输 Widget 使用指南

## 概述

文件传输 Widget 提供了完整的文件管理功能，可以连接到独立的文件服务器进行文件的上传、下载和管理。

## 功能特性

### ✨ 核心功能

- **用户认证**
  - 用户注册与登录
  - JWT Token 自动管理
  - 持久化登录状态

- **文件上传**
  - 拖拽上传
  - 批量上传（支持多文件）
  - 上传进度显示
  - 最大文件大小：100MB（服务器配置）

- **文件管理**
  - 文件列表展示（表格形式）
  - 按文件名、大小、类型、时间排序
  - 存储空间使用统计

- **文件操作**
  - 下载文件
  - 删除文件（带确认）
  - 图片预览

## 服务器配置

### 默认配置

- **服务器地址**: `http://localhost:3000/api`
- **端口**: 3000

### 修改服务器地址

在 Widget 的"服务器配置"区域可以修改服务器地址。配置保存在本地存储中。

## 使用流程

### 1. 启动文件服务器

文件服务器位于：`C:\Project\pc-utility-tool-electron-server`

```powershell
# 进入服务器目录
cd C:\Project\pc-utility-tool-electron-server

# 安装依赖（首次运行）
npm install

# 启动开发服务器
npm run dev
```

服务器启动后会监听在 `http://localhost:3000`

### 2. 注册用户

首次使用需要注册账户：

1. 在 Widget 中点击"注册"标签
2. 输入用户名（至少3个字符）
3. 输入密码（至少6个字符）
4. 确认密码
5. 点击"注册"按钮

注册成功后会自动登录。

### 3. 登录

如已有账户：

1. 在"登录"标签中输入用户名和密码
2. 点击"登录"按钮

登录状态会保存在浏览器本地存储中，下次打开自动登录。

### 4. 上传文件

两种上传方式：

**方式一：拖拽上传**
- 将文件拖拽到上传区域

**方式二：选择上传**
- 点击上传区域
- 选择一个或多个文件
- 点击"开始上传"按钮

### 5. 管理文件

文件列表提供以下操作：

- **预览**：支持图片文件预览
- **下载**：下载文件到本地
- **删除**：删除文件（需要确认）

### 6. 查看存储统计

在文件列表区域可以查看：
- 文件总数
- 已使用存储空间

## 服务器 API

### 认证端点

- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录

### 文件端点（需要认证）

- `GET /api/files` - 获取文件列表
- `POST /api/files/upload` - 上传单个文件
- `POST /api/files/upload-multiple` - 上传多个文件
- `GET /api/files/:id` - 下载文件
- `DELETE /api/files/:id` - 删除文件
- `GET /api/files/storage/usage` - 获取存储使用情况

## 数据存储

### 本地存储（localStorage）

- `fileserver_token` - JWT 认证 Token
- `fileserver_user` - 用户信息
- `file-transfer-config` - 服务器配置

### 服务器存储

- 用户数据：`data/users.json`
- 文件元数据：`data/files.json`
- 文件实体：`uploads/<user-id>/`

## 安全注意事项

1. **生产环境部署**
   - 修改默认的 JWT_SECRET
   - 使用 HTTPS
   - 配置适当的 CORS 策略

2. **文件上传**
   - 服务器默认限制单个文件最大 100MB
   - 可在服务器配置中调整

3. **用户隔离**
   - 每个用户的文件存储在独立目录
   - 无法访问其他用户的文件

## 故障排查

### 无法连接服务器

1. 检查服务器是否启动
2. 检查服务器地址配置是否正确
3. 查看浏览器控制台错误信息

### 登录失败

1. 确认用户名和密码正确
2. 检查服务器日志
3. 清除浏览器缓存和 localStorage

### 上传失败

1. 检查文件大小是否超过限制
2. 确认网络连接正常
3. 查看服务器日志

## 开发说明

### Widget 位置

- 文件：`src/widgets/FileTransferWidget.tsx`
- 使用的 Hooks：
  - `useWidget` - 生命周期管理
  - `useWidgetStorage` - 本地配置存储
  - `useWidgetActions` - 刷新操作

### 扩展功能

可以考虑添加：
- 文件搜索功能
- 文件分享链接
- 上传队列管理
- 断点续传
- 文件夹支持

## 相关文档

- 服务器文档：`C:\Project\pc-utility-tool-electron-server\README.md`
- API 文档：服务器 README 中的 API Documentation 部分
- Widget 开发规范：`AGENTS.md`
