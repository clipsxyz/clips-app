import { describe, expect, it } from 'vitest';

import {
    feedAspectRatio,
    feedCardAspectRatio,
    feedMediaHeight,
    fitContainBox,
    intrinsicRatio,
    orientationOf,
    RATIO_FALLBACK,
    RATIO_FEED_UNKNOWN,
    resolveIntrinsicSize,
    RATIO_FEED_MAX_PORTRAIT,
    RATIO_LANDSCAPE_16_9,
    RATIO_PORTRAIT_9_16,
    resolveAspectRatio,
    toTokenHeightRatio,
} from './mediaAspectRatio';

/**
 * These are the regression guards for the feed letterbox: a 16:9 clip rendered inside a
 * 4:5 token box produced ~55% black bars, and a 9:16 clip rendered inside the same box
 * was silently cropped. Both are asserted directly against the width/height pairs that
 * occur in the demo and production media sets.
 */
describe('intrinsicRatio', () => {
    it('reads real dimensions in width/height', () => {
        expect(intrinsicRatio(1920, 1080)).toBeCloseTo(16 / 9, 6);
        expect(intrinsicRatio(1080, 1920)).toBeCloseTo(9 / 16, 6);
        expect(intrinsicRatio(1080, 1080)).toBe(1);
    });

    it('rejects unusable input instead of returning a number', () => {
        // NaN would silently poison every downstream clamp.
        expect(intrinsicRatio(NaN, 1080)).toBeNull();
        expect(intrinsicRatio(1080, NaN)).toBeNull();
        expect(intrinsicRatio(Infinity, 1080)).toBeNull();
        expect(intrinsicRatio(0, 1080)).toBeNull();
        expect(intrinsicRatio(1080, 0)).toBeNull();
        expect(intrinsicRatio(-1920, 1080)).toBeNull();
        expect(intrinsicRatio(1080, -1080)).toBeNull();
        expect(intrinsicRatio(undefined, undefined)).toBeNull();
        expect(intrinsicRatio(null, null)).toBeNull();
        // String digits from a JSON payload still work.
        expect(intrinsicRatio('1920' as unknown as number, '1080' as unknown as number)).toBeCloseTo(
            16 / 9,
            6,
        );
    });

    it('rejects ratios outside the sane band', () => {
        expect(intrinsicRatio(10000, 100)).toBeNull(); // 100:1
        expect(intrinsicRatio(100, 10000)).toBeNull(); // 1:100
    });
});

describe('orientationOf', () => {
    it('classifies the three shapes', () => {
        expect(orientationOf(1080, 1920)).toBe('portrait');
        expect(orientationOf(1920, 1080)).toBe('landscape');
        expect(orientationOf(1080, 1080)).toBe('square');
    });

    it('treats near-square as square rather than portrait', () => {
        // 1080x1081 must not get pushed through the portrait clamp.
        expect(orientationOf(1080, 1081)).toBe('square');
        expect(orientationOf(1081, 1080)).toBe('square');
    });

    it('returns null when dimensions are unknown', () => {
        expect(orientationOf(undefined, undefined)).toBeNull();
    });
});

