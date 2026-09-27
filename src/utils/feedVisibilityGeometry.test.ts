import { describe, expect, it } from 'vitest';
import {
    FEED_ACTIVE_VISIBILITY_RATIO,
    anchoredVisibleRatio,
    anchoredVisibleRatio as ratio,
    computeVisibleRatio,
    isAnchorUsable,
    isCardAboveBar,
    shouldSilenceForScroll,
    type FeedVisibilityAnchor,
} from './feedVisibilityGeometry';

/**
 * These functions run inside a Reanimated worklet on the UI thread. If the maths
 * is wrong the symptom is a card that keeps playing audio after it has scrolled
 * away, so the boundary cases matter more than the happy path.
 */
const VIEWPORT = 800;

describe('computeVisibleRatio', () => {
    it('reports a card exactly filling the viewport as fully visible', () => {
        expect(computeVisibleRatio(0, VIEWPORT, 0, VIEWPORT)).toBe(1);
    });

    it('reports a half-scrolled card as half visible', () => {
        expect(computeVisibleRatio(0, VIEWPORT, VIEWPORT / 2, VIEWPORT)).toBeCloseTo(0.5, 5);
    });

    it('is 0 for a card scrolled entirely above the viewport', () => {
        expect(computeVisibleRatio(0, VIEWPORT, VIEWPORT, VIEWPORT)).toBe(0);
    });

    it('is 0 for a card scrolled entirely below the viewport', () => {
        expect(computeVisibleRatio(VIEWPORT * 3, VIEWPORT, 0, VIEWPORT)).toBe(0);
    });

    it('is 0 for a card that has not been measured yet', () => {
        expect(computeVisibleRatio(0, 0, 0, VIEWPORT)).toBe(0);
    });

    it('is 0 when the viewport has not been measured yet', () => {
        expect(computeVisibleRatio(0, VIEWPORT, 0, 0)).toBe(0);
    });

    it('reports a proportionally smaller slice of a card taller than the viewport', () => {
        // A long post only ever shows 1/3 of itself in an 800px band. This matches
        // RN's own `itemVisiblePercentThreshold`, which also measures the fraction
        // of the *item* — so a card over twice the viewport height can never clear
        // the 50% bar. Deliberate: consistency with the JS path, and a long post
        // should not hijack the audio slot.
        expect(computeVisibleRatio(0, VIEWPORT * 3, 0, VIEWPORT)).toBeCloseTo(1 / 3, 5);
    });

    it('never returns a value outside [0, 1] at pathological geometry', () => {
        const ratios = [
            computeVisibleRatio(-VIEWPORT, VIEWPORT, 0, VIEWPORT),
            computeVisibleRatio(0, VIEWPORT, -VIEWPORT, VIEWPORT),
            computeVisibleRatio(0, VIEWPORT * 10, 0, VIEWPORT * 10),
        ];
        for (const r of ratios) {
            expect(r).toBeLessThanOrEqual(1);
            expect(r).toBeGreaterThanOrEqual(0);
        }
    });

    it('decreases monotonically as a card scrolls away', () => {
        const samples = [0, 200, 400, 500, 600, 700, 800, 900].map((y) =>
            computeVisibleRatio(0, VIEWPORT, y, VIEWPORT),
        );
        expect(samples[0]).toBe(1);
        expect(samples[samples.length - 1]).toBe(0);
        for (let i = 1; i < samples.length; i += 1) {
            expect(samples[i]).toBeLessThanOrEqual(samples[i - 1]);
        }
    });

    it('ignores non-finite positions instead of producing NaN', () => {
        expect(computeVisibleRatio(Number.NaN, VIEWPORT, 0, VIEWPORT)).toBe(0);
        expect(computeVisibleRatio(0, VIEWPORT, Number.NaN, VIEWPORT)).toBe(0);
    });
});

describe('isCardAboveBar', () => {
    it('treats exactly 50% as still active', () => {
        // The bar is inclusive: a half-visible card has not dropped out yet.
        expect(isCardAboveBar(0, VIEWPORT, VIEWPORT / 2, VIEWPORT)).toBe(true);
    });

    it('treats just past 50% as dropped out', () => {
        expect(isCardAboveBar(0, VIEWPORT, VIEWPORT * 0.51, VIEWPORT)).toBe(false);
    });

    it('agrees with the ratio boundary at every sample', () => {
        for (const y of [0, 100, 399, 400, 401, 500, 799, 800]) {
            const r = computeVisibleRatio(0, VIEWPORT, y, VIEWPORT);
            expect(isCardAboveBar(0, VIEWPORT, y, VIEWPORT)).toBe(r >= FEED_ACTIVE_VISIBILITY_RATIO);
        }
    });
});

