# WebArchive 存储架构说明

## 概述

WebArchive Widget 采用 **混合存储架构**，将数据分为两部分：

1. **静态配置** → 存储在 `config.toml`
2. **运行时数据** → 存储在 `localStorage`

## 存储架构

```
┌──────────────────────────────────────┐
│         WebArchive Widget            │
└─────────┬──────────────┬─────────────┘
          │              │
          ▼              ▼
┌─────────────────┐  ┌──────────────────┐
│  config.toml    │  │  localStorage    │
│  (静态配置)      │  │  (运行时数据)     │
└─────────────────┘  └──────────────────┘
```

## 数据分类

### config.toml 中的静态配置

位置：`[web_archive]` 段落

包含以下字段：
- ✅ `id` - 唯一标识符
- ✅ `url` - 网页地址
- ✅ `title` - 标题
- ✅ `description` - 描述
- ✅ `tags` - 标签
- ✅ `crawlMode` - 抓取模式
- ✅ `autoRefresh` - 是否自动刷新
- ✅ `refreshInterval` - 刷新间隔
- ✅ `headers` - HTTP Headers（身份验证）
- ✅ `checkInScript` - 签到脚本
- ✅ `autoCheckIn` - 是否自动签到
- ✅ `createdAt` - 创建时间

**特点**：
- 可直接编辑 config.toml 文件
- 跨设备同步（通过配置文件）
- 适合备份和版本控制

### localStorage 中的运行时数据

Key: `web-archive-runtime`

包含以下字段（按 ID 索引）：
- ✅ `lastCrawled` - 最后抓取时间
- ✅ `status` - 当前状态（idle/crawling/success/error）
- ✅ `error` - 错误信息
- ✅ `content` - 抓取的内容（HTML、文本等）
- ✅ `lastCheckIn` - 最后签到时间
- ✅ `checkInResult` - 签到结果
- ✅ `updatedAt` - 更新时间

**特点**：
- 自动管理，无需手动编辑
- 本地存储，不同步
- 运行时生成的临时数据

## 示例配置

### config.toml 示例

```toml
[web_archive]

[[web_archive.items]]
id = "1732348800000-abc123"
url = "https://example.com"
title = "示例网站"
description = "每日签到网站"
tags = ["签到", "论坛"]
crawlMode = "metadata"
autoRefresh = true
refreshInterval = 60
checkInScript = """
const response = await fetch(url + '/checkin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});
const data = await response.json();
return { success: data.success, message: data.message };
"""
autoCheckIn = true
createdAt = 1732348800000

[web_archive.items.headers]
Cookie = "session=abc123; token=xyz789"

[[web_archive.items]]
id = "1732348900000-def456"
url = "https://example2.com"
title = "另一个网站"
crawlMode = "text"
autoRefresh = false
refreshInterval = 60
createdAt = 1732348900000
```

### localStorage 数据结构

```json
{
  "1732348800000-abc123": {
    "id": "1732348800000-abc123",
    "lastCrawled": 1732349000000,
    "status": "success",
    "content": {
      "title": "示例网站 - 首页",
      "description": "欢迎来到示例网站",
      "images": ["https://example.com/logo.png"],
      "timestamp": 1732349000000,
      "size": 12345
    },
    "lastCheckIn": 1732349100000,
    "checkInResult": {
      "success": true,
      "message": "签到成功，获得 10 积分",
      "timestamp": 1732349100000
    },
    "updatedAt": 1732349100000
  },
  "1732348900000-def456": {
    "id": "1732348900000-def456",
    "status": "idle",
    "updatedAt": 1732348900000
  }
}
```

## 数据迁移

如果您之前使用的是旧版本（所有数据都在 localStorage 中），可以按以下步骤迁移：

### 方法 1：自动迁移（推荐）

新版本会自动检测旧数据并提示迁移。

### 方法 2：手动迁移

1. **导出旧数据**：
   - 打开浏览器开发者工具（F12）
   - 进入 Console 标签
   - 执行：`console.log(localStorage.getItem('web-archive-items'))`
   - 复制输出的 JSON

2. **转换为配置格式**：
   - 提取静态配置字段到 `config.toml`
   - 保留运行时数据在 localStorage

3. **重启应用**：
   - 新版本会自动合并两个数据源

## 优势

### 1. 配置同步
- 通过 Git 同步 config.toml
- 多设备共享网址配置和脚本

### 2. 数据隔离
- 运行时数据不会污染配置文件
- 配置文件保持简洁易读

### 3. 灵活性
- 可以直接编辑 config.toml 添加网址
- 运行时数据自动管理

### 4. 备份
- 配置文件易于备份和恢复
- 运行时数据可选择性备份

## 故障排除

### Q: 添加的网址没有保存
A: 检查以下内容：
1. config.toml 文件是否可写
2. 控制台是否有错误信息
3. 配置文件格式是否正确

### Q: 抓取的内容丢失了
A: 运行时数据存储在 localStorage，可能的原因：
1. 浏览器缓存被清理
2. 应用重新安装
3. 用户数据目录更改

解决方案：重新抓取即可。

### Q: 如何备份所有数据？
A: 需要备份两部分：
1. 复制 `config.toml` 文件（或整个 config 目录）
2. 导出 localStorage 数据（开发者工具 → Application → Local Storage）

### Q: 如何在多台电脑之间同步？
A: 
1. **配置同步**：将 config.toml 加入 Git 仓库
2. **运行时数据不同步**：每台电脑独立维护

## 数据存储位置

### config.toml
- **Windows**: `C:\Project\pc-utility-tool-electron\config\config.toml`
- **用户配置覆盖**: `Saved\config.toml`（如果存在）

### localStorage
- **Windows**: `%APPDATA%\<AppName>\Local Storage\leveldb\`
- **macOS**: `~/Library/Application Support/<AppName>/Local Storage/`
- **Linux**: `~/.config/<AppName>/Local Storage/`

## 技术实现

```typescript
// 静态配置（config.toml）
const { config } = useWidgetConfig<WebArchiveConfig>({
  section: 'web_archive',
  defaultConfig: { items: [] }
})

// 运行时数据（localStorage）
const { value: runtimeData } = useWidgetStorage<Record<string, WebArchiveRuntimeData>>({
  key: 'web-archive-runtime',
  defaultValue: {}
})

// 合并视图
const items = config.items.map(configItem => ({
  ...configItem,
  ...(runtimeData[configItem.id] || defaultRuntime)
}))
```

## 最佳实践

1. **配置管理**：
   - 在 config.toml 中维护网址列表
   - 使用 Git 管理配置文件

2. **脚本开发**：
   - 在 config.toml 中编写签到脚本
   - 便于版本控制和分享

3. **数据清理**：
   - 定期清理无用的运行时数据
   - 删除配置项会自动清理对应的运行时数据

4. **备份策略**：
   - 配置文件：加入 Git 或定期备份
   - 运行时数据：按需备份（可重新生成）
