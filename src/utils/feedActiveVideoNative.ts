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
    if (!next) setFeedVideoPortalTarget(null);
    notify(activeListeners, activePostId);
}

/** Re-broadcast current active id (e.g. after remount / focus) without changing it. */
export function notifyActiveFeedVideoListeners(): void {
    notify(activeListeners, activePostId);
}

/** Set active id and always notify — use when remounting the same card after blur. */
export function forceActiveFeedVideoPostId(postId: string | null): void {
    activePostId = postId ? String(postId) : null;
    if (!activePostId) setFeedVideoPortalTarget(null);
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

/** @deprecated Warm is unused — portal mounts for active only. Kept so call sites compile. */
export function setWarmFeedVideoPostId(_postId: string | null): void {}
export function getWarmFeedVideoPostId(): string | null {
    return activePostId;
}
export function subscribeWarmFeedVideo(listener: IdListener): () => void {
    return subscribeActiveFeedVideo(listener);
}

/**
 * Window-space rect + source for the single feed Video outside FlatList
 * (Instagram-style: list cells are posters only).
 */
export type FeedVideoPortalTarget = {
    postId: string;
    rawUrl: string;
    /** measureInWindow X/Y — portal converts to host-local. */
    x: number;
    y: number;
    width: number;
    height: number;
    userHandle?: string;
    showScenesCta?: boolean;
};

export type FeedVideoPortalChrome = {
    postId: string;
    onOpenScenes?: () => void;
    onToggleMute?: () => void;
};

type ChromeListener = (chrome: FeedVideoPortalChrome | null) => void;

let portalChrome: FeedVideoPortalChrome | null = null;
const chromeListeners = new Set<ChromeListener>();

export function setFeedVideoPortalChrome(next: FeedVideoPortalChrome | null): void {
    portalChrome = next;
    chromeListeners.forEach((fn) => fn(portalChrome));
}

export function getFeedVideoPortalChrome(): FeedVideoPortalChrome | null {
    return portalChrome;
}

export function subscribeFeedVideoPortalChrome(listener: ChromeListener): () => void {
    chromeListeners.add(listener);
    listener(portalChrome);
    return () => chromeListeners.delete(listener);
}

type PortalListener = (target: FeedVideoPortalTarget | null) => void;

let portalTarget: FeedVideoPortalTarget | null = null;
const portalListeners = new Set<PortalListener>();

export function setFeedVideoPortalTarget(
    next: FeedVideoPortalTarget | null,
    opts?: { force?: boolean },
): void {
    if (next == null) {
        if (portalTarget == null) return;
        portalTarget = null;
        portalListeners.forEach((fn) => fn(null));
        return;
    }
    const prev = portalTarget;
    if (
        !opts?.force &&
        prev &&
        prev.postId === next.postId &&
        prev.rawUrl === next.rawUrl &&
        Math.abs(prev.x - next.x) < 0.5 &&
        Math.abs(prev.y - next.y) < 0.5 &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.height - next.height) < 0.5
    ) {
        return;
    }
    portalTarget = next;
    portalListeners.forEach((fn) => fn(portalTarget));
}

export function clearFeedVideoPortalTargetForPost(postId: string): void {
    if (portalTarget && portalTarget.postId === String(postId)) {
        setFeedVideoPortalTarget(null);
    }
}

export function getFeedVideoPortalTarget(): FeedVideoPortalTarget | null {
    return portalTarget;
}

export function subscribeFeedVideoPortal(listener: PortalListener): () => void {
    portalListeners.add(listener);
    listener(portalTarget);
    return () => portalListeners.delete(listener);
}
