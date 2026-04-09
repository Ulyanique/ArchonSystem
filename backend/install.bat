@echo off
echo ========================================
echo   Установка зависимостей ARCHON
echo   Python 3.12
echo ========================================
echo.

cd /d %~dp0

echo [1/2] Проверка Python...
venv\Scripts\python.exe --version
if errorlevel 1 (
    echo [ERROR] Python не найден в venv!
    pause
    exit /b 1
)

echo.
echo [2/2] Установка зависимостей...
venv\Scripts\pip.exe install -r requirements.txt

echo.
echo ========================================
echo   Готово!
echo ========================================
pause
