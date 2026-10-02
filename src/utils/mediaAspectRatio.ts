/**
 * Intrinsic video/image dimension -> the aspect ratio the feed actually renders at.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every feed card used to size its media box from a fixed token (`4:5`, or `16:9` for
 * landscape) decided *before* anything was decoded. `FeedPostMedia` then discovered the
 * real orientation from `naturalSize` after mount and shrank the inner video, but the
 * OUTER wrapper stayed pinned to the original token height with `height` AND
 * `maxHeight`. The difference rendered as black bars: on a 390x844 device a 16:9 clip
 * occupied ~219px inside a ~487px box, so roughly half the media area was empty black.
 * That is the letterbox this module removes.
 *
 * The fix is to let the intrinsic ratio drive the box, and to clamp it so one very tall
 * or very wide clip cannot blow up the feed.
 *
 * CONVENTION WARNING -- read before using
 * ---------------------------------------
 * This module is width / height (`0.5625` = 9:16 portrait, `1.777` = 16:9 landscape),
 * because that is what RNV reports in `naturalSize` and what `aspectRatio` means in a
 * React Native style.
 *
 * `src/constants/feedUiTokens.ts` uses the OPPOSITE convention, height / width, to match
 * the web feed (`minAspect: 3/4`, `maxAspect: 5/4`). Those two must never be mixed.
 * This module does not import FEED_UI so the inversion lives in exactly one place:
 * `toTokenHeightRatio()` at the bottom converts when crossing over.
 *
 * @module mediaAspectRatio
 */

/** 9:16. The native portrait format this app is built around (Shorts/Reels). */
export const RATIO_PORTRAIT_9_16 = 9 / 16; // 0.5625

/** 1:1. */
export const RATIO_SQUARE = 1;

/** 16:9. */
export const RATIO_LANDSCAPE_16_9 = 16 / 9; // ~1.777

/** 4:5. The maximum height allowed for a standard feed card. */
export const RATIO_FEED_MAX_PORTRAIT = 4 / 5; // 0.8

/**
 * Ratio used before any dimension is known.
 *
 * 16:9, NOT 1:1.
 *
 * A square default is the worst possible guess for feed video. It over-allocates height for
 * a landscape clip (a 390pt-wide card becomes a 390pt-tall box for content that only needs
 * ~219pt) and under-allocates for a portrait clip. Either way the box disagrees with the
 * video, and any surplus shows up as a black gap above the engagement row until `onLoad`
 * corrects it.
 *
 * 16:9 is the standard feed fallback: it is the orientation most camera and screen-capture
 * video defaults to, and it keeps the worst-case gap small. Because `FeedPostSkeleton`
 * imports this same constant, the placeholder and the settled card stay identical, so
 * correcting to the true ratio on load is a reflow of one component rather than a jump
 * between two differently-sized boxes.
 */
export const RATIO_FALLBACK = RATIO_LANDSCAPE_16_9;

/** Guard rails so malformed metadata cannot produce a 0px or infinite box. */
const MIN_SANE_RATIO = 0.1; // ~1:10, absurdly tall
const MAX_SANE_RATIO = 4; // 4:1, absurdly wide

export type MediaOrientation = 'portrait' | 'landscape' | 'square';

/** Raw intrinsic dimensions, as reported by RNV `naturalSize` or the API. */
export type IntrinsicSize = {
    width?: number | null;
    height?: number | null;
};

/**
 * A validated size: both dimensions present, finite and positive.
 *
 * Distinct from {@link IntrinsicSize} so that a resolved size can be used without a null
 * check at every call site -- once {@link intrinsicRatio} has accepted a pair, the numbers
 * are real.
 */
export type ResolvedSize = {
    width: number;
    height: number;
};

/**
 * Intrinsic `width / height`, or null when the dimensions are unusable.
 *
 * Returns null rather than guessing for: missing, null, NaN, Infinity, zero, negative
 * and non-numeric input, plus ratios outside {@link MIN_SANE_RATIO}..{@link MAX_SANE_RATIO}.
 * Callers treat null as "use the fallback" rather than dividing by zero and rendering a
 * zero-height box.
 */