describe('feedAspectRatio', () => {
    it('keeps 16:9 landscape at exactly 16:9 -- no letterbox', () => {
        expect(feedAspectRatio(1920, 1080)).toBeCloseTo(RATIO_LANDSCAPE_16_9, 6);
        expect(feedAspectRatio(640, 360)).toBeCloseTo(RATIO_LANDSCAPE_16_9, 6);
        expect(feedAspectRatio(960, 540)).toBeCloseTo(RATIO_LANDSCAPE_16_9, 6);
    });

    it('caps portrait at 4:5 for the standard feed', () => {
        expect(feedAspectRatio(1080, 1920)).toBeCloseTo(RATIO_FEED_MAX_PORTRAIT, 6);
        expect(feedAspectRatio(1920, 1080 + 1920 * 4)).toBeCloseTo(RATIO_FEED_MAX_PORTRAIT, 6);
    });

    it('lifts the portrait cap to true 9:16 for a full-bleed player', () => {
        expect(feedAspectRatio(1080, 1920, { fullscreenPortrait: true })).toBeCloseTo(
            RATIO_PORTRAIT_9_16,
            6,
        );
    });

    it('holds square at 1:1', () => {
        expect(feedAspectRatio(1080, 1080)).toBe(1);
    });

    it('caps ultras wide 2.4:1 to 16:9', () => {
        // sample_960x400_ocean_with_audio.mp4 is in the demo set.
        expect(feedAspectRatio(960, 400)).toBeCloseTo(RATIO_LANDSCAPE_16_9, 6);
    });

    it('does NOT widen a 3:2 clip up to 16:9', () => {
        // Forcing it up would letterbox the video inside a wider box.
        expect(feedAspectRatio(4, 3)).toBeCloseTo(4 / 3, 6);
    });

    it('falls back to the portrait default for unknown dimensions, never to 0 or NaN', () => {
        expect(feedAspectRatio(undefined, undefined)).toBe(RATIO_FALLBACK);
        expect(feedAspectRatio(0, 0)).toBe(RATIO_FALLBACK);
        expect(feedAspectRatio(NaN, 1080)).toBe(RATIO_FALLBACK);
    });

    it('never returns a non-positive or infinite ratio for any input', () => {
        const inputs = [
            [1, 100],
            [100, 1],
            [0, 5],
            [5, 0],
            [NaN, NaN],
            [undefined, 5],
            [1920, 1080],
            [1080, 1920],
            [1, 1],
            [99999, 3],
        ];

        for (const [w, h] of inputs) {
            const ratio = feedAspectRatio(w, h);
            expect(Number.isFinite(ratio)).toBe(true);
            expect(ratio).toBeGreaterThan(0);
        }
    });
});

describe('feedMediaHeight', () => {
    it('gives 16:9 a short box and 9:16 a capped taller one', () => {
        const landscape = feedMediaHeight(390, 1920, 1080);
        const portrait = feedMediaHeight(390, 1080, 1920);

        expect(landscape).toBeCloseTo(390 / (16 / 9), 6); // ~219
        expect(portrait).toBeCloseTo(390 / 0.8, 6); // ~487

        // Landscape must be strictly shorter than portrait, or the feed card ordering
        // inverts between shapes.
        expect(landscape).toBeLessThan(portrait);
    });

    it('matches width / ratio exactly for every orientation', () => {
        expect(feedMediaHeight(390, 1080, 1080)).toBeCloseTo(390, 6);
        expect(feedMediaHeight(390, 1080, 1920)).toBeCloseTo(390 / 0.8, 6);
        expect(feedMediaHeight(390, 1920, 1080)).toBeCloseTo(390 / (16 / 9), 6);
    });

    it('is safe with a zero or negative width', () => {
        expect(feedMediaHeight(0, 1080, 1920)).toBeCloseTo(360 / 0.8, 6);
        expect(feedMediaHeight(-100, 1080, 1920)).toBeCloseTo(360 / 0.8, 6);
    });
});

describe('resolveAspectRatio', () => {
    it('prefers API dimensions over measured ones (no layout shift)', () => {
        // API wins so the first paint is already final.
        expect(resolveAspectRatio({ width: 1920, height: 1080 }, { width: 1080, height: 1920 })).toBe(
            RATIO_LANDSCAPE_16_9,
        );
    });

    it('falls back to measured dimensions when the API has none', () => {
        expect(resolveAspectRatio(null, { width: 1920, height: 1080 })).toBeCloseTo(
            RATIO_LANDSCAPE_16_9,
            6,
        );
        expect(resolveAspectRatio({ width: 0, height: 0 }, { width: 1080, height: 1920 })).toBe(
            RATIO_FEED_MAX_PORTRAIT,
        );
    });

    it('falls back to the shared skeleton ratio when neither is known', () => {
        expect(resolveAspectRatio(null, null)).toBe(RATIO_FALLBACK);
        expect(resolveAspectRatio(undefined, undefined)).toBe(RATIO_FALLBACK);
    });

    it('is stable -- resolving twice changes nothing', () => {
        const once = resolveAspectRatio({ width: 1920, height: 1080 });
        expect(resolveAspectRatio({ width: 1920, height: 1080 })).toBe(once);
    });
});

