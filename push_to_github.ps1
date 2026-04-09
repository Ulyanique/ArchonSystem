#!/usr/bin/env pwsh
# Script for pushing repository to GitHub

param(
    [Parameter(Mandatory = $true)]
    [string]$RepoUrl,
    
    [Parameter(Mandatory = $false)]
    [string]$Branch = "main"
)

Write-Host "=== Push to GitHub ===" -ForegroundColor Cyan

# Check Git
try {
    $null = git --version
} catch {
    Write-Host "Error: Git not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Initialize repo
Write-Host "`n[1/5] Initializing Git repository..." -ForegroundColor Yellow
if (-not (Test-Path ".git")) {
    git init
    Write-Host "[OK] Repository initialized" -ForegroundColor Green
} else {
    Write-Host "[OK] Repository already initialized" -ForegroundColor Green
}

# Setup remote
Write-Host "`n[2/5] Setting up remote..." -ForegroundColor Yellow
$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    Write-Host "Current remote: $existingRemote" -ForegroundColor Gray
    $change = Read-Host "Change remote? (y/n)"
    if ($change -eq 'y') {
        git remote set-url origin $RepoUrl
    }
} else {
    git remote add origin $RepoUrl
    Write-Host "[OK] Remote added: $RepoUrl" -ForegroundColor Green
}

# Create .gitignore
Write-Host "`n[3/5] Creating .gitignore..." -ForegroundColor Yellow
$gitignorePath = ".gitignore"
$gitignoreContent = @"
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
ENV/
.venv
*.egg-info/
dist/
build/

# Node.js
node_modules/
npm-debug.log
yarn-error.log

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
desktop.ini

# Backups
backups/
*.zip

# Data
data/
*.db
*.sqlite

# Logs
*.log
logs/

# Environment
.env
.env.local
.env.*.local

# Qwen
.qwen/
"@

if (-not (Test-Path $gitignorePath)) {
    Set-Content -Path $gitignorePath -Value $gitignoreContent
    Write-Host "[OK] .gitignore created" -ForegroundColor Green
} else {
    Write-Host "[OK] .gitignore already exists" -ForegroundColor Green
}

# Add and commit
Write-Host "`n[4/5] Adding files and committing..." -ForegroundColor Yellow
git add .
$changes = git status --porcelain
if ($changes) {
    git commit -m "Initial commit: ARCHON project"
    Write-Host "[OK] Files committed" -ForegroundColor Green
} else {
    Write-Host "[OK] No changes to commit" -ForegroundColor Green
}

# Push to GitHub
Write-Host "`n[5/5] Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "Branch: $Branch" -ForegroundColor Gray

# Check branch
$currentBranch = git branch --show-current
if (-not $currentBranch) {
    git checkout -b $Branch
}

# Push
git push -u origin $Branch
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[SUCCESS] Repository pushed to GitHub!" -ForegroundColor Green
    Write-Host "URL: $RepoUrl" -ForegroundColor Cyan
} else {
    Write-Host "`n[WARN] Push failed. Possible reasons:" -ForegroundColor Yellow
    Write-Host "  - Authentication not configured (use GitHub CLI or token)" -ForegroundColor Gray
    Write-Host "  - Repository does not exist on GitHub" -ForegroundColor Gray
    Write-Host "  - Network issues" -ForegroundColor Gray
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
