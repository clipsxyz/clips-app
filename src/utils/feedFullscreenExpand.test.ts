import { describe, expect, it } from 'vitest';
import {
    FEED_COLLAPSE_DURATION_MS,
    FEED_EXPAND_DURATION_MS,
    computeCoverScale,
    computeExpandTransform,
    isExpandableBounds,
    isExpandTargetCard,
    isValidScreen,
    type ExpandCardBounds,
    type ExpandScreen,
} from './feedExpandGeometry';

/**
 * The morph is transform-only so the TextureView is never re-laid-out (a 1px
 * layout drift remounts ExoPlayer in this app). That constraint is really a
 * constraint on this maths: a non-uniform scale or a non-identity p=0 would show
 * up on device as a stretched video or a card that jumps when the style attaches.
 */
const SCREEN: ExpandScreen = { width: 400, height: 800 };

function card(over: Partial<ExpandCardBounds> = {}): ExpandCardBounds {
    return { x: 0, y: 0, width: 400, height: 800, ...over };
}

describe('computeCoverScale', () => {
    it('is 1 when the card already fills the screen', () => {
        expect(computeCoverScale(card(), SCREEN)).toBe(1);
    });

    it('uses the wider ratio when the card is short and wide', () => {
        // 400x200 card on a 400x800 screen: width already matches, height does not.
        expect(computeCoverScale(card({ height: 200 }), SCREEN)).toBe(4);
    });

    it('uses the taller ratio when the card is narrow', () => {
        expect(computeCoverScale(card({ width: 200, height: 800 }), SCREEN)).toBe(2);
    });

    it('is 1 for a degenerate card rather than Infinity', () => {
        expect(computeCoverScale(card({ width: 0, height: 0 }), SCREEN)).toBe(1);
    });

    it('is 1 for a degenerate screen', () => {
        expect(computeCoverScale(card(), { width: 0, height: 0 })).toBe(1);
    });
});

describe('computeExpandTransform', () => {
    it('is exactly identity at p=0 so attaching the style cannot jump the card', () => {
        // The single most important property: a card mid-scroll must not shift by
        // a pixel when the animated style is attached.
        expect(computeExpandTransform(0, card({ x: 37, y: 512, width: 390, height: 700 }), SCREEN))
            .toEqual({ translateX: 0, translateY: 0, scale: 1 });
    });

    it('centres the card on screen at p=1', () => {
        // A card smaller than the screen must end centred, not pinned to 0,0 —
        // otherwise the video sits in a corner instead of full screen.
        const t = computeExpandTransform(1, card({ width: 200, height: 200 }), SCREEN);
        expect(t.scale).toBe(4);
        // scaled size 800x800 on a 400x800 screen: x overflows by 400, split evenly.
        expect(t.translateX).toBe(0 + (400 - 800) / 2);
        expect(t.translateY).toBe(0 + (800 - 800) / 2);
    });

    it('offsets by the card position on screen at p=1', () => {
        // A card sitting at y=2000 in a tall list must travel up to the top.
        const t = computeExpandTransform(1, card({ y: 2000 }), SCREEN);
        expect(t.translateY).toBe(-2000);
        expect(t.translateX).toBe(0);
    });

    it('scales uniformly — never stretches one axis', () => {
        // A per-axis scale would distort the video; verify only one scale value
        // exists and that it is the cover ratio.
        const t = computeExpandTransform(1, card({ width: 200, height: 400 }), SCREEN);
        expect(t.scale).toBe(computeCoverScale(card({ width: 200, height: 400 }), SCREEN));
    });

    it('interpolates monotonically between identity and full screen', () => {
        const c = card({ x: 10, y: 900, width: 380, height: 640 });
        const end = computeExpandTransform(1, c, SCREEN);
        let prevScale = 0;
        let prevX = 0;
        let prevY = 0;
        for (const p of [0, 0.25, 0.5, 0.75, 1]) {
            const t = computeExpandTransform(p, c, SCREEN);
            expect(t.scale).toBeGreaterThanOrEqual(prevScale);
            // Offsets only ever grow in magnitude away from the resting position.
            expect(Math.abs(t.translateX)).toBeGreaterThanOrEqual(Math.abs(prevX));
            expect(Math.abs(t.translateY)).toBeGreaterThanOrEqual(Math.abs(prevY));
            prevScale = t.scale;
            prevX = t.translateX;
            prevY = t.translateY;
        }
        expect(prevScale).toBe(end.scale);
    });

    it('is a straight line in p, so withTiming gives a smooth path', () => {
        const c = card({ y: 400 });
        const half = computeExpandTransform(0.5, c, SCREEN);
        const end = computeExpandTransform(1, c, SCREEN);
        expect(half.translateY).toBeCloseTo(end.translateY * 0.5, 6);
        expect(half.scale).toBeCloseTo(1 + (end.scale - 1) * 0.5, 6);
    });

    it('clamps progress outside [0, 1]', () => {
        // A drag gesture can overshoot; it must never fly off screen.
        expect(computeExpandTransform(-3, card(), SCREEN)).toEqual(
            computeExpandTransform(0, card(), SCREEN),
        );
        expect(computeExpandTransform(9, card(), SCREEN)).toEqual(
            computeExpandTransform(1, card(), SCREEN),
        );
    });

    it('treats a non-finite progress as collapsed', () => {
        expect(computeExpandTransform(Number.NaN, card(), SCREEN)).toEqual({
            translateX: 0,
            translateY: 0,
            scale: 1,
        });
    });

    it('stays finite for a card measured off-screen', () => {
        const t = computeExpandTransform(1, card({ x: -900, y: 4000 }), SCREEN);
        expect(Number.isFinite(t.translateX)).toBe(true);
        expect(Number.isFinite(t.translateY)).toBe(true);
        expect(Number.isFinite(t.scale)).toBe(true);
    });
});

