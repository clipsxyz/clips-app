# PowerShell script to verify music files are in place

Write-Host "Checking music files..." -ForegroundColor Cyan

$musicDir = "storage\app\public\music"
$requiredFiles = @(
    "summer_calm.mp3",
    "night_ocean.mp3",
    "ambient_piano.mp3",
    "upbeat_pop.mp3",
    "energetic_rock.mp3"
)

if (-not (Test-Path $musicDir)) {
    Write-Host "ERROR: Music directory does not exist: $musicDir" -ForegroundColor Red
    Write-Host "Creating directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $musicDir -Force | Out-Null
}

Write-Host "`nChecking for required files:" -ForegroundColor Cyan
$allFound = $true

foreach ($file in $requiredFiles) {
    $filePath = Join-Path $musicDir $file
    if (Test-Path $filePath) {
        $size = (Get-Item $filePath).Length
        $sizeMB = [math]::Round($size / 1MB, 2)
        Write-Host "  ✓ $file ($sizeMB MB)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file (MISSING)" -ForegroundColor Red
        $allFound = $false
    }
}

if ($allFound) {
    Write-Host "`n✅ All music files are present!" -ForegroundColor Green
    Write-Host "You can now test the preview in the app." -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Some files are missing." -ForegroundColor Yellow
    Write-Host "Download files from: https://freepd.com/" -ForegroundColor Yellow
    Write-Host "Place them in: $musicDir" -ForegroundColor Yellow
}

Write-Host "`nCurrent files in directory:" -ForegroundColor Cyan
Get-ChildItem $musicDir -File | Select-Object Name, @{Name="Size (MB)";Expression={[math]::Round($_.Length/1MB, 2)}} | Format-Table


















