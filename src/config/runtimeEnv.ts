/**
 * Vite exposes env on import.meta.env; Metro (React Native) does not.
 * Also reads process.env for RN when babel/react-native-dotenv injects keys.
 */

export function getRuntimeEnv(key: string): string | undefined {
  try {
    if (typeof import.meta !== 'undefined') {
      const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
      const v = env?.[key];
      if (v !== undefined && v !== '') return String(v);
    }
  } catch {
    /* ignore */
  }
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

export function isLaravelApiEnabled(): boolean {
  return getRuntimeEnv('VITE_USE_LARAVEL_API') !== 'false';
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