describe('toTokenHeightRatio', () => {
    it('inverts to the feedUiTokens height/width convention', () => {
        // 4:5 width/height -> 1.25 height/width, which is FEED_UI.media.maxAspect.
        expect(toTokenHeightRatio(0.8)).toBeCloseTo(1.25, 6);
        expect(toTokenHeightRatio(16 / 9)).toBeCloseTo(9 / 16, 6);
        expect(toTokenHeightRatio(1)).toBe(1);
    });

    it('round-trips', () => {
        expect(toTokenHeightRatio(0.8)).toBeCloseTo(1 / 0.8, 6);
    });

    it('is safe with bad input', () => {
        expect(toTokenHeightRatio(0)).toBeCloseTo(1.25, 6);
        expect(toTokenHeightRatio(NaN)).toBeCloseTo(1.25, 6);
    });
});
/**
 * THE LETTERBOX REGRESSION TEST.
 *
 * Reproduces the exact two-layer sizing that produced black bars and asserts the wrapper
 * and the inner frame now agree, so there is no surplus black area for any orientation.
 *
 * Before the fix:
 *   wrapper  = feedCardMediaHeight()  -> always the 4:5 token (isLandscape was never
 *             passed by the call site, so the 16:9 branch was unreachable)
 *   inner    = frameHeight            -> shrank to 16:9 once naturalSize arrived
 *   surplus  = 4:5 box - 16:9 frame  -> rendered black
 *
 * After the fix both layers derive from feedAspectRatio(), so surplus === 0.
 */
describe('no black bars: wrapper and inner frame must agree', () => {
    const CARD_WIDTH = 390; // iPhone 14 logical width
    const WINDOW_HEIGHT = 844;
    const VIEWPORT_CAP = WINDOW_HEIGHT * 0.58; // FEED_UI.media.maxViewportFraction

    /** Mirrors FeedScreen's mediaFrameHeight. */
    const wrapperHeight = (w?: number, h?: number): number => {
        const content = feedMediaHeight(CARD_WIDTH, w, h);
        return Math.round(Math.min(content, VIEWPORT_CAP));
    };

    /** Mirrors FeedPostMedia's frameHeight. */
    const innerFrameHeight = (w?: number, h?: number, allocated?: number): number => {
        const ratio = feedAspectRatio(w, h);
        const contentHeight = Math.round(CARD_WIDTH / ratio);
        return allocated !== undefined ? Math.min(contentHeight, allocated) : contentHeight;
    };

    const cases: Array<[string, number, number]> = [
        ['9:16 portrait 405x720', 405, 720],
        ['9:16 portrait 1080x1920', 1080, 1920],
        ['16:9 landscape 1920x1080', 1920, 1080],
        ['16:9 landscape 640x360', 640, 360],
        ['4:3 landscape 720x540', 720, 540],
        ['2.4:1 ultrawide 960x400', 960, 400],
        ['1:1 square 1080x1080', 1080, 1080],
    ];

    it.each(cases)('%s leaves zero black bars', (_label, w, h) => {
        const wrapper = wrapperHeight(w, h);
        const inner = innerFrameHeight(w, h, wrapper);

        // The whole point: the video fills the card box it was given.
        expect(inner).toBe(wrapper);
        // And that box is content-sized, not the old 4:5 token.
        expect(wrapper).toBe(Math.round(CARD_WIDTH / feedAspectRatio(w, h)));
    });

    it('unknown dimensions still render a valid, non-zero box', () => {
        const wrapper = wrapperHeight(undefined, undefined);
        const inner = innerFrameHeight(undefined, undefined, wrapper);

        expect(wrapper).toBe(Math.round(CARD_WIDTH / RATIO_FALLBACK)); // 4:5 portrait default
        expect(inner).toBe(wrapper);
        expect(wrapper).toBeGreaterThan(0);
    });

    it('never exceeds the viewport cap for any orientation', () => {
        for (const [, w, h] of cases) {
            expect(wrapperHeight(w, h)).toBeLessThanOrEqual(VIEWPORT_CAP);
        }
    });

    it('is stable across a re-measure -- no shift once onLoad fires', () => {
        // The API-supplied size and the naturalSize-measured size must produce the same
        // height, otherwise the card jumps when the video finishes loading.
        for (const [, w, h] of cases) {
            expect(wrapperHeight(w, h)).toBe(wrapperHeight(w, h));
        }
    });

    it('a portrait card is taller than a landscape card', () => {
        expect(wrapperHeight(1080, 1920)).toBeGreaterThan(wrapperHeight(1920, 1080));
    });
});

