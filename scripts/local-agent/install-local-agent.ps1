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
$acl = Get-Acl -LiteralPath $statePath
$acl.SetAccessRuleProtection($true, $false)
$acl.SetOwner([System.Security.Principal.NTAccount]$user)
$acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($user, 'FullControl', 'Allow')))
Set-Acl -LiteralPath $statePath -AclObject $acl
$scriptPath = Join-Path $PSScriptRoot 'tamusni-local-agent.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Mode once"
$logon = New-ScheduledTaskTrigger -AtLogOn
$daily = New-ScheduledTaskTrigger -Daily -At 00:00
$daily.Repetition.Interval = 'PT30M'
$daily.Repetition.Duration = 'P1D'
Register-ScheduledTask -TaskName 'TAMUSNI Editorial Local Recovery' -Action $action -Trigger @($logon, $daily) -Description 'Rattrape de façon séquentielle les publications éditoriales TAMUSNI en attente.' -Force | Out-Null
Start-ScheduledTask -TaskName 'TAMUSNI Editorial Local Recovery'
Write-Output 'TAMUSNI local editorial recovery agent installed.'
