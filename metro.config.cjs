const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');
const fs = require('fs');
const path = require('path');
// metro-config package exports omit this path — load the file directly.
const exclusionList = require(path.join(
  __dirname,
  'node_modules/metro-config/src/defaults/exclusionList.js',
)).default;

/** Load repo `.env` into process.env so Metro/babel see EXPO_PUBLIC_* / VITE_* / REACT_NATIVE_API_URL at bundle time. */
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
      if (!/^(VITE_|EXPO_PUBLIC_|REACT_NATIVE_API_URL$)/.test(key)) continue;
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
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = mergeConfig(getDefaultConfig(__dirname), {
  // Keep file watchers under macOS launchctl soft maxfiles (often 256).
  // These trees are not part of the RN JS bundle.
  resolver: {
    blockList: exclusionList([
      /\/laravel-backend\/.*/,
      /\/ios\/Pods\/.*/,
      /\/ios\/build\/.*/,
      /\/android\/\.gradle\/.*/,
      /\/android\/app\/build\/.*/,
      /\/android\/build\/.*/,
      /\/musicgen-service\/.*/,
      /\/socketio-server\/node_modules\/.*/,
      // Only the app's Vite output — never node_modules/*/dist
      new RegExp(`^${path.resolve(__dirname, 'dist').replace(/[/\\]/g, '[/\\\\]')}[/\\\\].*`),
      /\/\.git\/.*/,
      /\/\.expo\/.*/,
    ]),
  },
  watcher: {
    healthCheck: {
      enabled: true,
    },
  },
});

module.exports = withNativeWind(config, {
  input: './global.css',
  configPath: path.resolve(__dirname, 'tailwind.config.cjs')
});
