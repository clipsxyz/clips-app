import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { getApiBaseUrl } from '../api/apiBaseUrl';
import { getAuthTokenAsync } from '../utils/authTokenBridge';
import { getRuntimeEnv, isReactNativeRuntime } from '../config/runtimeEnv';

let echo: Echo<'reverb'> | null = null;
let connecting: Promise<Echo<'reverb'> | null> | null = null;

function readEnv(keys: string[]): string | undefined {
    for (const key of keys) {
        const value = getRuntimeEnv(key)?.trim();
        if (value) return value;
    }
    return undefined;
}

function apiOriginAndPath(): { origin: string; authEndpoint: string } {
    const base = getApiBaseUrl().replace(/\/$/, '');
    if (base.startsWith('http://') || base.startsWith('https://')) {
        const url = new URL(base.endsWith('/api') ? base : `${base}/api`);
        const apiRoot = url.pathname.replace(/\/$/, '') || '/api';
        return {
            origin: url.origin,
            authEndpoint: `${url.origin}${apiRoot}/broadcasting/auth`,
        };
    }
    const origin =
        typeof location !== 'undefined' && location.origin ? location.origin : 'http://127.0.0.1:8000';
    const apiRoot = base.startsWith('/') ? base : '/api';
    return { origin, authEndpoint: `${origin}${apiRoot}/broadcasting/auth` };
}

function reverbHost(): string {
    const explicit = readEnv(['EXPO_PUBLIC_REVERB_HOST', 'REACT_NATIVE_REVERB_HOST', 'VITE_REVERB_HOST']);
    if (explicit && !(isReactNativeRuntime() && (explicit === 'localhost' || explicit === '127.0.0.1'))) {
        return explicit;
    }
    if (isReactNativeRuntime()) {
        try {
            const { origin } = apiOriginAndPath();
            const host = new URL(origin).hostname;
            if (host) return host;
        } catch {
            /* fall through */
        }
    }
    return explicit || 'localhost';
}

export function getReverbAppKey(): string | undefined {
    return readEnv(['EXPO_PUBLIC_REVERB_APP_KEY', 'REACT_NATIVE_REVERB_APP_KEY', 'VITE_REVERB_APP_KEY']);
}

export function getEchoSocketId(): string | undefined {
    try {
        return echo?.socketId() || undefined;
    } catch {
        return undefined;
    }
}

function assignGlobalPusher(): void {
    const g = globalThis as typeof globalThis & { Pusher?: typeof Pusher };
    g.Pusher = Pusher;
}

async function createEcho(): Promise<Echo<'reverb'> | null> {
    const key = getReverbAppKey();
    if (!key) return null;

    const token = (await getAuthTokenAsync())?.trim();
    if (!token) return null;

    assignGlobalPusher();
    const { authEndpoint } = apiOriginAndPath();
    const host = reverbHost();
    const port = Number(readEnv(['EXPO_PUBLIC_REVERB_PORT', 'REACT_NATIVE_REVERB_PORT', 'VITE_REVERB_PORT']) || '8080');
    const scheme = (readEnv(['EXPO_PUBLIC_REVERB_SCHEME', 'REACT_NATIVE_REVERB_SCHEME', 'VITE_REVERB_SCHEME']) || 'http').toLowerCase();
    const useTLS = scheme === 'https';

    return new Echo({
        broadcaster: 'reverb',
        key,
        wsHost: host,
        wsPort: port,
        wssPort: port,
        forceTLS: useTLS,
        enabledTransports: ['ws', 'wss'],
        authEndpoint,
        bearerToken: token,
        auth: {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
        },
        authorizer: (channel: { name: string }) => ({
            authorize: (socketId: string, callback: (error: Error | null, data: unknown) => void) => {
                void (async () => {
                    try {
                        const fresh = (await getAuthTokenAsync())?.trim() || token;
                        const body = new URLSearchParams({
                            socket_id: socketId,
                            channel_name: channel.name,
                        });
                        const response = await fetch(authEndpoint, {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${fresh}`,
                                Accept: 'application/json',
                                'Content-Type': 'application/x-www-form-urlencoded',
                            },
                            body: body.toString(),
                        });
                        const data = await response.json().catch(() => ({}));
                        if (!response.ok) {
                            callback(new Error(`Broadcast auth ${response.status}`), data);
                            return;
                        }
                        callback(null, data);
                    } catch (err) {
                        callback(err instanceof Error ? err : new Error(String(err)), null);
                    }
                })();
            },
        }),
    }) as Echo<'reverb'>;
}

export async function connectEcho(): Promise<Echo<'reverb'> | null> {
    if (echo) return echo;
    if (connecting) return connecting;
    connecting = createEcho()
        .then((client) => {
            echo = client;
            return client;
        })
        .catch((err) => {
            console.warn('Reverb Echo connect skipped:', err);
            return null;
        })
        .finally(() => {
            connecting = null;
        });
    return connecting;
}

export function disconnectEcho(): void {
    try {
        echo?.disconnect();
    } catch {
        /* ignore */
    }
    echo = null;
    connecting = null;
}

export function getEcho(): Echo<'reverb'> | null {
    return echo;
}
