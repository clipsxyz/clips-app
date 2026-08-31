import {
    getConfiguredApiEnvUrl,
    getReactNativeDefaultApiBaseUrl,
    isReactNativeRuntime,
} from '../config/runtimeEnv';

function isViteDev(): boolean {
    try {
        const env = (0, eval)('import.meta.env') as { DEV?: boolean; MODE?: string } | undefined;
        return !!env?.DEV || env?.MODE === 'development';
    } catch {
        return false;
    }
}

/** True browser location — RN often polyfills `window` without `location`. */
function getBrowserHostname(): string {
    try {
        if (
            typeof window !== 'undefined' &&
            window.location &&
            typeof window.location.hostname === 'string'
        ) {
            return window.location.hostname;
        }
    } catch {
        /* ignore */
    }
    return '';
}

/** Emulator-only host — remaps to localhost for physical devices + `adb reverse`. */
function preferLocalhostOverEmulatorLoopback(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.hostname === '10.0.2.2') {
            parsed.hostname = 'localhost';
            return parsed.toString().replace(/\/$/, '');
        }
    } catch {
        /* ignore */
    }
    return String(url || '').replace(/\/$/, '');
}

const FALLBACK_API = 'http://localhost:8000/api';

/**
 * Resolve Laravel API base URL for web and React Native.
 * Prefers `EXPO_PUBLIC_API_BASE_URL`, then legacy `VITE_API_URL`.
 * Web dev uses `/api` so Vite proxies to Laravel.
 * RN physical devices: keep `http://localhost:8000/api` for `adb reverse tcp:8000`.
 */
export function getApiBaseUrl(): string {
    const envUrl = getConfiguredApiEnvUrl();
    const browserHost = getBrowserHostname();
    const isRn = isReactNativeRuntime() || !browserHost;

    // React Native / no real window.location — never touch `.hostname` on undefined location.
    if (isRn) {
        const rnFromScript = getReactNativeDefaultApiBaseUrl();
        const scriptIsLan =
            !!rnFromScript &&
            !/localhost|127\.0\.0\.1/i.test(rnFromScript);
        // Wireless ADB reverse drops constantly; if Metro loaded over Wi‑Fi, use that host for Laravel too.
        if (scriptIsLan) {
            return preferLocalhostOverEmulatorLoopback(rnFromScript) || FALLBACK_API;
        }
        if (envUrl) {
            try {
                const parsed = new URL(envUrl);
                if (parsed.hostname === '10.0.2.2') {
                    parsed.hostname = 'localhost';
                    return parsed.toString().replace(/\/$/, '') || FALLBACK_API;
                }
                if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
                    return envUrl.replace(/\/$/, '') || FALLBACK_API;
                }
            } catch {
                // ignore malformed env URL
            }
            return preferLocalhostOverEmulatorLoopback(envUrl) || FALLBACK_API;
        }
        const rn = getReactNativeDefaultApiBaseUrl();
        if (rn) return preferLocalhostOverEmulatorLoopback(rn) || FALLBACK_API;
        return FALLBACK_API;
    }

    if (isViteDev()) {
        return '/api';
    }

    const hostname = browserHost;
    const protocol =
        typeof window !== 'undefined' && window.location?.protocol === 'https:' ? 'https' : 'http';
    const onNetwork = hostname !== 'localhost' && hostname !== '127.0.0.1';

    if (onNetwork && envUrl) {
        try {
            const parsed = new URL(envUrl, typeof window !== 'undefined' ? window.location?.origin : undefined);
            if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
                parsed.hostname = hostname;
                return parsed.toString().replace(/\/$/, '');
            }
        } catch {
            // relative env URL
        }
    }

    if (envUrl) return envUrl.replace(/\/$/, '');
    if (onNetwork) return `${protocol}://${hostname}:8000/api`;
    return '/api';
}

function currentApiOrigin(): string {
    const apiBase = getApiBaseUrl().replace(/\/$/, '');
    return apiBase.replace(/\/api$/i, '');
}

function isDevMediaHost(hostname: string): boolean {
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '10.0.2.2' ||
        /^10\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
}

/** Point leftover localhost / old LAN :8000 media URLs at the API this device can reach. */
function remapDevMediaHostToApiOrigin(absoluteUrl: string): string {
    const origin = currentApiOrigin();
    if (!origin || !/^https?:\/\//i.test(origin)) return absoluteUrl;
    try {
        const parsed = new URL(absoluteUrl);
        const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
        if (port !== '8000' || !isDevMediaHost(parsed.hostname)) return absoluteUrl;
        const current = new URL(origin);
        parsed.protocol = current.protocol;
        parsed.hostname = current.hostname;
        parsed.port = current.port;
        return parsed.toString();
    } catch {
        return absoluteUrl;
    }
}

/** Turn `/storage/...` (and other relative Laravel paths) into a loadable URL. */
export function resolvePublicMediaUrl(url: string | null | undefined): string {
    const raw = String(url || '').trim();
    if (!raw) return '';
    if (/^(data:|file:|content:|ph:)/i.test(raw)) return raw;
    if (/^https?:\/\//i.test(raw)) return remapDevMediaHostToApiOrigin(raw);
    let origin = currentApiOrigin();
    if (!origin || !/^https?:\/\//i.test(origin)) {
        origin = isReactNativeRuntime() ? 'http://localhost:8000' : origin;
    }
    if (raw.startsWith('/')) return origin ? `${origin}${raw}` : raw;
    return origin ? `${origin}/${raw}` : raw;
}
