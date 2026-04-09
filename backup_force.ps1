$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = "M:\ARCHON"
$backupsDir = Join-Path $projectRoot "backups"
if (-not (Test-Path $backupsDir)) { New-Item -ItemType Directory -Path $backupsDir | Out-Null }

$now = Get-Date
$year = $now.Year.ToString().Substring(2)
$month = $now.Month.ToString().PadLeft(2, '0')
$day = $now.Day.ToString().PadLeft(2, '0')
$hour = $now.Hour.ToString().PadLeft(2, '0')
$minute = $now.Minute.ToString().PadLeft(2, '0')
$archiveName = "v$year.$month$day.$hour$minute.zip"
$archivePath = Join-Path $backupsDir $archiveName

# Остановка
Write-Host "🛑 Останавливаем серверы..." -ForegroundColor Red
& "$projectRoot\stop.ps1" | Out-Null
Start-Sleep -Seconds 2

# Принудительная остановка по порту 8000
$port = 8000
$connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($connection) {
    $procId = $connection.OwningProcess
    if ($procId -and $procId -gt 0) {
        Write-Host "  ✘ Убиваем PID $procId (порт $port)..." -ForegroundColor Red
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3
    }
}
Write-Host "  ⏳ Ждём 2 секунды для освобождения файлов..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Копирование баз через robocopy (гарантированно работает при блокировке)
$dbFiles = @("backend\data\archon.db", "backend\data\vector_store\chroma.sqlite3")
foreach ($db in $dbFiles) {
    $src = Join-Path $projectRoot $db
    $dst = Join-Path $projectRoot "$db.tmp"
    if (Test-Path $src) {
        try {
            Copy-Item -Path $src -Destination $dst -Force -ErrorAction Stop
            Write-Host "✓ Скопировано: $db" -ForegroundColor Green
        } catch {
            Write-Host "⚠ Копирование $db через Copy-Item провалилось, используем robocopy..." -ForegroundColor Yellow
            robocopy "$projectRoot" "$projectRoot" "$db" "/Z" "/R:0" "/W:0" "/NP" "/NJH" "/NJS" | Out-Null
            # robocopy создаёт копию как "$src.tmp", переименуем
            if (Test-Path "$src.tmp") {
                Move-Item -Path "$src.tmp" -Destination $dst -Force
                Write-Host "✓ robocopy: $db → $db.tmp" -ForegroundColor Green
            }
        }
    }
}

# Удаление старого архива
if (Test-Path $archivePath) { Remove-Item $archivePath -Force }

Write-Host "Создание архива: $archiveName" -ForegroundColor Cyan

$excludePatterns = @('*.zip', '*.7z', '*.rar', 'node_modules', '.git', '__pycache__', '*.pyc', '.venv', 'venv', '.vscode', '.idea', 'temp', 'target', 'backups')
$files = Get-ChildItem -Path $projectRoot -Recurse -File | Where-Object {
    $rel = $_.FullName.Substring($projectRoot.Length + 1)
    $excluded = $false
    foreach ($p in $excludePatterns) {
        if ($rel -like "*$p*" -or $_.Name -like $p) { $excluded = $true; break }
    }
    -not $excluded
}

$zip = [System.IO.Compression.ZipFile]::Open($archivePath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($f in $files) {
        $path = $f.FullName
        $rel = $f.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')

        # Замена на .tmp для баз
        foreach ($db in $dbFiles) {
            $orig = Join-Path $projectRoot $db
            $tmp = Join-Path $projectRoot "$db.tmp"
            if ($path -eq $orig -and (Test-Path $tmp)) {
                $path = $tmp
                $rel = $db.Replace('\', '/')
                break
            }
        }

        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $path, $rel) | Out-Null
    }
} finally {
    # Удаление .tmp
    foreach ($db in $dbFiles) {
        $tmp = Join-Path $projectRoot "$db.tmp"
        if (Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
    }
    $zip.Dispose()
}

$size = [math]::Round((Get-Item $archivePath).Length / 1MB, 2)
Write-Host "`nАрхив создан: $archiveName" -ForegroundColor Green
Write-Host "Размер: $size MB" -ForegroundColor Yellow

Write-Host "▶ Запускаем серверы..." -ForegroundColor Green
& "$projectRoot\start.ps1" | Out-Null
Start-Sleep -Seconds 3
Write-Host "✅ Готово." -ForegroundColor Green