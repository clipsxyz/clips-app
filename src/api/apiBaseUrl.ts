import {
    DEV_LAN_API_BASE_URL,
    DEV_LOOPBACK_API_BASE_URL,
    DEV_ANDROID_EMULATOR_API_BASE_URL,
    getConfiguredApiEnvUrl,
    getLastWorkingApiBaseUrl,
    getPreferredRnApiHost,
    getReactNativeDefaultApiBaseUrl,
    isLoopbackApiHost,
    isReactNativeRuntime,
    rememberSuccessfulApiBaseUrl,
    rewriteLoopbackApiUrlToLan,
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

const FALLBACK_API = DEV_LAN_API_BASE_URL;

function isDomBrowser(): boolean {
    try {
        return (
            typeof window !== 'undefined' &&
            typeof window.document?.createElement === 'function' &&
            !!getBrowserHostname()
        );
    } catch {
        return false;
    }
}

/**
 * True only when Android reports an emulator fingerprint or model.
 * A missing signal is not an emulator: wireless handsets must keep the configured
 * LAN origin instead of falling back to `adb reverse` localhost.
 */
function isAndroidEmulator(): boolean {
    try {
        // Gate on the RN runtime check (mocked to false in unit tests) so requiring
        // react-native is skipped under Node/vitest.
        if (!isReactNativeRuntime()) return false;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Platform } = require('react-native') as typeof import('react-native');
        const constants = (Platform as { constants?: Record<string, unknown> }).constants || {};
        const fingerprint = String(constants.Fingerprint || '').toLowerCase();
        const model = String(constants.Model || '').toLowerCase();
        return (
            fingerprint.includes('generic') ||
            fingerprint.includes('emulator') ||
            fingerprint.includes('vbox') ||
            fingerprint.includes('goldfish') ||
            fingerprint.includes('ranchu') ||
            fingerprint.includes('sdk_gphone') ||
            model.includes('sdk_gphone') ||
            model.includes('emulator') ||
            model.includes('android sdk built for')
        );
    } catch {
        return false;
    }
}

export function getApiBaseUrl(): string {
    const envUrl = getConfiguredApiEnvUrl();
    const browserHost = getBrowserHostname();

    if (isDomBrowser()) {
        const protocol =
            typeof window !== 'undefined' && window.location?.protocol === 'https:' ? 'https' : 'http';
        if (isViteDev()) {
            return '/api';
        }
        const onNetwork = browserHost !== 'localhost' && browserHost !== '127.0.0.1';
        if (onNetwork && envUrl) {
            try {
                const parsed = new URL(envUrl, window.location?.origin);
                if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
                    parsed.hostname = browserHost;
                    return parsed.toString().replace(/\/$/, '');
                }
            } catch {
                // relative env URL
            }
        }
        if (envUrl) return envUrl.replace(/\/$/, '');
        if (onNetwork) return `${protocol}://${browserHost}:8000/api`;
        return '/api';
    }

    const isRn = isReactNativeRuntime() || !browserHost;

    if (isRn) {
        const trimmedEnv = envUrl ? envUrl.replace(/\/$/, '') : '';
        const envIsReachableLan = !!trimmedEnv && !isLoopbackApiHost(trimmedEnv);

        // Configured LAN origin (e.g. http://192.168.x.x:8000/api) is the wireless
        // path. Use it directly so login and media do not depend on `adb reverse`.
        // Emulators keep 10.0.2.2 / loopback below.
        if (envIsReachableLan && !isAndroidEmulator()) {
            return trimmedEnv;
        }

        // Trust the exact base that already answered this session before any guesswork —
        // otherwise a stale LAN IP baked into the bundle keeps media pointing at a dead host.
        const lastWorking = getLastWorkingApiBaseUrl();
        if (lastWorking) {
            return lastWorking;
        }
        const preferred = getPreferredRnApiHost();
        if (preferred === 'loopback') {
            return DEV_LOOPBACK_API_BASE_URL;
        }
        if (preferred === 'emulator') {
            return DEV_ANDROID_EMULATOR_API_BASE_URL;
        }
        if (preferred === 'lan') {
            return DEV_LAN_API_BASE_URL;
        }
        const fromMetro = getReactNativeDefaultApiBaseUrl();
        let resolved: string;
        if (fromMetro && isLoopbackApiHost(fromMetro)) {
            // Metro is reached over loopback (adb reverse). Emulators/simulators keep
            // loopback; physical devices already returned the LAN env URL above.
            resolved = DEV_LOOPBACK_API_BASE_URL;
        } else if (fromMetro) {
            // Metro serves the bundle from the dev machine, so its host is the live one —
            // prefer it over EXPO_PUBLIC_API_BASE_URL, which may pin a stale LAN address.
            resolved = fromMetro.replace(/\/$/, '');
        } else if (envIsReachableLan) {
            resolved = trimmedEnv;
        } else if (trimmedEnv) {
            resolved = rewriteLoopbackApiUrlToLan(trimmedEnv) || FALLBACK_API;
        } else {
            resolved = FALLBACK_API;
        }
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.debug('[getApiBaseUrl]', {
                resolved,
                fromMetro,
                envUrl: envUrl || null,
                lanFallback: FALLBACK_API,
                preferred,
                androidEmulator: isAndroidEmulator(),
            });
        }
        return resolved;
    }

    return FALLBACK_API;
}

