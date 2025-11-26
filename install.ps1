# Quick installer - redirects to the actual installation script
# Ensures the script runs with the same PowerShell session

$InstallScriptPath = Join-Path $PSScriptRoot "scripts\install\install.ps1"

if (-not (Test-Path $InstallScriptPath)) {
    Write-Host "Error: Installation script not found at: $InstallScriptPath" -ForegroundColor Red
    exit 1
}

# Use dot-sourcing to run in the same scope (preserves environment)
. $InstallScriptPath
