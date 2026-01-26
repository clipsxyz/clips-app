# Server Startup Guide

## Quick Start

### Option 1: Use the Batch Script (Easiest)
Double-click `start-servers.bat` - it will open two command windows, one for each server.

### Option 2: Use PowerShell Script
Run in PowerShell:
```powershell
.\start-servers.ps1
```

### Option 3: Manual Start

**Terminal 1 - Laravel Backend:**
```powershell
cd laravel-backend
php artisan serve --host=0.0.0.0 --port=8000
```

**Terminal 2 - Vite Frontend:**
```powershell
npm run dev
```

## Current Status

✅ **Laravel Backend**: Running on port 8000
❌ **Vite Frontend**: Not running due to esbuild permission error

## Fixing the Vite/esbuild Issue

The error `Error: spawn EPERM` means esbuild.exe is missing or blocked. Here's how to fix it:

### Step 1: Reinstall esbuild
Open a **new terminal** (or run as Administrator) and run:
```powershell
cd C:\Users\visua\clips-app
npm rebuild esbuild
```

If that doesn't work, try:
```powershell
npm uninstall esbuild
npm install --save-dev esbuild
```

### Step 2: Check Windows Defender
1. Open Windows Security
2. Go to Virus & threat protection
3. Click "Manage settings" under Virus & threat protection settings
4. Click "Add or remove exclusions"
5. Add these folders:
   - `C:\Users\visua\clips-app\node_modules`
   - `C:\Users\visua\clips-app\node_modules\esbuild`

### Step 3: Run as Administrator (if needed)
Right-click your terminal/PowerShell and select "Run as Administrator", then try:
```powershell
cd C:\Users\visua\clips-app
npm run dev
```

## Accessing from Your Phone

Once both servers are running:

1. **Make sure your phone is on the same WiFi network as your computer**

2. **Find your computer's IP address:**
   ```powershell
   ipconfig
   ```
   Look for "IPv4 Address" - it's usually something like `192.168.1.3`

3. **Access the app:**
   - Frontend: `http://YOUR_IP:5173` (e.g., `http://192.168.1.3:5173`)
   - Backend API: `http://YOUR_IP:8000/api` (e.g., `http://192.168.1.3:8000/api`)

## Troubleshooting

### Port Already in Use
If you see "port already in use" errors:
```powershell
# Kill processes on port 8000
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force

# Kill processes on port 5173
Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess | Stop-Process -Force
```

### Laravel Backend Issues
- Check if PHP is installed: `php -v`
- Check if database is running (if using PostgreSQL/MySQL)
- Check Laravel logs: `laravel-backend\storage\logs\laravel.log`

### Vite Frontend Issues
- Clear cache: `npm run clean:cache`
- Delete `node_modules` and reinstall: `rm -r node_modules; npm install`
- Check if Node.js version is compatible: `node -v` (should be 16+)

## Server URLs Summary

| Service | Local (This PC) | Network (Phone/Other Devices) |
|---------|----------------|-------------------------------|
| Frontend | http://localhost:5173 | http://192.168.1.3:5173 |
| Backend API | http://localhost:8000/api | http://192.168.1.3:8000/api |

**Note**: Replace `192.168.1.3` with your actual IP address from `ipconfig`
