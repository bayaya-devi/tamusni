[CmdletBinding()]
param([ValidateSet('once')][string]$Mode = 'once')

$ErrorActionPreference = 'Stop'
# Codex reads its stdin as UTF-8. Windows can otherwise send text through the
# legacy console code page, which damages accents and Arabic before the model
# ever sees the editorial prompt.
$utf8NoBom = New-Object Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
$AgentVersion = '1.0.0'
$AgentId = 'windows-codex-local'
$StatePath = Join-Path $env:LOCALAPPDATA 'TAMUSNI\local-agent.json'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$SchemaPath = Join-Path $PSScriptRoot 'content-schema.json'

function Read-AgentConfig {
  if (!(Test-Path -LiteralPath $StatePath)) { throw 'LOCAL_AGENT_NOT_CONFIGURED' }
  $state = Get-Content -LiteralPath $StatePath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($state.tokenDpapi) {
    $cipher = [Convert]::FromBase64String([string]$state.tokenDpapi)
    $clear = [System.Security.Cryptography.ProtectedData]::Unprotect($cipher, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $token = [Text.Encoding]::UTF8.GetString($clear)
  } else {
    # Legacy configuration, retained solely to migrate existing installations.
    $secure = ConvertTo-SecureString -String $state.tokenProtected
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  }
  if (!$state.workerOrigin -or !$token) { throw 'LOCAL_AGENT_CONFIGURATION_INVALID' }
  return @{ Origin = $state.workerOrigin.TrimEnd('/'); Token = $token }
}

function Invoke-AgentApi([hashtable]$Config, [string]$Path, [object]$Body) {
  $json = $Body | ConvertTo-Json -Depth 16 -Compress
  try { $null = $json | ConvertFrom-Json -ErrorAction Stop }
  catch { throw "LOCAL_AGENT_JSON_SERIALIZATION_INVALID: $($_.Exception.Message)" }
  $requestPath = Join-Path $env:TEMP ("tamusni-agent-request-" + [guid]::NewGuid().ToString() + '.json')
  $responsePath = Join-Path $env:TEMP ("tamusni-agent-response-" + [guid]::NewGuid().ToString() + '.json')
  [IO.File]::WriteAllText($requestPath, $json, (New-Object Text.UTF8Encoding($false)))
  try {
    $status = & curl.exe --ipv4 --silent --show-error --request POST --connect-timeout 15 --max-time 95 --header "Authorization: Bearer $($Config.Token)" --header 'Content-Type: application/json; charset=utf-8' --data-binary "@$requestPath" --output $responsePath --write-out '%{http_code}' ($Config.Origin + $Path)
    if ($LASTEXITCODE -ne 0) { throw "LOCAL_AGENT_TRANSPORT_FAILED:$LASTEXITCODE" }
    $body = if (Test-Path -LiteralPath $responsePath) { Get-Content -LiteralPath $responsePath -Raw -Encoding utf8 } else { '' }
    if ([int]$status -lt 200 -or [int]$status -ge 300) { throw "LOCAL_AGENT_HTTP_${status}: $body" }
    return ($body | ConvertFrom-Json)
  } finally {
    Remove-Item -LiteralPath $requestPath,$responsePath -Force -ErrorAction SilentlyContinue
  }
}

function Send-Heartbeat([hashtable]$Config, [string]$Status, [string]$Detail = '', [string]$LastJobId = '') {
  Invoke-AgentApi $Config '/local-agent/heartbeat' @{ agentId = $AgentId; version = $AgentVersion; status = $Status; detail = $Detail; lastJobId = $LastJobId; capabilities = @{ codex = $true; mode = 'read_only_editorial_brief' } } | Out-Null
}

$config = $null
$claim = $null
try {
  $config = Read-AgentConfig
  Send-Heartbeat $config 'online' 'agent started'
  $claimResponse = Invoke-AgentApi $config '/local-agent/claim' @{ agentId = $AgentId; version = $AgentVersion; capabilities = @{ codex = $true } }
  $claim = $claimResponse.job
  if ($null -eq $claim) { exit 0 }
  Send-Heartbeat $config 'busy' "processing $($claim.idempotencyKey)" $claim.id
  $context = @{ job = $claimResponse.job; candidates = $claimResponse.candidates; approvedSourceHosts = $claimResponse.approvedSourceHosts; policy = $claimResponse.policy } | ConvertTo-Json -Depth 16 -Compress
  $prompt = "You are the local TAMUSNI editorial recovery agent. Produce one factual, source-backed BRIEF only. Research may use only HTTPS pages whose host is listed in approvedSourceHosts. Use the candidate list when it offers a suitable current subject. Do not invent a fact, date, quote, number, product, person, source, or translation. Do not use a placeholder. Return only JSON matching the supplied schema. Every claim must cite a source id. Write five complete translations: fr, en, ar, es, pt. Each body must contain 350 to 1,100 characters. No image is required. The five editorialScore values must be conservative but their sum must be at least 30; only select a candidate that can honestly meet that threshold. Do not edit any file or publish anything yourself. CONTEXT: $context"
  $output = Join-Path $env:TEMP ("tamusni-local-publication-" + [guid]::NewGuid().ToString() + '.json')
  try {
    # Deliver the generated context through stdin. This avoids PowerShell
    # splitting punctuation or source titles into multiple CLI arguments.
    $prompt | & codex exec -C $RepoRoot -s read-only --output-schema $SchemaPath -o $output -
    if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $output)) { throw 'CODEX_LOCAL_GENERATION_FAILED' }
    # Codex writes UTF-8 JSON without a BOM.  PowerShell 5.1 otherwise assumes
    # the active ANSI code page and corrupts accented and RTL content.
    $generated = Get-Content -LiteralPath $output -Raw -Encoding utf8 | ConvertFrom-Json
    $submission = Invoke-AgentApi $config '/local-agent/submit' @{ agentId = $AgentId; agentVersion = $AgentVersion; jobId = $claim.id; lockToken = $claim.lockToken; publication = $generated.publication }
    if (!$submission.ok) { throw 'LOCAL_SUBMISSION_REJECTED' }
    Send-Heartbeat $config 'online' 'publication verified' $claim.id
  }
  finally { if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Force } }
}
catch {
  $reason = $_.Exception.Message
  if ($config -and $claim) {
    try { Invoke-AgentApi $config '/local-agent/failure' @{ agentId = $AgentId; agentVersion = $AgentVersion; jobId = $claim.id; lockToken = $claim.lockToken; reason = $reason } | Out-Null } catch {}
    try { Send-Heartbeat $config 'error' $reason $claim.id } catch {}
  }
  Write-Error $reason
  exit 1
}
