type IdListener = (postId: string | null) => void;

let activePostId: string | null = null;
/**
 * Live playback/audio focus — the top-most video in the viewport.
 *
 * Deliberately SEPARATE from `activePostId`. `activePostId` is the decoder/mount owner and
 * only moves once the list settles (so a fling never churns TextureViews). This one is
 * published on EVERY viewability pass, including mid-fling, so:
 *   - the outgoing card is muted/paused the instant it drops out of primary focus, and
 *   - the incoming card can claim playback promptly.
 * It must NEVER drive surface mount/teardown on its own.
 */
let audioFocusPostId: string | null = null;
const activeListeners = new Set<IdListener>();
const audioFocusListeners = new Set<IdListener>();

function notify(listeners: Set<IdListener>, id: string | null): void {
    listeners.forEach((fn) => fn(id));
}

/** Publish the live audio focus. Called on every viewability pass (incl. during scrolls). */
export function setFeedAudioFocusPostId(next: string | null): void {
    const id = next ? String(next) : null;
    if (id === audioFocusPostId) return;
    audioFocusPostId = id;
    notify(audioFocusListeners, id);
}

export function getFeedAudioFocusPostId(): string | null {
    return audioFocusPostId;
}

export function subscribeFeedAudioFocusPostId(listener: IdListener): () => void {
    audioFocusListeners.add(listener);
    listener(audioFocusPostId);
    return () => {
        audioFocusListeners.delete(listener);
    };
}

/**
 * The decoder/mount target. At rest exactly one card holds the decoder AND the audio, so the
 * two ids move together here — every programmatic active change (settle handoff, overlay
 * restore, other screens) also realigns audio focus and clears any stale mid-fling focus.
 */
export function setActiveFeedVideoPostId(postId: string | null): void {
    const id = postId ? String(postId) : null;
    if (activePostId !== id) {
        activePostId = id;
        notify(activeListeners, id);
    }
    setFeedAudioFocusPostId(id);
}

/** Re-broadcast current active id (e.g. after remount / focus) without changing it. */
export function notifyActiveFeedVideoListeners(): void {
    notify(activeListeners, activePostId);
}

/** Set active id and always notify — use when remounting the same card after blur. */
export function forceActiveFeedVideoPostId(postId: string | null): void {
    const id = postId ? String(postId) : null;
    activePostId = id;
    notify(activeListeners, id);
    setFeedAudioFocusPostId(id);
}

export function getActiveFeedVideoPostId(): string | null {
    return activePostId;
}

export function subscribeActiveFeedVideo(listener: IdListener): () => void {
    activeListeners.add(listener);
    listener(activePostId);
    return () => activeListeners.delete(listener);
}

/**
 * Silent preload targets — the adjacent card(s) whose native Video should be mounted,
 * prepared and buffered BEFORE they become the primary player, so settling on them plays
 * instantly (codec alloc + container parse + first-segment fetch already happened while
 * they were off-primary).
 *
 * Kept separate from `activePostId`/`audioFocusPostId` on purpose: a preload id may only
 * MOUNT a paused, muted surface. It must never claim playback/audio focus, and it never
 * moves the decoder owner. `FeedPostMedia` uses this solely to widen the mount condition.
 */
let preloadPostIds: string[] = [];
const preloadListeners = new Set<(ids: string[]) => void>();

/** Publish the neighbor ids. Same-content publishes bail so subscribers do not re-render. */
export function setFeedPreloadPostIds(next: string[]): void {
    const ids = next.map(String);
    if (ids.length === preloadPostIds.length && ids.every((id, i) => id === preloadPostIds[i])) {
        return;
    }
    preloadPostIds = ids;
    preloadListeners.forEach((fn) => fn(ids));
}

export function getFeedPreloadPostIds(): string[] {
    return preloadPostIds;
}

export function subscribeFeedPreloadPostIds(listener: (ids: string[]) => void): () => void {
    preloadListeners.add(listener);
    listener(preloadPostIds);
    return () => {
        preloadListeners.delete(listener);
    };
}

/** @deprecated Warm is unused with in-cell playback. Kept so call sites compile. */
export function setWarmFeedVideoPostId(_postId: string | null): void {}
export function getWarmFeedVideoPostId(): string | null {
    return activePostId;
}
export function subscribeWarmFeedVideo(listener: IdListener): () => void {
    return subscribeActiveFeedVideo(listener);
}
