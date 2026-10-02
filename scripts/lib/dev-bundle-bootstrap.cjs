'use strict';
/**
 * Shared device/bundle bootstrap used by every entry point that can start Metro.
 *
 * `metro.config.cjs` is the only seam that all launch styles share: `npm start`,
 * `npx react-native start` and `npx expo start` each load it before the server
 * listens, whereas npm `prestart` hooks only fire for `npm start`. Keeping the logic
 * here (rather than in either CLI script) is what makes one implementation serve all
 * three launch paths.
 *
 * Two failure modes this code is deliberately built to avoid:
 *
 *  1. Infinite recursion. `react-native bundle` loads `metro.config.cjs` too, so a
 *     staleness check that shells out to `react-native bundle` re-enters itself. The
 *     `GAZETTEER_SKIP_BOOTSTRAP` env var is exported to the child so its Metro config
 *     load is a no-op.
 *
 *  2. `--reset-cache` against a *running* server. That wipes the live Metro cache
 *     mid-session. The in-Metro repair path therefore never resets the cache; only the
 *     standalone CLI rebuild does.
 *
 * Booting the bundler matters more than perfecting the device, so this never throws and
 * only reports a non-zero exit when the project itself is unreadable.
 */
const { execFileSync, spawn } = require('node:child_process');
const http = require('node:http');
const { networkInterfaces } = require('node:os');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const GUARD_ENV = 'GAZETTEER_SKIP_BOOTSTRAP';
const LABEL = '[dev-bootstrap]';
const DEFAULT_PORT = 8081;
const DEFAULT_APP_ID = 'com.clipsapp';
/** The Laravel API still tunnels over reverse; Metro itself is reached over the LAN. */
const REVERSE_PORTS = [8000];

/** Files the aspect-ratio fix lives in, named explicitly so coverage is obvious. */
const WATCHED_SOURCES = [
  'index.js',
  'App.native.tsx',
  'src/utils/mediaAspectRatio.ts',
  'src/api/posts.ts',
  'src/screens/FeedScreen.tsx',
  'src/components/FeedPostMedia.native.tsx',
  'src/components/MyFeedPostCard.native.tsx',
  'src/components/FeedPostSkeleton.native.tsx',
  'src/constants/feedUiTokens.ts',
];
const SOURCE_SCAN_ROOTS = ['src'];

const stamp = () => new Date().toISOString().slice(11, 19);
const say = (...a) => console.log(`${LABEL} ${stamp()}`, ...a);
const note = (...a) => console.warn(`${LABEL} ${stamp()}`, ...a);

const adbTry = (args, input) => {
  try {
    return execFileSync('adb', args, {
      encoding: 'utf8',
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      input,
    });
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ host IP */

/** Every IPv4 the machine owns, best candidates first. */
function hostAddresses() {
  const out = [];
  for (const [name, addrs] of Object.entries(networkInterfaces() || {})) {
    for (const addr of addrs || []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (addr.address.startsWith('169.254.')) continue; // link-local autoconf
      // VPN/container bridges answer locally but are not routable from the phone.
      const virtual = /^(docker|br-|veth|utun|pppoe|tun|tap|awdl|anpi|llw|bridge)/i.test(name);
      out.push({ name, address: addr.address, virtual });
    }
  }
  return out.sort((a, b) => Number(a.virtual) - Number(b.virtual));
}

/** The device's own Wi-Fi address, so we can pick the host NIC on the same subnet. */
function deviceAddress(serial) {
  const probes = [
    "ip route get 1.1.1.1 2>/dev/null | grep -o 'src [0-9.]*' | cut -d' ' -f2",
    'getprop dhcp.wlan0.ip_address',
    "ip -4 addr show wlan0 2>/dev/null | grep -o 'inet [0-9.]*' | cut -d' ' -f2",
  ];
  for (const probe of probes) {
    const found = (adbTry(['-s', serial, 'shell', probe]) || '').trim().split(/\s+/)[0];
    if (found && /^\d+\.\d+\.\d+\.\d+$/.test(found)) return found;
  }
  return null;
}

const subnetOf = (ip) => (ip ? ip.split('.').slice(0, 3).join('.') : null);

/**
 * Same-subnet NIC wins. Falling back to "first non-internal address" is a trap: on a
 * laptop with Docker or a VPN up, that address is unreachable from the phone even though
 * the phone is on the same Wi-Fi as the machine.
 */
function chooseHostAddress(deviceIp) {
  const candidates = hostAddresses();
  if (candidates.length === 0) return null;
  if (!deviceIp) return candidates[0];
  const want = subnetOf(deviceIp);
  return candidates.find((c) => subnetOf(c.address) === want) || candidates[0];
}

/* ------------------------------------------------------------------ devices */

function connectedDevices() {
  const listing = adbTry(['devices']);
  if (listing === null) return [];
  return listing
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts[1] === 'device' && parts[0])
    .map(([serial]) => serial);
}

const readApplicationId = (root) => {
  try {
    const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
    return /applicationId\s+"([^"]+)"/.exec(gradle)?.[1] || DEFAULT_APP_ID;
  } catch {
    return DEFAULT_APP_ID;
  }
};

