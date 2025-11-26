#!/usr/bin/env pwsh
# ============================================
# 环境检测与清理工具
# ============================================
# 用于检测和清理 PATH 环境变量、npm 配置等问题

param(
    [switch]$AutoClean = $false,
    [switch]$Restore = $false,
    [string]$RestoreFile = ""
)

function Write-Title {
    param([string]$Text)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " $Text" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Section {
    param([string]$Text)
    Write-Host ""
    Write-Host "[$Text]" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Text)
    Write-Host "  ✓ $Text" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Text)
    Write-Host "  ⚠️  $Text" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Text)
    Write-Host "  ✗ $Text" -ForegroundColor Red
}

function Write-Info {
    param([string]$Text)
    Write-Host "  $Text" -ForegroundColor White
}

# ============================================
# 恢复功能
# ============================================

if ($Restore) {
    Write-Title "PATH 恢复工具"

    $backupDir = "$PSScriptRoot\环境备份"

    if (-not (Test-Path $backupDir)) {
        Write-Error "备份目录不存在: $backupDir"
        exit 1
    }

    # 列出可用的备份
    $backups = Get-ChildItem -Path $backupDir -Filter "*-path-*.txt" | Sort-Object LastWriteTime -Descending

    if ($backups.Count -eq 0) {
        Write-Error "没有找到备份文件"
        exit 1
    }

    Write-Info "可用的备份文件："
    Write-Host ""
    for ($i = 0; $i -lt $backups.Count; $i++) {
        $backup = $backups[$i]
        Write-Host "  [$($i+1)] $($backup.Name) - $($backup.LastWriteTime)" -ForegroundColor Cyan
    }

    Write-Host ""
    if ($RestoreFile) {
        $selectedFile = $RestoreFile
    } else {
        $selection = Read-Host "请选择要恢复的备份编号 (1-$($backups.Count))"
        $index = [int]$selection - 1

        if ($index -lt 0 -or $index -ge $backups.Count) {
            Write-Error "无效的选择"
            exit 1
        }

        $selectedFile = $backups[$index].FullName
    }

    Write-Host ""
    Write-Warning "即将恢复 PATH 从: $selectedFile"
    $confirm = Read-Host "确认恢复？(yes/no)"

    if ($confirm -ne "yes") {
        Write-Info "已取消恢复"
        exit 0
    }

    try {
        $pathContent = Get-Content $selectedFile -Raw

        if ($selectedFile -like "*user-path*") {
            [Environment]::SetEnvironmentVariable("Path", $pathContent, "User")
            Write-Success "已恢复用户 PATH"
        } elseif ($selectedFile -like "*system-path*") {
            [Environment]::SetEnvironmentVariable("Path", $pathContent, "Machine")
            Write-Success "已恢复系统 PATH"
        } else {
            Write-Error "无法识别备份类型"
            exit 1
        }

        Write-Host ""
        Write-Success "恢复完成！"
        Write-Warning "请重启计算机以使更改生效"

    } catch {
        Write-Error "恢复失败: $($_.Exception.Message)"
        exit 1
    }

    exit 0
}

# ============================================
# 主程序
# ============================================

Write-Title "环境检测与清理工具"

# ============================================
# 1. PATH 环境变量检测
# ============================================
Write-Section "1. PATH 环境变量检测"

$currentPath = $env:Path
$pathLength = $currentPath.Length
$pathEntries = $currentPath -split ';' | Where-Object { $_ -ne '' }
$pathCount = $pathEntries.Count

Write-Info "当前 PATH 长度: $pathLength 字符"
Write-Info "PATH 条目数量: $pathCount 个"

if ($pathLength -gt 2047) {
    Write-Error "PATH 长度超过 Windows 限制 (2047 字符)！"
    Write-Warning "这可能导致命令找不到的问题"
} elseif ($pathLength -gt 1500) {
    Write-Warning "PATH 长度接近限制，建议清理"
} else {
    Write-Success "PATH 长度正常"
}

