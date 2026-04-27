@echo off
title Database Setup — Industrial 3D Solution
color 0B
echo.
echo  =====================================================
echo   Database Initialization
echo  =====================================================
echo.
echo  This will create all database tables and insert sample data.
echo  Make sure PostgreSQL is running and credentials in server\.env are correct.
echo.
echo  Default .env settings:
echo    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/industrial3d_pos
echo.

REM Create database if needed
echo  Creating database (if not exists)...
psql -U postgres -c "CREATE DATABASE industrial3d_pos;" 2>nul

REM Run init script
echo  Running schema initialization...
cd /d "%~dp0server"
node config/initDb.js

echo.
echo  Done! Press any key to exit.
pause > nul
