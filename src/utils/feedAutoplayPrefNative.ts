import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

export type FeedAutoplayPref = 'always' | 'wifi' | 'never';

/** Same key as web (`App.tsx`) for future settings sync. */
export const FEED_AUTOPLAY_PREF_KEY = 'clips:feedAutoplayPref';

/** One-time marker so the legacy Wi-Fi-only default is migrated exactly once. */
const LEGACY_WIFI_MIGRATION_KEY = 'clips:feedAutoplayPref_migratedWifiToAlways_v1';

type Listener = (pref: FeedAutoplayPref) => void;
const listeners = new Set<Listener>();

export async function getFeedAutoplayPref(): Promise<FeedAutoplayPref> {
    try {
        const raw = await AsyncStorage.getItem(FEED_AUTOPLAY_PREF_KEY);
        if (raw === 'always' || raw === 'wifi' || raw === 'never') {
            // Legacy RN default was Wi-Fi-only; allow feed video on cellular. This must run
            // at most once, otherwise a user who later picks Wi-Fi-only gets silently
            // rewritten back to 'always' on every launch.
            if (Platform.OS !== 'web' && raw === 'wifi') {
                const migrated = await AsyncStorage.getItem(LEGACY_WIFI_MIGRATION_KEY);
                if (migrated !== '1') {
                    await AsyncStorage.setItem(LEGACY_WIFI_MIGRATION_KEY, '1');
                    await AsyncStorage.setItem(FEED_AUTOPLAY_PREF_KEY, 'always');
                    return 'always';
                }
            }
            return raw;
        }
    } catch {
        /* ignore */
    }
    return 'always';
}

export async function setFeedAutoplayPref(pref: FeedAutoplayPref): Promise<void> {
    try {
        await AsyncStorage.setItem(FEED_AUTOPLAY_PREF_KEY, pref);
        // An explicit user choice supersedes the legacy Wi-Fi-only default, so mark the
        // migration done here too. Without this, a fresh install that picks Wi-Fi-only
        // is still rewritten to 'always' on its next launch.
        await AsyncStorage.setItem(LEGACY_WIFI_MIGRATION_KEY, '1');
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
        return false;
    } catch {
        return false;
    }
}