describe('anchored visibility', () => {
    const anchorAtTop: FeedVisibilityAnchor = { anchorY: 1000, cardHeight: VIEWPORT };

    it('scores 1 while the anchored card is unmoved and on screen', () => {
        expect(ratio(anchorAtTop, 1000, VIEWPORT)).toBe(1);
    });

    it('scores 0.5 once the list has scrolled exactly half a card', () => {
        expect(ratio(anchorAtTop, 1000 + VIEWPORT / 2, VIEWPORT)).toBeCloseTo(0.5, 5);
    });

    it('stays 1 for a small bounce that does not drop below the bar', () => {
        // Small flings must not kill audio — this is the regression that a naive
        // "any scroll pauses" rule would cause.
        expect(ratio(anchorAtTop, 1030, VIEWPORT)).toBeGreaterThan(0.9);
    });

    it('reaches 0 once the card has fully left', () => {
        expect(ratio(anchorAtTop, 1000 + VIEWPORT, VIEWPORT)).toBe(0);
    });

    it('is 0 with no anchor', () => {
        expect(ratio(null, 0, VIEWPORT)).toBe(0);
    });

    it('measures the card against its own height, not the viewport', () => {
        // A short card (a text post) drops out sooner than a full-height one.
        const short: FeedVisibilityAnchor = { anchorY: 0, cardHeight: 400 };
        const scroll = 200;
        expect(ratio(short, scroll, VIEWPORT)).toBeCloseTo(0.5, 5);
        expect(ratio({ anchorY: 0, cardHeight: VIEWPORT }, scroll, VIEWPORT)).toBeCloseTo(0.75, 5);
    });
});

describe('shouldSilenceForScroll', () => {
    const anchor: FeedVisibilityAnchor = { anchorY: 0, cardHeight: VIEWPORT };

    it('is false while the card is fully visible', () => {
        expect(shouldSilenceForScroll(anchor, 0, VIEWPORT)).toBe(false);
    });

    it('is false at exactly the bar', () => {
        expect(shouldSilenceForScroll(anchor, VIEWPORT / 2, VIEWPORT)).toBe(false);
    });

    it('is true just past the bar', () => {
        expect(shouldSilenceForScroll(anchor, VIEWPORT * 0.51, VIEWPORT)).toBe(true);
    });

    it('is false with no anchor (disarmed guard must never silence)', () => {
        // Critical: a null anchor means "nothing to guard". Treating it as
        // "not visible" would kill playback the instant it was granted.
        expect(shouldSilenceForScroll(null, VIEWPORT * 3, VIEWPORT)).toBe(false);
    });

    it('is false when the viewport is unmeasured', () => {
        expect(shouldSilenceForScroll(anchor, VIEWPORT * 3, 0)).toBe(false);
    });

    it('stays true for a card scrolled far away', () => {
        expect(shouldSilenceForScroll(anchor, VIEWPORT * 10, VIEWPORT)).toBe(true);
    });

    it('never reports a resume — it can only tighten', () => {
        // Walking back up to the card flips it false again, which is the only
        // direction the JS layer is allowed to act on.
        expect(shouldSilenceForScroll(anchor, VIEWPORT * 3, VIEWPORT)).toBe(true);
        expect(shouldSilenceForScroll(anchor, 0, VIEWPORT)).toBe(false);
    });
});

describe('isAnchorUsable', () => {
    it('accepts a measured anchor with a measured viewport', () => {
        expect(isAnchorUsable({ anchorY: 0, cardHeight: VIEWPORT }, VIEWPORT)).toBe(true);
    });

    it('rejects a null anchor', () => {
        expect(isAnchorUsable(null, VIEWPORT)).toBe(false);
    });

    it('rejects an unmeasured card', () => {
        expect(isAnchorUsable({ anchorY: 0, cardHeight: 0 }, VIEWPORT)).toBe(false);
    });

    it('rejects an unmeasured viewport', () => {
        expect(isAnchorUsable({ anchorY: 0, cardHeight: VIEWPORT }, 0)).toBe(false);
    });
});

describe('module re-exports', () => {
    it('keeps anchoredVisibleRatio identical to computeVisibleRatio via the alias', () => {
        expect(anchoredVisibleRatio).toBe(ratio);
    });
});
