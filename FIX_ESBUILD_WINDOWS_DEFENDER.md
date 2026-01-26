# Fix esbuild.exe Blocked by Windows Defender

## The Problem
Windows Defender is likely **quarantining or blocking** `esbuild.exe` immediately after installation. This is why the file disappears even after successful rebuilds.

## Solution: Check Windows Defender Quarantine

### Step 1: Check Quarantine History
1. Open **Windows Security** (search for it in Start menu)
2. Go to **Virus & threat protection**
3. Click **Protection history** (or **Threat history**)
4. Look for any entries related to `esbuild.exe` or `node_modules`
5. If you find any, click on them and select **Restore** or **Allow on device**

### Step 2: Add Proper Exclusions (IMPORTANT)
1. In Windows Security, go to **Virus & threat protection**
2. Click **Manage settings** under Virus & threat protection settings
3. Scroll down to **Exclusions**
4. Click **Add or remove exclusions**
5. Click **Add an exclusion** → **Folder**
6. Add these folders (one at a time):
   - `C:\Users\visua\clips-app\node_modules`
   - `C:\Users\visua\clips-app\node_modules\esbuild`
   - `C:\Users\visua\clips-app\node_modules\.vite`

### Step 3: Temporarily Disable Real-Time Protection
**WARNING: Only do this temporarily to install esbuild, then re-enable it!**

1. In Windows Security → **Virus & threat protection**
2. Click **Manage settings**
3. Turn OFF **Real-time protection** temporarily
4. Open PowerShell as Administrator
5. Run:
   ```powershell
   cd C:\Users\visua\clips-app
   npm uninstall esbuild
   npm install --save-dev esbuild
   ```
6. **Immediately re-enable Real-time protection**
7. Add the exclusions from Step 2

### Step 4: Verify esbuild.exe Exists
After installation, verify:
```powershell
Test-Path "node_modules\esbuild\esbuild.exe"
```

If it returns `True`, you're good! If `False`, Windows Defender deleted it again.

### Step 5: If Still Not Working
If esbuild.exe keeps getting deleted:

1. **Check for other antivirus software** (Norton, McAfee, etc.) - they might also be blocking it
2. **Try installing esbuild globally first:**
   ```powershell
   npm install -g esbuild
   ```
3. **Use WSL (Windows Subsystem for Linux)** if available - esbuild works better in Linux environment

## Alternative: Use Different Port or Build Tool
If esbuild continues to be blocked, we might need to:
- Use a different bundler (webpack, rollup)
- Build the app first (`npm run build`) then serve the `dist` folder
- Use a different development server

Let me know which step worked or if you need help with alternatives!
