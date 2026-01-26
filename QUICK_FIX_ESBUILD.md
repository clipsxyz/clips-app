# Quick Fix for Frontend Server Issue

## Problem
The Vite dev server won't start because `esbuild.exe` is missing or blocked on Windows.

## Solution: Fix esbuild (REQUIRED)

**You MUST run this in a regular PowerShell/Command Prompt window (not in Cursor's terminal):**

```powershell
cd C:\Users\visua\clips-app
npm rebuild esbuild
```

If that doesn't work, try:
```powershell
npm uninstall esbuild
npm install --save-dev esbuild
```

**OR run as Administrator:**
1. Right-click PowerShell/Command Prompt
2. Select "Run as Administrator"
3. Run the commands above

## Alternative: Use Built Version

If you have a built version in the `dist` folder, you can serve it with:

```powershell
npx serve dist -p 5173
```

Or use Python:
```powershell
cd dist
python -m http.server 5173
```

## Current Status

✅ **Laravel Backend**: Running on `http://localhost:8000`  
❌ **Vite Frontend**: NOT running (esbuild issue)

## Access URLs

Once frontend is fixed:
- **Local**: `http://localhost:5173`
- **From Phone**: `http://192.168.1.3:5173`
- **Backend API**: `http://192.168.1.3:8000/api`

## Why This Happens

Windows Defender or antivirus software often blocks `esbuild.exe` because it's a native executable. The `npm rebuild esbuild` command will reinstall the correct executable for your system.
