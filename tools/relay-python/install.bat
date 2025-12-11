@echo off
REM =====================================================================
REM ControlBox Relay Agent - Quick Install & Run
REM One-click setup for users with Python installed
REM =====================================================================

echo.
echo ========================================
echo  ControlBox Relay Agent - Quick Setup
echo ========================================
echo.

REM Check for Python
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Python not found!
    echo.
    echo Please install Python 3.7+ from:
    echo https://www.python.org/downloads/
    echo.
    echo Make sure to check "Add Python to PATH" during installation!
    echo.
    pause
    exit /b 1
)

echo [1/3] Python found!
python --version
echo.

echo [2/3] Installing dependencies...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo ERROR: Failed to install dependencies.
    pause
    exit /b 1
)
echo     Dependencies installed!
echo.

echo [3/3] Setup complete!
echo.
echo ========================================
echo  Ready to use!
echo ========================================
echo.
echo To run the relay:
echo   1. Start iRacing (live session or replay)
echo   2. Double-click "run.bat"
echo.
echo Cloud Dashboard: https://coral-app-x988a.ondigitalocean.app
echo.
pause
