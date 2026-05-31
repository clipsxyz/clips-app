import AsyncStorage from '@react-native-async-storage/async-storage';

async function readValue(key: string): Promise<unknown> {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return undefined;
    try {
        return JSON.parse(raw) as unknown;
    } catch {
        return raw;
    }
}

/** AsyncStorage-backed key-value store (replaces idb-keyval on native). */
export const db = {
    async get<T>(key: string): Promise<T | undefined> {
        return (await readValue(key)) as T | undefined;
    },
    async set(key: string, value: unknown): Promise<void> {
        await AsyncStorage.setItem(key, JSON.stringify(value));
    },
    async del(key: string): Promise<void> {
        await AsyncStorage.removeItem(key);
    },
    async update<T>(key: string, updater: (oldValue: T | undefined) => T): Promise<void> {
        const current = await readValue(key);
        await db.set(key, updater(current as T | undefined));
    },
};
