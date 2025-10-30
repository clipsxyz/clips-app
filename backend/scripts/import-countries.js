import { createReadStream, mkdirSync, writeFileSync } from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';
import readline from 'readline';

const SRC = process.env.GEONAMES_SRC || './geonames';
const OUT_DIR = './backend/data';
const OUT_NDJSON = join(OUT_DIR, 'gazetteer.ndjson');
const COUNTRY_INFO = join(SRC, 'countryInfo.txt');

function parseCountryInfoLine(line) {
    if (!line || line.startsWith('#')) return null;
    const parts = line.split('\t');
    const name = parts[4];
    if (!name) return null;
    return { name, type: 'country' };
}

async function run() {
    if (!existsSync(COUNTRY_INFO)) {
        console.error('countryInfo.txt not found in', SRC);
        process.exit(1);
    }
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT_NDJSON, '');

    const rl = readline.createInterface({ input: createReadStream(COUNTRY_INFO), crlfDelay: Infinity });
    let count = 0;
    for await (const line of rl) {
        const rec = parseCountryInfoLine(line);
        if (rec) {
            writeFileSync(OUT_NDJSON, JSON.stringify(rec) + '\n', { flag: 'a' });
            count++;
        }
    }
    console.log(`Imported ${count} countries → ${OUT_NDJSON}`);
}

run().catch(err => { console.error(err); process.exit(1); });


