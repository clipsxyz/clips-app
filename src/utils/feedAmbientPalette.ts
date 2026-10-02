/**
 * Ambient canvas palette for the floating feed.
 *
 * WHY THIS EXISTS
 * ---------------
 * The feed used to sit on a single flat page colour (`FEED_PAGE_BG`). With floating
 * cards the margins between them are exposed, and a flat backdrop reads as dead grey.
 * The NOW TV treatment instead tints those exposed margins with a colour sampled from
 * whichever post is currently in focus, so the page breathes as you scroll.
 *
 * WHY IT IS PURE
 * --------------
 * No React Native imports on purpose. This module is called from the viewability
 * callback on the JS thread and from render, so it must stay cheap and it must stay
 * unit-testable under vitest without a native harness. The animated consumer lives in
 * `FeedAmbientCanvas.native.tsx`.
 */

/** Canvas floor — Bluesky-style dim feed canvas. */
export const AMBIENT_BASE_HEX = '#161E2E';

/** Accent used when a post carries no usable dominant/accent colour. */
export const AMBIENT_FALLBACK_HEX = AMBIENT_BASE_HEX;

/** Both `#rgb` and `#rrggbb`/`#rrggbbaa`. Alpha is dropped on read — the canvas is opaque. */
const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function isHexColor(value: unknown): value is string {
    return typeof value === 'string' && HEX_PATTERN.test(value.trim());
}

/**
 * Canonicalise a hex colour to uppercase `#RRGGBB`, expanding `#rgb`.
 * Returns null for anything untrustworthy so callers can fall through the chain —
 * the palette must never emit `undefined` into a Reanimated colour slot, which
 * renders as a hard frame drop rather than a silent no-op.
 */
export function normalizeHex(value: unknown): string | null {
    if (!isHexColor(value)) return null;
    const hex = value.trim().toUpperCase();
    if (hex.length === 4) {
        return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    return hex.slice(0, 7);
}

function parseRgb(value: string): [number, number, number] | null {
    const hex = normalizeHex(value);
    if (!hex) return null;
    return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
    ];
}

function toHex(r: number, g: number, b: number): string {
    const channel = (c: number) =>
        Math.min(255, Math.max(0, Math.round(c)))
            .toString(16)
            .padStart(2, '0')
            .toUpperCase();
    return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Linear RGB mix, `t` clamped to [0, 1]. */
export function mixHex(from: string, to: string, t: number): string {
    const a = parseRgb(from);
    const b = parseRgb(to);
    if (!a || !b) return AMBIENT_BASE_HEX;
    const ratio = Math.min(1, Math.max(0, t));
    return toHex(
        a[0] + (b[0] - a[0]) * ratio,
        a[1] + (b[1] - a[1]) * ratio,
        a[2] + (b[2] - a[2]) * ratio,
    );
}

/**
 * Lift sampled dominants into a mid-luminance band so scroll tint shifts stay obvious
 * behind frosted chrome. Near-black poster samples (#030510, #2C2A26) otherwise read as
 * a static abyss and make the glass bars look solid black.
 */
export function amplifyAmbientAccent(hex: string): string {
    const rgb = parseRgb(hex);
    if (!rgb) return AMBIENT_FALLBACK_HEX;
    let [r, g, b] = rgb;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    // Near-grey / crushed samples: push overall brightness up first.
    if (max < 90) {
        const boost = 90 - max;
        r += boost;
        g += boost;
        b += boost;
    } else if (max - min < 18 && max < 140) {
        const boost = Math.round((140 - max) * 0.55);
        r += boost;
        g += boost;
        b += boost;
    }

    // Enforce a readable mid luminance (~0.34–0.48) while keeping channel ratios.
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (lum < 0.34) {
        const scale = 0.34 / Math.max(lum, 0.02);
        r *= scale;
        g *= scale;
        b *= scale;
    } else if (lum > 0.62) {
        // Keep very bright samples from washing the whole feed white.
        const mix = (lum - 0.62) / 0.38;
        r = r * (1 - mix * 0.35) + 40 * mix * 0.35;
        g = g * (1 - mix * 0.35) + 48 * mix * 0.35;
        b = b * (1 - mix * 0.35) + 64 * mix * 0.35;
    }

    return toHex(r, g, b);
}

/**
 * Loose shape so this works against raw Laravel rows (`dominant_color`) and against
 * already-mapped client posts (`dominantColor`) without either side changing shape.
 */
export type AmbientColorFields = {
    dominant_color?: unknown;
    dominantColor?: unknown;
    accent_color?: unknown;
    accentColor?: unknown;
};

/** Same fields, tolerating an absent post. */
export type AmbientColorSource = AmbientColorFields | null | undefined;

/**
 * Server-supplied accent only, or `null` when the payload carried none.
 *
 * Deliberately distinct from `resolveAmbientAccent`: the canvas needs to tell "the backend
 * sent a colour" apart from "we substituted the fallback", because only the former means
 * there is nothing to sample.
 */
export function resolveServerAmbientAccent(post: AmbientColorSource): string | null {
    if (!post) return null;
    const raw =
        normalizeHex(post.dominant_color) ??
        normalizeHex(post.dominantColor) ??
        normalizeHex(post.accent_color) ??
        normalizeHex(post.accentColor) ??
        null;
    return raw ? amplifyAmbientAccent(raw) : null;
}

/**
 * Dominant colour fallback chain, in spec order:
 *   dominant -> accent -> AMBIENT_FALLBACK_HEX
 *
 * Each candidate is validated before it is accepted, so a malformed payload value
 * falls through to the next candidate instead of poisoning the animation.
 */
export function resolveAmbientAccent(post: AmbientColorSource): string {
    return resolveServerAmbientAccent(post) ?? AMBIENT_FALLBACK_HEX;
}
