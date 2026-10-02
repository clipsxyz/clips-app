#!/usr/bin/env node
/**
 * CLI front-end for the shared dev bootstrap (scripts/lib/dev-bundle-bootstrap.cjs).
 *
 * The same logic runs automatically from `metro.config.cjs`; this exists for the case
 * where you want to repair or audit the device without restarting Metro.
 *
 * Usage:
 *   npm run android:dev-host                 # detect, push to devices, verify
 *   npm run android:dev-host -- --check      # report only, exit 1 on drift
 *   npm run android:dev-host -- --print      # list LAN candidates, touch nothing
 *   npm run android:dev-host -- --port 8082 --app-id com.example.app
 */
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const core = require('./lib/dev-bundle-bootstrap.cjs');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const PORT = Number(opt('port', process.env.METRO_PORT ?? 8081));
const ROOT = process.cwd();
const APP_ID = opt('app-id', core.readApplicationId ? core.readApplicationId(ROOT) : 'com.clipsapp');
const log = (...a) => console.log(...a);
const warn = (...a) => console.warn(...a);

const candidates = core.hostAddresses();

if (flag('print')) {
  if (candidates.length === 0) {
    warn('No non-internal IPv4 interface found. Connect to Wi-Fi first.');
    process.exit(1);
  }
  log(`LAN IP candidates for :${PORT}`);
  for (const c of candidates) {
    log(`  ${c.address}  (${c.name})${c.virtual ? ' [virtual, deprioritized]' : ''}`);
  }
  process.exit(0);
}

const devices = core.connectedDevices();
const host = core.chooseHostAddress(devices[0] ? core.deviceAddress(devices[0]) : null)?.address ?? null;

if (flag('check')) {
  if (!host) {
    warn('No usable LAN address.');
    process.exit(1);
  }
  log(`Metro host : ${host}:${PORT}`);
  log(`App id     : ${APP_ID}`);
  if (devices.length === 0) {
    warn('No device attached.');
    process.exit(0);
  }

  // Reachability alone is a false green: a shell `curl` reaches the host regardless of
  // what the app has stored. Drift between the stored host and this machine is what
  // actually breaks the launch, so both are reported.
  let drift = 0;
  for (const serial of devices) {
    const stored = core.readDebugHost(serial, APP_ID) ?? '(unset)';
    const matches = stored === `${host}:${PORT}`;
    if (!matches) drift += 1;
    log(`  ${serial}`);
    log(`      debug_http_host : ${stored}${matches ? '' : `  <- stale, expected ${host}:${PORT}`}`);
    log(`      device -> host  : ${core.verifyFromDevice(serial, host, PORT) ? 'reachable' : 'UNREACHABLE'}`);
  }
  if (drift > 0) {
    warn(`\n${drift} device(s) point at the wrong Metro host.`);
    warn('Run `npm run android:dev-host` to repair (the app is stopped automatically).');
    process.exit(1);
  }
  log('\nOK: every device points at this machine and can reach it.');
  process.exit(0);
}

const code = core.runBootstrap({ root: ROOT, trigger: 'cli', port: PORT });
if (host) log(`\nMetro is reachable at http://${host}:${PORT}`);
process.exit(code);