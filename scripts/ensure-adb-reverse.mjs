#!/usr/bin/env node
/**
 * Re-establish the ADB reverse tunnels a React Native debug build needs, and prove
 * they work.
 *
 * Why this exists as a script: with *wireless* ADB, `adb reverse` is bound to the
 * current connection. Any reconnect — screen off, network switch, `adb
 * connect`/`disconnect`, a Metro restart that re-enumerates devices — silently drops
 * every mapping while leaving the device listed as `device`. The app then fails with
 * the opaque redbox:
 *
 *     Unable to load script. Make sure you're either running Metro or that the
 *     bundle is packaged correctly.
 *
 * which reads like a bundling bug and is not one. Metro is still serving, the device
 * is still connected, and `adb reverse --list` is simply empty. Re-running the raw
 * `adb reverse` commands fixes it every time, so this just does that, then verifies
 * from the device side instead of trusting the exit code.
 *
 * Usage:
 *   npm run android:adb-reverse          # set + verify
 *   npm run android:adb-reverse -- --check   # verify only, change nothing
 */
import { execFileSync } from 'node:child_process';

const PORTS = [8081, 8080, 8000];
const CHECK_ONLY = process.argv.includes('--check');

const adb = (args) => execFileSync('adb', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
/** Returns stdout on success, or null on failure (adb writes errors to stderr). */
const adbTry = (args) => {
    try {
        return adb(args);
    } catch {
        return null;
    }
};
const mappedPorts = (list) =>
    new Set(
        (list ?? '')
            .split('\n')
            .map((line) => /tcp:(\d+)/.exec(line)?.[1])
            .filter(Boolean),
    );

const devices = adbTry(['devices']);
if (devices === null || !/\tdevice\b/.test(devices)) {
    console.error('No device attached. Connect a device (or `adb connect <host:port>`) first.');
    process.exit(1);
}

const before = mappedPorts(adbTry(['reverse', '--list']));

if (!CHECK_ONLY) {
    for (const port of PORTS) {
        if (before.has(String(port))) continue;
        if (adbTry(['reverse', `tcp:${port}`, `tcp:${port}`]) === null) {
            console.warn(`  ! could not map ${port}`);
        }
    }
}

const after = mappedPorts(adbTry(['reverse', '--list']));
const missing = PORTS.filter((p) => !after.has(String(p)));
const added = PORTS.filter((p) => after.has(String(p)) && !before.has(String(p)));

if (added.length > 0) {
    console.log(`(re)established ${added.length} reverse tunnel(s): ${added.join(', ')}.`);
} else if (CHECK_ONLY) {
    console.log('No tunnels needed re-establishing.');
}

// Verify from the device, not from the exit code. `curl` is absent on plenty of
// Android builds, so fall back to the first HTTP client that exists.
const probe = adbTry([
    'shell',
    'for c in curl toybox\ wget; do command -v $c >/dev/null 2>&1 && { $c -s -m 5 http://localhost:8081/status 2>/dev/null && exit 0; }; done; exit 1',
]);

if (missing.length > 0) {
    console.warn(`Still unmapped: ${missing.join(', ')}`);
}
if (probe === null || !/packager-status/.test(probe)) {
    console.error(
        'Device still cannot reach Metro on 8081.\n' +
            '  - Is Metro running? `npm start`, or check `lsof -nP -iTCP:8081 -sTCP:LISTEN`.\n' +
            '  - Wireless ADB? Re-run `adb connect <host:port>` then this script.\n' +
            '  - Release build? A bundled APK ignores Metro entirely.',
    );
    process.exit(1);
}

console.log('OK: device can reach Metro on 8081 (packager-status:running).');
