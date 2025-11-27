param([string[]]$ArgsFromNpm)
$ErrorActionPreference = 'Stop'

function Add-ToPath([string[]]$paths) {
  $current = ($env:Path -split ';') | Where-Object { $_ -and $_.Trim() -ne '' }
  $prepend = @()
  foreach ($p in $paths) {
    if (-not $p) { continue }
    $full = [System.IO.Path]::GetFullPath($p)
    if ((Test-Path $full) -and -not ($current -contains $full) -and -not ($prepend -contains $full)) {
      $prepend += $full
    }
  }
  $env:Path = ($prepend + $current | Select-Object -Unique) -join ';'
}

# Compute canonical system paths
$system32 = Join-Path $env:SystemRoot 'System32'
$ps51     = Join-Path $system32 'WindowsPowerShell\v1.0'
$ps7      = Join-Path ${env:ProgramFiles} 'PowerShell\7'

# Normalize PATH for this session and all child processes
Add-ToPath @($system32, $ps51, $ps7)

Write-Host "[dev-start] PATH normalized for this session." -ForegroundColor Cyan

# Diagnostics (best-effort)
$pwshBin = (Get-Command pwsh -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source)
$psBin   = (Get-Command powershell -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source)
$tkBin   = Join-Path $system32 'taskkill.exe'
if ($pwshBin) { Write-Host "[dev-start] pwsh: $pwshBin" -ForegroundColor DarkGray }
if ($psBin)   { Write-Host "[dev-start] powershell: $psBin" -ForegroundColor DarkGray }
if (Test-Path $tkBin) { Write-Host "[dev-start] taskkill: $tkBin" -ForegroundColor DarkGray }

# Run existing dev script (vite + electron plugin)
Write-Host "[dev-start] Running: npm run dev" -ForegroundColor Green
npm run dev @ArgsFromNpm
exit $LASTEXITCODE
