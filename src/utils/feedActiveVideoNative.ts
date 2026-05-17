type Listener = (postId: string | null) => void;

let activePostId: string | null = null;
const listeners = new Set<Listener>();

/** Only one feed video should play at a time (mirrors web `FEED_ACTIVE_VIDEO_EVENT`). */
export function setActiveFeedVideoPostId(postId: string | null): void {
    const next = postId ? String(postId) : null;
    if (activePostId === next) return;
    activePostId = next;
    listeners.forEach((fn) => fn(activePostId));
}

export function getActiveFeedVideoPostId(): string | null {
    return activePostId;
}

export function subscribeActiveFeedVideo(listener: Listener): () => void {
    listeners.add(listener);
    listener(activePostId);
    return () => listeners.delete(listener);
}
