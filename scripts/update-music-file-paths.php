<?php
/**
 * Update music file paths in database after downloading files
 * 
 * Usage: php scripts/update-music-file-paths.php
 */

require __DIR__ . '/../laravel-backend/vendor/autoload.php';

$app = require_once __DIR__ . '/../laravel-backend/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Music;
use Illuminate\Support\Facades\Storage;

$musicDir = __DIR__ . '/../laravel-backend/storage/app/public/music';

if (!is_dir($musicDir)) {
    echo "❌ Music directory not found: $musicDir\n";
    exit(1);
}

echo "📁 Scanning music directory: $musicDir\n\n";

// Get all MP3 files in the directory
$files = glob($musicDir . '/*.mp3');
$fileNames = array_map(function($file) {
    return basename($file);
}, $files);

echo "Found " . count($fileNames) . " MP3 files:\n";
foreach ($fileNames as $file) {
    echo "  - $file\n";
}
echo "\n";

// Try to match files to database entries
$updated = 0;
$notFound = [];

foreach ($fileNames as $fileName) {
    // Remove extension
    $baseName = pathinfo($fileName, PATHINFO_FILENAME);
    
    // Try different matching strategies
    $track = null;
    
    // Strategy 1: Match by filename (e.g., "summer_calm" -> "Summer Calm")
    $titleFromFile = ucwords(str_replace('_', ' ', $baseName));
    $track = Music::where('title', 'LIKE', "%{$titleFromFile}%")->first();
    
    // Strategy 2: Match by lowercase title
    if (!$track) {
        $track = Music::whereRaw('LOWER(title) = ?', [strtolower($titleFromFile)])->first();
    }
    
    // Strategy 3: Match by partial title
    if (!$track) {
        $words = explode(' ', $titleFromFile);
        if (count($words) > 0) {
            $track = Music::where('title', 'LIKE', "%{$words[0]}%")->first();
        }
    }
    
    if ($track) {
        $filePath = 'music/' . $fileName;
        $track->file_path = $filePath;
        $track->save();
        echo "✅ Updated: {$track->title} -> $filePath\n";
        $updated++;
    } else {
        $notFound[] = $fileName;
    }
}

echo "\n📊 Summary:\n";
echo "  ✅ Updated: $updated tracks\n";
echo "  ⚠️  Not matched: " . count($notFound) . " files\n";

if (count($notFound) > 0) {
    echo "\n⚠️  Files that couldn't be matched to database entries:\n";
    foreach ($notFound as $file) {
        echo "  - $file\n";
    }
    echo "\n💡 Tip: You may need to manually update these in the database.\n";
}

echo "\n✨ Done! Refresh your app to see the updated tracks.\n";



















