# start.ps1 — always run from repo root and write runtime logs
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot  = Split-Path -Parent $scriptDir
Set-Location $repoRoot
if (-not (Test-Path ".\runtime-logs")) { New-Item -Path ".\runtime-logs" -ItemType Directory | Out-Null }
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
node src/index.js 2>&1 | Tee-Object -FilePath ".\runtime-logs\server-run-$ts.log"
