@echo off
title Industrial 3D Solution — POS System
color 0A
echo.
echo  =====================================================
echo   Industrial 3D Solution — Inventory and POS System
echo  =====================================================
echo.

REM Start Backend
echo [1/2] Starting backend API server (port 5000)...
start "API Server" cmd /k "cd /d "%~dp0server" && node server.js"

REM Wait a moment for backend to start
timeout /t 3 /nobreak > nul

REM Start Frontend
echo [2/2] Starting frontend dev server (port 5173)...
start "Frontend" cmd /k "cd /d "%~dp0client" && npm run dev"

REM Wait and open browser
timeout /t 5 /nobreak > nul
echo.
echo  Opening http://localhost:5173 in your browser...
start http://localhost:5173

echo.
echo  Login: admin@industrial.com.bd / admin123
echo.
echo  Press any key to exit this launcher (servers will keep running)
pause > nul
