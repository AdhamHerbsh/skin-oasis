@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Apex ERP - Customer PC Setup

echo ================================================================
echo   Apex ERP first-time setup - internet is required for npm install
echo ================================================================
echo.

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 24 LTS x64, then run this file again.
  echo https://nodejs.org/en/download
  pause
  exit /b 1
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js 24 LTS with npm enabled.
  pause
  exit /b 1
)
if not exist "work\postgresql-portable\pgsql\bin\pg_ctl.exe" (
  echo PostgreSQL runtime was not found.
  echo The transferred folder must include work\postgresql-portable\pgsql.
  pause
  exit /b 1
)
if not exist "work\postgresql-portable\pgsql\installer\vcredist_x64.exe" (
  echo The bundled Microsoft Visual C++ runtime was not found.
  echo Install the x64 runtime from https://aka.ms/vc14/vc_redist.x64.exe
  pause
  exit /b 1
)

echo Installing the PostgreSQL Visual C++ runtime if required...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$key='HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64'; $v=Get-ItemProperty -Path $key -ErrorAction SilentlyContinue; if (-not $v.Installed) { $p=Start-Process -FilePath '%~dp0work\postgresql-portable\pgsql\installer\vcredist_x64.exe' -ArgumentList '/install /quiet /norestart' -Verb RunAs -Wait -PassThru; if ($p.ExitCode -notin 0,1638,3010) { exit $p.ExitCode } }"
if errorlevel 1 (
  echo Runtime installation failed. Approve the Windows permission prompt and try again.
  pause
  exit /b 1
)

echo.
echo [1/3] Installing app dependencies...
call npm ci
if errorlevel 1 goto :failed

echo.
echo [2/3] Building the app...
set "NEXT_OUTPUT_MODE=standard"
set "NEXT_DIST_DIR=.next-installer"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\prepare-windows-build.ps1"
if errorlevel 1 goto :failed
call npm run build
if errorlevel 1 goto :failed

echo.
echo [3/3] Creating desktop and automatic sign-in shortcuts...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-startup-shortcuts.ps1"
if errorlevel 1 goto :failed

echo.
echo Starting Apex ERP now. The first launch will ask you to create the admin password.
echo Save it securely. The username is admin.
start "" wscript.exe "%~dp0Apex-ERP.vbs"
echo.
echo Setup complete. The desktop shortcut is ready and Windows will start Apex ERP at sign-in.
pause
exit /b 0

:failed
echo.
echo Setup failed. Review the messages above and confirm the PC has internet access.
pause
exit /b 1