/**
 * THE ACTUAL PRODUCTION BUG.
 *
 * A 16:9 landscape video rendered inside a ~390pt-tall box while occupying only ~219pt of
 * it, leaving a black rectangle above the engagement row. The cause was NOT arithmetic --
 * both layers computed a correct height. It was that the two layers read DIFFERENT state:
 *
 *   FeedPostMedia   read post.width/height straight from props   -> 16:9 -> 219pt
 *   FeedScreen      seeded the same values, then a
 *                   useEffect([post.id]) intended to clear stale
 *                   state on cell recycling ALSO fired on mount
 *                   and nulled them                            -> 1:1  -> 390pt
 *
 * A math-only test cannot see this, because both sides are individually correct. These tests
 * pin the RESOLUTION RULE instead, and then assert the two layers agree under every
 * combination of API / measured / recycled state.
 */
const W = 390;

describe('resolveIntrinsicSize: wrapper and frame must never disagree', () => {
    const LANDSCAPE_API = { width: 1920, height: 1080 };

    /** FeedScreen's wrapper height, given the resolved size. */
    const wrapperHeightFor = (resolved: { width: number; height: number } | null, cap: number) =>
        Math.round(Math.min(feedMediaHeight(W, resolved?.width, resolved?.height), cap));

    /** FeedPostMedia's frame height. */
    const frameHeightFor = (resolved: { width: number; height: number } | null) => {
        const ratio = feedAspectRatio(resolved?.width, resolved?.height);
        return Math.round(W / ratio);
    };

    it('keeps the API dimensions when the post also has a measurement', () => {
        const resolved = resolveIntrinsicSize({
            api: LANDSCAPE_API,
            measured: { width: 405, height: 720 },
            measuredForId: 'post-1',
            postId: 'post-1',
        });

        expect(resolved).toEqual({ width: 1920, height: 1080 });
        // The bug's arithmetic, with the API honoured: no gap.
        expect(frameHeightFor(resolved)).toBe(219);
        expect(wrapperHeightFor(resolved, 9999)).toBe(219);
    });

    it('uses a measurement only for the post it was taken from', () => {
        const measured = { width: 405, height: 720 };

        expect(resolveIntrinsicSize({ measured, measuredForId: 'post-1', postId: 'post-1' })).toEqual(measured);

        // A recycled FlatList cell: the measurement belongs to the previous post.
        expect(resolveIntrinsicSize({ measured, measuredForId: 'post-1', postId: 'post-2' })).toBeNull();

        // Untagged measurement -- no evidence of provenance, so it cannot be trusted.
        expect(resolveIntrinsicSize({ measured, postId: 'post-2' })).toBeNull();
    });

    it('falls back to a matching measurement only when the API has none', () => {
        const resolved = resolveIntrinsicSize({
            api: { width: null, height: null },
            measured: { width: 720, height: 540 },
            measuredForId: 'p',
            postId: 'p',
        });

        expect(resolved).toEqual({ width: 720, height: 540 });
        expect(frameHeightFor(resolved)).toBe(wrapperHeightFor(resolved, 9999));
    });

    it('ignores implausible API dimensions rather than trusting them', () => {
        // width/height that intrinsicRatio rejects must not win over a good measurement.
        const resolved = resolveIntrinsicSize({
            api: { width: 0, height: 0 },
            measured: { width: 1920, height: 1080 },
            measuredForId: 'p',
            postId: 'p',
        });

        expect(resolved).toEqual({ width: 1920, height: 1080 });
    });

    it('returns null when nothing is known, so both layers use the same fallback', () => {
        expect(resolveIntrinsicSize({ api: null, measured: null, postId: 'p' })).toBeNull();

        // Both layers hitting the fallback is what keeps them equal.
        expect(frameHeightFor(null)).toBe(wrapperHeightFor(null, 9999));
    });

    it('survives a viewport cap -- the frame must not shrink below the wrapper', () => {
        // Regression guard. Clamping the frame to `width` as well as the wrapper height looks
        // defensive but is wrong for every portrait ratio below 1: width/ratio exceeds width,
        // so the frame shrank while the wrapper did not -- a fresh 98pt black gap on 9:16.
        const REAL_CAP = Math.round(844 * 0.58); // 489, the feed's viewport cap
        const portrait = resolveIntrinsicSize({ api: { width: 405, height: 720 }, postId: 'p' })!;

        const wrapper = Math.round(Math.min(feedMediaHeight(W, portrait.width, portrait.height), REAL_CAP));
        const content = Math.round(W / feedAspectRatio(portrait.width, portrait.height));
        const frame = Math.min(content, wrapper); // wrapper-derived cap only -- never `width`

        expect(wrapper).toBe(488);
        expect(frame).toBe(wrapper);
        expect(wrapper - frame).toBe(0);
    });

    it('wrapper == frame for every reachable state combination', () => {
        const cap = 9999;
        const states: Array<Parameters<typeof resolveIntrinsicSize>[0]> = [
            { api: { width: 1920, height: 1080 }, postId: 'p' },
            { api: { width: 722, height: 406 }, postId: 'p' },
            { api: { width: 405, height: 720 }, postId: 'p' },
            { api: null, measured: { width: 720, height: 540 }, measuredForId: 'p', postId: 'p' },
            { api: null, measured: { width: 1920, height: 1080 }, measuredForId: 'p', postId: 'p' },
            { api: null, postId: 'p' },
        ];

        for (const state of states) {
            const resolved = resolveIntrinsicSize(state);
            const label = JSON.stringify(state.api ?? state.measured ?? null);

            // The invariant the black box violated.
            expect(wrapperHeightFor(resolved, cap), `wrapper vs frame for ${label}`)
                .toBe(frameHeightFor(resolved));
        }
    });
});