/**
 * Ordered API bases for RN: LAN / emulator host / adb-reverse loopback.
 * Physical devices often refuse localhost; emulators need 10.0.2.2.
 */
export function getApiBaseUrlCandidates(): string[] {
    const primary = getApiBaseUrl().replace(/\/$/, '');
    if (!isReactNativeRuntime()) return [primary];

    const loopback = DEV_LOOPBACK_API_BASE_URL;
    const lan = DEV_LAN_API_BASE_URL;
    const emulator = DEV_ANDROID_EMULATOR_API_BASE_URL;
    const preferred = getPreferredRnApiHost();
    const ordered: string[] = [];
    const pushUnique = (url: string) => {
        const trimmed = url.replace(/\/$/, '');
        if (trimmed && !ordered.includes(trimmed)) ordered.push(trimmed);
    };

    pushUnique(primary);

    if (preferred === 'loopback') {
        pushUnique(loopback);
        pushUnique(lan);
        pushUnique(emulator);
    } else if (preferred === 'emulator') {
        pushUnique(emulator);
        pushUnique(lan);
        pushUnique(loopback);
    } else if (preferred === 'lan') {
        pushUnique(lan);
        pushUnique(emulator);
        pushUnique(loopback);
    } else if (isLoopbackApiHost(primary)) {
        pushUnique(loopback);
        pushUnique(lan);
        pushUnique(emulator);
    } else {
        pushUnique(loopback);
        pushUnique(lan);
        pushUnique(emulator);
    }
    return ordered;
}

export { rememberSuccessfulApiBaseUrl };

function currentApiOrigin(): string {
    const apiBase = getApiBaseUrl().replace(/\/$/, '');
    if (apiBase === '/api' || (apiBase.startsWith('/') && !apiBase.startsWith('//'))) {
        try {
            if (typeof window !== 'undefined' && window.location?.origin) {
                return window.location.origin;
            }
        } catch {
            /* ignore */
        }
        return '';
    }
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
        if ((port !== '8000' && port !== '5173') || !isDevMediaHost(parsed.hostname)) return absoluteUrl;
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
        origin = isReactNativeRuntime() ? DEV_LAN_API_BASE_URL.replace(/\/api$/i, '') : origin;
    }
    if (raw.startsWith('/')) return origin ? `${origin}${raw}` : raw;
    return origin ? `${origin}/${raw}` : raw;
}

/**
 * Phone browsers cannot reach Laravel on :8000 (firewall). On web, point stored
 * `http://localhost:8000/storage/...` URLs at the Vite origin so `/storage` is proxied.
 */
export function rewriteMediaUrlForClient(url: string): string {
    const resolved = resolvePublicMediaUrl(url);
    if (!resolved) return '';
    try {
        if (
            typeof window !== 'undefined' &&
            typeof window.document?.createElement === 'function' &&
            window.location?.origin
        ) {
            const origin = window.location.origin.replace(/\/$/, '');
            return resolved.replace(
                /https?:\/\/(?:localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3}):8000/gi,
                origin,
            );
        }
    } catch {
        /* ignore */
    }
    return resolved;
}
