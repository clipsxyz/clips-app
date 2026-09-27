type IdListener = (postId: string | null) => void;

type FeedPlayer = {
    pause: () => void;
    setVolume: (volume: number) => void;
    resume?: () => void;
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

/**
 * Hand the single-player slot back because the feed screen lost focus.
 *
 * Deliberately *re-opens* `playbackAllowed` rather than closing it. That flag
 * is module-global, and both `setActiveFeedVideoPostId` and
 * `forceActiveFeedVideoPostId` early-return while it is false:
 *
 *     if (next && !playbackAllowed) return;
 *
 * So closing it on blur froze feed autoplay but ALSO meant ProfileScreen and
 * ViewProfilePostsSheet could never claim the slot — their videos stayed silent
 * and the feed's `activePostId` was still held. Nothing ever re-opened the flag
 * except the feed's own focus handler, so it deadlocked until you navigated
 * back to the feed.
 *
 * The feed stays frozen across the blur by `isFeedFocusedRef` instead: its
 * viewability scheduler bails on `!isFeedFocusedRef.current`, so it cannot
 * steal the slot back while another screen wants it. Clearing `activePostId`
 * here is what actually releases the slot.
 */
export function releaseFeedPlaybackOnBlur(): void {
    haltFeedPlayback();
    const changed = playbackAllowed !== true;
    playbackAllowed = true;
    if (changed) playbackListeners.forEach((fn) => fn(true));
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

/**
 * Re-assert volume/paused on the feed when the screen regains focus.
 *
 * Blur silences players imperatively (`silencePlayer`). `FeedPostMedia` derives its
 * `volume`/`muted` props from local `soundOn` state, so those props are unchanged
 * across a blur round-trip and React never forwards a new value to the native
 * player — the clip comes back silent and the first sound-icon tap only re-mutes.
 * Only the props that actually flip (`paused`) recover on their own.
 */
export function restoreFeedPlaybackAfterFocus(muted: boolean): void {
    if (!playbackAllowed) return;
    if (activePostId == null) return;
    const volume = muted ? 0 : 1;
    players.forEach((player) => {
        try {
            player.setVolume(volume);
            if (!muted) player.resume?.();
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

/**
 * Reset all module state. Test-only: the values above are process-global, so
 * without this a suite that leaves `activePostId` or the gates flipped would
 * silently poison every test after it.
 */
export function __resetFeedActiveVideoForTests(): void {
    players.clear();
    activeListeners.clear();
    playbackListeners.clear();
    textureMountListeners.clear();
    activePostId = null;
    playingAtY = 0;
    playbackAllowed = true;
    textureMountAllowed = true;
}
