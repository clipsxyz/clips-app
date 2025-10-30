import { existsSync, createReadStream } from 'fs';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let cache = null;

function mapTypeFromGeonames(featureClass, fcode) {
    // Very simplified mapping
    if (fcode === 'PCLI') return 'country';
    if (featureClass === 'P') return 'city';
    if (featureClass === 'A') return 'city';
    return 'local';
}

function normalizeRecord(rec) {
    // Expected fields for our API: name, type, country, city
    const name = rec.name || rec.asciiName || rec.fullName || rec.display_name;
    const type = rec.type || mapTypeFromGeonames(rec.featureClass, rec.fcode);
    const country = rec.country || rec.countryName || rec.country_code || rec.countryCode;
    const city = rec.city || rec.admin1Name || rec.admin2Name;
    if (!name) return null;
    return { name, type, country, city };
}

export async function loadGazetteer() {
    if (cache) return cache;
    const baseDir = join(__dirname, '..', 'data');
    const configured = process.env.GAZETTEER_PATH;
    const jsonPath = configured ? configured : join(baseDir, 'gazetteer.json');
    const ndjsonPath = configured ? configured : join(baseDir, 'gazetteer.ndjson');

    // Prefer JSON if present
    if (existsSync(jsonPath)) {
        const raw = await readFile(jsonPath, 'utf-8');
        const arr = JSON.parse(raw);
        cache = arr.map(normalizeRecord).filter(Boolean);
        return cache;
    }

    // Fallback to NDJSON (JSON Lines)
    if (existsSync(ndjsonPath)) {
        const items = [];
        const rl = readline.createInterface({ input: createReadStream(ndjsonPath), crlfDelay: Infinity });
        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                const obj = JSON.parse(line);
                const norm = normalizeRecord(obj);
                if (norm) items.push(norm);
            } catch { }
        }
        cache = items;
        return cache;
    }

    // Tiny built-in fallback to keep API working
    cache = [
        { name: 'Finglas', type: 'local', country: 'Ireland', city: 'Dublin' },
        { name: 'Artane', type: 'local', country: 'Ireland', city: 'Dublin' },
        { name: 'Dublin', type: 'city', country: 'Ireland' },
        { name: 'Paris', type: 'city', country: 'France' },
        { name: 'London', type: 'city', country: 'United Kingdom' },
        { name: 'Ireland', type: 'country' },
        { name: 'France', type: 'country' },
        { name: 'United Kingdom', type: 'country' }
    ];
    return cache;
}


