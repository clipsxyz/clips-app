const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');
const fs = require('fs');
const path = require('path');

/** Load repo `.env` into process.env so Metro/babel see EXPO_PUBLIC_* / VITE_* at bundle time. */
function loadRootEnvIntoProcess() {
  try {
    const envPath = path.resolve(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    const text = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      if (!/^(VITE_|EXPO_PUBLIC_)/.test(key)) continue;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}

loadRootEnvIntoProcess();

/**
 * Device/bundle bootstrap.
 *
 * This module is the one seam shared by every way Metro can be launched — `npm start`,
 * `npx react-native start` and `npx expo start` each load this config before the server
 * binds, whereas npm `prestart` hooks only fire for `npm start`. Running the LAN IP
 * auto-repair and the stale-snapshot audit here is what makes them unconditional.
 *
 * It runs at config-evaluation time, so the device is already pointed at this machine's
 * current address before the first bundle request can arrive. That ordering matters: RN
 * probes Metro once during startup and, on failure, permanently falls back to the APK
 * asset loader — so a repair that lands after `listen()` is too late for that launch.
 *
 * Safety: `runBootstrap` never throws and only returns non-zero when the project itself
 * is unreadable. A missing device, an unreachable phone or a stale bundle are reported
 * but must not stop the bundler from booting. Set `GAZETTEER_SKIP_BOOTSTRAP=1` to bypass
 * entirely (the background asset rebuild does this for its own child process to avoid
 * recursing back through this file).
 */
try {
  const { runBootstrap } = require('./scripts/lib/dev-bundle-bootstrap.cjs');
  runBootstrap({ root: __dirname, trigger: 'metro.config' });
} catch (err) {
  console.warn('[dev-bootstrap] skipped:', (err && err.message) || err);
}

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = mergeConfig(getDefaultConfig(__dirname), {});

module.exports = withNativeWind(config, {
  input: './global.css',
  configPath: path.resolve(__dirname, 'tailwind.config.cjs')
});
