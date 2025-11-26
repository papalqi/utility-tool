@echo off
setlocal enabledelayedexpansion

:: Monster Hunter UE5 Mobile Game Project - TypeScript Compilation Script
:: Author: PC Utility Tool
:: Description: Compiles TypeScript scripts for MHA workspace with flexible parameter support

echo ========================================
echo Monster Hunter UE5 TypeScript Compiler
echo ========================================

:: Auto-detect and set Node.js path
echo.
echo Detecting Node.js installation...
set NODE_FOUND=0

:: Check common Node.js installation locations
for %%P in (
    "%ProgramFiles%\nodejs"
    "%ProgramFiles(x86)%\nodejs"
    "%LOCALAPPDATA%\Programs\nodejs"
    "%APPDATA%\npm"
) do (
    if exist "%%~P\node.exe" (
        echo Found Node.js at: %%~P
        set "PATH=%%~P;!PATH!"
        set NODE_FOUND=1
        goto :node_found
    )
)

:: Try to use node from PATH (might already be available)
where node >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js found in system PATH
    set NODE_FOUND=1
    goto :node_found
)

:node_not_found
echo.
echo ========================================
echo WARNING: Node.js not found!
echo ========================================
echo Node.js is required to compile TypeScript.
echo Please install Node.js from: https://nodejs.org/
echo Or ensure Node.js is in your system PATH.
echo.
echo Common installation paths checked:
echo   - %ProgramFiles%\nodejs
echo   - %ProgramFiles(x86)%\nodejs
echo   - %LOCALAPPDATA%\Programs\nodejs
echo.
goto :end

:node_found
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js version:
    node --version
) else (
    echo Warning: Node.js detected but cannot execute
)
echo.

:: Debug: Show received parameters
echo Debug: Received parameters:
echo   Param 1 (WORK_DIR): [%~1]
echo.

:: Set parameters
set WORK_DIR=%~1

:: Validate required parameters
if "%WORK_DIR%"=="" (
    echo Error: WORK_DIR is required
    echo.
    echo Usage: compile-typescript.bat [WORK_DIR]
    echo.
    echo Example:
    echo   compile-typescript.bat "D:\Projects\MHAClient_main"
    goto :end
)

:: Set paths
set TS_PROJ_DIR=%WORK_DIR%\MHAGame\TsProj
set UPROJECT=%WORK_DIR%\MHAGame\MHMobile.uproject
set UNREAL_CMD=%WORK_DIR%\Engine\Binaries\Win64\UnrealEditor-Cmd.exe
set TSC_CMD=%TS_PROJ_DIR%\node_modules\.bin\tsc.cmd
set TSCONFIG=%TS_PROJ_DIR%\tsconfig.json

echo.
echo Configuration:
echo   Working Directory:    %WORK_DIR%
echo   TS Project Directory: %TS_PROJ_DIR%
echo   UProject File:        %UPROJECT%
echo.

:: Check if directory exists
if not exist "%WORK_DIR%" (
    echo Error: Working directory does not exist: %WORK_DIR%
    echo Please ensure the workspace is properly set up.
    goto :end
)

:: Check if TS project directory exists
if not exist "%TS_PROJ_DIR%" (
    echo Error: TypeScript project directory does not exist: %TS_PROJ_DIR%
    goto :end
)

:: Check if uproject file exists
if not exist "%UPROJECT%" (
    echo Error: Project file not found: %UPROJECT%
    goto :end
)

:: Check if UnrealEditor-Cmd.exe exists
if not exist "%UNREAL_CMD%" (
    echo Error: UnrealEditor-Cmd.exe not found: %UNREAL_CMD%
    goto :end
)

:: Check if tsc command exists
if not exist "%TSC_CMD%" (
    echo Error: TypeScript compiler not found: %TSC_CMD%
    echo Please ensure TypeScript dependencies are installed in %TS_PROJ_DIR%
    echo Run: cd "%TS_PROJ_DIR%" ^&^& npm install
    goto :end
)

:: Check if tsconfig.json exists
if not exist "%TSCONFIG%" (
    echo Error: tsconfig.json not found: %TSCONFIG%
    goto :end
)

:: Change to working directory
echo Changing to working directory...
cd /d "%WORK_DIR%"
if errorlevel 1 (
    echo Error: Failed to change to directory %WORK_DIR%
    goto :end
)

:: Step 1: Generate TypeScript type definitions (GenTs)
echo.
echo ========================================
echo Step 1: Generating TypeScript type definitions (GenTs)...
echo ========================================
echo.
echo Running: "%UNREAL_CMD%" "%UPROJECT%" -Run=MHEditor -Gen_UE_D_TS
echo.

::"%UNREAL_CMD%" "%UPROJECT%" -Run=MHEditor -Gen_UE_D_TS
if errorlevel 1 (
    echo.
    echo ========================================
    echo Error: Failed to generate TypeScript type definitions
    echo ========================================
    goto :end
)

echo.
echo ========================================
echo TypeScript type definitions generated successfully!
echo ========================================

:: Step 2: Compile TypeScript (CompileTs)
echo.
echo ========================================
echo Step 2: Compiling TypeScript to JavaScript (CompileTs)...
echo ========================================
echo.
echo Running: "%TSC_CMD%" -p "%TSCONFIG%" with NODE_OPTIONS=--max-old-space-size=8192
echo Note: Using 8GB memory limit to handle large project
echo.

setlocal
set NODE_OPTIONS=--max-old-space-size=8192
call "%TSC_CMD%" -p "%TSCONFIG%"
endlocal
if errorlevel 1 (
    echo.
    echo ========================================
    echo TypeScript compilation FAILED
    echo ========================================
    echo.
    echo Please check the compilation errors above
    echo.
    echo Suggestions:
    echo   - Check TypeScript syntax errors
    echo   - Verify tsconfig.json configuration
    echo   - Ensure all dependencies are installed
    echo.
    goto :end
) else (
    echo.
    echo ========================================
    echo TypeScript compilation SUCCESSFUL!
    echo ========================================
    echo.
    echo Working Directory:    %WORK_DIR%
    echo TS Project Directory: %TS_PROJ_DIR%
    echo Output Directory:     %WORK_DIR%\MHAGame\Content\JavaScript
    echo.
)

:end
echo.

