@echo off
setlocal enabledelayedexpansion

:: Monster Hunter UE5 Mobile Game Project - Build Script
:: Author: PC Utility Tool
:: Description: Builds MHA workspace with configurable build configuration

echo ========================================
echo Monster Hunter UE5 Project Builder
echo ========================================

:: Debug: Show received parameters
echo Debug: Received parameters:
echo   Param 1 (WORK_DIR): [%~1]
echo   Param 2 (BUILD_CONFIG): [%~2]
echo   Param 3 (PLATFORM): [%~3]
echo.

:: Set parameters
set WORK_DIR=%~1
set BUILD_CONFIG=%~2
set PLATFORM=%~3

:: Validate required parameters
if "%WORK_DIR%"=="" (
    echo Error: WORK_DIR is required
    echo.
    echo Usage: build-unreal-target.bat [WORK_DIR] [BUILD_CONFIG] [PLATFORM]
    echo.
    echo Available configurations:
    echo   Development - Development Editor build ^(default^)
    echo   Debug       - Debug Editor build
    echo.
    echo Available platforms:
    echo   Win64   - Windows 64-bit ^(default^)
    echo   Android - Android platform
    echo   iOS     - iOS platform
    echo   Linux   - Linux platform
    echo   Mac     - macOS platform
    echo.
    echo Example:
    echo   build-unreal-target.bat "D:\Projects\MHAClient_main" "Development" "Win64"
    goto :end
)

:: Set default configuration if not provided
if "%BUILD_CONFIG%"=="" (
    set BUILD_CONFIG=Development
)

:: Set default platform if not provided
if "%PLATFORM%"=="" (
    set PLATFORM=Win64
)

:: Validate build configuration
if /i not "%BUILD_CONFIG%"=="Development" if /i not "%BUILD_CONFIG%"=="Debug" (
    echo Error: Invalid build configuration "%BUILD_CONFIG%"
    echo Available configurations: Development, Debug
    goto :end
)

:: Validate platform
if /i not "%PLATFORM%"=="Win64" if /i not "%PLATFORM%"=="Android" if /i not "%PLATFORM%"=="iOS" if /i not "%PLATFORM%"=="Linux" if /i not "%PLATFORM%"=="Mac" (
    echo Error: Invalid platform "%PLATFORM%"
    echo Available platforms: Win64, Android, iOS, Linux, Mac
    goto :end
)

:: Set paths
set GENERATE_PROJECT_SCRIPT=%WORK_DIR%\GenerateProjectFiles_MHMobile.bat
set BUILD_SCRIPT=%WORK_DIR%\Engine\Build\BatchFiles\Build.bat
set UPROJECT=%WORK_DIR%\MHAGame\MHMobile.uproject

echo.
echo Configuration:
echo   Working Directory: %WORK_DIR%
echo   Build Config:      %BUILD_CONFIG%
echo   Target Platform:   %PLATFORM%
echo   UProject File:     %UPROJECT%
echo.

:: Check if directory exists
if not exist "%WORK_DIR%" (
    echo Error: Working directory does not exist: %WORK_DIR%
    echo Please ensure the workspace is properly set up.
    goto :end
)

:: Check if generate project script exists
if not exist "%GENERATE_PROJECT_SCRIPT%" (
    echo Error: Generate project script not found: %GENERATE_PROJECT_SCRIPT%
    goto :end
)

:: Check if build script exists
if not exist "%BUILD_SCRIPT%" (
    echo Error: Build script not found: %BUILD_SCRIPT%
    goto :end
)

:: Check if uproject file exists
if not exist "%UPROJECT%" (
    echo Error: Project file not found: %UPROJECT%
    goto :end
)

:: Change to working directory
echo Changing to working directory...
cd /d "%WORK_DIR%"
if errorlevel 1 (
    echo Error: Failed to change to directory %WORK_DIR%
    goto :end
)

:: Step 1: Generate project files
echo.
echo ========================================
echo Step 1: Generating project files...
echo ========================================
echo.

call "%GENERATE_PROJECT_SCRIPT%"
if errorlevel 1 (
    echo.
    echo Error: Failed to generate project files
    goto :end
)

echo.
echo Project files generated successfully!

:: Step 2: Build the project
echo.
echo ========================================
echo Step 2: Building %BUILD_CONFIG% Editor for %PLATFORM%...
echo ========================================
echo.

:: Set architecture based on platform
set ARCHITECTURE=x64
if /i "%PLATFORM%"=="Android" set ARCHITECTURE=arm64
if /i "%PLATFORM%"=="iOS" set ARCHITECTURE=arm64

:: Build UnrealEditor and ShaderCompileWorker
call "%BUILD_SCRIPT%" -Target="MHMobileEditor %PLATFORM% %BUILD_CONFIG% -Project=\"%UPROJECT%\"" -Target="ShaderCompileWorker %PLATFORM% %BUILD_CONFIG% -Project=\"%UPROJECT%\" -Quiet" -WaitMutex -FromMsBuild -architecture=%ARCHITECTURE%

if errorlevel 1 (
    echo.
    echo ========================================
    echo Build FAILED
    echo ========================================
    echo.
    echo Configuration: %BUILD_CONFIG%
    echo Platform: %PLATFORM%
    echo Working Directory: %WORK_DIR%
    echo.
    echo Please check the build output for errors
    echo.
    echo Suggestions:
    echo   - Check for compilation errors in the output above
    echo   - Verify all source files are valid
    echo   - Ensure all dependencies are properly installed
    echo   - Try cleaning the project and rebuilding
    echo.
    goto :end
) else (
    echo.
    echo ========================================
    echo Build SUCCESSFUL!
    echo ========================================
    echo.
    echo Configuration:     %BUILD_CONFIG%
    echo Platform:          %PLATFORM%
    echo Working Directory: %WORK_DIR%
    echo Output:            %WORK_DIR%\Binaries\%PLATFORM%
    echo.
)

:end
echo.
