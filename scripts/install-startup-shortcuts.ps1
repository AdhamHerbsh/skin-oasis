$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $projectRoot 'Apex-ERP.vbs'
if (-not (Test-Path -LiteralPath $launcher)) { throw "Launcher not found: $launcher" }

$wsh = New-Object -ComObject WScript.Shell
$targets = @(
  (Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'Apex ERP.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Startup')) 'Apex ERP.lnk')
)
foreach ($shortcutPath in $targets) {
  $shortcut = $wsh.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
  $shortcut.Arguments = '"' + $launcher + '"'
  $shortcut.WorkingDirectory = $projectRoot
  $shortcut.Description = 'Launch Apex ERP'
  $shortcut.IconLocation = Join-Path $env:WINDIR 'System32\shell32.dll,21'
  $shortcut.Save()
  Write-Host "Created shortcut: $shortcutPath"
}

$ruleName = 'ApexSoftwareERP_3001'
& netsh.exe advfirewall firewall show rule name=$ruleName *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Requesting administrator approval to allow shop devices on TCP 3001...'
  $arguments = "advfirewall firewall add rule name=$ruleName dir=in action=allow protocol=TCP localport=3001 profile=private"
  try {
    $process = Start-Process -FilePath (Join-Path $env:WINDIR 'System32\netsh.exe') -ArgumentList $arguments -Verb RunAs -Wait -PassThru
    if ($process.ExitCode -ne 0) { Write-Warning 'Allow TCP 3001 on the private network manually.' }
  } catch {
    Write-Warning 'Allow TCP 3001 on the private network manually.'
  }
}
Write-Host 'Desktop and Windows sign-in shortcuts are ready.' -ForegroundColor Green