const PREFS = 'shared_prefs/ReactNativeDevSupport.xml';

const readDebugHost = (serial, appId) => {
  const raw = adbTry(['-s', serial, 'shell', `run-as ${appId} cat ${PREFS}`]);
  if (raw === null) return null;
  return /<string name="debug_http_host">([^<]*)<\/string>/.exec(raw)?.[1] ?? null;
};

/**
 * Rewrite `debug_http_host` on the device.
 *
 * Read/transform/write on the host rather than `sed -i`: this crosses three shell layers
 * (local -> `adb shell` -> `run-as sh -c`) and nested quoting for XML corrupts the prefs
 * file in ways that are miserable to diagnose.
 */
function writeDebugHost(serial, appId, host, port) {
  // Refuse anything that is not a bare IPv4 literal. Writing a malformed value here is
  // silent and self-inflicted: the app boots, fails to reach Metro, and blames the bundle.
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(String(host ?? ''))) {
    return { ok: false, reason: `invalid-host(${typeof host === 'object' ? 'object' : String(host)})` };
  }
  const raw = adbTry(['-s', serial, 'shell', `run-as ${appId} cat ${PREFS}`]);
  if (raw === null) return { ok: false, reason: 'prefs-unreadable' };

  const value = `${host}:${port}`;
  const entry = `<string name="debug_http_host">${value}</string>`;
  const next = /<string name="debug_http_host">[^<]*<\/string>/.test(raw)
    ? raw.replace(/<string name="debug_http_host">[^<]*<\/string>/, entry)
    : raw.includes('</map>')
      ? raw.replace('</map>', `${entry}</map>`)
      : `<map>${entry}</map>`;

  const written = adbTry(['-s', serial, 'shell', `run-as ${appId} sh -c "cat > ${PREFS}"`], next);
  return written === null ? { ok: false, reason: 'prefs-write-failed' } : { ok: true, value };
}

/**
 * `run-as` only works against a debuggable build, and SharedPreferences is cached
 * in-process and rewritten on exit — so the app must be stopped before the file is
 * edited or the change is silently reverted.
 */
function applyDevHost({ root, port, appId }) {
  // `chooseHostAddress` returns the candidate record ({name, address, virtual}); the
  // address string is what belongs in `debug_http_host`, so unwrap it here rather than
  // letting an object stringify into the prefs file.
  const chosen = chooseHostAddress(deviceAddress(connectedDevices()[0]) || null);
  const host = chosen ? chosen.address : null;
  if (!host) return { host: null, devices: [], problem: 'no-ipv4' };

  const results = [];
  for (const serial of connectedDevices()) {
    const previous = readDebugHost(serial, appId);
    const desired = `${host}:${port}`;

    // Only stop the app when the stored value is actually wrong. SharedPreferences is
    // cached in-process and rewritten on exit, so the stop is required before an edit —
    // but doing it unconditionally would kill the app on every Metro restart.
    const changed = previous !== desired;
    if (changed) adbTry(['-s', serial, 'shell', 'am', 'force-stop', appId]);
    const write = changed ? writeDebugHost(serial, appId, host, port) : { ok: true, value: desired };

    const mapped = new Set(
      (adbTry(['-s', serial, 'reverse', '--list']) || '')
        .split('\n')
        .map((l) => /tcp:(\d+)/.exec(l)?.[1])
        .filter(Boolean),
    );
    const tunnels = [];
    for (const p of REVERSE_PORTS) {
      if (mapped.has(String(p))) continue;
      if (adbTry(['-s', serial, 'reverse', `tcp:${p}`, `tcp:${p}`]) !== null) tunnels.push(p);
    }

    results.push({
      serial,
      previous,
      next: write.ok ? write.value : null,
      wrote: write.ok,
      reason: write.reason || null,
      tunnels,
      changed,
      // Deliberately not probed here — see `probeDevices`.
      reachable: null,
    });
  }
  return { host, devices: results, appId, root };
}

