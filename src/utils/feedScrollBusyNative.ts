import { getActiveFeedVideoPostId } from './feedActiveVideoNative';

/**
 * Feed list fling/drag gate.
 *
 * A drag must NOT broadcast a pause to every mounted video. The list keeps a window of
 * cells mounted (~7), and a single global flag re-rendered every one of them — carousel
 * memos, scrims, overlays, tap layer, plus a native `ExoPlayer.setPlayWhenReady(false)`
 * write per card — on the exact frame the finger starts moving. That dropped frame is
 * what reads as a micro-pause at drag start.
 *
 * Only ONE feed video can be playing at a time (the feed designates it through
 * `feedActiveVideoNative`), and a card that is not playing has nothing to pause. So the
 * gate publishes the post id of that single card: every other leaf is handed a target
 * that is not its own and keeps `false` — a same-value `useState` setter React bails out
 * of, so no render, no native prop write, nothing outside the one playing leaf.
 *
 * `scrolling` stays a separate coarse flag for decorative preview loops (the
 * suggested-follower thumbnail) that have no post identity of their own.
 */

type PauseListener = (postId: string | null) => void;
type ScrollListener = (scrolling: boolean) => void;

let scrolling = false;
let pausePostId: string | null = null;
const scrollListeners = new Set<ScrollListener>();
const pauseListeners = new Set<PauseListener>();

/**
 * Raise (`true`) or release (`false`) the drag gate.
 *
 * Raising scopes the hold to whichever feed video is currently active — the only player
 * that can be running while the list moves. Release always clears the target, so no card
 * can be left held.
 */
export function setFeedScrollBusy(next: boolean): void {
    const nextPausePostId = next ? getActiveFeedVideoPostId() : null;
    const scrollingChanged = scrolling !== next;
    const targetChanged = pausePostId !== nextPausePostId;
    if (!scrollingChanged && !targetChanged) return;
    scrolling = next;
    pausePostId = nextPausePostId;
    if (scrollingChanged) scrollListeners.forEach((fn) => fn(scrolling));
    if (targetChanged) pauseListeners.forEach((fn) => fn(pausePostId));
}

/** Coarse "the list is moving" flag, for decorative preview loops only. */
export function getFeedScrollBusy(): boolean {
    return scrolling;
}

export function subscribeFeedScrollBusy(listener: ScrollListener): () => void {
    scrollListeners.add(listener);
    listener(scrolling);
    return () => {
        scrollListeners.delete(listener);
    };
}

/** Scoped gate: the one post id whose player must hold while the list moves. */
export function getFeedScrollPauseTarget(): string | null {
    return pausePostId;
}

export function subscribeFeedScrollPauseTarget(listener: PauseListener): () => void {
    pauseListeners.add(listener);
    listener(pausePostId);
    return () => {
        pauseListeners.delete(listener);
    };
}
