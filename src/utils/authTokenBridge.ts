const AUTH_TOKEN_KEY = 'authToken';

/** Web: token already lives in localStorage. */
export async function hydrateAuthTokenFromStorage(): Promise<void> {
    // no-op on web
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
