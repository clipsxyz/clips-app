import AsyncStorage from '@react-native-async-storage/async-storage';

export type PendingLocationFeed = {
    filter: string;
    label: string;
    scope?: string;
    placeId?: string | null;
    filterType: 'location' | 'venue' | 'landmark';
};

const KEYS = {
    location: 'pendingLocation',
    label: 'pendingLocationLabel',
    scope: 'pendingLocationScope',
    placeId: 'pendingLocationPlaceId',
    filterType: 'pendingFilterType',
} as const;

/** Read pending feed target written by Search/Discover (mirrors web sessionStorage). */
export async function readPendingLocationFeed(): Promise<PendingLocationFeed | null> {
    try {
        const filter = (await AsyncStorage.getItem(KEYS.location))?.trim();
        if (!filter) return null;

        const label = (await AsyncStorage.getItem(KEYS.label))?.trim() || filter;
        const scope = (await AsyncStorage.getItem(KEYS.scope))?.trim() || undefined;
        const placeId = (await AsyncStorage.getItem(KEYS.placeId))?.trim() || null;
        const rawType = (await AsyncStorage.getItem(KEYS.filterType))?.trim();
        const filterType: PendingLocationFeed['filterType'] =
            rawType === 'venue' || rawType === 'landmark' ? rawType : 'location';

        return { filter, label, scope, placeId, filterType };
    } catch {
        return null;
    }
}

/** Write pending feed target for Search/Discover → Feed handoff (mirrors web sessionStorage). */
export async function writePendingLocationFeed(payload: PendingLocationFeed): Promise<void> {
    try {
        const filter = payload.filter?.trim();
        if (!filter) return;

        const label = payload.label?.trim() || filter;
        const scope = payload.scope?.trim() || '';
        const filterType =
            payload.filterType === 'venue' || payload.filterType === 'landmark'
                ? payload.filterType
                : 'location';
        const placeId = payload.placeId?.trim() || null;

        await AsyncStorage.setItem(KEYS.location, filter);
        await AsyncStorage.setItem(KEYS.label, label);
        await AsyncStorage.setItem(KEYS.scope, scope);
        await AsyncStorage.setItem(KEYS.filterType, filterType);
        if (placeId) {
            await AsyncStorage.setItem(KEYS.placeId, placeId);
        } else {
            await AsyncStorage.removeItem(KEYS.placeId);
        }
    } catch {
        // ignore storage errors; caller still navigates
    }
}

export async function clearPendingLocationFeed(): Promise<void> {
    try {
        await Promise.all(Object.values(KEYS).map((k) => AsyncStorage.removeItem(k)));
    } catch {
        // ignore
    }
}
