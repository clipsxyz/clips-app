@echo off
:: Allow Vite dev server (port 5173) so phone/tablet on same WiFi can open the app.
:: Run this once as Administrator: right-click -> Run as administrator
netsh advfirewall firewall add rule name="Vite Dev Server 5173" dir=in action=allow protocol=TCP localport=5173
if %errorlevel% equ 0 (
    echo Firewall rule added. On your phone browser open: http://192.168.1.7:5173
    echo (Replace 192.168.1.7 with your PC IP if it changes - run ipconfig to check.)
) else (
    echo Failed. Make sure you ran this as Administrator.
)
pause
