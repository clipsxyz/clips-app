/**
 * Visibility geometry for the native feed — pure, no React, no Reanimated.
 *
 * Kept separate from the worklet shell (`feedViewabilityUiThread.ts`) so the
 * arithmetic that decides "is this card still on screen" is unit-testable on the
 * JS thread. An untested worklet is just a bug with better branding.
 *
 * The model is anchor-based rather than absolute. A virtualized row's offset
 * within the list content is not cheaply available (`onLayout` reports position
 * relative to the parent, and `measureLayout` would mean a native round-trip per
 * card, per scroll). Instead the *active* card — the only one that can be making
 * noise — records the scroll offset at which it was handed the audio slot, and
 * visibility is scored from the delta against that. That is exact for the case
 * that matters and costs nothing.
 *
 * All functions are worklet-safe: plain arithmetic, no allocation, no external
 * capture.
 */

/** A card counts as active at exactly this fraction of its height on screen. */
export const FEED_ACTIVE_VISIBILITY_RATIO = 0.5;

export type FeedVisibilityAnchor = {
    /** Scroll offset at which this card was granted the audio slot. */
    anchorY: number;
    /** Measured card height, so the bar is a fraction of the real card. */
    cardHeight: number;
};

/**
 * Fraction of a card's height still inside the viewport band.
 *
 * Clamped to [0, 1]. Returns 0 for unmeasured geometry rather than guessing.
 */
export function computeVisibleRatio(
    cardTop: number,
    cardHeight: number,
    scrollY: number,
    viewportHeight: number,
): number {
    'worklet';
    if (!(cardHeight > 0) || !(viewportHeight > 0)) return 0;
    if (!Number.isFinite(cardTop) || !Number.isFinite(scrollY)) return 0;

    const viewportTop = scrollY;
    const viewportBottom = scrollY + viewportHeight;

    const cardBottom = cardTop + cardHeight;
    if (cardBottom <= viewportTop || cardTop >= viewportBottom) return 0;

    const visible = Math.min(cardBottom, viewportBottom) - Math.max(cardTop, viewportTop);
    const ratio = visible / cardHeight;
    if (ratio < 0) return 0;
    return ratio > 1 ? 1 : ratio;
}

/** Whether a card still clears the active visibility bar. */
export function isCardAboveBar(
    cardTop: number,
    cardHeight: number,
    scrollY: number,
    viewportHeight: number,
): boolean {
    'worklet';
    return (
        computeVisibleRatio(cardTop, cardHeight, scrollY, viewportHeight) >=
        FEED_ACTIVE_VISIBILITY_RATIO
    );
}

/**
 * Score an anchored card against the current scroll offset.
 *
 * `cardTop` is the anchor itself: when the active card was granted the slot it
 * filled the viewport, so its content-space top sits at the scroll offset.
 */
export function anchoredVisibleRatio(
    anchor: FeedVisibilityAnchor | null,
    scrollY: number,
    viewportHeight: number,
): number {
    'worklet';
    if (!anchor) return 0;
    return computeVisibleRatio(
        anchor.anchorY,
        anchor.cardHeight,
        scrollY,
        viewportHeight,
    );
}

/**
 * Whether the anchored card has dropped below the bar and should be silenced.
 *
 * Veto-only by design: this can only ever say "stop". It never returns a
 * play/resume verdict, so it cannot race the JS mount logic.
 */
export function shouldSilenceForScroll(
    anchor: FeedVisibilityAnchor | null,
    scrollY: number,
    viewportHeight: number,
): boolean {
    'worklet';
    // Unusable geometry must NOT read as "not visible". computeVisibleRatio
    // returns 0 for an unmeasured viewport, and 0 is below the bar — so without
    // this guard the whole guard would silence playback the instant a card was
    // granted the slot, before layout had reported a height. Staying quiet is
    // always the safe direction for a veto-only check.
    if (!isAnchorUsable(anchor, viewportHeight)) return false;
    return anchoredVisibleRatio(anchor, scrollY, viewportHeight) < FEED_ACTIVE_VISIBILITY_RATIO;
}

/**
 * A usable anchor, or null.
 *
 * Guards the case where the viewport has not been measured yet — without it every
 * card would score 0 and the guard would silence playback the moment it started.
 */
export function isAnchorUsable(
    anchor: FeedVisibilityAnchor | null,
    viewportHeight: number,
): boolean {
    'worklet';
    return Boolean(anchor) && anchor!.cardHeight > 0 && viewportHeight > 0;
}
