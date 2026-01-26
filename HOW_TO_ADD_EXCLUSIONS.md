# How to Add Exclusions in Windows Defender

## Step-by-Step Instructions

### Method 1: Through Windows Security App (Easiest)

1. **Open Windows Security**
   - Press `Windows Key` on your keyboard
   - Type "Windows Security" and press Enter
   - OR click the Start button and search for "Windows Security"

2. **Go to Virus & Threat Protection**
   - In the left sidebar, click **"Virus & threat protection"**
   - (It's usually the first option with a shield icon)

3. **Open Settings**
   - Scroll down to find **"Virus & threat protection settings"**
   - Click **"Manage settings"** (it's a link/button)

4. **Scroll to Exclusions**
   - Scroll down in the settings window
   - Find the section called **"Exclusions"**
   - Click **"Add or remove exclusions"**

5. **Add Folder Exclusions**
   - Click the **"+" button** or **"Add an exclusion"** button
   - Select **"Folder"** from the dropdown menu
   - Navigate to and select: `C:\Users\visua\clips-app\node_modules`
   - Click **"Select Folder"**
   
   - Repeat to add: `C:\Users\visua\clips-app\node_modules\esbuild`

### Method 2: Through Windows Settings

1. **Open Windows Settings**
   - Press `Windows Key + I`
   - OR click Start → Settings (gear icon)

2. **Go to Privacy & Security**
   - Click **"Privacy & Security"** in the left sidebar
   - Click **"Windows Security"**

3. **Open Virus & Threat Protection**
   - Click **"Open Windows Security"**
   - Click **"Virus & threat protection"**

4. **Follow steps 3-5 from Method 1 above**

### Method 3: Direct Path (Quick Access)

1. Press `Windows Key + R` to open Run dialog
2. Type: `windowsdefender://threat/`
3. Press Enter
4. This opens Windows Security directly to threat protection
5. Click **"Manage settings"** under Virus & threat protection settings
6. Scroll to **"Exclusions"** → **"Add or remove exclusions"**

## Folders to Add

Add these folders as exclusions (one at a time):

1. `C:\Users\visua\clips-app\node_modules`
2. `C:\Users\visua\clips-app\node_modules\esbuild`
3. `C:\Users\visua\clips-app\node_modules\.vite` (optional, but recommended)

## After Adding Exclusions

1. **Disable Real-Time Protection Temporarily**
   - In the same "Manage settings" window
   - Turn OFF **"Real-time protection"** (toggle switch)

2. **Install esbuild** (in Administrator PowerShell):
   ```powershell
   cd C:\Users\visua\clips-app
   npm uninstall esbuild
   npm install --save-dev esbuild
   ```

3. **Verify it exists**:
   ```powershell
   Test-Path "node_modules\esbuild\esbuild.exe"
   ```
   Should return `True`

4. **Re-enable Real-Time Protection**
   - Go back to Windows Security
   - Turn ON **"Real-time protection"** again

## Visual Guide

The path looks like this:
```
Windows Security
  └─ Virus & threat protection
      └─ Virus & threat protection settings
          └─ Manage settings
              └─ Exclusions
                  └─ Add or remove exclusions
                      └─ [+] Add an exclusion → Folder
```

## Troubleshooting

**Can't find "Manage settings"?**
- Make sure you're in "Virus & threat protection" (not "Firewall & network protection")
- Scroll down - it's below the "Quick scan" button

**"Add or remove exclusions" is grayed out?**
- You might need Administrator privileges
- Right-click Windows Security and "Run as administrator"

**Still can't find it?**
- Try Method 3 (direct path) above
- Or search for "exclusions" in Windows Settings search bar
