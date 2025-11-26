# 自动发布脚本 - Windows PowerShell
# 功能：检查版本、创建 tag、推送到 GitHub，触发自动构建

param(
    [Parameter(Mandatory=$false)]
    [string]$Version,
    
    [Parameter(Mandatory=$false)]
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot ".." "..")
$script:PublishExitCode = 0

Push-Location $repoRoot
try {
    Write-Host "==================================" -ForegroundColor Cyan
    Write-Host "  PC Utility Tool 发布工具" -ForegroundColor Cyan
    Write-Host "==================================" -ForegroundColor Cyan
    Write-Host ""

    # 获取 package.json 中的版本
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $currentVersion = $packageJson.version

    if ($Version) {
        Write-Host "目标版本: v$Version" -ForegroundColor Green
        
        # 更新 package.json 版本
        $packageJson.version = $Version
        $packageJson | ConvertTo-Json -Depth 100 | Set-Content "package.json"
        Write-Host "✓ 已更新 package.json 版本为 $Version" -ForegroundColor Green
        
        $currentVersion = $Version
    } else {
        Write-Host "当前版本: v$currentVersion" -ForegroundColor Green
        $confirm = Read-Host "是否使用当前版本发布? (y/n)"
        if ($confirm -ne "y") {
            Write-Host "已取消" -ForegroundColor Yellow
            return
        }
    }

    # 检查是否有未提交的更改
    $status = git status --porcelain
    if ($status) {
        Write-Host ""
        Write-Host "检测到未提交的更改:" -ForegroundColor Yellow
        git status --short
        Write-Host ""
        $commit = Read-Host "是否提交这些更改? (y/n)"
        
        if ($commit -eq "y") {
            $commitMsg = if ($Message) { $Message } else { "chore: release v$currentVersion" }
            git add .
            git commit -m $commitMsg
            Write-Host "✓ 已提交更改" -ForegroundColor Green
        } else {
            Write-Host "请先提交或暂存你的更改" -ForegroundColor Red
            $script:PublishExitCode = 1
            return
        }
    }

    # 检查 tag 是否已存在
    $tagName = "v$currentVersion"
    $existingTag = git tag -l $tagName

    if ($existingTag) {
        Write-Host ""
        Write-Host "警告: Tag $tagName 已存在!" -ForegroundColor Red
        $overwrite = Read-Host "是否删除旧 tag 并重新创建? (y/n)"
        
        if ($overwrite -eq "y") {
            git tag -d $tagName
            git push origin :refs/tags/$tagName 2>$null
            Write-Host "✓ 已删除旧 tag" -ForegroundColor Green
        } else {
            Write-Host "已取消" -ForegroundColor Yellow
            return
        }
    }

    # 创建 tag
    Write-Host ""
    Write-Host "正在创建 tag: $tagName" -ForegroundColor Cyan

    $releaseMsg = if ($Message) { $Message } else { "Release v$currentVersion" }
    git tag -a $tagName -m $releaseMsg

    Write-Host "✓ 已创建 tag" -ForegroundColor Green

    # 推送到 GitHub
    Write-Host ""
    Write-Host "正在推送到 GitHub..." -ForegroundColor Cyan

    # 推送代码
    git push origin HEAD

    # 推送 tag
    git push origin $tagName

    Write-Host ""
    Write-Host "==================================" -ForegroundColor Green
    Write-Host "  发布流程已启动!" -ForegroundColor Green
    Write-Host "==================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "GitHub Actions 将自动:" -ForegroundColor Cyan
    Write-Host "  1. 构建 Windows/Mac/Linux 版本" -ForegroundColor White
    Write-Host "  2. 创建 GitHub Release" -ForegroundColor White
    Write-Host "  3. 上传所有安装包" -ForegroundColor White
    Write-Host ""
    Write-Host "查看构建进度:" -ForegroundColor Cyan
    $repoUrlRaw = $packageJson.repository.url
    $ownerRepo = $repoUrlRaw -replace '^.*github.com[/:]', '' -replace '\.git$',''
    $actionsUrl = "https://github.com/$ownerRepo/actions"
    Write-Host "  $actionsUrl" -ForegroundColor Blue
    Write-Host ""
    Write-Host "预计 10-15 分钟后完成" -ForegroundColor Yellow
    Write-Host ""
}
finally {
    Pop-Location
}

exit $script:PublishExitCode
