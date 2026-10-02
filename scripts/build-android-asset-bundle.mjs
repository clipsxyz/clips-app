#!/usr/bin/env node
/**
 * Refresh (or audit) the JS bundle embedded in the APK at
 * `android/app/src/main/assets/index.android.bundle`.
 *
 * Why it must exist
 * -----------------
 * A React Native *debug* APK normally ships no JS and expects Metro. The instant Metro is
 * unreachable, `ReactHostImpl.getJSBundleLoader()` sees `isMetroRunning() == false` and
 * falls back to the asset loader. With no asset present that is a hard launch crash
 * (`RuntimeException: Unable to load script`); with a *stale* asset present it is worse —
 * the app boots convincingly but runs old JS, so a fix looks broken with no crash to
 * explain it. Shipping a current asset turns that into a usable offline snapshot.
 *
 * This is also what `metro.config.cjs` invokes in the background when it detects staleness
 * (see scripts/lib/dev-bundle-bootstrap.cjs for the recursion guard).
 *
 * Usage:
 *   npm run android:asset-bundle               # rebuild
 *   npm run android:asset-bundle -- --check    # staleness audit, exit 1 when stale
 *   npm run android:asset-bundle -- --dev false
 *   npm run android:asset-bundle -- --reset-cache   # standalone use only
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const core = require('./lib/dev-bundle-bootstrap.cjs');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const ROOT = process.cwd();
const ENTRY = opt('entry', 'index.js');
const PLATFORM = opt('platform', 'android');
const DEV = opt('dev', 'true');
const RESET_CACHE = flag('reset-cache');
const log = (...a) => console.log(...a);
const warn = (...a) => console.warn(...a);

const { dir, bundle, meta } = core.bundlePaths(ROOT);

const gitSha = () => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
};

if (flag('check')) {
  const state = core.inspectAssetBundle(ROOT);
  log(`bundle : ${state.bundle}`);
  if (state.status === 'missing') {
    warn('missing  — offline launches would crash with "Unable to load script".');
    warn(`Run \`npm run android:asset-bundle\` (built with \`react-native bundle\`).`);
    process.exit(1);
  }
  log(`built  : ${state.builtIso}`);
  log(`sha256 : ${state.sha}`);
  if (state.status === 'stale') {
    warn(`STALE   : ${state.staleFile} is newer than the snapshot.`);
    warn('Offline launches would render pre-change code.');
    process.exit(1);
  }
  log('FRESH   : snapshot is at least as new as every source file.');
  process.exit(0);
}

mkdirSync(dir, { recursive: true });
log(`Bundling ${ENTRY} -> ${bundle} (dev=${DEV}${RESET_CACHE ? ', reset-cache' : ''})`);

const args = [
  'react-native',
  'bundle',
  '--platform',
  PLATFORM,
  '--dev',
  DEV,
  '--entry-file',
  ENTRY,
  '--bundle-output',
  bundle,
];
// Opt-in only. Clearing the cache of a Metro that is currently serving the developer
// invalidates the running session; the in-Metro auto-repair path never passes this.
if (RESET_CACHE) args.push('--reset-cache');

let failed = false;
try {
  execFileSync('npx', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch {
  failed = true;
}

if (failed || !core.inspectAssetBundle(ROOT).sha) {
  warn('react-native bundle failed. Any previous snapshot is left untouched.');
  process.exit(1);
}

const state = core.inspectAssetBundle(ROOT);
const bytes = statSync(bundle).size;
writeFileSync(
  meta,
  [
    `built_at=${new Date().toISOString()}`,
    `platform=${PLATFORM}`,
    `dev=${DEV}`,
    `entry=${ENTRY}`,
    `git=${gitSha()}`,
    `sha256=${state.sha}`,
    `bytes=${bytes}`,
    '',
  ].join('\n'),
);

log(`OK  ${(bytes / 1024 / 1024).toFixed(1)} MiB  sha256=${state.sha}  git=${gitSha()}`);
log(`meta ${path.relative(ROOT, meta)}`);
log('Offline launches will now render this snapshot when Metro is unreachable.');