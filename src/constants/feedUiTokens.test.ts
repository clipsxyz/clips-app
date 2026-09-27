import { describe, expect, it } from 'vitest';
import { FEED_UI, feedCardMediaHeight } from './feedUiTokens';

/**
 * Feed video frames are locked to 4:5 (`videoPortraitAspect`) so every postcard —
 * including those after Stories 24 — shares one height. These tests pin that
 * invariant; a wrong value here silently resizes every video in the feed.
 *
 * All aspect comparisons below are height/width ratios.
 */
const MAX = FEED_UI.media.videoPortraitAspect;

/** Width available to a video card: full card width minus both insets. */
const CARD_WIDTH = 360 - FEED_UI.media.videoInset * 2;
/** Tall enough that the viewport cap never engages. */
const TALL_WINDOW = 1200;

describe('feedCardMediaHeight', () => {
    it('defaults an unknown-size video to a 4:5 portrait frame', () => {
        const height = feedCardMediaHeight(CARD_WIDTH, TALL_WINDOW, true);
        expect(height).toBeCloseTo(CARD_WIDTH * MAX, 5);
        expect(height / CARD_WIDTH).toBeCloseTo(1.25, 5);
    });

    it('locks every video to 4:5 even when natural size is square', () => {
        const height = feedCardMediaHeight(CARD_WIDTH, TALL_WINDOW, true, false, 1);
        expect(height / CARD_WIDTH).toBeCloseTo(MAX, 5);
    });

    it('locks every video to 4:5 even for a 9:16 source', () => {
        const height = feedCardMediaHeight(CARD_WIDTH, TALL_WINDOW, true, false, 9 / 16);
        expect(height / CARD_WIDTH).toBeCloseTo(MAX, 5);
    });

    it('locks every video to 4:5 even when flagged landscape', () => {
        // Natural landscape must not shrink the feed frame (Stories-adjacent recycle bug).
        const height = feedCardMediaHeight(CARD_WIDTH, TALL_WINDOW, true, true, 16 / 9);
        expect(height / CARD_WIDTH).toBeCloseTo(MAX, 5);
    });

    it('never grows a video past 4:5 for a very tall portrait source', () => {
        const height = feedCardMediaHeight(CARD_WIDTH, TALL_WINDOW, true, false, 1 / 3);
        expect(height / CARD_WIDTH).toBeCloseTo(MAX, 5);
    });

    it('caps the frame so header + media + action bar still fit one screen', () => {
        const SHORT_WINDOW = 600;
        const cap = SHORT_WINDOW * FEED_UI.media.maxViewportFraction;
        expect(cap).toBeLessThan(CARD_WIDTH * MAX);

        const height = feedCardMediaHeight(CARD_WIDTH, SHORT_WINDOW, true);
        expect(height).toBeCloseTo(cap, 5);
    });

    it('lets the 4:5 aspect win when the window is tall enough to fit it', () => {
        const height = feedCardMediaHeight(CARD_WIDTH, TALL_WINDOW, true);
        expect(height).toBeCloseTo(CARD_WIDTH * MAX, 5);
    });

    it('ignores a non-finite or non-positive source ratio and stays on 4:5 for video', () => {
        for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
            const height = feedCardMediaHeight(CARD_WIDTH, TALL_WINDOW, true, false, bad);
            expect(height / CARD_WIDTH).toBeCloseTo(MAX, 5);
        }
    });

    it('leaves image frames on their existing 4:5 default', () => {
        const height = feedCardMediaHeight(CARD_WIDTH, TALL_WINDOW, false);
        expect(height / CARD_WIDTH).toBeCloseTo(FEED_UI.media.maxAspect, 5);
    });

    it('still letterboxes landscape images to their own ratio', () => {
        const height = feedCardMediaHeight(CARD_WIDTH, TALL_WINDOW, false, true, 16 / 9);
        expect(height / CARD_WIDTH).toBeCloseTo(9 / 16, 5);
    });

    it('uses the same inset token as the Bluesky-style 16px horizontal margin', () => {
        expect(FEED_UI.media.videoInset).toBe(16);
    });
});
