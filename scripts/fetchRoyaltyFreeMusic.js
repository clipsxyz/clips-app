import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Use built-in fetch (Node 18+) or require node-fetch for older versions
// For Node 18+, fetch is built-in. For older versions, install: npm install node-fetch
let fetch;
if (typeof globalThis.fetch !== 'undefined') {
    fetch = globalThis.fetch;
} else {
    try {
        // Try to use node-fetch if available
        const nodeFetch = await import("node-fetch");
        fetch = nodeFetch.default || nodeFetch;
    } catch (e) {
        console.error("❌ fetch is not available.");
        console.error("   Node 18+ has built-in fetch, or install: npm install node-fetch");
        process.exit(1);
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ▶️ Get your free API Key here: https://pixabay.com/accounts/register/
// Then paste your key below or set as environment variable
const API_KEY = process.env.PIXABAY_API_KEY || "YOUR_PIXABAY_API_KEY";

async function fetchRoyaltyFreeMusic(limit = 20) {
    if (API_KEY === "YOUR_PIXABAY_API_KEY") {
        console.error("❌ Please set your Pixabay API key!");
        console.log("1. Get a free key: https://pixabay.com/accounts/register/");
        console.log("2. Set it as: export PIXABAY_API_KEY=your_key_here");
        console.log("   Or edit this file and replace YOUR_PIXABAY_API_KEY");
        return;
    }

    const url = `https://pixabay.com/api/music/?key=${API_KEY}&per_page=${limit}&order=popular&safesearch=true`;

    try {
        console.log("🔄 Fetching royalty-free music from Pixabay...");
        const response = await fetch(url);
        const data = await response.json();

        if (!data.hits || data.hits.length === 0) {
            console.log("⚠️  No tracks found — try increasing limit or checking API key");
            return;
        }

        const tracks = data.hits.map((track, index) => ({
            id: track.id || `pixabay_${index}`,
            title: track.tags?.split(",")[0]?.trim() || `Track ${index + 1}`,
            artist: track.user || "Unknown Artist",
            cover: track.image || "https://via.placeholder.com/150?text=No+Cover",
            src: track.audio, // MP3 stream URL
            preview_url: track.audio, // Same as src for preview
            url: track.audio, // Download URL
            license: "CC0 / Royalty Free",
            license_type: "CC0",
            license_url: "https://creativecommons.org/publicdomain/zero/1.0/",
            license_requires_attribution: false,
            source: "Pixabay",
            genre: extractGenre(track.tags),
            mood: extractMood(track.tags),
            duration: track.duration || 180, // Default 3 minutes
            is_ai_generated: false,
            is_active: true,
        }));

        // Save to JSON file
        const outputPath = path.join(__dirname, "..", "royaltyFreeMusic.json");
        fs.writeFileSync(outputPath, JSON.stringify(tracks, null, 2));

        console.log(`✅ Generated ${tracks.length} royalty-free tracks`);
        console.log(`📁 Saved → ${outputPath}`);
        console.log("\n💡 Next steps:");
        console.log("   1. Review royaltyFreeMusic.json");
        console.log("   2. Import into your Laravel seeder or React app");
        console.log("   3. Download actual MP3 files if needed");
    } catch (error) {
        console.error("❌ Error fetching music:", error.message);
        if (error.message.includes("API key")) {
            console.log("\n💡 Make sure your Pixabay API key is valid!");
        }
    }
}

// Helper function to extract genre from tags
function extractGenre(tags) {
    if (!tags) return "ambient";
    const tagStr = tags.toLowerCase();
    
    if (tagStr.includes("pop")) return "pop";
    if (tagStr.includes("rock")) return "rock";
    if (tagStr.includes("electronic") || tagStr.includes("edm")) return "electronic";
    if (tagStr.includes("hip") || tagStr.includes("rap")) return "hip-hop";
    if (tagStr.includes("jazz")) return "jazz";
    if (tagStr.includes("classical") || tagStr.includes("piano")) return "classical";
    if (tagStr.includes("ambient") || tagStr.includes("chill")) return "ambient";
    
    return "ambient"; // Default
}

// Helper function to extract mood from tags
function extractMood(tags) {
    if (!tags) return "calm";
    const tagStr = tags.toLowerCase();
    
    if (tagStr.includes("happy") || tagStr.includes("upbeat")) return "happy";
    if (tagStr.includes("energetic") || tagStr.includes("intense")) return "energetic";
    if (tagStr.includes("calm") || tagStr.includes("peaceful") || tagStr.includes("relax")) return "calm";
    if (tagStr.includes("dramatic") || tagStr.includes("epic")) return "dramatic";
    if (tagStr.includes("romantic") || tagStr.includes("love")) return "romantic";
    
    return "calm"; // Default
}

// Run the script
fetchRoyaltyFreeMusic(20);

