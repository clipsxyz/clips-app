# Fix "Folder Name is Not Valid" Error

## Problem
Windows Defender is saying the folder name is not valid when trying to add exclusions.

## Solution 1: Use File Explorer to Select Folder

Instead of typing the path, use File Explorer to browse to it:

1. **Open Windows Security** → **Virus & threat protection** → **Manage settings** → **Exclusions** → **Add or remove exclusions**

2. **Click "Add an exclusion"** → **"Folder"**

3. **In the file picker that opens:**
   - Navigate to: `C:\Users\visua\clips-app`
   - Click on the `node_modules` folder
   - Click "Select Folder"

4. **Repeat for esbuild:**
   - Click "Add an exclusion" → "Folder" again
   - Navigate to: `C:\Users\visua\clips-app\node_modules`
   - Click on the `esbuild` folder
   - Click "Select Folder"

## Solution 2: Create Folders First (If They Don't Exist)

If the folders don't exist yet, create them first:

```powershell
# In PowerShell (run as Administrator)
cd C:\Users\visua\clips-app
New-Item -ItemType Directory -Path "node_modules" -Force
New-Item -ItemType Directory -Path "node_modules\esbuild" -Force
```

Then try adding exclusions again using Solution 1.

## Solution 3: Add Parent Folder Instead

If the specific folders don't work, add the entire project folder:

1. Add exclusion for: `C:\Users\visua\clips-app`

This will exclude everything in your project, including node_modules.

## Solution 4: Use Process Exclusion Instead

If folder exclusion doesn't work, try process exclusion:

1. In Windows Security → Exclusions
2. Click "Add an exclusion" → **"Process"**
3. Type: `esbuild.exe`
4. Click "Add"

## Solution 5: Check Path Format

Make sure you're using the correct path format:
- ✅ Correct: `C:\Users\visua\clips-app\node_modules`
- ❌ Wrong: `C:/Users/visua/clips-app/node_modules` (forward slashes)
- ❌ Wrong: `~\clips-app\node_modules` (tilde not supported)

## Quick Test

Run this in PowerShell to verify the path exists:
```powershell
Test-Path "C:\Users\visua\clips-app\node_modules"
```

If it returns `False`, the folder doesn't exist yet - use Solution 2 to create it first.
