@echo off
setlocal enabledelayedexpansion

:: Monster Hunter UE5 Mobile Game Project - Perforce Revert Script
:: Author: PC Utility Tool
:: Description: Reverts MHA Perforce workspace changes with flexible parameter support

echo ========================================
echo Monster Hunter Perforce Revert
echo ========================================

:: Debug: Show received parameters
echo Debug: Received parameters:
echo   Param 1 (P4PORT): [%~1]
echo   Param 2 (P4USER): [%~2]
echo   Param 3 (P4CHARSET): [%~3]
echo   Param 4 (P4CLIENT): [%~4]
echo   Param 5 (WORK_DIR): [%~5]
echo   Param 6 (CHANGELIST): [%~6]
echo   Param 7 (REVERT_PATH): [%~7]
echo.

:: Set parameters
set P4PORT=%~1
set P4USER=%~2
set P4CHARSET=%~3
set P4CLIENT=%~4
set WORK_DIR=%~5
set CHANGELIST=%~6
set REVERT_PATH=%~7

:: Validate required parameters
if "%P4PORT%"=="" (
    echo Error: P4PORT is required
    echo.
    echo Usage: revert-perforce.bat [P4PORT] [P4USER] [P4CHARSET] [P4CLIENT] [WORK_DIR] [CHANGELIST] [REVERT_PATH]
    echo.
    echo Example:
    echo   revert-perforce.bat "ssl:p4.example.com:1666" "yourUser" "utf8" "MHAClient_main_user" "D:\Projects\MHAClient_main" "" ""
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

:: Determine revert target
if "%REVERT_PATH%"=="" (
    set REVERT_TARGET=//...
    set REVERT_DESC=all files
) else (
    set REVERT_TARGET=%REVERT_PATH%/...
    set REVERT_DESC=%REVERT_PATH%
)

:: Determine changelist filter
if not "%CHANGELIST%"=="" (
    set CL_FILTER=-c %CHANGELIST%
    set CL_DESC=Changelist %CHANGELIST%
) else (
    set CL_FILTER=
    set CL_DESC=All changelists
)

echo.
echo Configuration:
echo   Server:     %P4PORT%
echo   User:       %P4USER%
echo   Charset:    %P4CHARSET%
echo   Workspace:  %P4CLIENT%
echo   Directory:  %WORK_DIR%
echo   Target:     %REVERT_DESC%
echo   Changelist: %CL_DESC%
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

:: Check Perforce connection
echo.
echo Checking Perforce connection...
p4 info >nul 2>&1
if errorlevel 1 (
    echo Error: Failed to connect to Perforce server
    echo Please check your network connection and Perforce configuration
    goto :end
)

:: Check for pending changes
echo.
echo ========================================
echo Checking pending changes...
echo ========================================
echo.
p4 opened %CL_FILTER% %REVERT_TARGET%
if errorlevel 1 (
    echo.
    echo No pending changes found
    echo Target: %REVERT_DESC%
    echo Changelist: %CL_DESC%
    goto :end
)

:: Confirm revert
echo.
echo ========================================
echo WARNING: About to revert changes
echo ========================================
echo Target: %REVERT_DESC%
echo Changelist: %CL_DESC%
echo.
set /p CONFIRM="Are you sure you want to revert? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo.
    echo Revert cancelled by user
    goto :end
)

:: Perform revert
echo.
echo ========================================
echo Reverting changes...
echo ========================================
echo.
p4 revert %CL_FILTER% %REVERT_TARGET%
if errorlevel 1 (
    echo.
    echo Error: Revert failed
    goto :end
)

echo.
echo ========================================
echo Successfully reverted!
echo ========================================
echo Target: %REVERT_DESC%
echo Changelist: %CL_DESC%
echo.

:end
echo.
