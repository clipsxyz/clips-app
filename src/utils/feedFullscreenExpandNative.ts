/**
 * Full-screen expand / collapse for a feed video card.
 *
 * The whole point of this module is that the *existing* player is never touched.
 * There is no second `<Video>`, no `sharedTransitionTag`, and no navigation, so
 * ExoPlayer is neither destroyed nor asked to re-buffer at any point in the
 * transition. That is not a stylistic preference — see
 * `feedActiveVideoNative.ts`: on ColorOS a second mounted `TextureView` stays
 * audible, and animating width/height re-lays-out the TextureView every frame,
 * which this codebase has already been bitten by ("1px TextureView drift remounts
 * ExoPlayer"). So the morph is TRANSFORM-ONLY: translate + uniform scale. Layout
 * never changes, no `onLayout` fires, and the player survives untouched.
 *
 * Only the card that currently owns the mounted player may expand
 * (`canExpand`), which keeps the invariant "the thing we are animating is the
 * thing that is playing".
 *
 * The progress value is a Reanimated shareable and every style is derived from it
 * in a worklet, so the animation runs entirely on the UI thread with no JS
 * involved per frame.
 */
import { makeMutable, runOnJS, withSpring, withTiming } from 'react-native-reanimated';
import {
    FEED_COLLAPSE_DURATION_MS,
    FEED_EXPAND_DURATION_MS,
    computeExpandTransform,
    isExpandableBounds,
    isValidScreen,
    type ExpandCardBounds,
    type ExpandScreen,
} from './feedExpandGeometry';

export {
    FEED_COLLAPSE_DURATION_MS,
    FEED_EXPAND_DURATION_MS,
    computeCoverScale,
    computeExpandTransform,
    isExpandableBounds,
    isExpandTargetCard,
    isValidScreen,
} from './feedExpandGeometry';
export type { ExpandCardBounds, ExpandScreen, ExpandTransform } from './feedExpandGeometry';

export type FeedExpandTarget = {
    postId: string;
    card: ExpandCardBounds;
    screen: ExpandScreen;
};

/**
 * Drag-to-dismiss, as worklets.
 *
 * These live here rather than inline in the gesture so they can be shared values
 * (a hook cannot be called from inside a `useMemo` callback) and so the gesture
 * closure only ever captures module imports, never a `const` declared further
 * down the component.
 */
const dragStartProgress = makeMutable<number>(1);

export function beginFeedExpandDrag(): void {
    'worklet';
    dragStartProgress.value = progress.value;
}

/** `travel` is the pixel distance that maps to a full collapse. */
export function dragFeedExpand(translationY: number, travel: number): void {
    'worklet';
    if (!(travel > 0)) return;
    const next = dragStartProgress.value - translationY / travel;
    progress.value = next < 0 ? 0 : next > 1 ? 1 : next;
}

/**
 * @returns true when the gesture committed to a dismissal, false when it should
 *          snap back to full screen.
 */
export function endFeedExpandDrag(): boolean {
    'worklet';
    if (progress.value <= 0.4) return true;
    progress.value = withSpring(1, { damping: 20, stiffness: 220, mass: 0.6 });
    return false;
}

type Listener = (target: FeedExpandTarget | null) => void;

const progress = makeMutable<number>(0);
let target: FeedExpandTarget | null = null;
/**
 * UI-thread mirrors of `target`.
 *
 * The animated style reads these, NOT React state. That is the whole point: a
 * card's `useAnimatedStyle` can then react to an arm+animate on the UI thread
 * with no React commit in between. When the style was gated on `isExpanding`
 * (React), the morph could not start until every visible card had re-rendered,
 * which measured as a ~200ms freeze on tap.
 */
const targetCard = makeMutable<ExpandCardBounds | null>(null);
const targetScreen = makeMutable<ExpandScreen | null>(null);
/**
 * Post id of the card currently owning the morph.
 *
 * `targetCard`/`targetScreen` are module-global, but every mounted feed card
 * runs the same `useAnimatedStyle`. Without this gate, arming one card made
 * every visible sibling read the same rect and scale to full screen too (and
 * take `zIndex: 100`). Each card compares this against its own id, which the
 * style closure can capture as a plain string — so correctness does not depend
 * on a React re-render, which is the freeze this whole path exists to avoid.
 */
const targetPostId = makeMutable<string | null>(null);

let expanded = false;
const listeners = new Set<Listener>();

/** Rect the card measured for itself, for the no-measure fast path. */
const cachedCard = makeMutable<ExpandCardBounds | null>(null);
const cachedScreen = makeMutable<ExpandScreen | null>(null);
/** UI-thread scroll offset at the moment `cachedCard` was measured. */
const cachedScrollY = makeMutable<number>(Number.NaN);

