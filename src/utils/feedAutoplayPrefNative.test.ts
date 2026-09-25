import { beforeEach, describe, expect, it, vi } from 'vitest';

const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: vi.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
        setItem: vi.fn(async (k: string, v: string) => {
            store.set(k, v);
        }),
        removeItem: vi.fn(async (k: string) => {
            store.delete(k);
        }),
    },
}));

vi.mock('@react-native-community/netinfo', () => ({
    default: {
        fetch: vi.fn(async () => ({ isConnected: true, type: 'wifi' })),
        addEventListener: vi.fn(() => () => {}),
    },
}));

vi.mock('react-native', () => {
    const platform = { OS: 'ios', select: (o: Record<string, unknown>) => o.ios };
    return { Platform: platform, default: { Platform: platform } };
});

import {
    FEED_AUTOPLAY_PREF_KEY,
    getFeedAutoplayPref,
    resolveFeedAutoplayAllowed,
    setFeedAutoplayPref,
} from './feedAutoplayPrefNative';

const MARKER_KEY = 'clips:feedAutoplayPref_migratedWifiToAlways_v1';

describe('getFeedAutoplayPref', () => {
    beforeEach(() => store.clear());

    it('defaults to always when nothing is stored', async () => {
        expect(await getFeedAutoplayPref()).toBe('always');
    });

    it('migrates a legacy wifi pref to always exactly once', async () => {
        store.set(FEED_AUTOPLAY_PREF_KEY, 'wifi');
        expect(await getFeedAutoplayPref()).toBe('always');
        expect(store.get(FEED_AUTOPLAY_PREF_KEY)).toBe('always');
        expect(store.get(MARKER_KEY)).toBe('1');
    });

    // Regression: the migration used to be un-marker-guarded, so every launch rewrote a
    // deliberately chosen 'wifi' back to 'always' and the option was unusable.
    it('keeps a user-chosen wifi pref across repeated reads', async () => {
        store.set(FEED_AUTOPLAY_PREF_KEY, 'always');
        await getFeedAutoplayPref();

        await setFeedAutoplayPref('wifi');
        expect(await getFeedAutoplayPref()).toBe('wifi');
        expect(await getFeedAutoplayPref()).toBe('wifi');
        expect(store.get(FEED_AUTOPLAY_PREF_KEY)).toBe('wifi');
    });

    it('preserves never and always without rewriting them', async () => {
        store.set(FEED_AUTOPLAY_PREF_KEY, 'never');
        expect(await getFeedAutoplayPref()).toBe('never');
        expect(store.get(FEED_AUTOPLAY_PREF_KEY)).toBe('never');

        store.set(FEED_AUTOPLAY_PREF_KEY, 'always');
        expect(await getFeedAutoplayPref()).toBe('always');
        expect(store.get(FEED_AUTOPLAY_PREF_KEY)).toBe('always');
    });
});

describe('resolveFeedAutoplayAllowed', () => {
    it('blocks on never and allows on always', async () => {
        expect(await resolveFeedAutoplayAllowed('never')).toBe(false);
        expect(await resolveFeedAutoplayAllowed('always')).toBe(true);
    });

    it('allows wifi mode on a wifi connection', async () => {
        expect(await resolveFeedAutoplayAllowed('wifi')).toBe(true);
    });
});
