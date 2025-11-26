# 网页存档签到功能使用指南

## 功能概述

WebArchive Widget 现在支持为每个网址配置独立的签到脚本，实现自动或手动签到功能。

## 功能特点

- ✅ **自定义脚本**：每个网址可配置独立的 JavaScript 签到脚本
- ✅ **沙箱环境**：脚本在安全的沙箱中执行
- ✅ **丰富 API**：提供 `url`、`html`、`headers`、`fetch` 等变量供脚本使用
- ✅ **结果追踪**：记录每次签到的结果和时间
- ✅ **自动签到**：支持启用自动签到（需要配合定时任务）

## 使用步骤

### 1. 添加网页并配置签到脚本

1. 点击 **"添加网页"** 按钮
2. 填写网页基本信息（URL、标题等）
3. 展开 **"签到脚本配置"** 折叠面板
4. 在文本框中编写签到脚本

### 2. 编写签到脚本

签到脚本是标准的 JavaScript 代码，运行在沙箱环境中。

#### 可用变量

- `url` (string)：目标网址
- `html` (string)：网页 HTML 内容
- `headers` (object)：配置的自定义 Headers
- `fetch(url, options)` (function)：发起 HTTP 请求

#### 返回格式

脚本必须返回一个对象：

```javascript
{
  success: boolean,    // 必需：签到是否成功
  message?: string,    // 可选：签到消息
  data?: any          // 可选：自定义数据
}
```

### 3. 脚本示例

#### 示例 1：简单 POST 请求签到

```javascript
const response = await fetch(url + '/api/checkin', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json'
  }
});

const data = await response.json();

return { 
  success: data.code === 0, 
  message: data.message || '签到完成',
  data: data
};
```

#### 示例 2：带表单数据的签到

```javascript
const formData = new URLSearchParams({
  action: 'checkin',
  token: 'your-token-here'
});

const response = await fetch(url + '/checkin', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: formData
});

const result = await response.text();

return {
  success: result.includes('签到成功'),
  message: result
};
```

#### 示例 3：从 HTML 中提取信息后签到

```javascript
// 从 HTML 中提取 CSRF token
const csrfMatch = html.match(/name="csrf_token" value="([^"]+)"/);
const csrfToken = csrfMatch ? csrfMatch[1] : '';

if (!csrfToken) {
  return {
    success: false,
    message: '无法获取 CSRF Token'
  };
}

// 使用提取的 token 进行签到
const response = await fetch(url + '/checkin', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    csrf_token: csrfToken
  })
});

const data = await response.json();

return {
  success: data.success,
  message: data.message,
  data: {
    points: data.points,
    continuous_days: data.continuous_days
  }
};
```

#### 示例 4：多步骤签到流程

```javascript
// 第一步：获取签到信息
const infoResponse = await fetch(url + '/api/checkin/info');
const info = await infoResponse.json();

if (info.already_checked) {
  return {
    success: true,
    message: '今日已签到',
    data: info
  };
}

// 第二步：执行签到
const checkinResponse = await fetch(url + '/api/checkin/do', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    challenge_id: info.challenge_id
  })
});

const result = await checkinResponse.json();

return {
  success: result.success,
  message: `签到成功！获得 ${result.points} 积分`,
  data: result
};
```

### 4. 执行签到

配置完成后，有两种方式执行签到：

1. **手动签到**：在网页列表中，点击签到按钮（LoginOutlined 图标）
2. **自动签到**：启用 "自动签到" 开关（需要配合定时任务）

### 5. 查看签到结果

- 签到成功/失败会在列表项中显示状态标签
- 鼠标悬停可查看上次签到时间
- 签到结果会持久化保存

## 注意事项

### 安全性

- ✅ 脚本在沙箱中执行，无法访问本地文件系统
- ✅ 脚本无法访问 Node.js API
- ⚠️ 请勿在脚本中硬编码敏感信息（如密码）
- ✅ 建议使用 Cookie 或 Bearer Token 进行身份验证

### 调试技巧

1. **查看网络请求**：在浏览器开发者工具中观察实际的签到请求
2. **使用 console.log**：在脚本中添加日志（会输出到 Electron 日志）
3. **错误处理**：使用 try-catch 捕获异常

```javascript
try {
  const response = await fetch(url + '/checkin', { method: 'POST' });
  const data = await response.json();
  return { success: true, message: '签到成功', data };
} catch (error) {
  return { 
    success: false, 
    message: `签到失败: ${error.message}` 
  };
}
```

### 身份验证配置

如果网站需要登录，建议：

1. 展开 **"身份验证配置"** 面板
2. 选择合适的验证方式（Cookie / Bearer Token / 自定义 Headers）
3. 使用 **"自动登录"** 功能获取 Cookie

配置的 Headers 会自动包含在 fetch 请求中。

## 测试建议

建议按以下顺序测试：

1. ✅ 添加一个公开的测试 API（如 https://httpbin.org/post）
2. ✅ 编写简单的 POST 请求脚本
3. ✅ 点击签到按钮，验证请求是否成功
4. ✅ 检查签到结果显示是否正确
5. ✅ 修改脚本，测试不同的签到逻辑

## 常见问题

### Q: 脚本报错 "签到脚本必须返回一个对象"
A: 确保脚本最后有 `return` 语句，并返回包含 `success` 字段的对象。

### Q: fetch 请求失败
A: 检查：
- URL 是否正确
- 是否需要身份验证
- CORS 是否限制请求

### Q: 如何传递 Cookie？
A: 在 "身份验证配置" 中选择 "Cookie" 方式，配置的 Cookie 会自动添加到所有请求中。

### Q: 能否使用第三方库？
A: 沙箱环境不支持导入外部模块，只能使用原生 JavaScript API。

## 技术架构

```
┌─────────────────┐
│  UI (React)     │
│  - 表单配置      │
│  - 签到按钮      │
│  - 结果显示      │
└────────┬────────┘
         │ IPC
┌────────▼────────┐
│  Main Process   │
│  - IPC Handler  │
└────────┬────────┘
         │
┌────────▼────────┐
│  web-scraper    │
│  - executeCheckIn│
│  - 沙箱执行      │
│  - 脚本验证      │
└─────────────────┘
```

## 更新日志

### v1.0.0 (2025-01-23)
- ✅ 实现自定义签到脚本功能
- ✅ 支持沙箱脚本执行
- ✅ 提供 fetch API
- ✅ 签到结果记录和显示
- ✅ 自动签到开关
