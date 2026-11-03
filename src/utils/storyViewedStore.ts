/**
 * Optimistic Instagram-style story seen state.
 * Rings read this immediately; Laravel `POST /stories/{id}/view` catches up in the background.
 */

type Listener = () => void;

const viewedStoryIds = new Set<string>();
const seenHandles = new Set<string>();
const unseenHandles = new Set<string>();
const listeners = new Set<Listener>();
let version = 0;
/** Seen rings belong to the signed-in account, not the device. */
let activeUserId: string | null = null;
let hydrateGen = 0;

function normalizeHandle(handle?: string | null): string {
    return String(handle || '')
        .trim()
        .toLowerCase()
        .replace(/^@/, '');
}

function exactKey(userIdOrHandle?: string | null): string {
    return normalizeHandle(userIdOrHandle);
}

/**
 * Inbox sometimes stores `Barry` and the feed stores `Barry@Galway` for the same
 * person. `Gazetteer@Dublin` and `Gazetteer@Cork` are different people, so a full
 * handle must not paint every other `Gazetteer@…` ring as seen.
 */
function setHasHandle(set: Set<string>, userIdOrHandle?: string | null): boolean {
    const key = exactKey(userIdOrHandle);
    if (!key) return false;
    if (set.has(key)) return true;
    const at = key.indexOf('@');
    if (at > 0) {
        const local = key.slice(0, at);
        return !!local && set.has(local);
    }
    const prefix = `${key}@`;
    for (const existing of set) {
        if (existing.startsWith(prefix)) return true;
    }
    return false;
}

function storageKey(userId: string): string {
    return `clips:storyViewed:v2:${userId}`;
}

function persist(): void {
    if (!activeUserId) return;
    if (typeof process !== 'undefined' && process.env.VITEST) return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        if (!AsyncStorage?.setItem) return;
        const userId = activeUserId;
        void Promise.resolve(
            AsyncStorage.setItem(
                storageKey(userId),
                JSON.stringify({ ids: [...viewedStoryIds], seen: [...seenHandles] }),
            ),
        ).catch(() => {});
    } catch {
        /* vitest / web without AsyncStorage */
    }
}

function applyHydrated(raw: string | null): void {
    if (!raw) return;
    let parsed: { ids?: string[]; seen?: string[] };
    try {
        parsed = JSON.parse(raw);
    } catch {
        return;
    }
    let changed = false;
    for (const id of parsed.ids || []) {
        if (id && !viewedStoryIds.has(id)) {
            viewedStoryIds.add(id);
            changed = true;
        }
    }
    for (const handle of parsed.seen || []) {
        const key = exactKey(handle);
        if (!key) continue;
        if (!seenHandles.has(key)) {
            seenHandles.add(key);
            changed = true;
        }
        if (unseenHandles.delete(key)) changed = true;
    }
    if (changed) emit();
}

function hydrateUser(userId: string, gen: number): void {
    if (typeof process !== 'undefined' && process.env.VITEST) return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        void AsyncStorage.getItem(storageKey(userId)).then((raw: string | null) => {
            if (gen !== hydrateGen || activeUserId !== userId) return;
            applyHydrated(raw);
        });
    } catch {
        /* vitest / web without AsyncStorage */
    }
}

/** Load this account's watched stories. Another sign-in must not keep their rings dark. */
export function bindStoryViewedUser(userId?: string | null): void {
    const next = String(userId || '').trim() || null;
    if (next === activeUserId) return;
    activeUserId = next;
    const gen = ++hydrateGen;
    viewedStoryIds.clear();
    seenHandles.clear();
    unseenHandles.clear();
    emit();
    if (!next) return;
    hydrateUser(next, gen);
}

function emit(): void {
    version += 1;
    listeners.forEach((fn) => fn());
}

export function subscribeStoryViewed(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getStoryViewedVersion(): number {
    return version;
}

/** Instantly mark a story (and optionally its author ring) as seen in local state. */
export function markStoryAsViewed(storyId?: string | null, handle?: string | null): void {
    let changed = false;
    const id = String(storyId || '').trim();
    if (id && !viewedStoryIds.has(id)) {
        viewedStoryIds.add(id);
        changed = true;
    }
    const key = exactKey(handle);
    if (key && !seenHandles.has(key)) {
        seenHandles.add(key);
        changed = true;
    }
    if (key && unseenHandles.delete(key)) {
        changed = true;
    }
    if (changed) {
        persist();
        emit();
    }
}

/** Record whether a handle currently has unseen stories (from a probe or inbox payload). */
export function rememberUnseenStory(userIdOrHandle?: string | null, unseen = true): void {
    const key = exactKey(userIdOrHandle);
    if (!key) return;
    if (setHasHandle(seenHandles, userIdOrHandle)) {
        if (unseenHandles.delete(key)) emit();
        return;
    }
    let changed = false;
    if (unseen) {
        if (!unseenHandles.has(key)) {
            unseenHandles.add(key);
            changed = true;
        }
    } else if (unseenHandles.delete(key)) {
        changed = true;
    }
    if (changed) emit();
}

/**
 * Shared getter: unseen ring for this author. False after `markStoryAsViewed`
 * or when they have no active unviewed stories.
 */
export function hasUnseenStory(userIdOrHandle?: string | null): boolean {
    if (!normalizeHandle(userIdOrHandle)) return false;
    if (setHasHandle(seenHandles, userIdOrHandle)) return false;
    return setHasHandle(unseenHandles, userIdOrHandle);
}

export function isStoryMarkedViewed(storyId?: string | null): boolean {
    const id = String(storyId || '').trim();
    return !!id && viewedStoryIds.has(id);
}

export function isHandleStoryRingSeen(handle?: string | null): boolean {
    return setHasHandle(seenHandles, handle);
}

export function storyHasViewed(story: { id?: string; hasViewed?: boolean; has_viewed?: boolean }): boolean {
    if (story.hasViewed === true || story.has_viewed === true) return true;
    return isStoryMarkedViewed(story.id);
}

/** Test helper: drop optimistic seen/unseen so cases don't leak across files. */
export function resetStoryViewedStore(): void {
    activeUserId = null;
    hydrateGen += 1;
    viewedStoryIds.clear();
    seenHandles.clear();
    unseenHandles.clear();
    emit();
}
