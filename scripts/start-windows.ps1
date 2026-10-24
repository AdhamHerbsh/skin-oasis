$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
$dataDir = Join-Path $projectRoot "data"
$envFile = Join-Path $dataDir ".env"
$startupLog = Join-Path $dataDir "startup-error.log"

function Request-InitialAdminPassword {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing

  $form = New-Object System.Windows.Forms.Form
  $form.Text = "إعداد مدير النظام"
  $form.Size = New-Object System.Drawing.Size(430, 255)
  $form.StartPosition = "CenterScreen"
  $form.FormBorderStyle = "FixedDialog"
  $form.MaximizeBox = $false
  $form.MinimizeBox = $false
  $form.RightToLeft = "Yes"
  $form.RightToLeftLayout = $true
  $form.TopMost = $true

  $title = New-Object System.Windows.Forms.Label
  $title.Text = "أنشئ كلمة مرور مدير النظام (14 حرفاً على الأقل)."
  $title.Location = New-Object System.Drawing.Point(18, 18)
  $title.Size = New-Object System.Drawing.Size(380, 28)
  $form.Controls.Add($title)

  $passwordLabel = New-Object System.Windows.Forms.Label
  $passwordLabel.Text = "كلمة المرور"
  $passwordLabel.Location = New-Object System.Drawing.Point(18, 58)
  $passwordLabel.Size = New-Object System.Drawing.Size(380, 20)
  $form.Controls.Add($passwordLabel)

  $passwordBox = New-Object System.Windows.Forms.TextBox
  $passwordBox.Location = New-Object System.Drawing.Point(18, 80)
  $passwordBox.Size = New-Object System.Drawing.Size(380, 25)
  $passwordBox.UseSystemPasswordChar = $true
  $form.Controls.Add($passwordBox)

  $confirmLabel = New-Object System.Windows.Forms.Label
  $confirmLabel.Text = "تأكيد كلمة المرور"
  $confirmLabel.Location = New-Object System.Drawing.Point(18, 112)
  $confirmLabel.Size = New-Object System.Drawing.Size(380, 20)
  $form.Controls.Add($confirmLabel)

  $confirmBox = New-Object System.Windows.Forms.TextBox
  $confirmBox.Location = New-Object System.Drawing.Point(18, 134)
  $confirmBox.Size = New-Object System.Drawing.Size(380, 25)
  $confirmBox.UseSystemPasswordChar = $true
  $form.Controls.Add($confirmBox)

  $okButton = New-Object System.Windows.Forms.Button
  $okButton.Text = "حفظ وتشغيل النظام"
  $okButton.Location = New-Object System.Drawing.Point(218, 174)
  $okButton.Size = New-Object System.Drawing.Size(180, 30)
  $okButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
  $form.Controls.Add($okButton)
  $form.AcceptButton = $okButton

  $cancelButton = New-Object System.Windows.Forms.Button
  $cancelButton.Text = "إلغاء"
  $cancelButton.Location = New-Object System.Drawing.Point(18, 174)
  $cancelButton.Size = New-Object System.Drawing.Size(100, 30)
  $cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
  $form.Controls.Add($cancelButton)
  $form.CancelButton = $cancelButton

  while ($true) {
    $result = $form.ShowDialog()
    if ($result -ne [System.Windows.Forms.DialogResult]::OK) {
      $form.Dispose()
      return $null
    }
    if ($passwordBox.Text.Length -lt 14) {
      [System.Windows.Forms.MessageBox]::Show("يجب أن تتكون كلمة المرور من 14 حرفاً على الأقل.", "كلمة مرور غير كافية", "OK", "Warning") | Out-Null
      continue
    }
    if ($passwordBox.Text -cne $confirmBox.Text) {
      [System.Windows.Forms.MessageBox]::Show("كلمتا المرور غير متطابقتين.", "تحقق من كلمة المرور", "OK", "Warning") | Out-Null
      $confirmBox.Clear()
      continue
    }
    $resultPassword = $passwordBox.Text
    $form.Dispose()
    return $resultPassword
  }
}

