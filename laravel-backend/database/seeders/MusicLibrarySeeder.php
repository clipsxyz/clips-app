<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use App\Models\Music;

class MusicLibrarySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Example CC-licensed tracks (safe to use)
        // These are example entries - you should replace with actual tracks from Free Music Archive, ccMixter, etc.
        $tracks = [
            [
                'title' => 'Summer Calm',
                'artist' => 'Audiorezout',
                'file_path' => 'music/summer_calm.mp3', // Placeholder - you'll need to add actual files
                'url' => 'music/summer_calm.mp3', // Temporary - will be generated from file_path when file exists
                'genre' => 'ambient',
                'mood' => 'calm',
                'duration' => 125,
                'license_type' => 'CC0',
                'license_url' => 'https://creativecommons.org/publicdomain/zero/1.0/',
                'license_requires_attribution' => false,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Night Ocean',
                'artist' => 'DreamHeaven',
                'file_path' => 'music/night_ocean.mp3',
                'url' => 'music/night_ocean.mp3',
                'genre' => 'electronic',
                'mood' => 'calm',
                'duration' => 147,
                'license_type' => 'CC-BY',
                'license_url' => 'https://creativecommons.org/licenses/by/4.0/',
                'license_requires_attribution' => true,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Ambient Piano',
                'artist' => 'Keys of Moon',
                'file_path' => 'music/ambient_piano.mp3',
                'url' => 'music/ambient_piano.mp3',
                'genre' => 'classical',
                'mood' => 'calm',
                'duration' => 180,
                'license_type' => 'CC-BY',
                'license_url' => 'https://creativecommons.org/licenses/by/4.0/',
                'license_requires_attribution' => true,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Upbeat Pop',
                'artist' => 'Bensound',
                'file_path' => 'music/upbeat_pop.mp3',
                'url' => 'music/upbeat_pop.mp3',
                'genre' => 'pop',
                'mood' => 'happy',
                'duration' => 120,
                'license_type' => 'CC-BY',
                'license_url' => 'https://creativecommons.org/licenses/by/4.0/',
                'license_requires_attribution' => true,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Energetic Rock',
                'artist' => 'Free Music Archive',
                'file_path' => 'music/energetic_rock.mp3',
                'url' => 'music/energetic_rock.mp3',
                'genre' => 'rock',
                'mood' => 'energetic',
                'duration' => 135,
                'license_type' => 'CC-BY-SA',
                'license_url' => 'https://creativecommons.org/licenses/by-sa/4.0/',
                'license_requires_attribution' => true,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Chill Vibes',
                'artist' => 'Audio Library',
                'file_path' => 'music/chill_vibes.mp3',
                'url' => 'music/chill_vibes.mp3',
                'genre' => 'ambient',
                'mood' => 'calm',
                'duration' => 142,
                'license_type' => 'CC0',
                'license_url' => 'https://creativecommons.org/publicdomain/zero/1.0/',
                'license_requires_attribution' => false,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Urban Beat',
                'artist' => 'Hip Hop Beats',
                'file_path' => 'music/urban_beat.mp3',
                'url' => 'music/urban_beat.mp3',
                'genre' => 'hip-hop',
                'mood' => 'energetic',
                'duration' => 128,
                'license_type' => 'CC-BY',
                'license_url' => 'https://creativecommons.org/licenses/by/4.0/',
                'license_requires_attribution' => true,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Jazz Lounge',
                'artist' => 'Smooth Jazz Collective',
                'file_path' => 'music/jazz_lounge.mp3',
                'url' => 'music/jazz_lounge.mp3',
                'genre' => 'jazz',
                'mood' => 'calm',
                'duration' => 165,
                'license_type' => 'CC-BY',
                'license_url' => 'https://creativecommons.org/licenses/by/4.0/',
                'license_requires_attribution' => true,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Dance Floor',
                'artist' => 'EDM Producer',
                'file_path' => 'music/dance_floor.mp3',
                'url' => 'music/dance_floor.mp3',
                'genre' => 'electronic',
                'mood' => 'energetic',
                'duration' => 138,
                'license_type' => 'CC-BY',
                'license_url' => 'https://creativecommons.org/licenses/by/4.0/',
                'license_requires_attribution' => true,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Acoustic Dreams',
                'artist' => 'Folk Musician',
                'file_path' => 'music/acoustic_dreams.mp3',
                'url' => 'music/acoustic_dreams.mp3',
                'genre' => 'pop',
                'mood' => 'calm',
                'duration' => 152,
                'license_type' => 'CC-BY',
                'license_url' => 'https://creativecommons.org/licenses/by/4.0/',
                'license_requires_attribution' => true,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Power Up',
                'artist' => 'Rock Band',
                'file_path' => 'music/power_up.mp3',
                'url' => 'music/power_up.mp3',
                'genre' => 'rock',
                'mood' => 'energetic',
                'duration' => 130,
                'license_type' => 'CC-BY-SA',
                'license_url' => 'https://creativecommons.org/licenses/by-sa/4.0/',
                'license_requires_attribution' => true,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Tropical Paradise',
                'artist' => 'Island Sounds',
                'file_path' => 'music/tropical_paradise.mp3',
                'url' => 'music/tropical_paradise.mp3',
                'genre' => 'pop',
                'mood' => 'happy',
                'duration' => 145,
                'license_type' => 'CC-BY',
                'license_url' => 'https://creativecommons.org/licenses/by/4.0/',
                'license_requires_attribution' => true,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Classical Elegance',
                'artist' => 'Symphony Orchestra',
                'file_path' => 'music/classical_elegance.mp3',
                'url' => 'music/classical_elegance.mp3',
                'genre' => 'classical',
                'mood' => 'calm',
                'duration' => 175,
                'license_type' => 'CC-BY',
                'license_url' => 'https://creativecommons.org/licenses/by/4.0/',
                'license_requires_attribution' => true,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Midnight Drive',
                'artist' => 'Synthwave Artist',
                'file_path' => 'music/midnight_drive.mp3',
                'url' => 'music/midnight_drive.mp3',
                'genre' => 'electronic',
                'mood' => 'calm',
                'duration' => 140,
                'license_type' => 'CC-BY',
                'license_url' => 'https://creativecommons.org/licenses/by/4.0/',
                'license_requires_attribution' => true,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Happy Days',
                'artist' => 'Pop Artist',
                'file_path' => 'music/happy_days.mp3',
                'url' => 'music/happy_days.mp3',
                'genre' => 'pop',
                'mood' => 'happy',
                'duration' => 118,
                'license_type' => 'CC-BY',
                'license_url' => 'https://creativecommons.org/licenses/by/4.0/',
                'license_requires_attribution' => true,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Deep Bass',
                'artist' => 'Hip Hop Producer',
                'file_path' => 'music/deep_bass.mp3',
                'url' => 'music/deep_bass.mp3',
                'genre' => 'hip-hop',
                'mood' => 'energetic',
                'duration' => 135,
                'license_type' => 'CC-BY',
                'license_url' => 'https://creativecommons.org/licenses/by/4.0/',
                'license_requires_attribution' => true,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Meditation',
                'artist' => 'Zen Sounds',
                'file_path' => 'music/meditation.mp3',
                'url' => 'music/meditation.mp3',
                'genre' => 'ambient',
                'mood' => 'calm',
                'duration' => 200,
                'license_type' => 'CC0',
                'license_url' => 'https://creativecommons.org/publicdomain/zero/1.0/',
                'license_requires_attribution' => false,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Party Time',
                'artist' => 'DJ Mix',
                'file_path' => 'music/party_time.mp3',
                'url' => 'music/party_time.mp3',
                'genre' => 'electronic',
                'mood' => 'energetic',
                'duration' => 125,
                'license_type' => 'CC-BY',
                'license_url' => 'https://creativecommons.org/licenses/by/4.0/',
                'license_requires_attribution' => true,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'title' => 'Smooth Jazz',
                'artist' => 'Jazz Trio',
                'file_path' => 'music/smooth_jazz.mp3',
                'url' => 'music/smooth_jazz.mp3',
                'genre' => 'jazz',
                'mood' => 'calm',
                'duration' => 158,
                'license_type' => 'CC-BY',
                'license_url' => 'https://creativecommons.org/licenses/by/4.0/',
                'license_requires_attribution' => true,
                'is_ai_generated' => false,
                'is_active' => true,
                'usage_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];
        
        // Filter: Only keep tracks that have actual audio files
        // Remove all placeholder tracks without files
        $tracks = array_filter($tracks, function($track) {
            if (empty($track['file_path'])) {
                return false; // No file_path = placeholder
            }
            
            $filePath = $track['file_path'];
            
            // Check if file exists in storage
            try {
                if (Storage::disk('public')->exists($filePath)) {
                    return true;
                }
            } catch (\Exception $e) {
                // Storage check failed
            }
            
            // Also check direct file path
            $fullPath = storage_path('app/public/' . $filePath);
            return file_exists($fullPath);
        });
        
        // Re-index array after filtering
        $tracks = array_values($tracks);

        // Only insert if tracks don't already exist (to allow re-running seeder)
        foreach ($tracks as $track) {
            Music::firstOrCreate(
                ['title' => $track['title'], 'artist' => $track['artist']],
                $track
            );
        }

        $this->command->info('Music library seeded with ' . count($tracks) . ' tracks');
        $this->command->warn('Note: You need to add actual audio files to storage/app/public/music/ for these tracks to work.');
    }
}

