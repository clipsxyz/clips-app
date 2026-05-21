import {
    blockAuthorOnServer,
    fetchFeedContentPrefsFromApi,
    hidePostOnServer,
    markNotInterestedOnServer,
    muteAuthorOnServer,
} from '../api/feedContentPrefs';
import {
    type FeedContentPrefs,
    filterPostsByContentPrefs,
    mergeFeedContentPrefs,
    normalizeFeedHandle,
    payloadToFeedContentPrefs,
    shouldFilterFeedPost,
} from './feedContentPrefsCore';

export type { FeedContentPrefs };
export { filterPostsByContentPrefs, shouldFilterFeedPost };

const mutedKey = (userId: string) => `clips:feedPrefs:muted:${String(userId ?? '').trim()}`;
const blockedKey = (userId: string) => `clips:feedPrefs:blocked:${String(userId ?? '').trim()}`;
const hiddenKey = (userId: string) => `clips:feedPrefs:hidden:${String(userId ?? '').trim()}`;
const notInterestedKey = (userId: string) => `clips:feedPrefs:notInterested:${String(userId ?? '').trim()}`;

function readStringSet(storageKey: string): Set<string> {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return new Set();
        const arr = JSON.parse(raw) as unknown;
        if (!Array.isArray(arr)) return new Set();
        return new Set(arr.filter((x): x is string => typeof x === 'string' && x.length > 0));
    } catch {
        return new Set();
    }
}

function writeStringSet(storageKey: string, set: Set<string>): void {
    try {
        localStorage.setItem(storageKey, JSON.stringify([...set]));
    } catch {
        /* ignore */
    }
}

export function loadFeedContentPrefsWebLocal(viewerUserId: string): FeedContentPrefs {
    return {
        mutedHandles: readStringSet(mutedKey(viewerUserId)),
        blockedHandles: readStringSet(blockedKey(viewerUserId)),
        hiddenPostIds: readStringSet(hiddenKey(viewerUserId)),
        notInterestedPostIds: readStringSet(notInterestedKey(viewerUserId)),
    };
}

export async function loadFeedContentPrefsWeb(viewerUserId: string): Promise<FeedContentPrefs> {
    const local = loadFeedContentPrefsWebLocal(viewerUserId);
    const remotePayload = await fetchFeedContentPrefsFromApi();
    if (!remotePayload) return local;
    return mergeFeedContentPrefs(local, payloadToFeedContentPrefs(remotePayload));
}

export async function muteFeedAuthorWeb(viewerUserId: string, handle: string): Promise<void> {
    const key = normalizeFeedHandle(handle);
    if (!key) return;
    const k = mutedKey(viewerUserId);
    const s = readStringSet(k);
    s.add(key);
    writeStringSet(k, s);
    await muteAuthorOnServer(handle);
}

export async function blockFeedAuthorWeb(viewerUserId: string, handle: string): Promise<void> {
    const key = normalizeFeedHandle(handle);
    if (!key) return;
    const k = blockedKey(viewerUserId);
    const s = readStringSet(k);
    s.add(key);
    writeStringSet(k, s);
    await blockAuthorOnServer(handle);
}

export async function hideFeedPostWeb(viewerUserId: string, postId: string): Promise<void> {
    const id = String(postId || '').trim();
    if (!id) return;
    const k = hiddenKey(viewerUserId);
    const s = readStringSet(k);
    s.add(id);
    writeStringSet(k, s);
    await hidePostOnServer(postId);
}

export async function markNotInterestedFeedPostWeb(viewerUserId: string, postId: string): Promise<void> {
    const id = String(postId || '').trim();
    if (!id) return;
    const k = notInterestedKey(viewerUserId);
    const s = readStringSet(k);
    s.add(id);
    writeStringSet(k, s);
    await markNotInterestedOnServer(postId);
}

export function isFeedAuthorMutedWeb(viewerUserId: string, handle: string): boolean {
    return readStringSet(mutedKey(viewerUserId)).has(normalizeFeedHandle(handle));
}

export function isFeedAuthorBlockedWeb(viewerUserId: string, handle: string): boolean {
    return readStringSet(blockedKey(viewerUserId)).has(normalizeFeedHandle(handle));
}
