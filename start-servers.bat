@echo off
echo ========================================
echo Starting Clips App Servers
echo ========================================
echo.

REM Get the directory where this script is located
cd /d "%~dp0"

REM Start Laravel backend in a new window
echo Starting Laravel Backend...
start "Laravel Backend" cmd /k "cd laravel-backend && php artisan serve --host=0.0.0.0 --port=8000"

REM Wait a moment for Laravel to start
timeout /t 3 /nobreak >nul

REM Start Vite frontend in a new window
echo Starting Vite Frontend...
start "Vite Frontend" cmd /k "npm run dev"

REM Wait a moment for Vite to start
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo Servers Started!
echo ========================================
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000
echo.
echo To access from your phone, use your computer's IP address
echo (Check ipconfig for your local IP, usually 192.168.x.x)
echo.
echo Press any key to exit (servers will keep running)...
pause >nul
