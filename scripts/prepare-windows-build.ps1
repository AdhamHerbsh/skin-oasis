$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path.TrimEnd('\')
$buildDir = [System.IO.Path]::GetFullPath((Join-Path $projectRoot ".next-installer"))
if (-not $buildDir.StartsWith("$projectRoot\", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Build output must stay inside the project directory."
}

if (Test-Path -LiteralPath $buildDir) {
  Remove-Item -LiteralPath $buildDir -Recurse -Force
}

$sourceApp = Join-Path $projectRoot "src\app"
$targetApp = Join-Path $buildDir "server\app"
New-Item -ItemType Directory -Force -Path $targetApp | Out-Null
Get-ChildItem -LiteralPath $sourceApp -Directory -Recurse | ForEach-Object {
  $relative = $_.FullName.Substring($sourceApp.Length).TrimStart('\')
  New-Item -ItemType Directory -Force -Path (Join-Path $targetApp $relative) | Out-Null
}

New-Item -ItemType Directory -Force -Path (Join-Path $targetApp "_global-error.segments\_global-error") | Out-Null
Get-ChildItem -LiteralPath $sourceApp -Directory -Recurse | ForEach-Object {
  $relative = $_.FullName.Substring($sourceApp.Length).TrimStart('\')
  if ($relative) {
    $leaf = Split-Path $relative -Leaf
    New-Item -ItemType Directory -Force -Path (Join-Path $targetApp "$relative.segments\$leaf") | Out-Null
  }
}
