const AUTH_TOKEN_KEY = 'authToken';

/** Web: token already lives in localStorage. */
export async function hydrateAuthTokenFromStorage(): Promise<void> {
    // no-op on web
}

export function getAuthToken(): string | null {
    try {
        if (typeof globalThis.localStorage !== 'undefined') {
            return globalThis.localStorage.getItem(AUTH_TOKEN_KEY);
        }
    } catch {
        // ignore
    }
    return null;
}

/** Async token read — used by shared Laravel `apiRequest` (web + RN). */
export async function getAuthTokenAsync(): Promise<string | null> {
    const token = getAuthToken();
    return token?.trim() || null;
}

export function hasAuthToken(): boolean {
    return !!getAuthToken();
}

export async function hasAuthTokenAsync(): Promise<boolean> {
    return !!(await getAuthTokenAsync());
}

/** Bearer header for Laravel API calls. */
export async function getAuthorizationHeader(): Promise<Record<string, string>> {
    const token = await getAuthTokenAsync();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function persistAuthToken(token: string): Promise<void> {
    const value = token.trim();
    if (!value) return;
    try {
        if (typeof globalThis.localStorage !== 'undefined') {
            globalThis.localStorage.setItem(AUTH_TOKEN_KEY, value);
        }
    } catch {
        // ignore
    }
}

export async function clearAuthToken(): Promise<void> {
    try {
        if (typeof globalThis.localStorage !== 'undefined') {
            globalThis.localStorage.removeItem(AUTH_TOKEN_KEY);
        }
    } catch {
        // ignore
    }
}
