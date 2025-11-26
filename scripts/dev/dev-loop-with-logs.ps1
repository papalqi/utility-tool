Param(
  [string]$LogDir = (Join-Path $PSScriptRoot ".." ".." "logs")
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot ".." "..")
if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$viteLog = Join-Path $LogDir ("npm-dev-{0}.log" -f $timestamp)
$electronLog = Join-Path $LogDir ("electron-dev-{0}.log" -f $timestamp)

Write-Host "Starting Vite (console + $viteLog)"
Write-Host "Will start Electron after Vite is ready (logs -> $electronLog)"

Push-Location $repoRoot
$electronJob = $null
try {
  # Start Electron in the background once Vite is up; log to file only
  $electronJob = Start-Job -ScriptBlock {
    param($root, $logPath)
    Set-Location $root
    npx wait-on tcp:5173 | Out-Null
    npx electron . *>> $logPath
  } -ArgumentList $repoRoot, $electronLog

  # Start Vite in foreground; mirror to console and file
  npm run dev | Tee-Object -FilePath $viteLog
} finally {
  if ($electronJob -ne $null) {
    try { Stop-Job -Job $electronJob -Force -ErrorAction SilentlyContinue } catch {}
    try { Remove-Job -Job $electronJob -Force -ErrorAction SilentlyContinue } catch {}
  }
  Pop-Location
}
