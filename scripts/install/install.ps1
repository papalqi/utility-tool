#!/usr/bin/env pwsh
# ============================================
# PC Utility Tool - Installation Script (PowerShell)
# ============================================
# This script handles the installation of dependencies
# and resolves common issues with native modules

# Ensure we're running from the project root
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (Test-Path "$PSScriptRoot\..\..\package.json") {
    # Script is in scripts/install/, go up two levels
    Set-Location (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
} elseif (Test-Path "$PSScriptRoot\package.json") {
    # Already in project root
    Set-Location $PSScriptRoot
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " PC Utility Tool - Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Working directory: $(Get-Location)" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Host "[1/6] Node.js version: $nodeVersion" -ForegroundColor Green
    Write-Host "      npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Clean npm cache
Write-Host "[2/6] Cleaning npm cache..." -ForegroundColor Yellow
try {
    npm cache clean --force | Out-Null
    Write-Host "      Cache cleaned successfully" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] Failed to clean cache, continuing..." -ForegroundColor Yellow
}
Write-Host ""

# Remove old dependencies
Write-Host "[3/6] Removing old dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "      Removing node_modules folder..."
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
}
if (Test-Path "package-lock.json") {
    Write-Host "      Removing package-lock.json..."
    Remove-Item -Force "package-lock.json" -ErrorAction SilentlyContinue
}
Write-Host "      Cleanup complete" -ForegroundColor Green
Write-Host ""

# Install dependencies
Write-Host "[4/6] Installing dependencies (this may take a few minutes)..." -ForegroundColor Yellow
Write-Host "      Note: Skipping native module compilation to avoid build errors" -ForegroundColor Cyan
try {
    npm install --ignore-scripts
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed"
    }
    Write-Host "      Dependencies installed successfully" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to install dependencies!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Install Electron
Write-Host "[5/6] Installing Electron..." -ForegroundColor Yellow
try {
    npm install electron --save-dev
    if ($LASTEXITCODE -ne 0) {
        throw "Electron installation failed"
    }
    Write-Host "      Electron installed successfully" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to install Electron!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

Write-Host "[6/6] Rebuilding native modules..." -ForegroundColor Yellow
try {
    npm rebuild
    if ($LASTEXITCODE -ne 0) {
        throw "npm rebuild failed"
    }
    Write-Host "      Native modules rebuilt successfully" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] npm rebuild encountered issues; continuing..." -ForegroundColor Yellow
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host " Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now run the application with:" -ForegroundColor Cyan
Write-Host "  npm run dev          - Development mode" -ForegroundColor White
Write-Host "  npm run electron:dev - Electron development mode" -ForegroundColor White
Write-Host "  npm run build        - Build for production" -ForegroundColor White
Write-Host ""
Write-Host "Note: If you encounter issues with node-pty or other native modules," -ForegroundColor Yellow
Write-Host "      they can be safely ignored for basic functionality." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit"