try {
  New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

  $pgRoot = Join-Path $projectRoot "runtime\postgresql"
  if (-not (Test-Path $pgRoot)) {
    $pgRoot = Join-Path $projectRoot "work\postgresql-portable\pgsql"
  }
  $pgData = Join-Path $dataDir "pgdata"
  $pgBin = Join-Path $pgRoot "bin"
  $pgCtl = Join-Path $pgBin "pg_ctl.exe"

  $node = Join-Path $projectRoot "runtime\node.exe"
  if (-not (Test-Path $node)) {
    $node = (Get-Command "node.exe" -ErrorAction SilentlyContinue).Source
  }

  if (-not $node -or -not (Test-Path $pgCtl)) {
    throw "ملفات التشغيل غير مكتملة. لم يتم العثور على Node.js أو PostgreSQL Portable."
  }

  # 1. Initialize environment file (.env) if missing
  if (-not (Test-Path $envFile)) {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
      $rngBytes = New-Object byte[] 48
      $rng.GetBytes($rngBytes)
      $authSecret = [Convert]::ToBase64String($rngBytes)
      $dbBytes = New-Object byte[] 32
      $rng.GetBytes($dbBytes)
      $dbPassword = ([BitConverter]::ToString($dbBytes)).Replace("-", "").ToLowerInvariant()
    } finally {
      $rng.Dispose()
    }
    
    $config = @(
      "DATABASE_URL=postgres://cosmetics:$dbPassword@127.0.0.1:55433/cosmetics_erp",
      "AUTH_SECRET=$authSecret",
      "SESSION_COOKIE_SECURE=false",
      "TRUST_PROXY=false",
      "NEXT_OUTPUT_MODE=standard",
      "NEXT_DIST_DIR=.next-installer",
      "HOSTNAME=0.0.0.0",
      "PORT=3001",
      "UPLOADS_DIR=./data/uploads",
      "BACKUP_DIR=./data/backups"
    )
    Set-Content -LiteralPath $envFile -Value $config -Encoding ascii
    
    # Initialize PostgreSQL data folder if PG_VERSION doesn't exist
    if (-not (Test-Path (Join-Path $pgData "PG_VERSION"))) {
      $pgPasswordFile = Join-Path $dataDir "pg-password.tmp"
      Set-Content -LiteralPath $pgPasswordFile -Value $dbPassword -NoNewline -Encoding ascii
      & (Join-Path $pgBin "initdb.exe") -D $pgData -U cosmetics -A scram-sha-256 --pwfile=$pgPasswordFile -E UTF8 *>&1 | Out-Null
      Remove-Item $pgPasswordFile -Force -ErrorAction SilentlyContinue
    }
    
  }

  foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^([A-Z_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process") }
  }
  $env:PGPASSWORD = ($env:DATABASE_URL -replace '^postgres://[^:]+:([^@]+)@.*$', '$1')

  # 2. Check and start PostgreSQL
  $pgRunning = $false
  try {
    $testTcp = New-Object System.Net.Sockets.TcpClient
    $connect = $testTcp.BeginConnect("127.0.0.1", 55433, $null, $null)
    $wait = $connect.AsyncWaitHandle.WaitOne(1000, $false)
    if ($wait -and $testTcp.Connected) {
      $testTcp.EndConnect($connect)
      $pgRunning = $true
    }
    $testTcp.Close()
  } catch {}

  if (-not $pgRunning) {
    $pidFile = Join-Path $pgData "postmaster.pid"
    if (Test-Path $pidFile) { Remove-Item -Force $pidFile -ErrorAction SilentlyContinue }
    
    & $pgCtl -D $pgData -l (Join-Path $dataDir "postgres-server.log") -o "-h 127.0.0.1 -p 55433" start
    
    # Wait up to 8 seconds for database socket
    for ($i = 0; $i -lt 8; $i++) {
      Start-Sleep -Seconds 1
      try {
        $testTcp = New-Object System.Net.Sockets.TcpClient
        $connect = $testTcp.BeginConnect("127.0.0.1", 55433, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(800, $false)
        if ($wait -and $testTcp.Connected) {
          $testTcp.EndConnect($connect)
          $testTcp.Close()
          $pgRunning = $true
          break
        }
        $testTcp.Close()
      } catch {}
    }
  }

  # 3. Ensure database cosmetics_erp exists
  $psql = Join-Path $pgBin "psql.exe"
  $dbExists = & $psql -h 127.0.0.1 -p 55433 -U cosmetics -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='cosmetics_erp'" 2>&1
  if ($dbExists -notlike "*1*") {
    & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p 55433 -U cosmetics cosmetics_erp 2>&1 | Out-Null
  }

  # 4. Run database migrations
  $migrateScript = Join-Path $projectRoot "scripts\migrate-runtime.mjs"
  if (Test-Path $migrateScript) {
    & $node $migrateScript
  }

  # 5. Seed initial admin account
  $adminExists = & $psql -h 127.0.0.1 -p 55433 -U cosmetics -d cosmetics_erp -tAc "SELECT 1 FROM users WHERE username='admin' LIMIT 1" 2>&1
  if ($adminExists -notlike "*1*") {
    $initialAdminPassword = $env:SEED_ADMIN_PASSWORD
    if (-not $initialAdminPassword -or $initialAdminPassword.Length -lt 14) {
      $initialAdminPassword = Request-InitialAdminPassword
    }
    if (-not $initialAdminPassword) {
      throw "تم إلغاء إنشاء حساب المدير. شغّل النظام مرة أخرى وأكمل إعداد كلمة المرور الأولى."
    }
    $env:SEED_ADMIN_PASSWORD = $initialAdminPassword
    $seedScript = Join-Path $projectRoot "scripts\seed-runtime.mjs"
    if (Test-Path $seedScript) {
      & $node $seedScript
    }
    $env:SEED_ADMIN_PASSWORD = $null
    $env:SEED_ADMIN_PASSWORD = $null
  }

  # 6. Check if Web Server is already running
  $existing = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { 
    $_.CommandLine -like "*$projectRoot*" -or $_.CommandLine -like "*standalone*server.js*"
  }

  if (-not $existing) {
    $env:HOSTNAME = "0.0.0.0"
    $env:PORT = "3001"
    $server = Join-Path $projectRoot "server.js"
    if (-not (Test-Path $server)) {
      $server = Join-Path $projectRoot ".next-bundle\standalone\server.js"
    }
    
    if (Test-Path $server) {
      $proc = Start-Process -FilePath $node -ArgumentList @($server) -WorkingDirectory $projectRoot -RedirectStandardOutput (Join-Path $dataDir "app.log") -RedirectStandardError (Join-Path $dataDir "app-error.log") -WindowStyle Hidden -PassThru
      if ($proc) {
        Set-Content -LiteralPath (Join-Path $dataDir "app.pid") -Value $proc.Id -Encoding ascii
      }
    } else {
      $nextCli = Join-Path $projectRoot "node_modules\next\dist\bin\next"
      if (Test-Path $nextCli) {
        $proc = Start-Process -FilePath $node -ArgumentList @($nextCli, "start", "--hostname", "0.0.0.0", "--port", "3001") -WorkingDirectory $projectRoot -RedirectStandardOutput (Join-Path $dataDir "app.log") -RedirectStandardError (Join-Path $dataDir "app-error.log") -WindowStyle Hidden -PassThru
        if ($proc) {
          Set-Content -LiteralPath (Join-Path $dataDir "app.pid") -Value $proc.Id -Encoding ascii
        }
      } else {
        throw "لم يتم العثور على ملفات تشغيل Next.js داخل الحزمة."
      }
    }
  }

  # 7. Wait for port 3001 to respond before launching browser
  for ($i = 0; $i -lt 15; $i++) {
    try {
      $testTcp = New-Object System.Net.Sockets.TcpClient
      $connect = $testTcp.BeginConnect("127.0.0.1", 3001, $null, $null)
      $wait = $connect.AsyncWaitHandle.WaitOne(600, $false)
      if ($wait -and $testTcp.Connected) {
        $testTcp.EndConnect($connect)
        $testTcp.Close()
        break
      }
      $testTcp.Close()
    } catch {}
    Start-Sleep -Milliseconds 500
  }

  # 8. Open default browser
  Start-Process "http://127.0.0.1:3001"

} catch {
  $errMsg = $_.Exception.ToString()
  Set-Content -LiteralPath $startupLog -Value $errMsg -Encoding UTF8
  
  # Try to show a GUI alert to the user so they know what happened
  try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
      "حدث خطأ أثناء تشغيل Apex Software ERP:`n`n$($_.Exception.Message)`n`nتم حفظ التفاصيل في: data\startup-error.log",
      "Apex Software ERP - تنبيه",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  } catch {}
  
  exit 1
}
