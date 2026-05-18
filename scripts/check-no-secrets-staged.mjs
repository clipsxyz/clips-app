#!/usr/bin/env node
/**
 * Blocks commits/pushes that include secret files or Google API keys in tracked files.
 * Run manually: npm run check:secrets
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ALLOWED_PATH_SUFFIXES = [
  '.env.example',
  'env.example',
  'laravel-backend/.env.example',
  'firebase-web.local.json.example',
];

const BLOCKED_EXACT = new Set([
  '.env',
  '.env.local',
  'firebase-web.local.json',
  'public/firebase-messaging-sw.js',
  'android/app/google-services.json',
  'ios/GoogleService-Info.plist',
  'ios/ClipsApp/GoogleService-Info.plist',
  'laravel-backend/.env',
]);

function normalize(p) {
  return p.replace(/\\/g, '/');
}

function isAllowedEnvFile(file) {
  return ALLOWED_PATH_SUFFIXES.some((suffix) => file === suffix || file.endsWith(suffix));
}

function isBlockedPath(file) {
  const f = normalize(file);
  if (BLOCKED_EXACT.has(f)) return true;
  if (isAllowedEnvFile(f)) return false;
  if (f.startsWith('.env.') && !f.includes('.example')) return true;
  if (f.includes('google-services.json')) return true;
  if (f.includes('GoogleService-Info.plist')) return true;
  return false;
}

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: root,
      encoding: 'utf8',
    });
    return out.trim() ? out.trim().split(/\r?\n/) : [];
  } catch {
    return [];
  }
}

function stagedContainsGoogleApiKey(file) {
  if (isAllowedEnvFile(normalize(file))) return null;
  try {
    const diff = execSync(`git diff --cached -- "${file}"`, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    if (/AIza[0-9A-Za-z_-]{20,}/.test(diff)) {
      return 'Google API key pattern (AIza…) found in staged changes';
    }
  } catch {
    /* ignore */
  }
  return null;
}

const staged = getStagedFiles();
const errors = [];

for (const file of staged) {
  if (isBlockedPath(file)) {
    errors.push(`Secret file must not be committed: ${file}`);
    continue;
  }
  const keyHit = stagedContainsGoogleApiKey(file);
  if (keyHit) {
    errors.push(`${file}: ${keyHit}`);
  }
}

if (errors.length > 0) {
  console.error('\n❌ Secret safety check failed:\n');
  for (const e of errors) {
    console.error(`  • ${e}`);
  }
  console.error(`
Keep keys only in .env (gitignored). Use:
  git restore --staged <file>
  npm run dev   (regenerates public/firebase-messaging-sw.js locally)

See .gitignore and public/firebase-messaging-sw.template.js
`);
  process.exit(1);
}

console.log('✓ No secret files or API keys staged for commit.');