export function intrinsicRatio(width?: number | null, height?: number | null): number | null {
    const w = Number(width);
    const h = Number(height);

    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        return null;
    }

    const ratio = w / h;

    if (!Number.isFinite(ratio) || ratio < MIN_SANE_RATIO || ratio > MAX_SANE_RATIO) {
        return null;
    }

    return ratio;
}

/**
 * Classify by orientation.
 *
 * Uses a small epsilon rather than an exact comparison: a 1080x1081 clip is effectively
 * square, and calling it "portrait" would push it through the portrait clamp and shift
 * the card by a pixel for no reason.
 */
export function orientationOf(
    width?: number | null,
    height?: number | null,
): MediaOrientation | null {
    const ratio = intrinsicRatio(width, height);

    if (ratio == null) {
        return null;
    }

    // ~1.5% band around 1:1.
    if (Math.abs(ratio - RATIO_SQUARE) <= 0.015) {
        return 'square';
    }

    return ratio > RATIO_SQUARE ? 'landscape' : 'portrait';
}

/**
 * The aspect ratio a feed card should render at.
 *
 * Clamp rules, by orientation. Remember this module is width/height, so a SMALLER ratio
 * means a TALLER box -- which is why portrait clamps downward-in-height (upward-in-ratio)
 * and landscape clamps the other way. Getting this backwards is the whole bug:
 *
 * - portrait  -> height capped at 4:5, i.e. ratio floored at {@link RATIO_FEED_MAX_PORTRAIT}.
 *   A raw 9:16 (0.5625) is 1.78x taller than a square card and would push the engagement
 *   row off screen; flooring to 0.8 crops it to 4:5 via `resizeMode="cover"`. That is a
 *   CROP, not a letterbox, and it is intended feed behaviour.
 * - landscape -> width capped at 16:9, i.e. ratio capped at {@link RATIO_LANDSCAPE_16_9},
 *   so a 2.4:1 clip is trimmed instead of being given a letterboxed sliver.
 * - square    -> left at 1:1, no crop.
 *
 * Both bounds are applied only when exceeded. A 3:2 clip stays 3:2 rather than being
 * forced out to 16:9, because widening its box would reintroduce the exact letterbox this
 * module removes.
 *
 * `fullscreenPortrait` lowers the portrait floor to true 9:16 so a full-bleed vertical
 * player shows the whole frame uncropped. Not for feed cards.
 *
 * @returns Always a usable, positive ratio. {@link RATIO_FALLBACK} when the intrinsic
 *          dimensions are missing or implausible.
 */
export function feedAspectRatio(
    width?: number | null,
    height?: number | null,
    options?: { fullscreenPortrait?: boolean },
): number {
    const ratio = intrinsicRatio(width, height);

    if (ratio == null) {
        return RATIO_FALLBACK;
    }

    if (ratio >= RATIO_SQUARE) {
        // Landscape and square. Cap the ratio to keep ultras wide clips from becoming
        // slivers; 16:9 is the widest we allow.
        return Math.min(ratio, RATIO_LANDSCAPE_16_9);
    }

    // Portrait. Floor the ratio, because the box must not exceed 4:5 height.
    const floor = options?.fullscreenPortrait
        ? RATIO_FULLSCREEN_PORTRAIT
        : RATIO_FEED_MAX_PORTRAIT;

    return Math.max(ratio, floor);
}

/** True 9:16, for a full-bleed vertical player that should not clamp. */
export const RATIO_FULLSCREEN_PORTRAIT = RATIO_PORTRAIT_9_16;

/**
 * Concrete pixel height for a card of known width.
 *
 * `height = width / ratio`. The card wrapper measures its width from
 * `useWindowDimensions`, so it needs a height, not a ratio.
 */
