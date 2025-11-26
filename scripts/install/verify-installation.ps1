#!/usr/bin/env pwsh
# ============================================
# PC Utility Tool - Installation Verification Script
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Installation Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true

# Check Node.js
Write-Host "[1/6] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "      ✓ Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "      ✗ Node.js not found" -ForegroundColor Red
    $allPassed = $false
}

# Check npm
Write-Host "[2/6] Checking npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "      ✓ npm $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "      ✗ npm not found" -ForegroundColor Red
    $allPassed = $false
}

# Check node_modules
Write-Host "[3/6] Checking node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    $packageCount = (Get-ChildItem "node_modules" -Directory).Count
    Write-Host "      ✓ node_modules exists ($packageCount packages)" -ForegroundColor Green
} else {
    Write-Host "      ✗ node_modules not found" -ForegroundColor Red
    $allPassed = $false
}

# Check Electron
Write-Host "[4/6] Checking Electron..." -ForegroundColor Yellow
if (Test-Path "node_modules/electron") {
    try {
        $electronVersion = npx electron --version 2>$null
        Write-Host "      ✓ Electron $electronVersion" -ForegroundColor Green
    } catch {
        Write-Host "      ⚠ Electron installed but not executable" -ForegroundColor Yellow
    }
} else {
    Write-Host "      ✗ Electron not found" -ForegroundColor Red
    $allPassed = $false
}

# Check critical dependencies
Write-Host "[5/6] Checking critical dependencies..." -ForegroundColor Yellow
$criticalDeps = @("react", "react-dom", "antd", "vite")
$missingDeps = @()

foreach ($dep in $criticalDeps) {
    if (-not (Test-Path "node_modules/$dep")) {
        $missingDeps += $dep
    }
}

if ($missingDeps.Count -eq 0) {
    Write-Host "      ✓ All critical dependencies installed" -ForegroundColor Green
} else {
    Write-Host "      ✗ Missing: $($missingDeps -join ', ')" -ForegroundColor Red
    $allPassed = $false
}

# Check package.json scripts
Write-Host "[6/6] Checking package.json scripts..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $requiredScripts = @("dev", "build", "electron:dev")
    $missingScripts = @()
    
    foreach ($script in $requiredScripts) {
        if (-not $packageJson.scripts.$script) {
            $missingScripts += $script
        }
    }
    
    if ($missingScripts.Count -eq 0) {
        Write-Host "      ✓ All required scripts present" -ForegroundColor Green
    } else {
        Write-Host "      ✗ Missing scripts: $($missingScripts -join ', ')" -ForegroundColor Red
        $allPassed = $false
    }
} else {
    Write-Host "      ✗ package.json not found" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($allPassed) {
    Write-Host " ✓ Installation Verified Successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "You can now run:" -ForegroundColor Cyan
    Write-Host "  npm run dev          - Start development server" -ForegroundColor White
    Write-Host "  npm run electron:dev - Start Electron app" -ForegroundColor White
    Write-Host "  npm run build        - Build for production" -ForegroundColor White
} else {
    Write-Host " ✗ Installation Issues Detected" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Please run the installation script again:" -ForegroundColor Yellow
    Write-Host "  .\install.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "Or see INSTALL.md for manual installation steps." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to exit"
