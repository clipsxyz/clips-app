/**
 * Stop-control for the fullscreen Scenes overlay's own ExoPlayer.
 *
 * Why this is NOT the shared store in `feedActiveVideoNative`:
 *
 * That store is a *slot* store. `setActiveFeedVideoPostId` runs
 * `haltAllPlayers()` on every transition, so anything registered there is
 * paused by *any* active-id change — including ones driven by another screen
 * entirely. Registering the overlay's player there meant the feed's own
 * scheduler could pause the video the user was watching, and because the
 * overlay's `paused` prop was unchanged React never re-asserted it, so it
 * stayed silent for the rest of the session. The overlay is a separate native
 * Modal with its own window; it does not compete for the feed's slot, so it
 * must not sit in the slot's halt set.
 *
 * Deliberately NOT symmetrical with `registerFeedVideoPlayer`: detaching here
 * does not silence. Silencing on detach fires on React 18/19 StrictMode's
 * double-invoked effects and on any remount, which pauses a player that is
 * about to start playing. Stopping is always an explicit navigation decision.
 */
type StoppablePlayer = {
    pause: () => void;
    setVolume: (volume: number) => void;
};

let current: StoppablePlayer | null = null;

/**
 * Publish the player the overlay is currently driving. Pass `null` on unmount
 * so a stale, released handle is never touched.
 */
export function setScenesPlaybackPlayer(player: StoppablePlayer | null): void {
    current = player;
}

/**
 * Silence the overlay synchronously and release the handle.
 *
 * Idempotent, and a no-op when no overlay is mounted, so it is safe to call
 * from any navigation path without checking whether Scenes is open.
 */
export function stopScenesPlayback(): void {
    const player = current;
    // Clear first: if `pause()` throws on an already-released ExoPlayer we must
    // not leave a dead handle behind for the next navigation to retry.
    current = null;
    if (!player) return;
    try {
        player.setVolume(0);
        player.pause();
    } catch {
        /* ExoPlayer can already be released — the unmount will finish the job */
    }
}