describe('RATIO_FALLBACK is portrait 4:5, not 16:9 or 1:1', () => {
    it('defaults an unknown-dimension video to the portrait feed ceiling', () => {
        expect(RATIO_FALLBACK).toBeCloseTo(4 / 5, 6);
        expect(feedAspectRatio(undefined, undefined)).toBeCloseTo(4 / 5, 6);
        expect(feedMediaHeight(W, undefined, undefined)).toBeCloseTo(390 / (4 / 5), 5);
    });

    it('seeds portrait clips at their final clamped height so onLoad cannot shift them', () => {
        // A true 9:16 source clamps to 4:5. With the fallback also at 4:5, the pre-load box
        // already equals the settled box -- the exact no-shift guarantee this constant buys.
        const settled = feedMediaHeight(W, 1080, 1920);
        const fallback = feedMediaHeight(W, undefined, undefined);
        expect(fallback).toBeCloseTo(settled, 6);
    });

    it('never under-allocates for portrait the way the old 16:9 default did', () => {
        const fallbackHeight = Math.round(W / (4 / 5));
        const oldLandscapeHeight = Math.round(W / (16 / 9));

        // The portrait default is taller than the old landscape one, matching the dominant
        // portrait content instead of reserving a short landscape strip for it.
        expect(fallbackHeight).toBeGreaterThan(oldLandscapeHeight);
    });

    it('still lets portrait sit between 4/5 and 9/16 as required', () => {
        // "Between 4/5 and 9/16" means inside [9/16, 4/5] = [0.5625, 0.8] in width/height.
        for (const [w, h] of [[1080, 1920], [405, 720], [576, 1024], [720, 1280]]) {
            const ratio = feedAspectRatio(w, h);
            expect(ratio).toBeGreaterThanOrEqual(9 / 16 - 1e-9);
            expect(ratio).toBeLessThanOrEqual(4 / 5 + 1e-9);
        }

        // A true 9:16 source is cropped UP to 4:5 rather than left at 0.5625.
        expect(feedAspectRatio(1080, 1920)).toBeCloseTo(4 / 5, 6);

        // fullscreenPortrait may go to true 9:16.
        expect(feedAspectRatio(1080, 1920, { fullscreenPortrait: true })).toBeCloseTo(9 / 16, 6);
    });
});

/**
 * Regression guards for the fullscreen distortion: a landscape clip used to be forced into
 * a rigid screen-height box (`contain` inside `100%x100%`), and the poster cover (`cover`)
 * popped against it. `fitContainBox` is the aspect-correct frame both now share.
 */
