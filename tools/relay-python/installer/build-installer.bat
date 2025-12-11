@echo off
REM =====================================================================
REM ControlBox Relay Agent - Installer Build Script
REM Creates Windows installer using NSIS
REM =====================================================================

echo.
echo ========================================
echo  ControlBox Installer Build Script
echo ========================================
echo.

REM Check if executable exists
if not exist "..\dist\ControlBox-Relay.exe" (
    echo ERROR: Executable not found!
    echo Please run build.bat first to create the executable.
    pause
    exit /b 1
)

REM Check for NSIS
where makensis >nul 2>&1
if errorlevel 1 (
    echo ERROR: NSIS not found!
    echo Please install NSIS from https://nsis.sourceforge.io/
    pause
    exit /b 1
)

echo [1/3] Copying files...
copy ..\dist\ControlBox-Relay.exe . >nul
copy ..\README.md . >nul

echo [2/3] Creating installer...
makensis ControlBox-Relay.nsi
if errorlevel 1 (
    echo ERROR: Installer build failed
    pause
    exit /b 1
)

echo [3/3] Cleanup...
del ControlBox-Relay.exe >nul 2>&1
del README.md >nul 2>&1

echo.
echo ========================================
echo  Installer Created Successfully!
echo ========================================
echo.
echo Output: ControlBox-Relay-Setup.exe
echo.
pause
