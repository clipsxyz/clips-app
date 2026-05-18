import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'locationNotifyOptIn';

export async function loadLocationNotifyPrefs(): Promise<string[]> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
        return [];
    }
}

export async function saveLocationNotifyPrefs(keys: string[]): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    } catch {
        // ignore
    }
}

export function locationNotifyKey(location: string): string {
    return location.trim().toLowerCase();
}
