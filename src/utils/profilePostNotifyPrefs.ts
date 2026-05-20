/**
 * Per-creator "notify me when they post" (YouTube-style channel bell).
 * Scoped per viewer user id; reverse index maps creator → subscriber handles.
 */

export type ProfilePostNotifyLevel = 'off' | 'all';

const uid = (userId: string) => String(userId ?? '').trim();

export function normalizeProfileNotifyHandle(handle: string): string {
    return String(handle || '').replace(/^@/, '').trim().toLowerCase();
}

const enabledKey = (viewerId: string) => `clips:profilePostNotify:${uid(viewerId)}`;
const reverseKey = (creatorKey: string) => `clips:profilePostNotifySubs:${creatorKey}`;

function readHandleSet(storageKey: string): Set<string> {
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

function writeHandleSet(storageKey: string, set: Set<string>): void {
    localStorage.setItem(storageKey, JSON.stringify([...set]));
}

export function getProfilePostNotifyLevel(viewerId: string, creatorHandle: string): ProfilePostNotifyLevel {
    const creatorKey = normalizeProfileNotifyHandle(creatorHandle);
    return readHandleSet(enabledKey(viewerId)).has(creatorKey) ? 'all' : 'off';
}

export function setProfilePostNotifyLevel(
    viewerId: string,
    viewerHandle: string,
    creatorHandle: string,
    level: ProfilePostNotifyLevel,
): void {
    const creatorKey = normalizeProfileNotifyHandle(creatorHandle);
    const subscriberHandle = String(viewerHandle || '').trim();
    const enabled = readHandleSet(enabledKey(viewerId));
    const reverse = readHandleSet(reverseKey(creatorKey));

    if (level === 'all') {
        enabled.add(creatorKey);
        if (subscriberHandle) reverse.add(subscriberHandle);
    } else {
        enabled.delete(creatorKey);
        if (subscriberHandle) reverse.delete(subscriberHandle);
    }

    writeHandleSet(enabledKey(viewerId), enabled);
    writeHandleSet(reverseKey(creatorKey), reverse);

    if (typeof window !== 'undefined') {
        window.dispatchEvent(
            new CustomEvent('profilePostNotifyPrefChanged', {
                detail: { creatorHandle, level },
            }),
        );
    }
}

export function clearProfilePostNotifyForCreator(
    viewerId: string,
    viewerHandle: string,
    creatorHandle: string,
): void {
    setProfilePostNotifyLevel(viewerId, viewerHandle, creatorHandle, 'off');
}

export async function notifySubscribersOfCreatorPost(creatorHandle: string, postId: string): Promise<void> {
    const creatorKey = normalizeProfileNotifyHandle(creatorHandle);
    const subscribers = readHandleSet(reverseKey(creatorKey));
    if (subscribers.size === 0) return;

    const displayHandle = String(creatorHandle || '').trim() || creatorKey;
    const { createNotification } = await import('../api/notifications');

    for (const toHandle of subscribers) {
        if (!toHandle) continue;
        try {
            await createNotification({
                type: 'new_post',
                fromHandle: displayHandle,
                toHandle,
                message: `${displayHandle} posted a new clip`,
                postId,
            });
        } catch (err) {
            console.warn('Failed to notify profile post subscriber:', toHandle, err);
        }
    }
}
