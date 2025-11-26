#!/bin/bash
# 自动发布脚本 - Mac/Linux
# 功能：检查版本、创建 tag、推送到 GitHub，触发自动构建

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

VERSION=""
MESSAGE=""

# 解析参数
while [[ $# -gt 0 ]]; do
  case $1 in
    -v|--version)
      VERSION="$2"
      shift 2
      ;;
    -m|--message)
      MESSAGE="$2"
      shift 2
      ;;
    *)
      echo "未知参数: $1"
      exit 1
      ;;
  esac
done

echo "=================================="
echo "  PC Utility Tool 发布工具"
echo "=================================="
echo ""

# 获取 package.json 中的版本
CURRENT_VERSION=$(node -p "require('./package.json').version")

if [ -n "$VERSION" ]; then
    echo "目标版本: v$VERSION"
    
    # 更新 package.json 版本
    node -e "const fs=require('fs');const pkg=require('./package.json');pkg.version='$VERSION';fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n')"
    echo "✓ 已更新 package.json 版本为 $VERSION"
    
    CURRENT_VERSION=$VERSION
else
    echo "当前版本: v$CURRENT_VERSION"
    read -p "是否使用当前版本发布? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消"
        exit 0
    fi
fi

# 检查是否有未提交的更改
if [[ -n $(git status --porcelain) ]]; then
    echo ""
    echo "检测到未提交的更改:"
    git status --short
    echo ""
    read -p "是否提交这些更改? (y/n) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        COMMIT_MSG=${MESSAGE:-"chore: release v$CURRENT_VERSION"}
        git add .
        git commit -m "$COMMIT_MSG"
        echo "✓ 已提交更改"
    else
        echo "请先提交或暂存你的更改"
        exit 1
    fi
fi

# 检查 tag 是否已存在
TAG_NAME="v$CURRENT_VERSION"
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    echo ""
    echo "警告: Tag $TAG_NAME 已存在!"
    read -p "是否删除旧 tag 并重新创建? (y/n) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git tag -d "$TAG_NAME"
        git push origin ":refs/tags/$TAG_NAME" 2>/dev/null || true
        echo "✓ 已删除旧 tag"
    else
        echo "已取消"
        exit 0
    fi
fi

# 创建 tag
echo ""
echo "正在创建 tag: $TAG_NAME"

RELEASE_MSG=${MESSAGE:-"Release v$CURRENT_VERSION"}
git tag -a "$TAG_NAME" -m "$RELEASE_MSG"

echo "✓ 已创建 tag"

# 推送到 GitHub
echo ""
echo "正在推送到 GitHub..."

# 推送代码
git push origin HEAD

# 推送 tag
git push origin "$TAG_NAME"

echo ""
echo "=================================="
echo "  发布流程已启动!"
echo "=================================="
echo ""
echo "GitHub Actions 将自动:"
echo "  1. 构建 Windows/Mac/Linux 版本"
echo "  2. 创建 GitHub Release"
echo "  3. 上传所有安装包"
echo ""
echo "查看构建进度:"
REPO_URL=$(node -p "require('./package.json').repository.url.replace(/.*github\.com[:/]/,'https://github.com/').replace(/\.git$/,'')")
echo "  $REPO_URL/actions"
echo ""
echo "预计 10-15 分钟后完成"
echo ""
