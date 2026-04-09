# ARCHON - Скрипт остановки всех процессов
# Запустите от имени администратора если есть проблемы с остановкой

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ARCHON - Остановка серверов" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Остановка Python процессов (backend)
Write-Host "[1/3] Остановка Python процессов (backend)..." -ForegroundColor Yellow
$pythonProcesses = Get-Process | Where-Object { 
    $_.ProcessName -eq "python" -and 
    $_.Path -like "*ARCHON*" 
}

if ($pythonProcesses) {
    foreach ($proc in $pythonProcesses) {
        Write-Host "  Остановка процесса $($proc.Id)..." -ForegroundColor Cyan
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "  ✓ Python процессы остановлены" -ForegroundColor Green
} else {
    Write-Host "  ℹ Python процессы не найдены" -ForegroundColor Gray
}

# Остановка Node.js процессов (frontend)
Write-Host "[2/3] Остановка Node.js процессов (frontend)..." -ForegroundColor Yellow
$nodeProcesses = Get-Process | Where-Object { 
    $_.ProcessName -eq "node" -and 
    $_.Path -like "*ARCHON*" 
}

if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        Write-Host "  Остановка процесса $($proc.Id)..." -ForegroundColor Cyan
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "  ✓ Node.js процессы остановлены" -ForegroundColor Green
} else {
    Write-Host "  ℹ Node.js процессы не найдены" -ForegroundColor Gray
}

# Очистка портов
Write-Host "[3/3] Очистка портов..." -ForegroundColor Yellow

# Функция для освобождения порта
function Free-Port {
    param([int]$Port)
    
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($connection) {
        $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "  Порт $Port занят процессом $($process.Name) (PID: $($connection.OwningProcess))" -ForegroundColor Yellow
            Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host "  ✓ Порт $Port освобождён" -ForegroundColor Green
        }
    } else {
        Write-Host "  ✓ Порт $Port свободен" -ForegroundColor Green
    }
}

Free-Port -Port 8000  # Backend
Free-Port -Port 5173  # Frontend

# [4/3] Принудительная остановка по использованию баз данных
Write-Host "[4/3] Принудительная остановка по использованию баз..." -ForegroundColor Yellow

$DBPaths = @(
    "M:\ARCHON\backend\data\archon.db",
    "M:\ARCHON\backend\data\vector_store\chroma.sqlite3"
)

foreach ($dbPath in $DBPaths) {
    if (-not (Test-Path $dbPath)) { continue }
    $procs = Get-WmiObject Win32_Process | Where-Object {
        $_.CommandLine -and $_.CommandLine.Contains($dbPath)
    }
    if ($procs) {
        foreach ($p in $procs) {
            Write-Host "  ✘ Убиваем PID $($p.ProcessId) (использует $dbPath)..." -ForegroundColor Red
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "  ℹ Нет процессов, использующих $dbPath" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Все серверы остановлены!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Пауза чтобы увидеть результат
Start-Sleep -Seconds 2
