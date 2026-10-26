[CmdletBinding()]
param([ValidateRange(5, 240)][int]$IntervalMinutes = 30)

$ErrorActionPreference = 'Continue'
$agent = Join-Path $PSScriptRoot 'tamusni-local-agent.ps1'
while ($true) {
  # A separate PowerShell process makes an individual failed recovery harmless:
  # the daemon remains alive and retries on the next interval.
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $agent -Mode once
  Start-Sleep -Seconds ($IntervalMinutes * 60)
}