/**
 * Probe each device's ability to reach Metro.
 *
 * Kept separate from the write path because of ordering: when this runs from
 * `metro.config.cjs` the server has not bound its port yet, so probing immediately
 * reports every device as unreachable. Metro loads this config *before* listening, which
 * is what makes the repair timely but makes an inline probe meaningless.
 */
function probeDevices(devices, host, port) {
  for (const d of devices) {
    d.reachable = d.wrote ? verifyFromDevice(d.serial, host, port) : false;
  }
  return devices;
}

/** Probe from the device; host-side success proves nothing about the Wi-Fi path. */
function verifyFromDevice(serial, host, port) {
  const probe =
    'for c in curl toybox\\ wget; do command -v $c >/dev/null 2>&1 && ' +
    `{ $c -s -m 8 http://${host}:${port}/status 2>/dev/null && exit 0; }; ` +
    'done; exit 1';
  const out = adbTry(['-s', serial, 'shell', probe]);
  const ok = out !== null && /packager-status/.test(out);
  if (!ok && process.env.GAZETTEER_BOOTSTRAP_DEBUG) {
    let detail;
    try {
      execFileSync('adb', ['-s', serial, 'shell', probe], { encoding: 'utf8', stdio: 'pipe' });
      detail = 'exit 0 but no packager-status in output';
    } catch (err) {
      detail = `status=${err.status} signal=${err.signal} stderr=${JSON.stringify(err.stderr)} msg=${err.message}`;
    }
    note(`  [debug] device probe -> ${detail}`);
  }
  return ok;
}

/* -------------------------------------------------------------- asset bundle */

const bundlePaths = (root) => {
  const dir = path.join(root, 'android/app/src/main/assets');
  return { dir, bundle: path.join(dir, 'index.android.bundle'), meta: `${dir}/index.android.bundle.meta` };
};

const safeMtime = (p) => {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return 0;
  }
};

/** Newest mtime across the aspect-ratio/feed sources plus a full src sweep. */
function newestSource(root) {
  let newest = 0;
  let file = null;
  const consider = (p) => {
    const t = safeMtime(p);
    if (t > newest) {
      newest = t;
      file = p;
    }
  };

  for (const rel of WATCHED_SOURCES) consider(path.join(root, rel));

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '__tests__') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(tsx?|jsx?)$/.test(e.name)) consider(full);
    }
  };
  for (const rel of SOURCE_SCAN_ROOTS) walk(path.join(root, rel));

  return { newest, file };
}

function inspectAssetBundle(root) {
  const { bundle } = bundlePaths(root);
  const built = safeMtime(bundle);
  if (!built) return { status: 'missing', bundle };
  const src = newestSource(root);
  let sha = null;
  try {
    sha = createHash('sha256').update(fs.readFileSync(bundle)).digest('hex').slice(0, 12);
  } catch {
    /* size and mtime are still useful */
  }
  return {
    status: src.newest > built ? 'stale' : 'fresh',
    bundle,
    built,
    builtIso: new Date(built).toISOString(),
    sha,
    staleFile: src.newest > built ? path.relative(root, src.file) : null,
  };
}

/**
 * Rebuild the embedded snapshot out-of-band.
 *
 * Runs detached so Metro startup is never blocked, and exports the guard env var so the
 * child's own Metro config load short-circuits instead of recursing back into here.
 * `resetCache` is intentionally false here: clearing the cache of the server that is
 * currently serving the developer would be actively harmful.
 */
