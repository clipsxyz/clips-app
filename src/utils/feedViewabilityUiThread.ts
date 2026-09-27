/**
 * UI-thread visibility guard for the native feed.
 *
 * FlashList's `onViewableItemsChanged` is dispatched to the JS thread. When JS is
 * busy — decoding an image, laying out a sheet, merging a pagination page — the
 * 50% verdict is computed late or coalesced, so a clip that has already scrolled
 * away can stay *audible* through the gap. That gap is the audio-bleed window.
 *
 * This module keeps the scroll offset in a Reanimated shareable so the threshold
 * is scored on the UI thread every frame, independent of JS load. Only the
 * resulting *state change* needs JS, and that is a single imperative call. The
 * geometry itself lives in `feedVisibilityGeometry.ts` so it stays unit-testable.
 *
 * SCOPE: THIS IS A NET, NOT THE PRIMARY RULE. The authoritative cut is the
 * JS-thread `haltFeedPlaybackIfScrolled` (±8px, "any meaningful scroll leaves the
 * playing postcard"), which also clears the active id and unmounts the player.
 * That stays the primary path and is unchanged. This module is the safety net for
 * the one case the primary cannot cover: JS so starved that the scroll callback
 * never runs. The 50% bar is deliberately *looser* than 8px for that reason — a
 * net should catch what the primary missed, not race it.
 *
 * Three deliberate constraints:
 *
 * 1. VETO ONLY. This module silences; it never plays. Autoplay permission still
 *    comes from the JS layer (active store id, overlay gating, Wi-Fi prefs, screen
 *    focus), so the UI thread cannot start a clip the app has not authorised. A
 *    guard that can only tighten is safe to run early and often; one that can also
 *    loosen fights the mount logic.
 *
 * 2. NO setState. Crossing the bar calls an imperative `player.pause()` /
 *    `setVolume(0)` on the already-mounted player. Nothing here re-renders a card.
 *
 * 3. ONE ANCHOR, not a row registry. Only the audible card can bleed audio, so
 *    only the audible card is tracked. That avoids per-row `measureLayout` and
 *    keeps the UI-thread work O(1) regardless of list length.
 *
 * On the remaining hop: `react-native-video` exposes pause/mute as JS-thread
 * commands that dispatch to the native view manager, so the final call still
 * crosses over. What moves off JS is the *decision* — the part that was late.
 */
import { useSharedValue, makeMutable, runOnJS, useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { Dimensions } from 'react-native';
import {
    FEED_ACTIVE_VISIBILITY_RATIO,
    anchoredVisibleRatio,
    isAnchorUsable,
    shouldSilenceForScroll,
    type FeedVisibilityAnchor,
} from './feedVisibilityGeometry';

export {
    FEED_ACTIVE_VISIBILITY_RATIO,
    computeVisibleRatio,
    shouldSilenceForScroll,
} from './feedVisibilityGeometry';
export type { FeedVisibilityAnchor } from './feedVisibilityGeometry';

const scrollY = makeMutable<number>(0);
const viewportHeight = makeMutable<number>(Dimensions.get('window').height || 0);
const anchor = makeMutable<FeedVisibilityAnchor | null>(null);

/**
 * Publish the scroll offset. Marked as a worklet so it can be called *from* a
 * Reanimated scroll handler, which is the only place it is worth calling from:
 * a JS-thread `onScroll` is throttled and, worse, stops arriving at all when JS
 * is busy — which is precisely the window this module exists to cover.
 */
export function setFeedUiThreadScrollY(y: number): void {
    'worklet';
    if (Number.isFinite(y)) scrollY.value = y;
}

export function setFeedUiThreadViewportHeight(h: number): void {
    'worklet';
    if (Number.isFinite(h) && h > 0) viewportHeight.value = h;
}

export function getFeedUiThreadScrollY(): number {
    return scrollY.value;
}

/**
 * Point the guard at the card that currently holds the audio slot.
 *
 * Called when the JS layer grants the slot, i.e. on settle rather than per
 * frame. `anchorY` is the scroll offset at that moment, which is where the card's
 * top sat in content space.
 *
 * Pass null to disarm — the guard then does nothing at all.
 */
export function setFeedUiThreadAnchor(
    next: FeedVisibilityAnchor | null,
): void {
    if (!next) {
        anchor.value = null;
        return;
    }
    if (!(next.cardHeight > 0) || !Number.isFinite(next.anchorY)) return;
    anchor.value = { anchorY: next.anchorY, cardHeight: next.cardHeight };
}

export function getFeedUiThreadAnchor(): FeedVisibilityAnchor | null {
    return anchor.value;
}

/**
 * Point a ref at a value, supporting both ref flavours.
 *
 * React refs come in two shapes: a callback ref (a function) and a ref object
 * (something with `.current`). FlashList hands us its scroll-view ref as an
 * object while Reanimated's `useAnimatedRef` is a callback, so composing the two
 * means handling both. Getting this wrong silently breaks `scrollTo` /
 * `getScrollResponder`, which is why it is exported and unit-tested rather than
 * inlined at the call site.
 */
export function assignRef(ref: unknown, value: unknown): void {
    if (typeof ref === 'function') {
        (ref as (v: unknown) => void)(value);
        return;
    }
    if (ref && typeof ref === 'object') {
        (ref as { current: unknown }).current = value;
    }
}

/** Test seams. */
export function __resetFeedViewabilityForTests(viewportH?: number): void {
    scrollY.value = 0;
    viewportHeight.value =
        typeof viewportH === 'number' ? viewportH : Dimensions.get('window').height || 0;
    anchor.value = null;
}

/**
 * Silence the anchored card once it drops below the visibility bar.
 *
 * Net only — see the SCOPE note above. `onBelowBar` should be an imperative
 * pause + mute, never a state update: this fires from a worklet, and a
 * `setState` here would re-enter React exactly when the JS thread is already
 * struggling.
 *
 * @param onBelowBar imperative pause + mute, fired once per downward crossing.
 * @param onAboveBar optional upward-crossing edge. Note this module still never
 *                   plays — this is only for callers that need the transition.
 */
export function useFeedUiThreadSilenceNet(
    onBelowBar: () => void,
    onAboveBar?: () => void,
): { visibleRatio: SharedValue<number> } {
    const visibleRatio = useSharedValue(1);
    const wasAbove = useSharedValue(true);

    useAnimatedReaction(
        () => {
            const current = anchor.value;
            if (!isAnchorUsable(current, viewportHeight.value)) {
                // Unarmed or unmeasured: hold the last good ratio so the reaction
                // does not fire a spurious "went below the bar" on mount.
                return visibleRatio.value;
            }
            const ratio = anchoredVisibleRatio(current, scrollY.value, viewportHeight.value);
            visibleRatio.value = ratio;
            return ratio;
        },
        (ratio, previous) => {
            // `previous === null` is the priming run. Acting on it would silence a
            // card that has not been scrolled at all.
            if (previous === null) return;
            const above = ratio >= FEED_ACTIVE_VISIBILITY_RATIO;
            if (above === wasAbove.value) return;
            wasAbove.value = above;
            if (!above) {
                runOnJS(onBelowBar)();
            } else if (onAboveBar) {
                runOnJS(onAboveBar)();
            }
        },
    );

    return { visibleRatio };
}
