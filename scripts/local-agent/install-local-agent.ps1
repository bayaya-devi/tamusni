[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$WorkerOrigin,
  [Parameter(Mandatory = $true)][string]$Token
)

$ErrorActionPreference = 'Stop'
$agentDir = Join-Path $env:LOCALAPPDATA 'TAMUSNI'
New-Item -ItemType Directory -Force -Path $agentDir | Out-Null
$secure = ConvertTo-SecureString -String $Token -AsPlainText -Force
$state = @{ workerOrigin = $WorkerOrigin.TrimEnd('/'); tokenProtected = ConvertFrom-SecureString -SecureString $secure; installedAt = (Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress
$statePath = Join-Path $agentDir 'local-agent.json'
Set-Content -LiteralPath $statePath -Value $state -Encoding UTF8
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
# DPAPI already binds the secret to this Windows account. Tighten the ACL where
# the current Windows edition allows it, but do not make installation depend on
# privileges that ordinary interactive accounts do not have.
try {
  $acl = Get-Acl -LiteralPath $statePath
  $acl.SetAccessRuleProtection($true, $false)
  $acl.ResetAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($user, 'FullControl', 'Allow')))
  Set-Acl -LiteralPath $statePath -AclObject $acl
} catch {
  Write-Warning 'ACL hardening was skipped; the token remains protected with Windows DPAPI for the current user.'
}
$scriptPath = Join-Path $PSScriptRoot 'tamusni-local-agent.ps1'
$daemonPath = Join-Path $PSScriptRoot 'tamusni-local-agent-daemon.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Mode once"
$logon = New-ScheduledTaskTrigger -AtLogOn
$repeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 30) -RepetitionDuration (New-TimeSpan -Days 3650)
try {
  Register-ScheduledTask -TaskName 'TAMUSNI Editorial Local Recovery' -Action $action -Trigger @($logon, $repeat) -Description 'Rattrape de façon séquentielle les publications éditoriales TAMUSNI en attente.' -Force | Out-Null
  Start-ScheduledTask -TaskName 'TAMUSNI Editorial Local Recovery'
  Write-Output 'TAMUSNI local editorial recovery agent installed with Task Scheduler.'
} catch {
  # Some locked-down Windows installations deny ScheduledTasks registration to
  # a standard user. The per-user Startup folder needs no elevation and starts
  # the same bounded agent loop on the next sign-in.
  $startup = [Environment]::GetFolderPath('Startup')
  $launcher = Join-Path $startup 'TAMUSNI Editorial Local Recovery.cmd'
  $command = "@echo off`r`npowershell.exe -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$daemonPath`"`r`n"
  Set-Content -LiteralPath $launcher -Value $command -Encoding ASCII
  Write-Warning 'Task Scheduler access was denied; installed the current-user Startup launcher instead.'
  Write-Output 'TAMUSNI local editorial recovery agent installed with Startup.'
}
