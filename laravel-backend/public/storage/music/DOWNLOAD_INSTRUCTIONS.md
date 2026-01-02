# How to Download and Add Music Files

## Quick Setup Guide

The database expects these files in `storage/app/public/music/`:

1. `summer_calm.mp3` - Ambient/calm track
2. `night_ocean.mp3` - Electronic/calm track  
3. `ambient_piano.mp3` - Classical/calm track
4. `upbeat_pop.mp3` - Pop/happy track
5. `energetic_rock.mp3` - Rock/energetic track

## Recommended Sources (100% Free, No Attribution Required)

### 1. FreePD (Easiest - Direct Downloads)
- Website: https://freepd.com/
- License: Public Domain / CC0
- How to use:
  1. Browse by mood/genre
  2. Click download (MP3 format)
  3. Rename file to match database entry
  4. Place in this directory

### 2. Pixabay Music
- Website: https://pixabay.com/music/
- License: Free for commercial use
- Requires: Free account (optional)
- How to use:
  1. Search for music by mood/genre
  2. Download MP3
  3. Rename and place here

### 3. Free Music Archive
- Website: https://freemusicarchive.org/
- License: Various CC licenses (check each track)
- How to use:
  1. Filter by license (CC0 recommended)
  2. Download MP3
  3. Rename and place here

## File Naming

Make sure files match exactly:
- ✅ `summer_calm.mp3` (correct)
- ❌ `Summer_Calm.mp3` (wrong - case sensitive on some systems)
- ❌ `summer-calm.mp3` (wrong - use underscore)

## After Adding Files

1. Files should be in: `storage/app/public/music/`
2. Restart Laravel server (if running)
3. Test preview in the app
4. Preview should now work!

## Alternative: Use External URLs

If you prefer to use external URLs instead of local files:

```php
php artisan tinker
$track = App\Models\Music::where('title', 'Summer Calm')->first();
$track->url = 'https://freepd.com/upbeat/Summer.mp3'; // Example URL
$track->file_path = null; // Clear file_path if using URL
$track->save();
```

## Testing

After adding files, test the preview:
1. Go to music category in the app
2. Click on a track
3. Click the preview button
4. You should hear the music!


















