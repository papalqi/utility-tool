@echo off
setlocal enabledelayedexpansion

:: Monster Hunter UE5 Mobile Game Project - Perforce Sync Script
:: Author: PC Utility Tool
:: Description: Syncs MHA Perforce workspace with flexible parameter support

echo ========================================
echo Monster Hunter Perforce Sync
echo ========================================

:: Debug: Show received parameters
echo Debug: Received parameters:
echo   Param 1: [%~1]
echo   Param 2: [%~2]
echo   Param 3: [%~3]
echo   Param 4: [%~4]
echo   Param 5: [%~5]
echo   Param 6: [%~6]
echo   Param 7: [%~7]
echo.

:: Skip parameter check - always proceed with sync
echo Debug: Proceeding with sync operation...

:: Set parameters
set P4PORT=%~1
set P4USER=%~2
set P4CHARSET=%~3
set P4CLIENT=%~4
set WORK_DIR=%~5
set SYNC_PATH=%~6
set FORCE_SYNC=%~7

:: Validate required parameters
if "%P4PORT%"=="" (
    echo Error: P4PORT is required
    goto :end
)
if "%P4USER%"=="" (
    echo Error: P4USER is required
    goto :end
)
if "%P4CHARSET%"=="" (
    set P4CHARSET=utf8
)
if "%P4CLIENT%"=="" (
    echo Error: P4CLIENT is required
    goto :end
)
if "%WORK_DIR%"=="" (
    echo Error: WORK_DIR is required
    goto :end
)

:: Determine sync target
if "%SYNC_PATH%"=="" (
    set SYNC_TARGET=
    set SYNC_DESC=entire workspace
) else (
    set SYNC_TARGET=%SYNC_PATH%/...
    set SYNC_DESC=%SYNC_PATH%
)

:: Determine force sync option (default is false - P4V Get Latest behavior)
if "%FORCE_SYNC%"=="" set FORCE_SYNC=false

:: Debug: Show FORCE_SYNC value
echo Debug: FORCE_SYNC value is [%FORCE_SYNC%]

set SYNC_OPTIONS=
if /i "%FORCE_SYNC%"=="true" (
    set SYNC_OPTIONS=-f
    set FORCE_DESC=Yes - Force mode - will DELETE files removed from server
    echo.
    echo WARNING: Force sync enabled - will DELETE files removed from server
    echo.
) else (
    set SYNC_OPTIONS=
    set FORCE_DESC=No - P4V Get Latest mode - will NOT delete files
    echo.
    echo INFO: Using P4V Get Latest mode - will NOT delete files removed from server
    echo.
)

echo.
echo Configuration:
echo   Server:    %P4PORT%
echo   User:      %P4USER%
echo   Charset:   %P4CHARSET%
echo   Workspace: %P4CLIENT%
echo   Directory: %WORK_DIR%
echo   Target:    %SYNC_DESC%
echo   Force:     %FORCE_DESC%
echo.

:: Check if directory exists
if not exist "%WORK_DIR%" (
    echo Error: Working directory does not exist: %WORK_DIR%
    echo Please ensure the workspace is properly set up.
    goto :end
)

:: Change to working directory
echo Changing to working directory...
cd /d "%WORK_DIR%"
if errorlevel 1 (
    echo Error: Failed to change to directory %WORK_DIR%
    goto :end
)

:: Set Perforce environment variables
set P4PORT=%P4PORT%
set P4USER=%P4USER%
set P4CHARSET=%P4CHARSET%
set P4CLIENT=%P4CLIENT%

:: Show current workspace info
echo.
echo Current Perforce workspace info:
p4 info
if errorlevel 1 (
    echo Error: Failed to connect to Perforce server
    echo Please check your network connection and Perforce configuration
    goto :end
)

:: Check for opened files if not force syncing
if /i "%FORCE_SYNC%"=="false" (
    echo.
    echo Checking for opened files...
    p4 opened >nul 2>&1
    if not errorlevel 1 (
        echo.
        echo WARNING: You have files checked out in this workspace.
        echo This may cause sync conflicts.
        echo.
        echo Opened files:
        p4 opened
        echo.
        echo Consider reverting files first or use default force sync.
        echo.
    )
)

:: Sync the workspace
echo.
echo ========================================
echo Starting sync...
echo Target: %SYNC_DESC%
if /i "%FORCE_SYNC%"=="true" (
    echo Mode: FORCE SYNC - Overwriting local changes
)
echo ========================================
echo.

if "%SYNC_TARGET%"=="" (
    p4 sync %SYNC_OPTIONS%
) else (
    p4 sync %SYNC_OPTIONS% %SYNC_TARGET%
)

if errorlevel 1 (
    echo.
    echo ========================================
    echo Error: Sync failed
    echo ========================================
    echo Target: %SYNC_DESC%
    echo.
    echo Possible causes:
    echo   - File conflicts (local modifications)
    echo   - Files are opened/checked out
    echo   - Network connection issues
    echo   - Permission problems
    echo.
    echo Suggestions:
    echo   - Use force sync option to overwrite local changes
    echo   - Check opened files with: p4 opened
    echo   - Revert unwanted changes with: p4 revert
    echo.
    goto :end
) else (
    echo.
    echo ========================================
    echo Successfully synced!
    echo ========================================
    echo.
    echo Workspace: %P4CLIENT%
    echo Directory: %WORK_DIR%
    echo Synced: %SYNC_DESC%
    if /i "%FORCE_SYNC%"=="true" (
        echo Mode: Force sync (local changes overwritten)
    )
    echo.
)

:end
echo.