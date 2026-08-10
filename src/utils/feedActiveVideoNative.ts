type IdListener = (postId: string | null) => void;

let activePostId: string | null = null;
const activeListeners = new Set<IdListener>();

function notify(listeners: Set<IdListener>, id: string | null): void {
    listeners.forEach((fn) => fn(id));
}

/** Only one feed video should play at a time (mirrors web `FEED_ACTIVE_VIDEO_EVENT`). */
export function setActiveFeedVideoPostId(postId: string | null): void {
    const next = postId ? String(postId) : null;
    if (activePostId === next) return;
    activePostId = next;
    notify(activeListeners, activePostId);
}

/** Re-broadcast current active id (e.g. after remount / focus) without changing it. */
export function notifyActiveFeedVideoListeners(): void {
    notify(activeListeners, activePostId);
}

/** Set active id and always notify — use when remounting the same card after blur. */
export function forceActiveFeedVideoPostId(postId: string | null): void {
    activePostId = postId ? String(postId) : null;
    notify(activeListeners, activePostId);
}

export function getActiveFeedVideoPostId(): string | null {
    return activePostId;
}

export function subscribeActiveFeedVideo(listener: IdListener): () => void {
    activeListeners.add(listener);
    listener(activePostId);
    return () => activeListeners.delete(listener);
}

/** @deprecated Warm is unused with in-cell playback. Kept so call sites compile. */
export function setWarmFeedVideoPostId(_postId: string | null): void {}
export function getWarmFeedVideoPostId(): string | null {
    return activePostId;
}
export function subscribeWarmFeedVideo(listener: IdListener): () => void {
    return subscribeActiveFeedVideo(listener);
}