export function feedMediaHeight(
    width: number,
    intrinsicWidth?: number | null,
    intrinsicHeight?: number | null,
    options?: { fullscreenPortrait?: boolean },
): number {
    const safeWidth = Number.isFinite(width) && width > 0 ? width : 360;

    return safeWidth / feedAspectRatio(intrinsicWidth, intrinsicHeight, options);
}

/**
 * Prefer server-known dimensions, then measured ones, then the fallback.
 *
 * The ordering exists for layout stability: API dimensions are present on the very first
 * render, so the card is laid out at its final height before any bytes are fetched and
 * there is no shift when `onLoad` finally fires. Measured dimensions cover posts created
 * before the dimensions columns existed.
 */
export function resolveAspectRatio(
    api?: IntrinsicSize | null,
    measured?: IntrinsicSize | null,
): number {
    if (intrinsicRatio(api?.width, api?.height) != null) {
        return feedAspectRatio(api?.width, api?.height);
    }

    if (intrinsicRatio(measured?.width, measured?.height) != null) {
        return feedAspectRatio(measured?.width, measured?.height);
    }

    return RATIO_FALLBACK;
}

/**
 * The single source of truth for "what size is this card's media right now".
 *
 * `FeedScreen` (the outer wrapper) and `FeedPostMedia` (the inner frame) both need this
 * answer, and when they compute it independently they DRIFT APART -- which reintroduces the
 * black gap this module exists to remove. The concrete failure was:
 *
 *   - `FeedPostMedia` read `post.width/height` straight from props -> 16:9 -> 219pt frame.
 *   - `FeedScreen` seeded the same values into state, then a `useEffect([post.id])` intended
 *     to clear stale state on cell recycling ALSO fired on mount and wiped them -> the
 *     wrapper fell back to 1:1 -> 390pt box.
 *   - Result: a 171pt black rectangle under every landscape video.
 *
 * A math-level test cannot catch that, because both layers computed a correct height from
 * the same inputs; the divergence lived in *which* inputs each layer held. So the rule is
 * stated once, here, and shared:
 *
 *   1. API dimensions win. They are present on first render, so the card is already at its
 *      final height before any bytes are fetched -- no shift when `onLoad` fires.
 *   2. Measured dimensions cover posts created before the dimensions columns existed.
 *   3. A measurement is only honoured if it was taken for THIS post. `measuredForId` must
 *      equal `postId`, so a recycled FlatList cell can never inherit its neighbour's size.
 *      This replaces the nulling effect that caused the bug, and makes the leak a type-
 *      level impossibility rather than something to remember.
 *   4. Otherwise null, which callers read as "use {@link RATIO_FALLBACK}".
 */
export function resolveIntrinsicSize(params: {
    /** Dimensions from the API payload for this post. */
    api?: IntrinsicSize | null;
    /** Dimensions measured at runtime (naturalSize / image source). */
    measured?: IntrinsicSize | null;
    /** Which post `measured` was captured for. */
    measuredForId?: string | null;
    /** The post currently being rendered. */
    postId?: string | null;
}): ResolvedSize | null {
    const { api, measured, measuredForId, postId } = params;

    if (intrinsicRatio(api?.width, api?.height) != null) {
        return { width: Number(api!.width), height: Number(api!.height) };
    }

    const measurementIsForThisPost = measuredForId != null && measuredForId === postId;

    if (measurementIsForThisPost && intrinsicRatio(measured?.width, measured?.height) != null) {
        return { width: Number(measured!.width), height: Number(measured!.height) };
    }

    return null;
}

/**
 * Width / height ratio -> the height / width ratio used by `feedUiTokens.ts`.
 *
 * The only sanctioned crossing point between the two conventions. Mixing them silently
 * produces cards 1.56x the intended height (1.25 / 0.8).
 */
export function toTokenHeightRatio(widthOverHeight: number): number {
    const ratio = Number(widthOverHeight);

    if (!Number.isFinite(ratio) || ratio <= 0) {
        return 1 / RATIO_FEED_MAX_PORTRAIT;
    }

    return 1 / ratio;
}