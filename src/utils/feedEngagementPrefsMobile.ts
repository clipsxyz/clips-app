import AsyncStorage from '@react-native-async-storage/async-storage';

const archivedKey = (userId: string) => `clips:rn:feedArchivedPosts:${String(userId ?? '').trim()}`;
const notifyKey = (userId: string) => `clips:rn:postNotifyPosts:${String(userId ?? '').trim()}`;

async function readIdSet(storageKey: string): Promise<Set<string>> {
    try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!raw) return new Set();
        const arr = JSON.parse(raw) as unknown;
        if (!Array.isArray(arr)) return new Set();
        return new Set(arr.filter((x): x is string => typeof x === 'string'));
    } catch {
        return new Set();
    }
}

async function writeIdSet(storageKey: string, set: Set<string>): Promise<void> {
    await AsyncStorage.setItem(storageKey, JSON.stringify([...set]));
}

export async function markFeedPostArchivedMobile(viewerUserId: string, postId: string): Promise<void> {
    const k = archivedKey(viewerUserId);
    const s = await readIdSet(k);
    s.add(postId);
    await writeIdSet(k, s);
}

export async function isFeedPostArchivedMobile(viewerUserId: string, postId: string): Promise<boolean> {
    const s = await readIdSet(archivedKey(viewerUserId));
    return s.has(postId);
}

export async function setPostNotificationsPrefMobile(
    viewerUserId: string,
    postId: string,
    enabled: boolean,
): Promise<void> {
    const k = notifyKey(viewerUserId);
    const s = await readIdSet(k);
    if (enabled) s.add(postId);
    else s.delete(postId);
    await writeIdSet(k, s);
}

export async function hasPostNotificationsPrefMobile(viewerUserId: string, postId: string): Promise<boolean> {
    const s = await readIdSet(notifyKey(viewerUserId));
    return s.has(postId);
}
