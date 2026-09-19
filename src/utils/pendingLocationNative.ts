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

let memoryPending: PendingLocationFeed | null = null;

function persistPending(pending: PendingLocationFeed): void {
    const ops: Array<Promise<unknown>> = [
        AsyncStorage.setItem(KEYS.location, pending.filter),
        AsyncStorage.setItem(KEYS.label, pending.label),
        AsyncStorage.setItem(KEYS.scope, pending.scope || ''),
        AsyncStorage.setItem(KEYS.filterType, pending.filterType),
    ];
    if (pending.placeId) {
        ops.push(AsyncStorage.setItem(KEYS.placeId, pending.placeId));
    } else {
        ops.push(AsyncStorage.removeItem(KEYS.placeId));
    }
    void Promise.all(ops).catch(() => {
        /* ignore */
    });
}

/** Instant in-memory write; disk persist happens in the background. */
export function writePendingLocationFeed(pending: PendingLocationFeed): void {
    memoryPending = { ...pending };
    persistPending(memoryPending);
}

/** Look at the in-memory pending target without consuming it. */
export function peekPendingLocationFeed(): PendingLocationFeed | null {
    return memoryPending ? { ...memoryPending } : null;
}

/** Consume the in-memory pending target without waiting on disk. */
export function takePendingLocationFeed(): PendingLocationFeed | null {
    const next = memoryPending;
    memoryPending = null;
    return next;
}

/** Read pending feed target written by Search/Discover (mirrors web sessionStorage). */
export async function readPendingLocationFeed(): Promise<PendingLocationFeed | null> {
    if (memoryPending) return { ...memoryPending };
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

export async function clearPendingLocationFeed(): Promise<void> {
    memoryPending = null;
    try {
        await Promise.all(Object.values(KEYS).map((k) => AsyncStorage.removeItem(k)));
    } catch {
        // ignore
    }
}
