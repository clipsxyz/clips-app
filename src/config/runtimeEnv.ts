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

function isReactNativeRuntime(): boolean {
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

export function isLaravelApiEnabled(): boolean {
  const raw = getRuntimeEnv('VITE_USE_LARAVEL_API');
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  // On RN devices, default to mock/local mode unless explicitly enabled.
  if (isReactNativeRuntime()) return false;
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
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
          return `http://${host}:${port}/api`;
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
