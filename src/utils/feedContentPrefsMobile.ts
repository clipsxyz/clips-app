import AsyncStorage from '@react-native-async-storage/async-storage';
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

const mutedHandlesKey = (userId: string) => `clips:rn:mutedHandles:${String(userId ?? '').trim()}`;
const blockedHandlesKey = (userId: string) => `clips:rn:blockedHandles:${String(userId ?? '').trim()}`;
const hiddenPostsKey = (userId: string) => `clips:rn:hiddenFeedPosts:${String(userId ?? '').trim()}`;
const notInterestedKey = (userId: string) => `clips:rn:notInterestedPosts:${String(userId ?? '').trim()}`;

async function readStringSet(storageKey: string): Promise<Set<string>> {
    try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!raw) return new Set();
        const arr = JSON.parse(raw) as unknown;
        if (!Array.isArray(arr)) return new Set();
        return new Set(arr.filter((x): x is string => typeof x === 'string' && x.length > 0));
    } catch {
        return new Set();
    }
}

async function writeStringSet(storageKey: string, set: Set<string>): Promise<void> {
    await AsyncStorage.setItem(storageKey, JSON.stringify([...set]));
}

export async function loadFeedContentPrefsMobileLocal(viewerUserId: string): Promise<FeedContentPrefs> {
    const [mutedHandles, blockedHandles, hiddenPostIds, notInterestedPostIds] = await Promise.all([
        readStringSet(mutedHandlesKey(viewerUserId)),
        readStringSet(blockedHandlesKey(viewerUserId)),
        readStringSet(hiddenPostsKey(viewerUserId)),
        readStringSet(notInterestedKey(viewerUserId)),
    ]);
    return { mutedHandles, blockedHandles, hiddenPostIds, notInterestedPostIds };
}

export async function loadFeedContentPrefsMobile(viewerUserId: string): Promise<FeedContentPrefs> {
    const local = await loadFeedContentPrefsMobileLocal(viewerUserId);
    const remotePayload = await fetchFeedContentPrefsFromApi();
    if (!remotePayload) return local;
    return mergeFeedContentPrefs(local, payloadToFeedContentPrefs(remotePayload));
}

export async function muteFeedAuthorMobile(viewerUserId: string, handle: string): Promise<void> {
    const key = normalizeFeedHandle(handle);
    if (!key) return;
    const k = mutedHandlesKey(viewerUserId);
    const s = await readStringSet(k);
    s.add(key);
    await writeStringSet(k, s);
    await muteAuthorOnServer(handle);
}

export async function blockFeedAuthorMobile(viewerUserId: string, handle: string): Promise<void> {
    const key = normalizeFeedHandle(handle);
    if (!key) return;
    const k = blockedHandlesKey(viewerUserId);
    const s = await readStringSet(k);
    s.add(key);
    await writeStringSet(k, s);
    await blockAuthorOnServer(handle);
}

export async function hideFeedPostMobile(viewerUserId: string, postId: string): Promise<void> {
    const id = String(postId || '').trim();
    if (!id) return;
    const k = hiddenPostsKey(viewerUserId);
    const s = await readStringSet(k);
    s.add(id);
    await writeStringSet(k, s);
    await hidePostOnServer(postId);
}

export async function markNotInterestedFeedPostMobile(viewerUserId: string, postId: string): Promise<void> {
    const id = String(postId || '').trim();
    if (!id) return;
    const k = notInterestedKey(viewerUserId);
    const s = await readStringSet(k);
    s.add(id);
    await writeStringSet(k, s);
    await markNotInterestedOnServer(postId);
}
