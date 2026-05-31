import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'authToken';

/** Mirror Laravel token into in-memory localStorage for shared api/* code. */
export async function hydrateAuthTokenFromStorage(): Promise<void> {
    try {
        const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (token && typeof globalThis.localStorage !== 'undefined') {
            globalThis.localStorage.setItem(AUTH_TOKEN_KEY, token);
        }
    } catch {
        // ignore
    }
}

export async function persistAuthToken(token: string): Promise<void> {
    const value = token.trim();
    if (!value) return;
    try {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, value);
    } catch {
        // ignore
    }
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
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
        // ignore
    }
    try {
        if (typeof globalThis.localStorage !== 'undefined') {
            globalThis.localStorage.removeItem(AUTH_TOKEN_KEY);
        }
    } catch {
        // ignore
    }
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
