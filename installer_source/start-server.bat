@echo off
title Canteen POS System - Setup & Start
echo ============================================
echo     CANTEEN POS SYSTEM - GROUP 5
echo ============================================
echo.

cd /d "%~dp0"
set PATH=%~dp0node;%PATH%

:: --- CHECK NODE.JS ---
if not exist "%~dp0\node\node.exe" (
    echo ❌ Node.js not found in 'node' folder!
    echo Please ensure portable Node.js is included in this directory.
    pause
    exit /b 1
)

:: --- INSTALL DEPENDENCIES ---
echo 📦 Installing Node.js dependencies...
"%~dp0\node\node.exe" "%~dp0\node\node_modules\npm\bin\npm-cli.js" install

if %errorlevel% neq 0 (
    echo ❌ ERROR: Failed to install npm packages!
    echo Please check your internet connection.
    pause
    exit /b 1
)
echo ✅ Dependencies installed successfully!
echo.

:: --- INITIALIZE MARIADB ---
set MARIADB_BIN=%~dp0mariadb\bin
set MARIADB_DATA=%~dp0mariadb\data

if not exist "%MARIADB_DATA%" mkdir "%MARIADB_DATA%"

echo 🛠 Initializing MariaDB data directory (if needed)...
"%MARIADB_BIN%\mysql_install_db.exe" --datadir="%MARIADB_DATA%" --skip-name-resolve >nul 2>&1

:: --- START MARIADB SERVER ---
echo 🚀 Starting MariaDB server...
start "" "%MARIADB_BIN%\mysqld.exe" --console --datadir="%MARIADB_DATA%" --skip-name-resolve

timeout /t 5 >nul

:: --- IMPORT DATABASE SCHEMA ---
if exist "%~dp0database\schema.sql" (
    echo 📄 Importing database schema...
    "%MARIADB_BIN%\mysql.exe" -u root < "%~dp0database\schema.sql"
    echo ✅ Database initialized.
) else (
    echo ⚠️ No schema.sql file found. Skipping database import.
)

echo.
echo ============================================
echo  Starting Canteen POS Server
echo ============================================

:: --- CHANGE TO APP DIRECTORY ---
cd /d "%~dp0\canteen-pos"

if not exist "%cd%\server.js" (
    echo ❌ Could not find server.js inside "%cd%"
    echo Make sure your Canteen POS app is in the correct folder.
    pause
    exit /b 1
)

:: --- START NODE SERVER ---
echo Running: node server.js
"%~dp0\node\node.exe" server.js

echo.
pause
