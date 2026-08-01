@echo off
title SafeCover Dev Server
cd /d "%~dp0backend"

echo Killing any process on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo Rebuilding native modules for current Node.js version...
call npm rebuild better-sqlite3 >nul 2>&1

echo.
echo  ==========================================
echo   SafeCover - Starting Dev Server
echo   http://localhost:3000
echo  ==========================================
echo.
node server.js
pause
