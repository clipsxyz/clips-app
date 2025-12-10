# PowerShell script to download sample music files from FreePD

Write-Host "Downloading royalty-free music files from FreePD..." -ForegroundColor Cyan
Write-Host ""

$musicDir = "laravel-backend\storage\app\public\music"
$baseUrl = "https://freepd.com"

# Create directory if it doesn't exist
if (-not (Test-Path $musicDir)) {
    New-Item -ItemType Directory -Path $musicDir -Force | Out-Null
    Write-Host "Created directory: $musicDir" -ForegroundColor Green
}

# FreePD direct download links (these are example URLs - may need to be updated)
$files = @{
    "summer_calm.mp3" = "https://freepd.com/ambient/Summer.mp3"
    "night_ocean.mp3" = "https://freepd.com/electronic/NightOcean.mp3"
    "ambient_piano.mp3" = "https://freepd.com/classical/AmbientPiano.mp3"
    "upbeat_pop.mp3" = "https://freepd.com/upbeat/Upbeat.mp3"
    "energetic_rock.mp3" = "https://freepd.com/rock/EnergeticRock.mp3"
}

$downloaded = 0
$failed = 0

foreach ($file in $files.GetEnumerator()) {
    $fileName = $file.Key
    $fileUrl = $file.Value
    $filePath = Join-Path $musicDir $fileName
    
    Write-Host "Downloading $fileName..." -ForegroundColor Yellow
    
    try {
        # Use Invoke-WebRequest to download
        $response = Invoke-WebRequest -Uri $fileUrl -OutFile $filePath -ErrorAction Stop
        $size = (Get-Item $filePath).Length / 1MB
        Write-Host "  [OK] Downloaded $fileName ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
        $downloaded++
    } catch {
        Write-Host "  [FAILED] Failed to download $fileName" -ForegroundColor Red
        Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "    You can download manually from: https://freepd.com/" -ForegroundColor Yellow
        $failed++
    }
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Downloaded: $downloaded files" -ForegroundColor Green
Write-Host "  Failed: $failed files" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })

if ($downloaded -gt 0) {
    Write-Host ""
    Write-Host "[SUCCESS] Files are ready! Test preview in the app." -ForegroundColor Green
}

if ($failed -gt 0) {
    Write-Host ""
    Write-Host "[WARNING] Some files failed to download." -ForegroundColor Yellow
    Write-Host "Manual download:" -ForegroundColor Yellow
    Write-Host "  1. Go to: https://freepd.com/" -ForegroundColor Yellow
    Write-Host "  2. Browse by category and download tracks" -ForegroundColor Yellow
    Write-Host "  3. Rename files to match database entries" -ForegroundColor Yellow
    Write-Host "  4. Place in: $musicDir" -ForegroundColor Yellow
}

