import { getRuntimeEnv, getReactNativeDefaultApiBaseUrl } from '../config/runtimeEnv';

function isViteDev(): boolean {
    try {
        const env = (0, eval)('import.meta.env') as { DEV?: boolean; MODE?: string } | undefined;
        return !!env?.DEV || env?.MODE === 'development';
    } catch {
        return false;
    }
}

/**
 * Resolve Laravel API base URL for web and React Native.
 * Web dev (localhost or LAN IP like 192.168.x.x:5173) uses `/api` so Vite proxies to Laravel on the dev machine.
 */
export function getApiBaseUrl(): string {
    const envUrl = getRuntimeEnv('VITE_API_URL');

    if (typeof window === 'undefined') {
        if (envUrl) {
            try {
                const parsed = new URL(envUrl);
                if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
                    const rn = getReactNativeDefaultApiBaseUrl();
                    if (rn) {
                        const rnParsed = new URL(rn);
                        parsed.protocol = rnParsed.protocol;
                        parsed.hostname = rnParsed.hostname;
                        parsed.port = rnParsed.port;
                        return parsed.toString().replace(/\/$/, '');
                    }
                }
            } catch {
                // ignore
            }
            return envUrl.replace(/\/$/, '');
        }
        const rn = getReactNativeDefaultApiBaseUrl();
        if (rn) return rn;
        return 'http://localhost:8000/api';
    }

    if (typeof window !== 'undefined' && window.location?.hostname) {
        if (isViteDev()) {
            return '/api';
        }

        const hostname = window.location.hostname;
        const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
        const onNetwork = hostname !== 'localhost' && hostname !== '127.0.0.1';

        if (onNetwork && envUrl) {
            try {
                const parsed = new URL(envUrl, window.location.origin);
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

    const rn = getReactNativeDefaultApiBaseUrl();
    if (rn) return rn;

    return 'http://localhost:8000/api';
}
