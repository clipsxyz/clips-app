/**
 * Vite exposes env on import.meta.env; Metro (React Native) does not.
 * Also reads process.env for RN when babel/react-native-dotenv injects keys.
 */

function readViteEnv(key: string): string | undefined {
  try {
    // Vite replaces import.meta.env at build time on web only — keep behind eval so Hermes never parses import.meta.
    const env = (0, eval)('import.meta.env') as Record<string, string | boolean | undefined> | undefined;
    const v = env?.[key];
    if (v !== undefined && v !== '') return String(v);
  } catch {
    /* Metro / Hermes */
  }
  return undefined;
}

export function getRuntimeEnv(key: string): string | undefined {
  const fromVite = readViteEnv(key);
  if (fromVite !== undefined) return fromVite;

  try {
    if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
      const v = process.env[key];
      if (v !== undefined && v !== '') return String(v);
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export function isReactNativeRuntime(): boolean {
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative') {
      return true;
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof require !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const rn = require('react-native');
      return !!rn?.Platform;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Set after a connection refused / failed fetch so local dev skips Laravel until reload. */
let laravelUnreachableThisSession = false;

export function markLaravelUnreachable(): void {
  laravelUnreachableThisSession = true;
}

/** Clear the session poison-pill (e.g. on Login screen or after a successful API call). */
export function clearLaravelUnreachable(): void {
  laravelUnreachableThisSession = false;
}

export function isLaravelUnreachableThisSession(): boolean {
  return laravelUnreachableThisSession;
}

/** True when EXPO_PUBLIC_USE_MOCK is explicitly `'true'` (mock data fallback; no Laravel). */
export function isMockMode(): boolean {
  let raw: string | undefined;
  try {
    if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_USE_MOCK !== undefined) {
      raw = String(process.env.EXPO_PUBLIC_USE_MOCK);
    }
  } catch {
    /* ignore */
  }
  if (raw === undefined || raw === '') {
    raw = getRuntimeEnv('EXPO_PUBLIC_USE_MOCK');
  }
  return String(raw ?? '').trim().toLowerCase() === 'true';
}

/**
 * Prefer migration env `EXPO_PUBLIC_API_BASE_URL`, then legacy `VITE_API_URL`.
 */
export function getConfiguredApiEnvUrl(): string | undefined {
  return (
    getRuntimeEnv('EXPO_PUBLIC_API_BASE_URL') ||
    getRuntimeEnv('VITE_API_URL') ||
    undefined
  );
}

export function isLaravelApiEnabled(): boolean {
  // Migration flag: keep mock data when EXPO_PUBLIC_USE_MOCK=true.
  if (isMockMode()) return false;
  const raw = getRuntimeEnv('VITE_USE_LARAVEL_API');
  if (raw === 'false') return false;
  // Live migration mode: EXPO_PUBLIC_USE_MOCK=false enables Laravel for migrated routes.
  // RN keeps localhost API hosts for `adb reverse tcp:8000` (see getApiBaseUrl).
  if (raw === 'true' || getRuntimeEnv('EXPO_PUBLIC_USE_MOCK') === 'false') {
    return true;
  }
  if (isReactNativeRuntime()) {
    // Legacy default: stay on mock unless explicitly enabled above.
    return false;
  }
  return true;
}

/** When true, some post actions skip Laravel and use local mock only. */
export function isViteDevMode(): boolean {
  return getRuntimeEnv('VITE_DEV_MODE') === 'true';
}

/**
 * Default Laravel API URL when running under Metro (no window.location).
 *
 * Physical Android: prefer `http://localhost:8000/api` with
 * `adb reverse tcp:8000 tcp:8000` (never 10.0.2.2 — that only works on emulators).
 * Wi‑Fi Metro (e.g. 192.168.x.x:8081) may use the same LAN host for Laravel.
 */
export function getReactNativeDefaultApiBaseUrl(): string | null {
  if (typeof require === 'undefined') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeModules } = require('react-native') as typeof import('react-native');
    const port = '8000';
    const localhostApi = `http://localhost:${port}/api`;

    const scriptUrl = (NativeModules as any)?.SourceCode?.scriptURL as string | undefined;
    if (scriptUrl) {
      try {
        const parsed = new URL(scriptUrl);
        const host = parsed.hostname;
        // LAN / Wi‑Fi Metro → same host for Laravel when not using ADB reverse for API.
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
          return `http://${host}:${port}/api`;
        }
        // USB / wireless ADB with Metro on localhost — API via `adb reverse tcp:8000`.
        if (host === 'localhost' || host === '127.0.0.1') {
          return localhostApi;
        }
      } catch {
        /* ignore malformed script URL */
      }
    }

    // Physical device + emulator fallback: localhost (requires adb reverse on hardware).
    return localhostApi;
  } catch {
    return null;
  }
}
