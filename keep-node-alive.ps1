# keep-node-alive.ps1 (fixed): uses Process events to read stdout/stderr safely
Set-Location $PSScriptRoot

$nodeCmd = "node"
$serverFile = "server.js"
$logDir = Join-Path $PSScriptRoot "runtime-logs"
$lockFile = Join-Path $PSScriptRoot "node_runner.lock"
$maxBackoffSeconds = 300
$baseBackoffSeconds = 2
$maxRestartsWithinWindow = 8
$restartWindowSeconds = 60

if (-not (Test-Path $serverFile)) { Write-Host "Missing $serverFile in $PSScriptRoot. Aborting."; exit 1 }
if (-not (Test-Path $logDir)) { New-Item -Path $logDir -ItemType Directory | Out-Null }

# single-instance guard
if (Test-Path $lockFile) {
  try { $pidTxt = Get-Content $lockFile -ErrorAction Stop } catch { $pidTxt = $null }
  if ($pidTxt -and (Get-Process -Id $pidTxt -ErrorAction SilentlyContinue)) {
    Write-Host "Another runner is active (PID $pidTxt). Exiting."
    exit 0
  } else { Remove-Item $lockFile -Force -ErrorAction SilentlyContinue }
}
Set-Content -Path $lockFile -Value $PID

function New-LogFile {
  $t = Get-Date -Format "yyyyMMdd-HHmmss"
  return Join-Path $logDir ("node-" + $t + ".log")
}

$restartTimestamps = New-Object System.Collections.Generic.List[datetime]
Write-Host "Starting persistent runner for $serverFile (PID $PID). Logs -> $logDir"
Write-Host "Press Ctrl+C to stop this runner (it will remove the lock file)."

try {
  while ($true) {
    $now = Get-Date
    $restartTimestamps.RemoveAll({ param($x) ($now - $x).TotalSeconds -gt $restartWindowSeconds }) | Out-Null
    $restartCount = $restartTimestamps.Count
    $backoff = [math]::Min($maxBackoffSeconds, $baseBackoffSeconds * [math]::Pow(2, $restartCount))
    if ($restartCount -ge $maxRestartsWithinWindow) {
      Write-Host "Detected $restartCount restarts within $restartWindowSeconds seconds. Backing off for $backoff seconds..."
      Start-Sleep -Seconds $backoff
    }

    $logFile = New-LogFile
    Write-Host "Launching $nodeCmd $serverFile  (logging -> $logFile)"

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $nodeCmd
    $startInfo.Arguments = $serverFile
    $startInfo.WorkingDirectory = $PSScriptRoot
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $startInfo

    # open log file for append
    $fs = [System.IO.File]::Open($logFile, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)
    $sw = New-Object System.IO.StreamWriter($fs)
    $sw.AutoFlush = $true

    # event handlers to write stdout/stderr to console and file
    $stdoutHandler = [System.Diagnostics.DataReceivedEventHandler]{
      param($sender, $ea)
      if ($ea.Data -ne $null) {
        $line = (Get-Date).ToString("o") + " [OUT] " + $ea.Data
        Write-Host $line
        $sw.WriteLine($line)
      }
    }
    $stderrHandler = [System.Diagnostics.DataReceivedEventHandler]{
      param($sender, $ea)
      if ($ea.Data -ne $null) {
        $line = (Get-Date).ToString("o") + " [ERR] " + $ea.Data
        Write-Host $line
        $sw.WriteLine($line)
      }
    }

    $proc.add_OutputDataReceived($stdoutHandler)
    $proc.add_ErrorDataReceived($stderrHandler)

    $started = $proc.Start()
    if ($started) {
      $proc.BeginOutputReadLine()
      $proc.BeginErrorReadLine()
    } else {
      Write-Host "Failed to start process."
      $sw.Close(); $fs.Close()
      Start-Sleep -Seconds 2
      continue
    }

    # wait for exit
    $proc.WaitForExit()
    $exitCode = $proc.ExitCode
    $ts = Get-Date
    $line = "$($ts.ToString('o')) Process exited with code $exitCode. Log: $logFile"
    Write-Host $line
    $sw.WriteLine($line)
    $sw.Close(); $fs.Close()

    $restartTimestamps.Add($ts)
    Start-Sleep -Seconds 1
  }
} finally {
  if (Test-Path $lockFile) { Remove-Item $lockFile -Force -ErrorAction SilentlyContinue }
  Write-Host "Runner exiting and lock file removed."
}