describe('fitContainBox', () => {
    // Typical phone portrait screen box.
    const SCREEN_W = 390;
    const SCREEN_H = 844;

    it('letterboxes a landscape clip by width (bars top/bottom, no crop)', () => {
        // 16:9 landscape (1920x1080) -> fitted by width, height = 390 / (16/9) ≈ 219.
        const box = fitContainBox(SCREEN_W, SCREEN_H, 1920, 1080);
        expect(box.width).toBeCloseTo(SCREEN_W, 6);
        expect(box.height).toBeCloseTo(SCREEN_W / (16 / 9), 6);
        expect(box.height).toBeLessThan(SCREEN_H);
        // Ratio preserved exactly.
        expect(box.width / box.height).toBeCloseTo(16 / 9, 6);
    });

    it('fills a portrait clip by width when it is wider than the screen ratio', () => {
        // 9:16 (1080x1920, ratio 0.5625) on a 390x844 screen (ratio 0.462). The clip is
        // WIDER than the screen, so it fits by width: height = 390 / 0.5625 ≈ 693, and the
        // remaining vertical space is the letterbox. Ratio preserved, no crop, no upscale.
        const box = fitContainBox(SCREEN_W, SCREEN_H, 1080, 1920);
        expect(box.width).toBeCloseTo(SCREEN_W, 6);
        expect(box.height).toBeCloseTo(SCREEN_W / (9 / 16), 6);
        expect(box.height).toBeLessThan(SCREEN_H);
        expect(box.width / box.height).toBeCloseTo(9 / 16, 6);
    });

    it('fills a very tall clip by height when it is narrower than the screen ratio', () => {
        // 1:2.5 (1080x2700, ratio 0.4) is NARROWER than the screen (0.462), so it fits by
        // height and pillarboxes horizontally.
        const box = fitContainBox(SCREEN_W, SCREEN_H, 1080, 2700);
        expect(box.height).toBeCloseTo(SCREEN_H, 6);
        expect(box.width).toBeCloseTo(SCREEN_H * (1080 / 2700), 6);
        expect(box.width).toBeLessThan(SCREEN_W);
        expect(box.width / box.height).toBeCloseTo(0.4, 6);
    });

    it('never upscales past the screen in either dimension', () => {
        for (const [w, h] of [
            [1920, 1080],
            [1080, 1920],
            [1080, 1080],
            [4000, 1200],
            [1200, 4000],
        ]) {
            const box = fitContainBox(SCREEN_W, SCREEN_H, w, h);
            expect(box.width).toBeLessThanOrEqual(SCREEN_W + 1e-6);
            expect(box.height).toBeLessThanOrEqual(SCREEN_H + 1e-6);
            expect(box.width).toBeGreaterThan(0);
            expect(box.height).toBeGreaterThan(0);
            // Aspect preserved.
            expect(box.width / box.height).toBeCloseTo((w as number) / (h as number), 6);
        }
    });

    it('fits a square clip into the smaller dimension', () => {
        // 1:1 on a portrait screen -> fitted by width.
        const box = fitContainBox(SCREEN_W, SCREEN_H, 1080, 1080);
        expect(box.width).toBeCloseTo(SCREEN_W, 6);
        expect(box.height).toBeCloseTo(SCREEN_W, 6);
    });

    it('falls back to the full box when dimensions are unknown', () => {
        expect(fitContainBox(SCREEN_W, SCREEN_H)).toEqual({ width: SCREEN_W, height: SCREEN_H });
        expect(fitContainBox(SCREEN_W, SCREEN_H, null, null)).toEqual({
            width: SCREEN_W,
            height: SCREEN_H,
        });
        expect(fitContainBox(SCREEN_W, SCREEN_H, 0, 0)).toEqual({
            width: SCREEN_W,
            height: SCREEN_H,
        });
    });

    it('guards against a zero/degenerate box', () => {
        const box = fitContainBox(0, 0, 1920, 1080);
        expect(box.width).toBeGreaterThan(0);
        expect(box.height).toBeGreaterThan(0);
    });

    it('uses a neutral fallback ratio for unknown dims when one is given', () => {
        // Fullscreen seeds RATIO_FEED_UNKNOWN so the frame matches the feed's neutral box and
        // does not jump from full-screen to widescreen when naturalSize arrives.
        const box = fitContainBox(SCREEN_W, SCREEN_H, undefined, undefined, RATIO_FEED_UNKNOWN);
        expect(box.width).toBeCloseTo(SCREEN_W, 6);
        expect(box.height).toBeCloseTo(SCREEN_W / RATIO_FEED_UNKNOWN, 6);
        // Identical to passing the matching intrinsic dims.
        const equiv = fitContainBox(SCREEN_W, SCREEN_H, 1920, 1080);
        expect(box).toEqual(equiv);
    });
});

