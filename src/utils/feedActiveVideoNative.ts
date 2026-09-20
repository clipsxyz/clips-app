type IdListener = (postId: string | null) => void;

type FeedPlayer = {
    pause: () => void;
    setVolume: (volume: number) => void;
};

let activePostId: string | null = null;
let playingAtY = 0;
let playbackAllowed = true;
const activeListeners = new Set<IdListener>();
const players = new Set<FeedPlayer>();

function notify(listeners: Set<IdListener>, id: string | null): void {
    listeners.forEach((fn) => fn(id));
}

function silencePlayer(player: FeedPlayer): void {
    try {
        player.setVolume(0);
        player.pause();
    } catch {
        /* ColorOS ExoPlayer can already be released */
    }
}

function haltAllPlayers(): void {
    players.forEach(silencePlayer);
}

/** Native ExoPlayer handles — pause these directly; JS props can lag a recycle. */
export function registerFeedVideoPlayer(player: FeedPlayer | null | undefined): () => void {
    if (!player || typeof player.pause !== 'function') return () => {};
    players.add(player);
    return () => {
        silencePlayer(player);
        players.delete(player);
    };
}

/** Pause+mute without unmounting — finger-down must not tear down TextureView (black flash). */
export function pauseFeedPlayback(): void {
    haltAllPlayers();
}

/** Stop every registered feed player now. Does not wait for a React render. */
export function haltFeedPlayback(): void {
    haltAllPlayers();
    if (activePostId == null) return;
    activePostId = null;
    notify(activeListeners, null);
}

/** Inbox / other tabs: freeze autoplay so viewability cannot restart ExoPlayer in the background. */
export function setFeedPlaybackAllowed(allowed: boolean): void {
    playbackAllowed = allowed;
    if (!allowed) haltFeedPlayback();
}

export function setFeedVideoPlayingAtY(y: number): void {
    playingAtY = y;
}

/** Kill audio once the list has moved off the postcard that started playing. */
export function haltFeedPlaybackIfScrolled(y: number): boolean {
    if (!activePostId) return false;
    if (Math.abs(y - playingAtY) <= 48) return false;
    haltFeedPlayback();
    return true;
}

/** Only one feed video should play at a time (mirrors web `FEED_ACTIVE_VIDEO_EVENT`). */
export function setActiveFeedVideoPostId(postId: string | null): void {
    const next = postId ? String(postId) : null;
    if (next && !playbackAllowed) return;
    if (activePostId === next) return;
    // Always mute every registered ExoPlayer before the next card starts.
    // ColorOS will keep the previous clip's audio if we only pause the active id.
    haltAllPlayers();
    activePostId = next;
    notify(activeListeners, activePostId);
}

/** Re-broadcast current active id (e.g. after remount / focus) without changing it. */
export function notifyActiveFeedVideoListeners(): void {
    notify(activeListeners, activePostId);
}

/** Set active id and always notify — use when remounting the same card after blur. */
export function forceActiveFeedVideoPostId(postId: string | null): void {
    const next = postId ? String(postId) : null;
    if (next && !playbackAllowed) return;
    if (next !== activePostId) {
        haltAllPlayers();
    }
    activePostId = next;
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
