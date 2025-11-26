@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%dev-loop-with-logs.ps1"

pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"

endlocal
