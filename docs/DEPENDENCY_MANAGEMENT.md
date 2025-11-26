# 依赖管理最佳实践

## 问题：为什么不同机器的 package-lock.json 会不同？

### 常见原因

1. **npm 版本不同**
   - npm 5.x vs 7.x vs 9.x 生成的 lock 文件格式不同
   - 解决方案：团队统一使用相同版本

2. **操作系统差异**
   - 原生模块（如 `node-pty`）在不同平台有不同的依赖
   - Windows/macOS/Linux 的构建工具链不同

3. **依赖版本范围解析**
   - `^1.0.0` 在不同时间可能解析到不同的次版本
   - 解决方案：使用 `package-lock.json` 锁定版本

4. **npm registry 镜像源**
   - 官方源 vs 淘宝镜像的元数据可能不同
   - 解决方案：团队统一使用相同源

5. **缓存污染**
   - 本地缓存包含过期/损坏的包信息

---

## ✅ 最佳实践

### 1. 团队协作规范

#### 统一 npm 版本
```bash
# 检查当前版本
npm --version

# 建议使用 npm 9.x+
npm install -g npm@latest
```

在 `package.json` 中声明（已配置）：
```json
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

#### 统一 registry 源
```bash
# 团队使用官方源
npm config set registry https://registry.npmjs.org/

# 或在项目 .npmrc 中配置（取消注释）
# registry=https://registry.npmjs.org/
```

---

### 2. Git 工作流

#### 提交 `package-lock.json`
```bash
# ✅ 必须提交 lock 文件
git add package-lock.json
git commit -m "chore: update dependencies"
```

**永远不要** 添加到 `.gitignore`！

#### 拉取代码后重新安装
```bash
# 拉取最新代码
git pull

# 重新安装（使用 lock 文件）
npm ci  # ✅ 推荐：严格按照 lock 文件安装

# 或者
npm install  # ⚠️ 会更新 lock 文件
```

**`npm ci` vs `npm install` 的区别**：
- `npm ci`：删除 `node_modules` 并严格按照 lock 文件安装（CI/CD 推荐）
- `npm install`：可能更新 lock 文件（本地开发可用）

---

### 3. 处理 lock 文件冲突

当多人协作时，`package-lock.json` 可能产生 Git 冲突。

#### 解决步骤
```bash
# 1. 拉取最新代码（会产生冲突）
git pull

# 2. 删除冲突的 lock 文件和 node_modules
rm -rf node_modules package-lock.json

# 3. 重新安装（会生成新的 lock 文件）
npm install

# 4. 测试应用是否正常
npm run electron:dev

# 5. 提交新的 lock 文件
git add package-lock.json
git commit -m "chore: resolve package-lock.json conflicts"
```

---

### 4. 清理和重建

当遇到莫名其妙的依赖问题时：

```bash
# 完整清理
npm run clean        # 删除 node_modules 和 lock 文件
npm run clean:cache  # 清理 npm 缓存

# 重新安装
npm install

# 重建原生模块（本项目需要）
npm run rebuild:all
```

---

### 5. 检查依赖健康度

#### 检查过时的依赖
```bash
# 查看可更新的包
npm outdated

# 安全审计
npm audit

# 自动修复安全问题
npm audit fix
```

#### 更新依赖
```bash
# 更新次版本（安全）
npm update

# 更新主版本（谨慎！）
npx npm-check-updates -u
npm install
```

---

## ⚠️ 常见错误

### ❌ 错误做法
```bash
# ❌ 不要忽略 lock 文件
echo "package-lock.json" >> .gitignore

# ❌ 不要手动编辑 lock 文件
vim package-lock.json

# ❌ 不要在不理解的情况下删除 lock 文件
rm package-lock.json
```

### ✅ 正确做法
```bash
# ✅ 提交 lock 文件
git add package-lock.json

# ✅ 使用 npm 命令管理依赖
npm install package-name

# ✅ 使用 npm ci 进行干净安装
npm ci
```

---

## 🔧 本项目特殊注意事项

### 原生模块 (`node-pty`)

本项目使用 `@homebridge/node-pty-prebuilt-multiarch`，需要特殊处理：

```bash
# 安装依赖后自动重建（已配置 postinstall）
npm install

# 手动重建
npm run rebuild:all
```

**平台要求**：
- Windows: Visual Studio Build Tools
- macOS: Xcode Command Line Tools
- Linux: build-essential

---

## 📋 检查清单

在提交代码前确认：

- [ ] `package-lock.json` 已提交
- [ ] 本地运行 `npm run electron:dev` 正常
- [ ] 运行 `npm run type-check` 无错误
- [ ] 运行 `npm audit` 无严重安全问题
- [ ] 如果更新了依赖，在 commit message 中说明原因

---

## 📚 参考资源

- [npm package-lock.json 官方文档](https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json)
- [npm ci 命令](https://docs.npmjs.com/cli/v10/commands/npm-ci)
- [Semantic Versioning](https://semver.org/)

---

**维护者**: papalqi
**更新日期**: 2025-11-22