# 检查重复条目
$uniqueEntries = $pathEntries | Select-Object -Unique
$duplicateCount = $pathCount - $uniqueEntries.Count

if ($duplicateCount -gt 0) {
    Write-Warning "发现 $duplicateCount 个重复的 PATH 条目"
    
    # 显示重复最多的条目
    $duplicates = $pathEntries | Group-Object | Where-Object { $_.Count -gt 1 } | Sort-Object Count -Descending | Select-Object -First 5
    if ($duplicates) {
        Write-Info "重复最多的条目："
        foreach ($dup in $duplicates) {
            Write-Info "  - $($dup.Name) (重复 $($dup.Count) 次)"
        }
    }
} else {
    Write-Success "没有重复的 PATH 条目"
}

# 检查 Node.js
$nodeInPath = $pathEntries | Where-Object { $_ -like "*nodejs*" }
if ($nodeInPath) {
    $nodeCount = ($nodeInPath | Measure-Object).Count
    if ($nodeCount -gt 1) {
        Write-Warning "Node.js 在 PATH 中出现 $nodeCount 次"
    } else {
        Write-Success "Node.js 在 PATH 中"
    }
} else {
    Write-Error "Node.js 不在 PATH 中"
}

# ============================================
# 2. npm 配置检测
# ============================================
Write-Section "2. npm 配置检测"

try {
    # 检查 script-shell
    $scriptShell = npm config get script-shell 2>$null
    if ($scriptShell -and $scriptShell -ne "null") {
        Write-Warning "检测到自定义 script-shell: $scriptShell"
    } else {
        Write-Success "script-shell 使用默认值"
    }

    # 检查 shell
    $shell = npm config get shell 2>$null
    if ($shell -and $shell -ne "null") {
        Write-Warning "检测到自定义 shell: $shell"
        Write-Info "这可能导致 PATH 问题"
    } else {
        Write-Success "shell 使用默认值"
    }

    # 检查过时的配置
    $obsoleteConfigs = @('msbuild-path', 'msvs-version', 'python')
    $foundObsolete = @()
    
    foreach ($config in $obsoleteConfigs) {
        $value = npm config get $config 2>$null
        if ($value -and $value -ne "null") {
            $foundObsolete += $config
            Write-Warning "检测到过时的配置: $config = $value"
        }
    }
    
    if ($foundObsolete.Count -eq 0) {
        Write-Success "没有过时的 npm 配置"
    }

} catch {
    Write-Error "无法检测 npm 配置: $($_.Exception.Message)"
}

# ============================================
# 3. Node.js 和 npm 版本检测
# ============================================
Write-Section "3. Node.js 和 npm 版本"

try {
    $nodeVersion = node --version 2>$null
    $npmVersion = npm --version 2>$null | Select-Object -Last 1
    
    Write-Success "Node.js: $nodeVersion"
    Write-Success "npm: $npmVersion"
} catch {
    Write-Error "无法检测 Node.js/npm 版本"
}

# ============================================
# 4. 系统环境变量检测
# ============================================
Write-Section "4. 系统环境变量"

try {
    $systemPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    
    $systemEntries = ($systemPath -split ';' | Where-Object { $_ -ne '' }).Count
    $userEntries = ($userPath -split ';' | Where-Object { $_ -ne '' }).Count
    
    Write-Info "系统 PATH 条目: $systemEntries 个"
    Write-Info "用户 PATH 条目: $userEntries 个"
    
    if ($userEntries -gt 100) {
        Write-Warning "用户 PATH 条目过多 ($userEntries 个)"
    }
    if ($systemEntries -gt 100) {
        Write-Warning "系统 PATH 条目过多 ($systemEntries 个)"
    }
} catch {
    Write-Warning "无法读取系统环境变量（可能需要管理员权限）"
}

# ============================================
# 5. 清理建议
# ============================================
Write-Section "5. 清理建议"

