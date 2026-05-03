/**
 * Client-side prefs for feed menu actions (archive visibility, per-post notification bell).
 * Scoped per viewer user id.
 */

const uid = (userId: string) => String(userId ?? '').trim();
const archivedKey = (userId: string) => `clips:feedArchivedPosts:${uid(userId)}`;
const notifyKey = (userId: string) => `clips:postNotificationPosts:${uid(userId)}`;

function readIdSet(storageKey: string): Set<string> {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return new Set();
        const arr = JSON.parse(raw) as unknown;
        if (!Array.isArray(arr)) return new Set();
        return new Set(arr.filter((x): x is string => typeof x === 'string'));
    } catch {
        return new Set();
    }
}

function writeIdSet(storageKey: string, set: Set<string>): void {
    localStorage.setItem(storageKey, JSON.stringify([...set]));
}

export function markFeedPostArchived(viewerUserId: string, postId: string): void {
    const k = archivedKey(viewerUserId);
    const s = readIdSet(k);
    s.add(postId);
    writeIdSet(k, s);
    window.dispatchEvent(new CustomEvent('feedPostArchived', { detail: { postId } }));
}

export function isFeedPostArchived(viewerUserId: string, postId: string): boolean {
    return readIdSet(archivedKey(viewerUserId)).has(postId);
}

export function setPostNotificationsPref(viewerUserId: string, postId: string, enabled: boolean): void {
    const k = notifyKey(viewerUserId);
    const s = readIdSet(k);
    if (enabled) s.add(postId);
    else s.delete(postId);
    writeIdSet(k, s);
    window.dispatchEvent(new CustomEvent('postNotificationPrefChanged', { detail: { postId, enabled } }));
}

export function hasPostNotificationsPref(viewerUserId: string, postId: string): boolean {
    return readIdSet(notifyKey(viewerUserId)).has(postId);
}
