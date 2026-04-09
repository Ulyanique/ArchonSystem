# ARCHON - Knowledge Management System for Writers
# PowerShell Startup Script

$PYTHON_PATH = "python"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ARCHON - System Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/5] Checking Python 3.12..." -ForegroundColor Yellow
try {
    $pythonVersion = & $PYTHON_PATH --version 2>&1
    Write-Host "  Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Python 3.12 not found!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[2/5] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "  Found: Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js not found! Install Node.js 18+" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[3/5] Checking virtual environment..." -ForegroundColor Yellow
if (-not (Test-Path "backend\venv")) {
    Write-Host "  Creating venv..." -ForegroundColor Cyan
    & $PYTHON_PATH -m venv backend\venv
    Write-Host "  Virtual environment created" -ForegroundColor Green
} else {
    Write-Host "  Virtual environment found" -ForegroundColor Green
}

Write-Host "[4/5] Checking Python dependencies..." -ForegroundColor Yellow
& "backend\venv\Scripts\python.exe" -m pip install -r backend\requirements.txt --quiet
Write-Host "  Dependencies installed" -ForegroundColor Green

Write-Host "[5/5] Checking Node.js dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "  Installing npm packages..." -ForegroundColor Cyan
    Push-Location frontend
    npm install --silent
    Pop-Location
    Write-Host "  Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  Dependencies found" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting servers..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""

if (-not (Test-Path "data")) {
    New-Item -ItemType Directory -Path "data" | Out-Null
}

Write-Host "[Backend] Starting..." -ForegroundColor Cyan
$backendScript = @"
Set-Location "$PSScriptRoot\backend"
& ".\venv\Scripts\activate.ps1"
Write-Host "Backend started" -ForegroundColor Green
& python -m uvicorn app.main:app --reload --port 8000
"@

$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript -PassThru -WindowStyle Normal

Write-Host "[Backend] Waiting for server to accept connections (up to 90 sec)..." -ForegroundColor Yellow
$backendReady = $false
$attempts = 0
$maxAttempts = 45
while (-not $backendReady -and $attempts -lt $maxAttempts) {
    Start-Sleep -Seconds 2
    $attempts++
    try {
        $null = Invoke-WebRequest -Uri "http://127.0.0.1:8000/docs" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        $backendReady = $true
        Write-Host "  Backend is ready." -ForegroundColor Green
    } catch {
        Write-Host "  Attempt $attempts/$maxAttempts..." -ForegroundColor Gray
    }
}
if (-not $backendReady) {
    Write-Host "  WARNING: Backend did not respond in time. Start it manually and refresh the page." -ForegroundColor Yellow
}

Write-Host "[Frontend] Starting..." -ForegroundColor Cyan
$frontendScript = @"
Set-Location "$PSScriptRoot\frontend"
Write-Host "Frontend started" -ForegroundColor Green
& npm run dev
"@

$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript -PassThru -WindowStyle Normal

Start-Sleep -Seconds 5
Write-Host ""
Write-Host "[Browser] Opening..." -ForegroundColor Cyan
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ARCHON started successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Terminal windows are open. Close them to stop the servers." -ForegroundColor Yellow
Write-Host ""

Read-Host "Press Enter to finish script (windows will keep running)"
