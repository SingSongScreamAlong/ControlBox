@echo off
REM =====================================================================
REM ControlBox Relay Agent - Run Script
REM =====================================================================

echo.
echo ========================================
echo  ControlBox Relay Agent
echo ========================================
echo.
echo Starting relay... (Press Ctrl+C to stop)
echo.
echo Cloud: https://coral-app-x988a.ondigitalocean.app
echo.

python main.py

echo.
echo Relay stopped.
pause
