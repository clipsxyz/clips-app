import { clearLaravelUnreachable, markLaravelUnreachable } from '../config/runtimeEnv';
import { getAuthorizationHeader } from '../utils/authTokenBridge';
import { emitUnauthorized } from '../utils/authSessionEvents';
import { isLoopbackApiHost, rewriteLoopbackApiUrlToLan } from '../config/runtimeEnv';
import { getApiBaseUrlCandidates, rememberSuccessfulApiBaseUrl } from './apiBaseUrl';

export function isTransportNetworkError(error: unknown): boolean {
    const err = error as { name?: string; message?: string } | null;
    const name = String(err?.name || '');
    const message = String(err?.message || '');
    return (
        message.includes('Network request failed') ||
        message.includes('Failed to fetch') ||
        message.includes('ERR_CONNECTION_REFUSED') ||
        message.includes('NetworkError') ||
        message === 'CONNECTION_REFUSED' ||
        name === 'ConnectionRefused' ||
        (name === 'TypeError' && (message.includes('fetch') || message.includes('Network')))
    );
}

export function describeFetchError(error: unknown): string {
    const err = error as {
        name?: string;
        message?: string;
        status?: number;
        response?: { status?: number; data?: unknown } | Record<string, unknown>;
    } | null;
    const status = Number(err?.status || (err?.response as { status?: number } | undefined)?.status || 0);
    const body = err?.response;
    console.warn('[api] request failed', {
        name: err?.name,
        message: err?.message,
        status: status || undefined,
        body,
    });
    if (status === 401) return 'Session expired. Please sign in again.';
    if (isTransportNetworkError(error) || err?.name === 'AbortError') {
        return 'Cannot reach the server. Check Wi‑Fi and that the API is running, then pull to refresh.';
    }
    if (status) return `Server error (${status}). Pull to retry.`;
    const msg = String(err?.message || 'Network request failed');
    return msg.slice(0, 160);
}

function pathWithLeadingSlash(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Fetch a path under `/api`, trying LAN / emulator / loopback bases when the
 * physical device cannot reach localhost.
 */
export async function fetchWithApiFallback(
    path: string,
    init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
    const { timeoutMs = 8000, ...rest } = init;
    const bases = getApiBaseUrlCandidates()
        .map((base) => {
            const trimmed = base.replace(/\/$/, '');
            return isLoopbackApiHost(trimmed) ? rewriteLoopbackApiUrlToLan(trimmed) : trimmed;
        })
        .filter((base, index, all) => base && all.indexOf(base) === index);
    const suffix = pathWithLeadingSlash(path);
    let lastError: unknown;

    for (let i = 0; i < bases.length; i += 1) {
        const base = bases[i];
        const url = `${base}${suffix}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                ...rest,
                signal: rest.signal ?? controller.signal,
            });
            clearTimeout(timeoutId);
            rememberSuccessfulApiBaseUrl(base);
            clearLaravelUnreachable();
            if (typeof __DEV__ !== 'undefined' && __DEV__ && i > 0) {
                console.debug('[api] recovered via fallback host', { url, status: response.status });
            }
            return response;
        } catch (err) {
            clearTimeout(timeoutId);
            lastError = err;
            const aborted = (err as { name?: string })?.name === 'AbortError';
            console.warn('[api] transport error', {
                url,
                name: (err as { name?: string })?.name,
                message: (err as { message?: string })?.message,
                status: (err as { status?: number })?.status,
                attempt: i + 1,
                of: bases.length,
            });
            if (!aborted && !isTransportNetworkError(err)) {
                throw err;
            }
        }
    }

    markLaravelUnreachable();
    if ((lastError as { name?: string } | undefined)?.name === 'AbortError') {
        throw lastError;
    }
    const connectionError = new Error('CONNECTION_REFUSED');
    connectionError.name = 'ConnectionRefused';
    throw connectionError;
}

function isAuthLoginPath(path: string): boolean {
    const normalized = path.split('?')[0] || '';
    return normalized.includes('/auth/login') || normalized.includes('/auth/register');
}

export async function authorizedJsonHeaders(
    extra?: HeadersInit,
): Promise<{ headers: Record<string, string>; hadToken: boolean }> {
    const authHeader = await getAuthorizationHeader();
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...authHeader,
    };
    if (extra) {
        const fromInit = extra instanceof Headers ? Object.fromEntries(extra.entries()) : (extra as Record<string, string>);
        Object.assign(headers, fromInit);
    }
    return { headers, hadToken: Boolean(authHeader.Authorization) };
}

export function throwIfHttpError(
    response: Response,
    path: string,
    payload: unknown,
    hadToken: boolean,
): void {
    if (response.ok) return;
    const errorData =
        payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : { error: 'Network error' };
    console.warn('[api] HTTP error', {
        path,
        status: response.status,
        body: errorData,
        url: response.url,
    });
    if (response.status === 401 && hadToken && !isAuthLoginPath(path)) {
        emitUnauthorized();
    }
    const errorMessage =
        (typeof errorData.error === 'string' && errorData.error) ||
        (typeof errorData.message === 'string' && errorData.message) ||
        (errorData.errors ? JSON.stringify(errorData.errors) : `HTTP ${response.status}`);
    const error = new Error(errorMessage);
    (error as { status?: number }).status = response.status;
    (error as { response?: unknown }).response = errorData;
    throw error;
}
