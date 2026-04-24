@echo off
setlocal

REM Go to this script's directory (project root)
cd /d "%~dp0"

echo ========================================
echo DumbReader quick start
echo Project: %cd%
echo ========================================

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found. Please install Node.js first.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] node_modules not found, running npm install...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [INFO] Starting DumbReader dev server...
call npm run dev

echo.
echo [INFO] Dev server exited.
pause
