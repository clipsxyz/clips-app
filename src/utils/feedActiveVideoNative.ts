type IdListener = (postId: string | null) => void;

type FeedPlayer = {
    pause: () => void;
    setVolume: (volume: number) => void;
};

let activePostId: string | null = null;
/** Mount+buffer target while scrolling — never audible. Bluesky-style warm vs play. */
let warmPostId: string | null = null;
let playingAtY = 0;
let playbackAllowed = true;
const activeListeners = new Set<IdListener>();
const warmListeners = new Set<IdListener>();
const playbackListeners = new Set<(allowed: boolean) => void>();
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
    const hadActive = activePostId != null;
    const hadWarm = warmPostId != null;
    activePostId = null;
    warmPostId = null;
    if (hadActive) notify(activeListeners, null);
    if (hadWarm) notify(warmListeners, null);
}

/** Drop audible active only — keep a warm mount buffering the next postcard. */
export function clearAudibleFeedVideo(): void {
    haltAllPlayers();
    if (activePostId == null) return;
    activePostId = null;
    notify(activeListeners, null);
}

/**
 * Finger-down: silence audio without destroying the ExoPlayer.
 * The playing card becomes the warm mount when nothing else is already buffering,
 * so a short nudge does not cold-start the same MP4.
 */
export function parkAudibleFeedVideo(): void {
    haltAllPlayers();
    const playing = activePostId;
    if (playing == null) return;
    activePostId = null;
    if (warmPostId == null) {
        warmPostId = playing;
        notify(warmListeners, warmPostId);
    }
    notify(activeListeners, null);
}

/** Inbox / other tabs: freeze autoplay without unmounting. Unmounting on ColorOS leaves a second audible player. */
export function setFeedPlaybackAllowed(allowed: boolean): void {
    const changed = playbackAllowed !== allowed;
    playbackAllowed = allowed;
    if (!allowed) haltAllPlayers();
    if (changed) playbackListeners.forEach((fn) => fn(allowed));
}

export function subscribeFeedPlaybackAllowed(listener: (allowed: boolean) => void): () => void {
    playbackListeners.add(listener);
    listener(playbackAllowed);
    return () => playbackListeners.delete(listener);
}

/** Mute tap: volume only. Pausing here stops the clip the user is watching. */
export function setAllFeedPlayerVolumes(volume: number): void {
    players.forEach((player) => {
        try {
            player.setVolume(volume);
        } catch {
            /* ColorOS ExoPlayer can already be released */
        }
    });
}

export function setFeedVideoPlayingAtY(y: number): void {
    playingAtY = y;
}

/** Kill audio once the list has moved off the postcard that started playing. */
export function haltFeedPlaybackIfScrolled(y: number): boolean {
    if (!activePostId) return false;
    // Any meaningful scroll leaves the playing postcard — cut audio immediately.
    if (Math.abs(y - playingAtY) <= 8) return false;
    clearAudibleFeedVideo();
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
    if (next && warmPostId === next) {
        // Playing the card we were already warming — drop warm flag.
        warmPostId = null;
        notify(warmListeners, null);
    }
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
    // Same ExoPlayer is already mounted and buffering — don't pause it again.
    const promotingWarm = next != null && warmPostId === next;
    if (!promotingWarm && next !== activePostId) {
        haltAllPlayers();
    }
    activePostId = next;
    if (next && warmPostId === next) {
        warmPostId = null;
        notify(warmListeners, null);
    }
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

/**
 * Mount the next postcard's ExoPlayer (paused/muted) while scrolling.
 * Does not grant audio — only `setActiveFeedVideoPostId` does.
 */
export function setWarmFeedVideoPostId(postId: string | null): void {
    const next = postId ? String(postId) : null;
    if (next && !playbackAllowed) return;
    if (warmPostId === next) return;
    // Never warm the card that is already audible.
    if (next && activePostId === next) {
        if (warmPostId != null) {
            warmPostId = null;
            notify(warmListeners, null);
        }
        return;
    }
    // Switching warm target — silence every TextureView first (ColorOS bleed).
    haltAllPlayers();
    warmPostId = next;
    notify(warmListeners, warmPostId);
}

export function getWarmFeedVideoPostId(): string | null {
    return warmPostId;
}

export function subscribeWarmFeedVideo(listener: IdListener): () => void {
    warmListeners.add(listener);
    listener(warmPostId);
    return () => warmListeners.delete(listener);
}
