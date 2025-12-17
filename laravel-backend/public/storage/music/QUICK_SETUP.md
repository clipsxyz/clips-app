# Quick Setup: Add Music Files

## Step-by-Step Instructions

### Step 1: Download Music Files

You need to download 5 MP3 files and place them in this directory with these exact names:

1. **summer_calm.mp3** - Ambient/calm music
2. **night_ocean.mp3** - Electronic/calm music
3. **ambient_piano.mp3** - Classical/calm music
4. **upbeat_pop.mp3** - Pop/happy music
5. **energetic_rock.mp3** - Rock/energetic music

### Step 2: Best Sources (100% Free, No Attribution)

#### Option A: FreePD (Recommended - Easiest)
1. Go to: https://freepd.com/
2. Browse by category:
   - **Ambient**: https://freepd.com/ambient/
   - **Electronic**: https://freepd.com/electronic/
   - **Classical**: https://freepd.com/classical/
   - **Upbeat**: https://freepd.com/upbeat/
   - **Rock**: https://freepd.com/rock/
3. Click "Download" on any track
4. Rename the file to match the database entry
5. Place in this directory: `storage/app/public/music/`

#### Option B: Pixabay Music
1. Go to: https://pixabay.com/music/
2. Search by mood/genre
3. Download MP3 files
4. Rename and place here

#### Option C: Free Music Archive
1. Go to: https://freemusicarchive.org/
2. Filter by license (CC0 recommended)
3. Download MP3 files
4. Rename and place here

### Step 3: File Placement

After downloading, place files here:
```
laravel-backend/storage/app/public/music/
├── summer_calm.mp3
├── night_ocean.mp3
├── ambient_piano.mp3
├── upbeat_pop.mp3
└── energetic_rock.mp3
```

### Step 4: Verify Files

Check that files exist:
```bash
cd laravel-backend
dir storage\app\public\music
```

You should see all 5 MP3 files listed.

### Step 5: Test Preview

1. Restart Laravel server (if running)
2. Go to music category in your app
3. Click on a track
4. Click the preview button
5. You should hear the music! 🎵

## Troubleshooting

**If preview still doesn't work:**
1. Check file permissions (files should be readable)
2. Verify storage link: `php artisan storage:link`
3. Check browser console for errors
4. Verify file paths in database match actual filenames

## Alternative: Use External URLs

If you prefer to use external URLs instead of local files, you can update the database:

```php
php artisan tinker
$track = App\Models\Music::where('title', 'Summer Calm')->first();
$track->url = 'https://freepd.com/upbeat/Summer.mp3'; // Use actual URL
$track->file_path = null;
$track->save();
```















