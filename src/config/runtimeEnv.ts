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

export function isLaravelUnreachableThisSession(): boolean {
  return laravelUnreachableThisSession;
}

/** True when EXPO_PUBLIC_USE_MOCK=true (mock data fallback; no Laravel). */
export function isMockMode(): boolean {
  try {
    if (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_USE_MOCK === 'true') {
      return true;
    }
  } catch {
    /* ignore */
  }
  return getRuntimeEnv('EXPO_PUBLIC_USE_MOCK') === 'true';
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
  if (laravelUnreachableThisSession) return false;
  // Migration flag: keep mock data when EXPO_PUBLIC_USE_MOCK=true.
  if (isMockMode()) return false;
  const raw = getRuntimeEnv('VITE_USE_LARAVEL_API');
  if (raw === 'false') return false;
  if (isReactNativeRuntime()) {
    // Physical devices cannot reach Metro's localhost API URL — use bundled mock feed instead.
    if (raw !== 'true') return false;
    const base = getConfiguredApiEnvUrl() || getReactNativeDefaultApiBaseUrl() || '';
    if (/localhost|127\.0\.0\.1/i.test(base)) return false;
    return true;
  }
  if (raw === 'true') return true;
  return true;
}

/** When true, some post actions skip Laravel and use local mock only. */
export function isViteDevMode(): boolean {
  return getRuntimeEnv('VITE_DEV_MODE') === 'true';
}

/**
 * Default Laravel API URL when running under Metro (no window.location).
 * Android emulator: 10.0.2.2 → host machine.
 */
export function getReactNativeDefaultApiBaseUrl(): string | null {
  if (typeof require === 'undefined') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform, NativeModules } = require('react-native') as typeof import('react-native');
    const port = '8000';

    const scriptUrl = (NativeModules as any)?.SourceCode?.scriptURL as string | undefined;
    if (scriptUrl) {
      try {
        const parsed = new URL(scriptUrl);
        const host = parsed.hostname;
        // LAN / Wi‑Fi Metro (e.g. 192.168.x.x:8081) → same host for Laravel.
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
          return `http://${host}:${port}/api`;
        }
        // USB `adb reverse` Metro is localhost — API must also be localhost (reverse :8000),
        // NOT 10.0.2.2 (emulator-only; black-holes places search on physical devices).
        if (host === 'localhost' || host === '127.0.0.1') {
          return `http://127.0.0.1:${port}/api`;
        }
      } catch {
        /* ignore malformed script URL */
      }
    }

    if (Platform.OS === 'android') {
      return `http://10.0.2.2:${port}/api`;
    }
    return `http://localhost:${port}/api`;
  } catch {
    return null;
  }
}
