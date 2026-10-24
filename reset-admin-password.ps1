$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'data\.env'))) {
  $parentRoot = Split-Path -Parent $PSScriptRoot
  if (Test-Path -LiteralPath (Join-Path $parentRoot 'data\.env')) { $projectRoot = $parentRoot }
}
$dataDir = Join-Path $projectRoot 'data'
$envFile = Join-Path $dataDir '.env'
$pgRoot = Join-Path $projectRoot 'runtime\postgresql'
if (-not (Test-Path -LiteralPath $pgRoot)) { $pgRoot = Join-Path $projectRoot 'work\postgresql-portable\pgsql' }
$pgData = Join-Path $dataDir 'pgdata'
$pgCtl = Join-Path $pgRoot 'bin\pg_ctl.exe'
$node = Join-Path $projectRoot 'runtime\node.exe'
if (-not (Test-Path -LiteralPath $node)) {
  $nodeCommand = Get-Command 'node.exe' -ErrorAction SilentlyContinue
  if ($nodeCommand) { $node = $nodeCommand.Source }
}

if (-not (Test-Path -LiteralPath $envFile)) { throw 'System settings not found. Start Apex ERP once before resetting the password.' }
if (-not (Test-Path -LiteralPath (Join-Path $pgData 'PG_VERSION'))) { throw 'Database not initialized. Start Apex ERP once before resetting the password.' }
if (-not (Test-Path -LiteralPath $pgCtl)) { throw 'Portable PostgreSQL runtime not found.' }
if (-not $node) { throw 'Node.js was not found.' }
$dbLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $dbLine) { throw 'DATABASE_URL not found in data\.env.' }
$env:DATABASE_URL = $dbLine.Substring('DATABASE_URL='.Length)

$firstSecure = Read-Host 'Enter the new admin password (14 characters minimum)' -AsSecureString
$secondSecure = Read-Host 'Confirm the new admin password' -AsSecureString
function Convert-SecureToPlainText($secureString) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureString)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
$newPassword = Convert-SecureToPlainText $firstSecure
$confirmation = Convert-SecureToPlainText $secondSecure
if ($newPassword.Length -lt 14) { throw 'The password must contain at least 14 characters.' }
if ($newPassword -cne $confirmation) { throw 'The two passwords do not match.' }

$startedDatabaseHere = $false
$status = & $pgCtl -D $pgData status 2>&1 | Out-String
if ($status -notmatch 'server is running') {
  & $pgCtl -D $pgData -l (Join-Path $dataDir 'postgres-server.log') -o '-h 127.0.0.1 -p 55433' start
  if ($LASTEXITCODE -ne 0) { throw 'Could not start PostgreSQL. Check data\postgres-server.log.' }
  $startedDatabaseHere = $true
  Start-Sleep -Seconds 2
}
try {
  $env:NEW_ADMIN_PASSWORD = $newPassword
  $env:PROJECT_ROOT = $projectRoot
  & $node (Join-Path $PSScriptRoot 'reset-admin-password.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Password reset failed.' }
} finally {
  $env:NEW_ADMIN_PASSWORD = $null
  $env:PROJECT_ROOT = $null
  $newPassword = $null
  $confirmation = $null
  if ($startedDatabaseHere) { & $pgCtl -D $pgData stop -m fast | Out-Null }
}