function rebuildAssetBundle({ root, resetCache = false }) {
  const args = [path.join(root, 'scripts/build-android-asset-bundle.mjs')];
  if (resetCache) args.push('--reset-cache');
  const child = spawn(process.execPath, args, {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, [GUARD_ENV]: '1' },
  });
  child.unref();
  return child.pid;
}

/**
 * True once Metro genuinely answers `/status`.
 *
 * Testing only the TCP port is not enough: Metro binds the socket before it can serve,
 * so a connect() succeeds while requests still hang. `/status` returning
 * `packager-status:running` is the exact signal RN itself uses in `isPackagerRunning()`,
 * so waiting on it means our "device can reach Metro" verdict is taken under the same
 * conditions the app will face.
 */
function metroIsReady(port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const req = http.get({ host: '127.0.0.1', port, path: '/status', timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => finish(res.statusCode === 200 && /packager-status/.test(body)));
      res.on('error', () => finish(false));
    });
    req.on('timeout', () => {
      req.destroy();
      finish(false);
    });
    req.on('error', () => finish(false));
  });
}

/**
 * Wait for Metro to answer, then probe each device.
 *
 * Polling readiness first is what makes this correct on a cold cache: a fixed delay is
 * either too short (a false "cannot reach" alarm, since a 17 MB bundle transform can take
 * well over a minute) or an irritating pause. Readiness is observed, not assumed.
 */
async function verifyAfterListen(devices, host, port, { attempts = 60, intervalMs = 3000, probeTries = 3 } = {}) {
  let ready = false;
  for (let i = 0; i < attempts && !ready; i += 1) {
    ready = await metroIsReady(port);
    if (!ready) await new Promise((r) => setTimeout(r, intervalMs));
  }
  if (!ready) {
    note('Metro did not become ready in time — skipping device reachability probe.');
    return devices;
  }

  // The host answering /status and the device dialling the LAN address are not the same
  // event: the socket may be up before the Wi-Fi path is serving. Retry briefly rather
  // than report a failure that a second later is provably wrong.
  for (let d = 0; d < devices.length; d += 1) {
    const device = devices[d];
    if (!device.wrote) continue;
    for (let attempt = 1; attempt <= probeTries; attempt += 1) {
      if (verifyFromDevice(device.serial, host, port)) {
        device.reachable = true;
        break;
      }
      device.reachable = false;
      if (attempt < probeTries) await new Promise((r) => setTimeout(r, 2000));
    }
    say(
      `  ${device.serial}: ${device.reachable ? 'device can reach Metro' : 'DEVICE CANNOT REACH METRO'}`,
    );
  }
  return devices;
}

/* ----------------------------------------------------------------- entry point */

/**
 * @returns {number} 0 in every case except an unreadable project, which is the only
 *   condition that genuinely means Metro cannot work.
 */