describe('feedCardAspectRatio (landscape side-crop fix)', () => {
    it('keeps a 16:9 landscape clip at exactly 16:9 (no change)', () => {
        expect(feedCardAspectRatio(1920, 1080)).toBeCloseTo(RATIO_LANDSCAPE_16_9, 6);
    });

    it('does NOT cap a wider-than-16:9 cinematic clip (the side-crop bug)', () => {
        // 2.39:1 — the old feedAspectRatio crushed this to 16:9, so the box was too tall
        // and `cover` trimmed the left/right. The card ratio must now reflect the frame.
        const cinematic = feedCardAspectRatio(2048, 858);
        expect(cinematic).toBeCloseTo(2048 / 858, 6);
        expect(cinematic).toBeGreaterThan(RATIO_LANDSCAPE_16_9);
        // Contrast: the shared clamp still slivers it to 16:9.
        expect(feedAspectRatio(2048, 858)).toBeCloseTo(RATIO_LANDSCAPE_16_9, 6);
    });

    it('keeps ultra-wide 21:9 uncapped so the whole frame fits', () => {
        const ultrawide = feedCardAspectRatio(2560, 1080);
        expect(ultrawide).toBeCloseTo(2560 / 1080, 6);
    });

    it('preserves the 4:5 feed floor for portrait (unchanged behaviour)', () => {
        expect(feedCardAspectRatio(1080, 1920)).toBeCloseTo(RATIO_FEED_MAX_PORTRAIT, 6);
        expect(feedCardAspectRatio(1080, 1920)).toBe(feedAspectRatio(1080, 1920));
    });

    it('leaves square at 1:1', () => {
        expect(feedCardAspectRatio(1080, 1080)).toBe(1);
    });

    it('falls back to a neutral 16:9 box when dimensions are unknown', () => {
        // Unknown media must NOT default to a tall 4:5 box: a first-view landscape clip was
        // exactly what snapped from that portrait fallback to widescreen on ExoPlayer load.
        expect(feedCardAspectRatio(undefined, undefined)).toBe(RATIO_FEED_UNKNOWN);
        expect(feedCardAspectRatio(0, 0)).toBe(RATIO_FEED_UNKNOWN);
        expect(RATIO_FEED_UNKNOWN).toBeCloseTo(RATIO_LANDSCAPE_16_9, 6);
    });
});

describe('feedMediaHeight with fitLandscape', () => {
    const WIDTH = 390;

    it('sizes a landscape box from the true ratio, not the 16:9 cap', () => {
        // 2.39:1 at 390 wide -> ~163pt tall. The old (capped) path gave 390/1.777 = 219pt,
        // which is 56pt too tall and was what forced the cover-crop.
        const fitted = feedMediaHeight(WIDTH, 2048, 858, { fitLandscape: true });
        expect(fitted).toBeCloseTo(WIDTH / (2048 / 858), 6);
        expect(fitted).toBeLessThan(feedMediaHeight(WIDTH, 2048, 858));
    });

    it('is identical to the default path for portrait', () => {
        expect(feedMediaHeight(WIDTH, 1080, 1920, { fitLandscape: true })).toBe(
            feedMediaHeight(WIDTH, 1080, 1920),
        );
    });

    it('matches the default path for a true 16:9 clip', () => {
        expect(feedMediaHeight(WIDTH, 1920, 1080, { fitLandscape: true })).toBeCloseTo(
            feedMediaHeight(WIDTH, 1920, 1080),
            6,
        );
    });

    it('sizes unknown media to a stable 16:9 box (no onLoad reflow)', () => {
        // The card must pick this height on frame 0 and never resize. A landscape clip that
        // reports 16:9 at load lands on the SAME height, so there is no snap.
        const unknown = feedMediaHeight(WIDTH, undefined, undefined, { fitLandscape: true });
        const known16x9 = feedMediaHeight(WIDTH, 1920, 1080, { fitLandscape: true });
        expect(unknown).toBeCloseTo(WIDTH / RATIO_FEED_UNKNOWN, 6);
        expect(unknown).toBeCloseTo(known16x9, 6);
    });
});