describe('isExpandableBounds', () => {
    it('accepts real bounds', () => {
        expect(isExpandableBounds(card({ x: 1, y: 2 }))).toBe(true);
    });

    it('rejects null and undefined', () => {
        expect(isExpandableBounds(null)).toBe(false);
        expect(isExpandableBounds(undefined)).toBe(false);
    });

    it('rejects an unmeasured card', () => {
        // A card that has not laid out yet would otherwise animate from 0x0 and
        // produce a wild scale.
        expect(isExpandableBounds({ x: 0, y: 0, width: 0, height: 0 })).toBe(false);
    });

    it('rejects partially measured bounds', () => {
        expect(isExpandableBounds({ x: 0, y: 0, width: 400 })).toBe(false);
    });

    it('rejects non-finite values', () => {
        expect(isExpandableBounds({ x: Number.NaN, y: 0, width: 400, height: 800 })).toBe(false);
        expect(
            isExpandableBounds({ x: 0, y: Number.POSITIVE_INFINITY, width: 400, height: 800 }),
        ).toBe(false);
    });
});

describe('durations', () => {
    it('expands in 300ms as specified', () => {
        expect(FEED_EXPAND_DURATION_MS).toBe(300);
    });

    it('collapses faster than it expands, since it is a dismissal', () => {
        expect(FEED_COLLAPSE_DURATION_MS).toBeLessThan(FEED_EXPAND_DURATION_MS);
    });
});

describe('isValidScreen', () => {
    it('accepts a real screen', () => {
        expect(isValidScreen(SCREEN)).toBe(true);
    });

    it('rejects a screen with no x/y, which isExpandableBounds would refuse', () => {
        // The bug this guards: routing the screen through the card validator
        // rejects every screen, so the expansion silently never arms.
        expect(isExpandableBounds(SCREEN)).toBe(false);
        expect(isValidScreen(SCREEN)).toBe(true);
    });

    it('rejects missing, non-finite and zero-sized screens', () => {
        expect(isValidScreen(null)).toBe(false);
        expect(isValidScreen(undefined)).toBe(false);
        expect(isValidScreen({})).toBe(false);
        expect(isValidScreen({ width: Number.NaN, height: 800 })).toBe(false);
        expect(isValidScreen({ width: 400, height: Number.POSITIVE_INFINITY })).toBe(false);
        expect(isValidScreen({ width: 0, height: 800 })).toBe(false);
        expect(isValidScreen({ width: 400, height: 0 })).toBe(false);
    });
});

describe('isExpandTargetCard', () => {
    it('claims only the card whose id owns the morph', () => {
        expect(isExpandTargetCard('7', '7')).toBe(true);
        expect(isExpandTargetCard('8', '7')).toBe(false);
    });

    it('claims nobody while no card is expanding', () => {
        // The mirrors are cleared only after collapse reaches progress 0, so
        // 'no target' is a state every sibling must render as at-rest.
        expect(isExpandTargetCard('7', null)).toBe(false);
        expect(isExpandTargetCard('7', undefined)).toBe(false);
    });

    it('never claims a card with no id', () => {
        expect(isExpandTargetCard('', '')).toBe(false);
        expect(isExpandTargetCard(null, '7')).toBe(false);
        expect(isExpandTargetCard(undefined, '7')).toBe(false);
    });

    it('distinguishes id 7 from the string "7" only by exact match', () => {
        // Ids are stringified before comparison, so a numeric 7 arriving as a
        // number must not silently match — the tap worklet arms by string id.
        expect(isExpandTargetCard(7 as unknown as string, '7')).toBe(false);
    });

    it('guards the bug where every mounted sibling scaled to full screen', () => {
        // Regression: the expand rect/screen are module-global so the tap
        // worklet can arm with no React commit, but every mounted feed card runs
        // the same useAnimatedStyle. Without this gate, tapping one card applied
        // the transform to all of them.
        const mountedIds = ['5', '6', '7', '8'];
        const claimed = mountedIds.filter((id) => isExpandTargetCard(id, '7'));
        expect(claimed).toEqual(['7']);
    });
});
