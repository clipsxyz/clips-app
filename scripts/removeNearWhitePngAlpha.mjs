/**
 * Make near-white pixels transparent on splash logo PNG (removes white matte on black splash).
 * Requires: npm i -D jimp@0.22.12
 * Usage: node scripts/removeNearWhitePngAlpha.mjs [path-to-png]
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultPath = join(__dirname, '..', 'src', 'assets', 'gazetteer-splash-logo.png');
const target = process.argv[2] || defaultPath;

async function main() {
  const { default: Jimp } = await import('jimp');
  const img = await Jimp.read(target);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const threshold = 248; // RGB above this → transparent (white matte)

  img.scan(0, 0, w, h, function (x, y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    if (r >= threshold && g >= threshold && b >= threshold) {
      this.bitmap.data[idx + 3] = 0;
    }
  });

  await img.writeAsync(target);
  console.log('Wrote transparent matte:', target);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