function runBootstrap({
  root = process.cwd(),
  trigger = 'metro',
  port = Number(process.env.METRO_PORT || DEFAULT_PORT),
  autoRepair = process.env.GAZETTEER_NO_AUTO_BUNDLE !== '1',
  probeDevice = trigger === 'cli' || process.env.GAZETTEER_PROBE_DEVICE === '1',
  verbose = true,
} = {}) {
  if (process.env[GUARD_ENV]) return 0; // child of our own rebuild — nothing to do

  // Critical-file gate: the project must be readable or nothing else is meaningful.
  try {
    JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  } catch {
    note('cannot read package.json — skipping device bootstrap.');
    return 1;
  }

  if (verbose) say(`bootstrap via ${trigger} (port ${port})`);

  const appId = readApplicationId(root);
  let hostResult = { host: null, devices: [] };

  try {
    hostResult = applyDevHost({ root, port, appId });
  } catch (err) {
    note('LAN IP auto-repair failed (non-fatal):', err && err.message);
  }

  if (!hostResult.host) {
    note('no non-internal IPv4 interface found — connect to Wi-Fi to auto-repair the device.');
  } else if (hostResult.devices.length === 0) {
    say(`host ${hostResult.host}:${port} (${appId}) — no device attached, nothing to repair.`);
  } else {
    say(`host ${hostResult.host}:${port} (${appId})`);
    for (const d of hostResult.devices) {
      if (!d.wrote) {
        note(`  ${d.serial}: could not update debug_http_host (${d.reason}). Needs a debuggable build.`);
        continue;
      }
      say(
        `  ${d.serial}: debug_http_host ${d.changed ? `${d.previous} -> ${d.next}` : `${d.next} (already current)`}`,
      );
      if (d.tunnels.length) say(`  ${d.serial}: reverse tunnel(s) re-established: ${d.tunnels.join(', ')}`);
    }

    // Deliberately no device reachability probe from the Metro process itself.
    //
    // Metro is single-threaded, and during startup it is busy transforming the bundle.
    // A /status request issued by a device while that is happening queues behind the
    // transform and is answered — if at all — long after the probe's own timeout. The
    // probe therefore reports "cannot reach Metro" for a device that reaches Metro
    // perfectly well moments later, which is a far more expensive lie than silence: it
    // sends developers chasing a network fault that does not exist. Verified on this
    // device: the identical command returns in 0.2s from an idle shell and times out
    // from inside the bundler.
    //
    // The device still reports the truth itself — if it cannot load the bundle it says
    // "Unable to load script" loudly. Opt in with GAZETTEER_PROBE_DEVICE=1 when a probe
    // is genuinely wanted, e.g. on an idle Metro.
    if (probeDevice) {
      if (trigger === 'cli') {
        // Running outside the bundler, so an inline probe is reliable here.
        probeDevices(hostResult.devices, hostResult.host, port);
        for (const d of hostResult.devices) {
          if (!d.wrote) continue;
          say(
            `  ${d.serial}: ${d.reachable ? 'device can reach Metro' : 'device cannot reach Metro (is Metro running?)'}`,
          );
        }
      } else {
        const timer = setTimeout(() => {
          verifyAfterListen(hostResult.devices, hostResult.host, port).catch((err) =>
            note('reachability probe failed (non-fatal):', err && err.message),
          );
        }, 3000);
        if (typeof timer.unref === 'function') timer.unref();
      }
    } else if (hostResult.devices.some((d) => d.wrote)) {
      say('  reachability: not probed from inside Metro (would self-interfere).');
      say('  verify on demand: npm run android:dev-host -- --check');
    }
  }

  let asset = { status: 'missing' };
  try {
    asset = inspectAssetBundle(root);
  } catch (err) {
    note('asset bundle inspection failed (non-fatal):', err && err.message);
  }

  if (asset.status === 'fresh') {
    say(`asset bundle FRESH (sha256 ${asset.sha}, built ${asset.builtIso})`);
  } else if (asset.status === 'stale') {
    note(`asset bundle STALE — ${asset.staleFile} is newer than the snapshot.`);
    if (autoRepair) {
      const pid = rebuildAssetBundle({ root, resetCache: false });
      say(`auto-repairing asset bundle in background (pid ${pid}); Metro starts now.`);
    } else {
      note(`  skipped (GAZETTEER_NO_AUTO_BUNDLE=1). Run: npm run android:asset-bundle`);
    }
  } else {
    note('no embedded asset bundle — an offline launch would hard-crash with "Unable to load script".');
    if (autoRepair) {
      const pid = rebuildAssetBundle({ root, resetCache: false });
      say(`building asset bundle in background (pid ${pid}); Metro starts now.`);
    } else {
      note(`  skipped (GAZETTEER_NO_AUTO_BUNDLE=1). Run: npm run android:asset-bundle`);
    }
  }

  return 0;
}

module.exports = {
  GUARD_ENV,
  LABEL,
  runBootstrap,
  applyDevHost,
  inspectAssetBundle,
  rebuildAssetBundle,
  chooseHostAddress,
  hostAddresses,
  deviceAddress,
  connectedDevices,
  readApplicationId,
  readDebugHost,
  probeDevices,
  writeDebugHost,
  verifyFromDevice,
  newestSource,
  bundlePaths,
  WATCHED_SOURCES,
};