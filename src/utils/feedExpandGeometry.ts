/**
 * Geometry for the full-screen expand morph — pure, no React, no Reanimated.
 *
 * Kept separate from the store/animation shell (`feedFullscreenExpandNative.ts`)
 * so the maths can be unit-tested on the JS thread. The properties that matter
 * here are only observable on a device otherwise, and two of them are
 * correctness-critical:
 *
 *  - p = 0 must be EXACTLY identity, or the card jumps by a pixel when the
 *    animated style attaches mid-scroll.
 *  - the scale must be UNIFORM, or the video is stretched. A per-axis scale
 *    cannot morph a card box into a differently-proportioned screen.
 *
 * All functions are worklet-safe: plain arithmetic, no allocation.
 */

export type ExpandCardBounds = { x: number; y: number; width: number; height: number };
export type ExpandScreen = { width: number; height: number };
export type ExpandTransform = { translateX: number; translateY: number; scale: number };

/** Expanding into full screen. Matches the 300ms the design called for. */
export const FEED_EXPAND_DURATION_MS = 300;
/** Collapse is a touch quicker — it is a dismissal, not a presentation. */
export const FEED_COLLAPSE_DURATION_MS = 250;

function clamp01(v: number): number {
    'worklet';
    if (!Number.isFinite(v)) return 0;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
}

/**
 * Uniform scale that makes the card cover the screen.
 *
 * Cover rather than fit, so there are no gaps at the corners mid-flight.
 */
export function computeCoverScale(card: ExpandCardBounds, screen: ExpandScreen): number {
    'worklet';
    if (!(card.width > 0) || !(card.height > 0)) return 1;
    if (!(screen.width > 0) || !(screen.height > 0)) return 1;
    const sx = screen.width / card.width;
    const sy = screen.height / card.height;
    return sx > sy ? sx : sy;
}

/**
 * Transform at a given progress: 0 = card frame, 1 = full screen.
 *
 * At p = 1 the scaled box is centred on the screen, so the axis that overflows
 * (cover means one axis always does) is split evenly instead of being clipped to
 * one side.
 */
export function computeExpandTransform(
    p: number,
    card: ExpandCardBounds,
    screen: ExpandScreen,
): ExpandTransform {
    'worklet';
    const t = clamp01(p);
    if (t === 0) return { translateX: 0, translateY: 0, scale: 1 };

    const endScale = computeCoverScale(card, screen);
    const endX = -card.x + (screen.width - card.width * endScale) / 2;
    const endY = -card.y + (screen.height - card.height * endScale) / 2;

    return {
        translateX: endX * t,
        translateY: endY * t,
        scale: 1 + (endScale - 1) * t,
    };
}

/** Whether bounds are real enough to animate from (guards a not-yet-laid-out card). */
export function isExpandableBounds(card: Partial<ExpandCardBounds> | null | undefined): boolean {
    'worklet';
    if (!card) return false;
    const { x, y, width, height } = card;
    return (
        typeof x === 'number' &&
        typeof y === 'number' &&
        typeof width === 'number' &&
        typeof height === 'number' &&
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(width) &&
        Number.isFinite(height) &&
        width > 1 &&
        height > 1
    );
}

/**
 * Whether `cardPostId` owns the current morph.
 *
 * The expand target rect/screen live in module-global shareables so the tap
 * worklet can arm the animation without a React commit (that round trip is the
 * ~200ms tap freeze this path removes). But *every* mounted feed card runs the
 * same `useAnimatedStyle` and therefore reads those same globals. Without this
 * gate, arming one card scaled every visible sibling to full screen and lifted
 * them all to `zIndex: 100`.
 *
 * Kept here, next to the other pure transform helpers, so the invariant is
 * testable without instantiating Reanimated, and so the component compares two
 * plain captured strings rather than waiting on component state.
 */
export function isExpandTargetCard(
    cardPostId: string | null | undefined,
    targetPostId: string | null | undefined,
): boolean {
    'worklet';
    if (!cardPostId || !targetPostId) return false;
    return cardPostId === targetPostId;
}

/**
 * Screen-size check.
 *
 * Deliberately separate from `isExpandableBounds`: a screen has no `x`/`y`, so
 * routing it through the card validator would reject every screen and the
 * expansion would never arm. That bug is why this function exists.
 */
export function isValidScreen(screen: Partial<ExpandScreen> | null | undefined): boolean {
    'worklet';
    if (!screen) return false;
    const { width, height } = screen;
    return (
        typeof width === 'number' &&
        typeof height === 'number' &&
        Number.isFinite(width) &&
        Number.isFinite(height) &&
        width > 0 &&
        height > 0
    );
}
