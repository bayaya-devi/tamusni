[CmdletBinding()]
param([ValidateRange(5, 240)][int]$IntervalMinutes = 30)

$ErrorActionPreference = 'Continue'
$agent = Join-Path $PSScriptRoot 'tamusni-local-agent.ps1'
$shell = Join-Path $PSHOME 'pwsh.exe'
if (!(Test-Path -LiteralPath $shell)) { $shell = (Get-Command pwsh.exe -ErrorAction Stop).Source }
while ($true) {
  # A separate PowerShell process makes an individual failed recovery harmless:
  # the daemon remains alive and retries on the next interval.
  & $shell -NoProfile -ExecutionPolicy Bypass -File $agent -Mode once
  Start-Sleep -Seconds ($IntervalMinutes * 60)
}
