import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'authToken';

let memoryToken: string | null = null;

function mirrorTokenToLocalStorage(value: string | null): void {
    try {
        if (typeof globalThis.localStorage === 'undefined') return;
        if (value) globalThis.localStorage.setItem(AUTH_TOKEN_KEY, value);
        else globalThis.localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
        // ignore
    }
}

/** Mirror Laravel token into in-memory localStorage for shared api/* code. */
export async function hydrateAuthTokenFromStorage(): Promise<void> {
    try {
        const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        memoryToken = token?.trim() || null;
        mirrorTokenToLocalStorage(memoryToken);
    } catch {
        memoryToken = null;
    }
}

export async function persistAuthToken(token: string): Promise<void> {
    const value = token.trim();
    if (!value) return;
    memoryToken = value;
    try {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, value);
    } catch {
        // ignore
    }
    mirrorTokenToLocalStorage(value);
}

export async function clearAuthToken(): Promise<void> {
    memoryToken = null;
    try {
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
        // ignore
    }
    mirrorTokenToLocalStorage(null);
}

export function getAuthToken(): string | null {
    if (memoryToken) return memoryToken;
    try {
        if (typeof globalThis.localStorage !== 'undefined') {
            const stored = globalThis.localStorage.getItem(AUTH_TOKEN_KEY);
            return stored?.trim() || null;
        }
    } catch {
        // ignore
    }
    return null;
}

/**
 * Prefer AsyncStorage so API calls work before in-memory localStorage is hydrated.
 */
export async function getAuthTokenAsync(): Promise<string | null> {
    if (memoryToken) return memoryToken;
    try {
        const stored = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        const trimmed = stored?.trim();
        if (trimmed) {
            memoryToken = trimmed;
            mirrorTokenToLocalStorage(trimmed);
            return trimmed;
        }
    } catch {
        // ignore
    }
    return getAuthToken();
}

export function hasAuthToken(): boolean {
    return !!getAuthToken();
}

export async function hasAuthTokenAsync(): Promise<boolean> {
    return !!(await getAuthTokenAsync());
}

export async function getAuthorizationHeader(): Promise<Record<string, string>> {
    const token = await getAuthTokenAsync();
    return token ? { Authorization: `Bearer ${token}` } : {};
}
