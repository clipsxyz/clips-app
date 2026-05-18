#!/usr/bin/env node
/** Point this repo at .githooks/ so pre-commit/pre-push run the secret check. */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  execSync('git config core.hooksPath .githooks', { cwd: root, stdio: 'inherit' });
  console.log('Git hooks installed (.githooks → pre-commit & pre-push secret check)');
} catch (e) {
  console.warn('Could not install git hooks (not a git repo?):', e.message);
}