export function getFeedExpandCard() {
    return targetCard;
}

export function getFeedExpandScreen() {
    return targetScreen;
}

export function getFeedExpandTargetPostId() {
    return targetPostId;
}

/**
 * Publish a card's measured rect so the tap worklet can arm without a bridge
 * round trip. `scrollYAtMeasure` is stamped alongside it: the fast path is only
 * valid while the list has not moved, since a scroll invalidates the card's
 * window-space rect.
 */
export function cacheFeedExpandCard(
    card: ExpandCardBounds,
    screen: ExpandScreen,
    scrollYAtMeasure: number,
): void {
    cachedCard.value = card;
    cachedScreen.value = screen;
    cachedScrollY.value = scrollYAtMeasure;
}

/**
 * The UI-thread fast path.
 *
 * Arms the transform AND starts the flight inside the gesture worklet, so the
 * morph begins on the very next UI frame. `runOnJS` is scheduled, not blocking,
 * so the JS bookkeeping below cannot delay the animation.
 */
export function armAndExpandOnUIThread(
    postId: string,
    card: ExpandCardBounds,
    screen: ExpandScreen,
    currentScrollY: number,
): boolean {
    'worklet';
    if (!isExpandableBounds(card) || !isValidScreen(screen)) return false;
    const base = cachedCard.value;
    const baseScreen = cachedScreen.value;
    const measuredAt = cachedScrollY.value;
    if (base == null || baseScreen == null) return false;

    // The cached rect is in window space, so scrolling the list moves the card by
    // exactly the scroll delta. Compensating rather than rejecting keeps the fast
    // path usable after the user has scrolled — refusing outright only worked in
    // the narrow case of tapping without scrolling since the card became active.
    let rect = base;
    if (Number.isFinite(measuredAt)) {
        const dy = measuredAt - currentScrollY;
        if (dy !== 0) {
            rect = { x: base.x, y: base.y + dy, width: base.width, height: base.height };
        }
    }
    if (!isExpandableBounds(rect)) return false;

    // Sanity gate: after compensation the card should still overlap the screen. A
    // rect entirely off-window means the cache is not trustworthy (a re-layout we
    // never observed), so let the measured fallback take over.
    const offscreenY = rect.y >= screen.height || rect.y + rect.height <= 0;
    const offscreenX = rect.x >= screen.width || rect.x + rect.width <= 0;
    if (offscreenY || offscreenX) return false;

    targetCard.value = rect;
    targetScreen.value = baseScreen;
    targetPostId.value = postId;
    progress.value = withTiming(1, { duration: FEED_EXPAND_DURATION_MS }, (finished) => {
        'worklet';
        if (finished) runOnJS(settleExpand)(postId);
    });
    // Scheduled, not blocking: the flight above is already under way.
    runOnJS(armExpandJS)(postId, rect, baseScreen);
    return true;
}

function notify(): void {
    listeners.forEach((fn) => {
        try {
            fn(target);
        } catch {
            /* a bad subscriber must not wedge the transition */
        }
    });
}

/** 0 = card frame, 1 = full screen. Read by the card's animated style. */
export function getFeedExpandProgress() {
    return progress;
}

export function getFeedExpandTarget(): FeedExpandTarget | null {
    return target;
}

export function isFeedExpanded(): boolean {
    return expanded;
}

export function getFeedExpandPostId(): string | null {
    return target ? target.postId : null;
}

