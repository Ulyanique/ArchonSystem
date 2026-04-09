# setup.ps1 - ARCHON Setup Script
# Use this script to install all dependencies and prepare the environment.

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ARCHON - Environment Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Python 3.12
Write-Host "[1/6] Checking Python 3.12..." -ForegroundColor Yellow
$pythonExe = "python"
try {
    $pyVer = & $pythonExe --version 2>&1
    if ($pyVer -like "*Python 3.12*") {
        Write-Host "  Found: $pyVer" -ForegroundColor Green
    } else {
        Write-Host "  Warning: Found $pyVer. Python 3.12 is recommended." -ForegroundColor Cyan
    }
} catch {
    Write-Host "  ERROR: Python not found! Please install Python 3.12." -ForegroundColor Red
    exit 1
}

# 2. Check Node.js
Write-Host "[2/6] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVer = node --version 2>&1
    Write-Host "  Found: Node.js $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js not found! Please install Node.js 18+." -ForegroundColor Red
    exit 1
}

# 3. Create Virtual Environment
Write-Host "[3/6] Setting up Python virtual environment..." -ForegroundColor Yellow
if (-not (Test-Path "backend\venv")) {
    & $pythonExe -m venv backend\venv
    Write-Host "  Created venv in backend\venv" -ForegroundColor Green
} else {
    Write-Host "  Virtual environment already exists." -ForegroundColor Green
}

# 4. Install Backend Dependencies
Write-Host "[4/6] Installing backend dependencies..." -ForegroundColor Yellow
& "backend\venv\Scripts\pip.exe" install -r backend\requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Failed to install backend dependencies." -ForegroundColor Red
    exit 1
}
Write-Host "  Backend dependencies installed successfully." -ForegroundColor Green

# 5. Install Frontend Dependencies
Write-Host "[5/6] Installing frontend dependencies..." -ForegroundColor Yellow
Push-Location frontend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Failed to install frontend dependencies." -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "  Frontend dependencies installed successfully." -ForegroundColor Green

# 6. Run Database Migrations
Write-Host "[6/6] Running database migrations..." -ForegroundColor Yellow
Push-Location backend
& ".\venv\Scripts\python.exe" -m alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Failed to run migrations." -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "  Migrations completed successfully." -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup completed successfully!" -ForegroundColor Green
Write-Host "  You can now start the system using start.ps1" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to exit"
