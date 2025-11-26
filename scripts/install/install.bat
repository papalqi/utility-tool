@echo off
REM ============================================
REM PC Utility Tool - Installation Script
REM ============================================
REM This script handles the installation of dependencies
REM and resolves common issues with native modules

echo.
echo ========================================
echo  PC Utility Tool - Installation
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/6] Checking Node.js version...
node --version
npm --version
echo.

echo [2/6] Cleaning npm cache...
call npm cache clean --force
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Failed to clean cache, continuing...
)
echo.

echo [3/6] Removing old dependencies...
if exist "node_modules" (
    echo Removing node_modules folder...
    rmdir /s /q node_modules
)
if exist "package-lock.json" (
    echo Removing package-lock.json...
    del /f /q package-lock.json
)
echo.

echo [4/6] Installing dependencies (this may take a few minutes)...
echo Note: Skipping native module compilation to avoid build errors
call npm install --ignore-scripts
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies!
    pause
    exit /b 1
)
echo.

echo [5/6] Installing Electron...
call npm install electron --save-dev
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install Electron!
    pause
    exit /b 1
)
echo.

echo [6/6] Rebuilding native modules...
call npm rebuild
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] npm rebuild encountered issues; continuing...
) else (
    echo Native modules rebuilt successfully
)
echo.

echo ========================================
echo  Installation Complete!
echo ========================================
echo.
echo You can now run the application with:
echo   npm run dev          - Development mode
echo   npm run electron:dev - Electron development mode
echo   npm run build        - Build for production
echo.
echo Note: If you encounter issues with node-pty or other native modules,
echo       they can be safely ignored for basic functionality.
echo.
pause
