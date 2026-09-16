import { NativeModules } from 'react-native';

type ConvertFn = (url: string) => string;

let convertFn: ConvertFn | null = null;
try {
    // Native LRU HTTP proxy (AndroidVideoCache / KTVHTTPCache).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-video-cache');
    convertFn = typeof mod?.default === 'function' ? (mod.default as ConvertFn) : null;
} catch {
    convertFn = null;
}

const PROXY_CACHE = new Map<string, string>();

function isRemoteHttpUri(uri: string): boolean {
    return /^https?:\/\//i.test(uri);
}

function nativeProxyAvailable(): boolean {
    try {
        // Bridgeless / missing native module → fall back to origin URL.
        if (!NativeModules?.VideoCache) return false;
        // react-native-video-cache uses sync native calls; without the sync hook it no-ops.
        if (typeof (globalThis as { nativeCallSyncHook?: unknown }).nativeCallSyncHook === 'undefined') {
            return false;
        }
        return typeof convertFn === 'function';
    } catch {
        return false;
    }
}

/** True when the URI already points at the local video-cache proxy. */
export function isVideoCacheProxyUri(uri: string): boolean {
    const u = String(uri || '');
    if (!u) return false;
    if (/^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?\//i.test(u)) return true;
    if (/ktvhttp|videocache|ProxyCache/i.test(u)) return true;
    return false;
}

/**
 * Map a remote MP4 URL onto the local LRU disk-cache proxy so Range prebuffer
 * and react-native-video share the same bytes.
 * Local / HLS / missing-native fallbacks return the original URL unchanged.
 */
export function convertToProxyURL(url: string): string {
    try {
        const raw = String(url || '').trim();
        if (!raw) return raw;
        if (!isRemoteHttpUri(raw)) return raw;
        if (isVideoCacheProxyUri(raw)) return raw;
        // AndroidVideoCache does not handle HLS playlists reliably.
        if (/\.m3u8(\?|#|$)/i.test(raw)) return raw;

        const hit = PROXY_CACHE.get(raw);
        if (hit) return hit;

        if (!nativeProxyAvailable() || !convertFn) {
            return raw;
        }

        try {
            const proxied = convertFn(raw);
            if (typeof proxied === 'string' && proxied.trim()) {
                const next = proxied.trim();
                PROXY_CACHE.set(raw, next);
                if (PROXY_CACHE.size > 200) {
                    const first = PROXY_CACHE.keys().next().value;
                    if (first) PROXY_CACHE.delete(first);
                }
                return next;
            }
        } catch (err) {
            if (__DEV__) {
                console.warn('[video-cache] convertToProxyURL failed — using origin URL', err);
            }
        }
        return raw;
    } catch {
        return String(url || '').trim() || String(url || '');
    }
}
