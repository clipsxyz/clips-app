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
  // Vite aliases `react-native` → `react-native-web`, which still exports Platform.
  // A real DOM means this is the web app — never treat it as RN (that forced localhost API).
  try {
    if (typeof window !== 'undefined' && typeof window.document?.createElement === 'function') {
      return false;
    }
  } catch {
    /* ignore */
  }
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
      const os = rn?.Platform?.OS as string | undefined;
      if (os === 'web') return false;
      return os === 'ios' || os === 'android';
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

/** Mac LAN IP used when the phone cannot reach localhost (adb reverse drops). */
export const DEV_LAN_API_HOST = '192.168.1.9';
export const DEV_LAN_API_BASE_URL = `http://${DEV_LAN_API_HOST}:8000/api`;

/**
 * Prefer migration env `EXPO_PUBLIC_API_BASE_URL`, then
 * `EXPO_PUBLIC_API_URL` / `REACT_NATIVE_API_URL`, then legacy `VITE_API_URL`.
 */
export function getConfiguredApiEnvUrl(): string | undefined {
  return (
    getRuntimeEnv('EXPO_PUBLIC_API_BASE_URL') ||
    getRuntimeEnv('EXPO_PUBLIC_API_URL') ||
    getRuntimeEnv('REACT_NATIVE_API_URL') ||
    getRuntimeEnv('VITE_API_URL') ||
    undefined
  );
}

export function isLoopbackApiHost(url: string): boolean {
  try {
    const host = new URL(String(url || '').trim()).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

/** Physical devices cannot use localhost; map loopback API URLs to the LAN host. */
export function rewriteLoopbackApiUrlToLan(url: string): string {
  const trimmed = String(url || '').trim().replace(/\/$/, '');
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      parsed.hostname = DEV_LAN_API_HOST;
      if (!parsed.port) parsed.port = '8000';
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    /* ignore malformed */
  }
  return trimmed;
}

export function isLaravelApiEnabled(): boolean {
  // Migration flag: keep mock data when EXPO_PUBLIC_USE_MOCK=true.
  if (isMockMode()) return false;
  const raw = getRuntimeEnv('VITE_USE_LARAVEL_API');
  if (raw === 'false') return false;
  // Live migration mode: EXPO_PUBLIC_USE_MOCK=false enables Laravel for migrated routes.
  if (raw === 'true' || getRuntimeEnv('EXPO_PUBLIC_USE_MOCK') === 'false') {
    return true;
  }
  if (isReactNativeRuntime()) {
    // Live unless mock was opted in. Missing Metro env inlining used to return
    // false here, so View Profile skipped Laravel while the feed still used it.
    return true;
  }
  return true;
}

/** When true, some post actions skip Laravel and use local mock only. */
export function isViteDevMode(): boolean {
  return getRuntimeEnv('VITE_DEV_MODE') === 'true';
}

/**
 * Default Laravel API URL when running under Metro (no window.location).
 * Physical phones cannot reach the Mac's localhost; use the LAN IP
 * (or Metro's Wi‑Fi host) instead of adb reverse.
 */
export function getReactNativeDefaultApiBaseUrl(): string | null {
  if (typeof require === 'undefined') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeModules } = require('react-native') as typeof import('react-native');
    const port = '8000';

    const scriptUrl = (NativeModules as any)?.SourceCode?.scriptURL as string | undefined;
    if (scriptUrl) {
      try {
        const parsed = new URL(scriptUrl);
        const host = parsed.hostname;
        const protocol = String(parsed.protocol || '').replace(/:$/, '');
        if (protocol === 'file' || !host) return null;
        if (host !== 'localhost' && host !== '127.0.0.1') {
          return `http://${host}:${port}/api`;
        }
      } catch {
        /* ignore malformed script URL */
      }
    }

    return null;
  } catch {
    return null;
  }
}
