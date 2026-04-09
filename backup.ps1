$ErrorActionPreference = 'Stop'

# Загружаем сборку для работы с ZIP
Add-Type -AssemblyName System.IO.Compression.FileSystem

$now = Get-Date
$year = $now.Year.ToString().Substring(2)
$month = $now.Month.ToString().PadLeft(2, '0')
$day = $now.Day.ToString().PadLeft(2, '0')
$hour = $now.Hour.ToString().PadLeft(2, '0')
$minute = $now.Minute.ToString().PadLeft(2, '0')

$archiveName = "v$year.$month$day.$hour$minute.zip"
$backupsDir = Join-Path -Path (Get-Location) "backups"
if (-not (Test-Path $backupsDir)) { New-Item -ItemType Directory -Path $backupsDir | Out-Null }
$archivePath = Join-Path -Path $backupsDir -ChildPath $archiveName

Write-Host "Создание архива: $archiveName" -ForegroundColor Cyan

$rootPath = (Get-Location).Path
$excludePatterns = @('*.zip', '*.7z', '*.rar', 'node_modules', '.git', '__pycache__', '*.pyc', '.venv', 'venv', '.vscode', '.idea', 'temp', 'target', 'backups')

# Получаем все файлы, исключая ненужные
$files = Get-ChildItem -Path $rootPath -Recurse -File | Where-Object {
    $excluded = $false
    $relativePath = $_.FullName.Substring($rootPath.Length + 1)
    
    # Проверяем паттерны исключения
    foreach ($pattern in $excludePatterns) {
        if ($relativePath -like "*$pattern*" -or $_.Name -like $pattern) {
            $excluded = $true
            break
        }
    }
    
    # Исключаем сам создаваемый архив
    if ($relativePath -eq $archiveName) {
        $excluded = $true
    }
    
    -not $excluded
}

# Создаем архив используя .NET классы для сохранения структуры папок
$zipFile = [System.IO.Compression.ZipFile]::Open($archivePath, [System.IO.Compression.ZipArchiveMode]::Create)

try {
    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($rootPath.Length + 1)
        # Заменяем обратные слеши на прямые для корректного отображения в архиве
        $entryName = $relativePath.Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipFile, $file.FullName, $entryName) | Out-Null
    }
} finally {
    $zipFile.Dispose()
}

$archiveSize = [math]::Round((Get-Item $archivePath).Length / 1MB, 2)

Write-Host ""
Write-Host "Архив успешно создан: $archiveName" -ForegroundColor Green
Write-Host "Размер архива: $archiveSize MB" -ForegroundColor Yellow