export function subscribeFeedExpand(listener: Listener): () => void {
    listeners.add(listener);
    listener(target);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * React bookkeeping for an arm. Runs AFTER the UI-thread animation has already
 * started (see `armAndExpandOnUIThread`), which is why the notification is
 * deferred: the `notify()` fan-out sets state on every mounted card *and* on
 * FeedScreen, and doing that synchronously is what produced the tap-to-morph
 * freeze. One `requestAnimationFrame` is enough to let the first animation frame
 * commit on the UI thread first, while the JS reconciliation overlaps the rest
 * of the 300ms flight.
 */
let pendingNotify: number | null = null;

function scheduleNotify(): void {
    if (pendingNotify != null) return;
    pendingNotify = requestAnimationFrame(() => {
        pendingNotify = null;
        notify();
    });
}

function cancelPendingNotify(): void {
    if (pendingNotify == null) return;
    cancelAnimationFrame(pendingNotify);
    pendingNotify = null;
}

/** JS-thread arm. Assumes the caller has already started the UI-thread flight. */
function armExpandJS(
    postId: string,
    card: ExpandCardBounds,
    screen: ExpandScreen,
): void {
    target = { postId, card, screen };
    expanded = false;
    targetCard.value = card;
    targetScreen.value = screen;
    targetPostId.value = postId;
    scheduleNotify();
}

/**
 * Measured fallback path: the rect was not already cached, so arm from JS after a
 * `measureInWindow` round trip. The animation still starts before any React
 * work — `progress` is driven here, not in an effect.
 */
export function armFeedExpand(next: FeedExpandTarget): void {
    if (!isExpandableBounds(next.card) || !isValidScreen(next.screen)) return;
    target = next;
    expanded = false;
    targetCard.value = next.card;
    targetScreen.value = next.screen;
    targetPostId.value = next.postId;
    progress.value = 0;
    progress.value = withTiming(1, { duration: FEED_EXPAND_DURATION_MS }, (finished) => {
        'worklet';
        if (finished) runOnJS(settleExpand)(next.postId);
    });
    scheduleNotify();
}

/**
 * JS-thread finalisers. `withTiming` runs its callback on the UI thread, where
 * `target`/`expanded`/`listeners` are not reachable — mutating them there either
 * silently no-ops or tears down the store mid-flight, so every completion hops
 * back explicitly.
 */
function settleExpand(postId?: string): void {
    expanded = true;
    if (postId && target && target.postId !== postId) {
        // A newer card took over mid-flight; do not mark the stale one expanded.
        expanded = false;
    }
}

function settleCollapse(): void {
    target = null;
    expanded = false;
    progress.value = 0;
    // Only now is it safe to drop the mirrors: progress is already 0, so the
    // card leaves the frame at rest instead of snapping.
    targetCard.value = null;
    targetScreen.value = null;
    targetPostId.value = null;
    cancelPendingNotify();
    notify();
}

/**
 * Retained for callers that must await the flight. Prefer `armFeedExpand` /
 * `armAndExpandOnUIThread`, which start the animation themselves.
 */
export function runFeedExpandAnimation(onDone?: () => void): void {
    if (!target) {
        onDone?.();
        return;
    }
    progress.value = withTiming(
        1,
        { duration: FEED_EXPAND_DURATION_MS },
        (finished) => {
            'worklet';
            if (!finished) return;
            runOnJS(settleExpand)(target ? target.postId : undefined);
            if (onDone) runOnJS(onDone)();
        },
    );
}

/**
 * Animate back to the card frame, then release.
 *
 * The target is cleared only once the animation lands, so the style stays
 * attached for the whole flight and the card is never yanked back to identity
 * mid-transition.
 */
export function runFeedCollapseAnimation(onDone?: () => void): void {
    if (!target) {
        onDone?.();
        return;
    }
    progress.value = withTiming(
        0,
        { duration: FEED_COLLAPSE_DURATION_MS },
        (finished) => {
            'worklet';
            // Only release on a clean landing. If the animation was interrupted we
            // keep the anchor so the next collapse can finish the job.
            if (!finished) return;
            // settleCollapse notifies, which is what drops the target and with it
            // the card's animated style — only after progress has reached 0.
            runOnJS(settleCollapse)();
            if (onDone) runOnJS(onDone)();
        },
    );
}

/** Snap back to fully expanded (used when a dismiss drag is released too early). */
export function runFeedExpandSnapBack(): void {
    if (!target) return;
    progress.value = withSpring(1, { damping: 20, stiffness: 220, mass: 0.6 });
}

/**
 * Drop the morph instantly because we are navigating away.
 *
 * Not a collapse animation: a profile tap expects a screen transition, and a
 * 250ms flight behind it would leave the card visibly parked mid-morph on
 * return. Setting `progress` to 0 and clearing the mirrors means every card's
 * `useAnimatedStyle` falls back to its at-rest transform on the very next
 * frame, so the feed is clean whether or not anything was expanded.
 *
 * Also clears the JS-side `target`/`expanded`, which are not reachable from a
 * worklet and would otherwise survive as a phantom "expanded" card.
 */
export function resetFeedExpandForNavigation(): void {
    cancelPendingNotify();
    progress.value = 0;
    targetCard.value = null;
    targetScreen.value = null;
    targetPostId.value = null;
    target = null;
    expanded = false;
}

/** True once the collapse animation has fully landed and the card is released. */
export function isFeedCollapseSettled(): boolean {
    return target === null;
}

export function __resetFeedExpandForTests(): void {
    cancelPendingNotify();
    targetCard.value = null;
    targetScreen.value = null;
    targetPostId.value = null;
    cachedCard.value = null;
    cachedScreen.value = null;
    cachedScrollY.value = Number.NaN;
    target = null;
    expanded = false;
    progress.value = 0;
    listeners.clear();
}