$needsCleanup = $false
$cleanupActions = @()

if ($duplicateCount -gt 0) {
    $needsCleanup = $true
    $cleanupActions += "清理重复的 PATH 条目 ($duplicateCount 个)"
}

if ($shell -and $shell -ne "null") {
    $needsCleanup = $true
    $cleanupActions += "删除自定义 shell 配置"
}

if ($foundObsolete.Count -gt 0) {
    $needsCleanup = $true
    $cleanupActions += "删除过时的 npm 配置 ($($foundObsolete.Count) 个)"
}

if (-not $needsCleanup) {
    Write-Success "环境配置良好，无需清理"
    exit 0
}

Write-Warning "建议执行以下清理操作："
foreach ($action in $cleanupActions) {
    Write-Info "  - $action"
}

# ============================================
# 6. 执行清理
# ============================================
Write-Host ""
if (-not $AutoClean) {
    Write-Info "请选择要执行的清理操作："
    Write-Host ""
    Write-Host "  [1] 仅清理 npm 配置（推荐）" -ForegroundColor Green
    Write-Host "  [2] 仅清理 PATH 重复项" -ForegroundColor Yellow
    Write-Host "  [3] 清理 npm 配置 + PATH 重复项" -ForegroundColor Yellow
    Write-Host "  [0] 取消" -ForegroundColor Red
    Write-Host ""

    $choice = Read-Host "请选择 (0-3)"

    switch ($choice) {
        "0" {
            Write-Info "已取消清理操作"
            exit 0
        }
        "1" {
            $cleanNpm = $true
            $cleanPath = $false
        }
        "2" {
            $cleanNpm = $false
            $cleanPath = $true
        }
        "3" {
            $cleanNpm = $true
            $cleanPath = $true
        }
        default {
            Write-Error "无效的选择"
            exit 1
        }
    }
} else {
    # 自动清理模式：默认只清理 npm 配置
    $cleanNpm = $true
    $cleanPath = $false
}

Write-Section "6. 执行清理"

# 备份目录
$backupDir = "$PSScriptRoot\环境备份"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

# 清理 npm 配置
if ($cleanNpm) {
    Write-Host ""
    Write-Info "清理 npm 配置..."

    if ($shell -and $shell -ne "null") {
        Write-Info "删除自定义 shell 配置..."
        npm config delete shell 2>$null
        Write-Success "已删除 shell 配置"
    }

    if ($foundObsolete.Count -gt 0) {
        Write-Info "删除过时的 npm 配置..."
        foreach ($config in $foundObsolete) {
            npm config delete $config 2>$null
            Write-Success "已删除 $config"
        }
    }

    if (-not $shell -and $foundObsolete.Count -eq 0) {
        Write-Info "没有需要清理的 npm 配置"
    }
}

