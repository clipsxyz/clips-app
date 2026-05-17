import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

export type FeedAutoplayPref = 'always' | 'wifi' | 'never';

/** Same key as web (`App.tsx`) for future settings sync. */
export const FEED_AUTOPLAY_PREF_KEY = 'clips:feedAutoplayPref';

type Listener = (pref: FeedAutoplayPref) => void;
const listeners = new Set<Listener>();

export async function getFeedAutoplayPref(): Promise<FeedAutoplayPref> {
    try {
        const raw = await AsyncStorage.getItem(FEED_AUTOPLAY_PREF_KEY);
        if (raw === 'always' || raw === 'wifi' || raw === 'never') return raw;
    } catch {
        /* ignore */
    }
    return 'wifi';
}

export async function setFeedAutoplayPref(pref: FeedAutoplayPref): Promise<void> {
    try {
        await AsyncStorage.setItem(FEED_AUTOPLAY_PREF_KEY, pref);
    } catch {
        /* ignore */
    }
    listeners.forEach((fn) => fn(pref));
}

export function subscribeFeedAutoplayPref(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Sync helper when network state is already known. */
export function isFeedAutoplayAllowed(pref: FeedAutoplayPref, onWifi: boolean): boolean {
    if (pref === 'never') return false;
    if (pref === 'always') return true;
    return onWifi;
}

/** Resolves autoplay permission from pref + live connection (Wi‑Fi only mode). */
export async function resolveFeedAutoplayAllowed(pref: FeedAutoplayPref): Promise<boolean> {
    if (pref === 'never') return false;
    if (pref === 'always') return true;

    try {
        const state = await NetInfo.fetch();
        if (state.isConnected === false) return false;
        const type = state.type;
        if (type === 'wifi' || type === 'ethernet') return true;
        if (type === 'cellular') return false;
        // Unknown / other: allow when not explicitly cellular (offline handled above).
        return type !== 'cellular';
    } catch {
        return false;
    }
}
