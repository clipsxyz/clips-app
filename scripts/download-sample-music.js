// Node.js script to download sample music files
// Uses sample audio from various free sources

import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const musicDir = path.join(__dirname, '..', 'laravel-backend', 'storage', 'app', 'public', 'music');

// Create directory if it doesn't exist
if (!fs.existsSync(musicDir)) {
    fs.mkdirSync(musicDir, { recursive: true });
    console.log(`Created directory: ${musicDir}`);
}

// Sample music URLs from free sources
// Using SoundHelix sample tracks - these are royalty-free demo tracks
const files = [
    {
        name: 'summer_calm.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
    },
    {
        name: 'night_ocean.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
    },
    {
        name: 'ambient_piano.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
    },
    {
        name: 'upbeat_pop.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
    },
    {
        name: 'energetic_rock.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3'
    },
    {
        name: 'chill_vibes.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3'
    },
    {
        name: 'urban_beat.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3'
    },
    {
        name: 'jazz_lounge.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3'
    },
    {
        name: 'dance_floor.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3'
    },
    {
        name: 'acoustic_dreams.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3'
    },
    {
        name: 'power_up.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3'
    },
    {
        name: 'tropical_paradise.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3'
    },
    {
        name: 'classical_elegance.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3'
    },
    {
        name: 'midnight_drive.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3'
    },
    {
        name: 'happy_days.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3'
    },
    {
        name: 'deep_bass.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3'
    },
    {
        name: 'meditation.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3'
    },
    {
        name: 'party_time.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-18.mp3'
    },
    {
        name: 'smooth_jazz.mp3',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-19.mp3'
    }
];

function downloadFile(url, filepath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(filepath);
        
        protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Handle redirect
                return downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
            }
            
            if (response.statusCode !== 200) {
                file.close();
                fs.unlinkSync(filepath);
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                const stats = fs.statSync(filepath);
                resolve(stats.size);
            });
        }).on('error', (err) => {
            file.close();
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
            }
            reject(err);
        });
    });
}

async function downloadAll() {
    console.log('Downloading sample music files...\n');
    
    let downloaded = 0;
    let failed = 0;
    
    for (const file of files) {
        const filepath = path.join(musicDir, file.name);
        
        // Skip if file already exists
        if (fs.existsSync(filepath)) {
            const stats = fs.statSync(filepath);
            console.log(`[SKIP] ${file.name} already exists (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            downloaded++;
            continue;
        }
        
        try {
            process.stdout.write(`Downloading ${file.name}... `);
            const size = await downloadFile(file.url, filepath);
            console.log(`[OK] (${(size / 1024 / 1024).toFixed(2)} MB)`);
            downloaded++;
        } catch (error) {
            console.log(`[FAILED] ${error.message}`);
            failed++;
        }
    }
    
    console.log(`\nSummary:`);
    console.log(`  Downloaded: ${downloaded} files`);
    console.log(`  Failed: ${failed} files`);
    
    if (downloaded > 0) {
        console.log(`\n✅ Files are ready! Test preview in the app.`);
    }
    
    if (failed > 0) {
        console.log(`\n⚠️  Some files failed. You can manually download from:`);
        console.log(`   - https://freepd.com/`);
        console.log(`   - https://incompetech.com/music/royalty-free/`);
        console.log(`   - https://www.soundhelix.com/`);
        console.log(`\nPlace files in: ${musicDir}`);
    }
}

downloadAll().catch(console.error);

