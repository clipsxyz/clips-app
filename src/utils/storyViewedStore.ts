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

function normalizeHandle(handle?: string | null): string {
    return String(handle || '')
        .trim()
        .toLowerCase()
        .replace(/^@/, '');
}

/** `Barry@Galway` and `Barry` must share ring state (inbox vs rail vs feed). */
function handleKeys(userIdOrHandle?: string | null): string[] {
    const key = normalizeHandle(userIdOrHandle);
    if (!key) return [];
    const keys = [key];
    const at = key.indexOf('@');
    if (at > 0) {
        const local = key.slice(0, at);
        if (local) keys.push(local);
    }
    return keys;
}

function setHasHandle(set: Set<string>, userIdOrHandle?: string | null): boolean {
    const keys = handleKeys(userIdOrHandle);
    if (keys.length === 0) return false;
    if (keys.some((k) => set.has(k))) return true;
    for (const existing of set) {
        for (const key of keys) {
            if (existing.startsWith(`${key}@`) || key.startsWith(`${existing}@`)) return true;
        }
    }
    return false;
}

function persist(): void {
    if (typeof process !== 'undefined' && process.env.VITEST) return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        if (!AsyncStorage?.setItem) return;
        void Promise.resolve(
            AsyncStorage.setItem(
                'clips:storyViewed:v1',
                JSON.stringify({ ids: [...viewedStoryIds], seen: [...seenHandles] }),
            ),
        ).catch(() => {});
    } catch {
        /* vitest / web without AsyncStorage */
    }
}

function hydrate(): void {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        void AsyncStorage.getItem('clips:storyViewed:v1').then((raw: string | null) => {
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
                for (const key of handleKeys(handle)) {
                    if (!seenHandles.has(key)) {
                        seenHandles.add(key);
                        changed = true;
                    }
                    if (unseenHandles.delete(key)) changed = true;
                }
            }
            if (changed) emit();
        });
    } catch {
        /* vitest / web without AsyncStorage */
    }
}

if (typeof process === 'undefined' || !process.env.VITEST) {
    hydrate();
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
    const keys = handleKeys(handle);
    for (const key of keys) {
        if (!seenHandles.has(key)) {
            seenHandles.add(key);
            changed = true;
        }
        if (unseenHandles.delete(key)) {
            changed = true;
        }
    }
    if (changed) {
        persist();
        emit();
    }
}

/** Record whether a handle currently has unseen stories (from a probe or inbox payload). */
export function rememberUnseenStory(userIdOrHandle?: string | null, unseen = true): void {
    const keys = handleKeys(userIdOrHandle);
    if (keys.length === 0) return;
    if (setHasHandle(seenHandles, userIdOrHandle)) {
        let cleared = false;
        for (const key of keys) {
            if (unseenHandles.delete(key)) cleared = true;
        }
        if (cleared) emit();
        return;
    }
    let changed = false;
    if (unseen) {
        for (const key of keys) {
            if (!unseenHandles.has(key)) {
                unseenHandles.add(key);
                changed = true;
            }
        }
    } else {
        for (const key of keys) {
            if (unseenHandles.delete(key)) changed = true;
        }
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
    viewedStoryIds.clear();
    seenHandles.clear();
    unseenHandles.clear();
    emit();
}
