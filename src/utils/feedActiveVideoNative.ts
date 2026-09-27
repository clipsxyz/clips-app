type IdListener = (postId: string | null) => void;

type FeedPlayer = {
    pause: () => void;
    setVolume: (volume: number) => void;
};

/**
 * ColorOS / Oppo: pause+mute on a still-mounted TextureView does NOT stop audio.
 * Exactly one feed Video may be mounted — the settled audible postcard.
 * No warm-mount / Instant Start secondary players.
 */
let activePostId: string | null = null;
let playingAtY = 0;
let playbackAllowed = true;
/** When false, feed cards must not mount a TextureView (Stories 24 bleed on ColorOS). */
let textureMountAllowed = true;
const activeListeners = new Set<IdListener>();
const playbackListeners = new Set<(allowed: boolean) => void>();
const textureMountListeners = new Set<(allowed: boolean) => void>();
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

/** Pause+mute without clearing the active id. */
export function pauseFeedPlayback(): void {
    haltAllPlayers();
}

/** Stop every registered feed player and clear the active id. */
export function haltFeedPlayback(): void {
    haltAllPlayers();
    if (activePostId == null) return;
    activePostId = null;
    notify(activeListeners, null);
}

/** @deprecated Use haltFeedPlayback — kept so older call sites still hard-stop. */
export function clearAudibleFeedVideo(): void {
    haltFeedPlayback();
}

/** @deprecated Warm-mount removed; same as haltFeedPlayback. */
export function parkAudibleFeedVideo(): void {
    haltFeedPlayback();
}

/** Inbox / other tabs: freeze autoplay without relying on unmount alone. */
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

/**
 * Hard gate on mounting feed TextureViews. Pause alone is not enough on ColorOS —
 * a paused TextureView still paints into Stories 24 thumbs underneath the postcard.
 */
export function setFeedTextureMountAllowed(allowed: boolean): void {
    const changed = textureMountAllowed !== allowed;
    textureMountAllowed = allowed;
    if (!allowed) {
        haltFeedPlayback();
    }
    if (changed) textureMountListeners.forEach((fn) => fn(allowed));
}

export function getFeedTextureMountAllowed(): boolean {
    return textureMountAllowed;
}

export function subscribeFeedTextureMountAllowed(listener: (allowed: boolean) => void): () => void {
    textureMountListeners.add(listener);
    listener(textureMountAllowed);
    return () => textureMountListeners.delete(listener);
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
    if (Math.abs(y - playingAtY) <= 8) return false;
    haltFeedPlayback();
    return true;
}

/** Only one feed video should play at a time. */
export function setActiveFeedVideoPostId(postId: string | null): void {
    const next = postId ? String(postId) : null;
    if (next && !playbackAllowed) return;
    if (activePostId === next) return;
    haltAllPlayers();
    activePostId = next;
    notify(activeListeners, activePostId);
}

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

/** @deprecated Warm-mount removed — no-ops kept for any stale imports. */
export function setWarmFeedVideoPostId(_postId: string | null): void {}
export function getWarmFeedVideoPostId(): string | null {
    return null;
}
export function subscribeWarmFeedVideo(listener: IdListener): () => void {
    listener(null);
    return () => {};
}
