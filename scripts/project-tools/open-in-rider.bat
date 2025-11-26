@echo off
REM ============================================================================
REM Script: open-in-rider.bat
REM Description: Open Monster Hunter UE5 project in JetBrains Rider
REM Usage: open-in-rider.bat [RIDER_PATH] [WORK_DIR]
REM Parameters:
REM   RIDER_PATH - Path to Rider executable
REM   WORK_DIR   - Working directory (e.g., D:\Projects\MHAClient_main)
REM ============================================================================

setlocal enabledelayedexpansion

echo ========================================
echo Monster Hunter Project Opener
echo ========================================

REM Debug: Show received parameters
echo Debug: Received parameters:
echo   Param 1 (RIDER_PATH): [%~1]
echo   Param 2 (WORK_DIR): [%~2]
echo.

REM Set parameters
set "RIDER_PATH=%~1"
set "WORK_DIR=%~2"

REM Validate required parameters
if "%RIDER_PATH%"=="" (
    echo [ERROR] RIDER_PATH is required
    echo.
    echo Usage: open-in-rider.bat [RIDER_PATH] [WORK_DIR]
    echo.
    echo Example:
    echo   open-in-rider.bat "C:\Program Files\JetBrains\JetBrains Rider 2025.1.4\bin\rider64.exe" "D:\Projects\MHAClient_main"
    echo.
    exit /b 1
)

if "%WORK_DIR%"=="" (
    echo [ERROR] WORK_DIR is required
    echo.
    echo Usage: open-in-rider.bat [RIDER_PATH] [WORK_DIR]
    echo.
    exit /b 1
)

REM Determine the solution file path
set "SLN_FILE=%WORK_DIR%\MHAGame\MHMobile.sln"

echo.
echo Configuration:
echo   Rider Path:     %RIDER_PATH%
echo   Working Dir:    %WORK_DIR%
echo   Solution File:  %SLN_FILE%
echo.

REM Check if working directory exists
if not exist "%WORK_DIR%" (
    echo [ERROR] Working directory does not exist: %WORK_DIR%
    echo Please ensure the workspace is properly set up.
    exit /b 1
)

REM Check if Rider exists
if not exist "%RIDER_PATH%" (
    echo [ERROR] JetBrains Rider not found at: %RIDER_PATH%
    echo Please check the Rider installation path.
    exit /b 1
)

REM Check if solution file exists
if not exist "%SLN_FILE%" (
    echo [ERROR] Solution file not found: %SLN_FILE%
    echo Please check if the project has been generated.
    echo.
    echo Suggestion: Run the project generation script first.
    exit /b 1
)

REM Open the project in Rider
echo ========================================
echo Launching JetBrains Rider...
echo ========================================
echo.
start "" "%RIDER_PATH%" "%SLN_FILE%"

if %errorlevel% neq 0 (
    echo [ERROR] Failed to launch JetBrains Rider.
    exit /b 1
)

echo ========================================
echo [SUCCESS] JetBrains Rider launched successfully!
echo ========================================
echo.

endlocal
exit /b 0

