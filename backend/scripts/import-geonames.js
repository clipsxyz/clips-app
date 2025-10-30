import { createReadStream, mkdirSync, writeFileSync } from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';
import readline from 'readline';

// GeoNames source directory (unzipped files)
// Expect: countryInfo.txt and cities5000.txt (or cities15000.txt)
const SRC = process.env.GEONAMES_SRC || './geonames';
const OUT_DIR = './backend/data';
const OUT_NDJSON = join(OUT_DIR, 'gazetteer.ndjson');

const COUNTRY_INFO = join(SRC, 'countryInfo.txt');
const CITIES_5000 = join(SRC, 'cities5000.txt');
const CITIES_15000 = join(SRC, 'cities15000.txt');

function parseCountryInfoLine(line) {
    if (!line || line.startsWith('#')) return null;
    const parts = line.split('\t');
    // ISO alpha-2, ISO alpha-3, ISO numeric, fips, Country, Capital, ...
    const code = parts[0];
    const name = parts[4];
    if (!code || !name) return null;
    return { code, name };
}

function parseCityLine(line) {
    if (!line) return null;
    const parts = line.split('\t');
    // GeoNames cities*.txt format
    const name = parts[1]; // name
    const asciiname = parts[2];
    const countryCode = parts[8];
    const admin1 = parts[10]; // admin1 code
    const population = parseInt(parts[14] || '0', 10);
    const featureClass = parts[6];
    const fcode = parts[7];
    const displayName = name || asciiname;
    if (!displayName || !countryCode) return null;
    return { name: displayName, featureClass, fcode, countryCode, admin1, population };
}

async function loadCountries() {
    if (!existsSync(COUNTRY_INFO)) {
        console.error('countryInfo.txt not found in', SRC);
        return { map: new Map(), list: [] };
    }
    const rl = readline.createInterface({ input: createReadStream(COUNTRY_INFO), crlfDelay: Infinity });
    const map = new Map();
    const list = [];
    for await (const line of rl) {
        const c = parseCountryInfoLine(line);
        if (c) {
            map.set(c.code, c.name);
            list.push({ name: c.name, type: 'country' });
        }
    }
    return { map, list };
}

async function* iterCities() {
    const file = existsSync(CITIES_15000) ? CITIES_15000 : CITIES_5000;
    if (!file || !existsSync(file)) {
        console.error('cities file not found in', SRC, '(expected cities5000.txt or cities15000.txt)');
        return;
    }
    const rl = readline.createInterface({ input: createReadStream(file), crlfDelay: Infinity });
    for await (const line of rl) {
        const city = parseCityLine(line);
        if (city) yield city;
    }
}

function mapType(featureClass, fcode) {
    if (fcode === 'PPLC' || fcode === 'PPLA' || fcode === 'PPLA2' || fcode === 'PPLA3' || fcode === 'PPLA4') return 'city';
    if (featureClass === 'P') return 'city';
    return 'local';
}

async function run() {
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    // Truncate output
    writeFileSync(OUT_NDJSON, '');

    const { map: ccMap, list: countries } = await loadCountries();

    // Write countries first
    for (const c of countries) {
        writeFileSync(OUT_NDJSON, JSON.stringify(c) + '\n', { flag: 'a' });
    }

    // Stream cities
    let count = 0;
    for await (const city of iterCities()) {
        const country = ccMap.get(city.countryCode) || city.countryCode;
        const type = mapType(city.featureClass, city.fcode);
        const rec = { name: city.name, type, country };
        writeFileSync(OUT_NDJSON, JSON.stringify(rec) + '\n', { flag: 'a' });
        count++;
        if (count % 50000 === 0) console.log('Processed cities:', count);
    }

    console.log('Import complete. Output:', OUT_NDJSON);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});