# 清理 PATH
if ($cleanPath -and $duplicateCount -gt 0) {
    Write-Host ""
    Write-Warning "PATH 清理需要修改环境变量"
    Write-Info "清理方式："
    Write-Info "  - 保留每个路径的第一次出现"
    Write-Info "  - 删除后续的重复项"
    Write-Info "  - 保持原始顺序"
    Write-Info "  - 不区分大小写（Windows 标准）"
    Write-Info "  - 忽略尾部斜杠差异"
    Write-Info "  - 自动备份到: $backupDir"
    Write-Host ""

    # 显示将要删除的重复项（前10个）
    Write-Info "将要删除的重复项示例（前10个）："
    $seen = @{}
    $duplicatesToShow = @()
    foreach ($entry in $pathEntries) {
        $normalized = $entry.TrimEnd('\').ToLower()
        if ($seen.ContainsKey($normalized)) {
            $duplicatesToShow += $entry
            if ($duplicatesToShow.Count -ge 10) { break }
        } else {
            $seen[$normalized] = $true
        }
    }
    foreach ($dup in $duplicatesToShow) {
        Write-Info "  - $dup"
    }
    if ($duplicateCount -gt 10) {
        Write-Info "  ... 还有 $($duplicateCount - 10) 个重复项"
    }

    Write-Host ""
    Write-Warning "⚠️  PATH 清理有一定风险，建议先备份重要数据"
    $confirmPath = Read-Host "确认清理 PATH 中的重复条目？(yes/no)"

    if ($confirmPath -eq "yes") {
        # 备份
        Set-Content -Path "$backupDir\system-path-$timestamp.txt" -Value $systemPath -ErrorAction SilentlyContinue
        Set-Content -Path "$backupDir\user-path-$timestamp.txt" -Value $userPath -ErrorAction SilentlyContinue
        Write-Success "已备份 PATH 到: $backupDir"

        # 安全的去重函数（不区分大小写，忽略尾部斜杠）
        function Remove-PathDuplicates {
            param([string]$PathString)

            $entries = $PathString -split ';' | Where-Object { $_ -ne '' }
            $seen = @{}
            $unique = @()

            foreach ($entry in $entries) {
                # 规范化：去除尾部斜杠，转小写
                $normalized = $entry.TrimEnd('\').ToLower()

                if (-not $seen.ContainsKey($normalized)) {
                    $seen[$normalized] = $true
                    $unique += $entry  # 保留原始大小写和格式
                }
            }

            return $unique -join ';'
        }

        # 清理用户 PATH
        $userUnique = Remove-PathDuplicates -PathString $userPath
        $userBefore = ($userPath -split ';' | Where-Object { $_ -ne '' }).Count
        $userAfter = ($userUnique -split ';' | Where-Object { $_ -ne '' }).Count

        [Environment]::SetEnvironmentVariable("Path", $userUnique, "User")
        Write-Success "已清理用户 PATH (从 $userBefore 减少到 $userAfter 个条目)"

        # 清理系统 PATH（需要管理员权限）
        try {
            $systemUnique = Remove-PathDuplicates -PathString $systemPath
            $systemBefore = ($systemPath -split ';' | Where-Object { $_ -ne '' }).Count
            $systemAfter = ($systemUnique -split ';' | Where-Object { $_ -ne '' }).Count

            [Environment]::SetEnvironmentVariable("Path", $systemUnique, "Machine")
            Write-Success "已清理系统 PATH (从 $systemBefore 减少到 $systemAfter 个条目)"
        } catch {
            Write-Warning "清理系统 PATH 失败（需要管理员权限）"
            Write-Info "请以管理员身份运行此脚本以清理系统 PATH"
        }

        Write-Host ""
        Write-Success "PATH 清理完成！"
        Write-Info "清理统计："
        Write-Info "  - 用户 PATH: 删除了 $($userBefore - $userAfter) 个重复项"
        if ($systemBefore -and $systemAfter) {
            Write-Info "  - 系统 PATH: 删除了 $($systemBefore - $systemAfter) 个重复项"
        }
        Write-Info "  - 备份位置: $backupDir"
        Write-Host ""
        Write-Warning "重要：请重启计算机以使 PATH 更改生效！"
    } else {
        Write-Info "已跳过 PATH 清理"
    }
} elseif ($cleanPath -and $duplicateCount -eq 0) {
    Write-Host ""
    Write-Success "PATH 中没有重复项，无需清理"
}

Write-Host ""
Write-Title "清理完成"

if ($cleanNpm -or $cleanPath) {
    Write-Success "环境清理已完成"

    if ($cleanNpm) {
        Write-Info "✓ npm 配置已清理"
    }
    if ($cleanPath) {
        Write-Info "✓ PATH 重复项已清理"
    }

    Write-Host ""
    if ($cleanPath) {
        Write-Warning "重要：请重启计算机以使 PATH 更改完全生效"
    } else {
        Write-Info "建议重启终端以使 npm 配置更改生效"
    }
} else {
    Write-Info "未执行任何清理操作"
}

Write-Host ""

