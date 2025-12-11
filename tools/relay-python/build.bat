@echo off
REM =====================================================================
REM ControlBox Relay Agent - Build Script
REM Creates standalone Windows executable using PyInstaller
REM =====================================================================

echo.
echo ========================================
echo  ControlBox Relay Agent Build Script
echo ========================================
echo.

REM Check for Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.7+
    pause
    exit /b 1
)

REM Check for pip
pip --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: pip not found. Please install pip.
    pause
    exit /b 1
)

echo [1/4] Installing dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo [2/4] Installing PyInstaller...
pip install pyinstaller
if errorlevel 1 (
    echo ERROR: Failed to install PyInstaller
    pause
    exit /b 1
)

echo [3/4] Building executable...
pyinstaller --clean ControlBox-Relay.spec
if errorlevel 1 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo [4/4] Build complete!
echo.
echo Executable created at: dist\ControlBox-Relay.exe
echo.

REM Copy to installer folder
if exist installer\nsis (
    echo Copying to installer folder...
    copy dist\ControlBox-Relay.exe installer\nsis\
)

echo.
echo ========================================
echo  Build Successful!
echo ========================================
echo.
pause
