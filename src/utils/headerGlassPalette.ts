import { normalizeHex } from './feedAmbientPalette';

/**
 * Vibrant accents the feed header cycles through as cards reach the top.
 *
 * Fixed rather than sampled from each post's `dominant_color` so consecutive cards always
 * land on clearly distinct hues — a server-extracted colour often lands on two near
 * identical dark tones back to back, which reads as "the header stopped working".
 */
export const HEADER_GLASS_PALETTE = [
    '#FF4D6D', // 0: Vivid Pink
    '#7209B7', // 1: Deep Purple
    '#FFB703', // 2: Warm Amber
    '#F72585', // 3: Neon Magenta
    '#00B4D8', // 4: Vivid Cyan
    '#10B981', // 5: Emerald Green
    '#4338CA', // 6: Deep Indigo
    '#FF6B35', // 7: Sunset Orange
    '#00F5D4', // 8: Bright Turquoise
    '#E11D48', // 9: Crimson Red
    '#84CC16', // 10: Lime Green
    '#3A86EF', // 11: Electric Sky Blue
] as const;

/**
 * Neutral header tint, used whenever no palette colour applies.
 *
 * Matches the feed canvas floor rather than `AMBIENT_BASE_HEX` (which is a blue-teal) so
 * an un-tinted header melts into the backdrop instead of laying a cool cast over the
 * vibrant palette.
 */
export const HEADER_GLASS_NEUTRAL = '#0B0E14';

/**
 * Palette colour for a post's ordinal position in the feed, cycling through the ramp.
 *
 * Ordinal is the count of *posts* above this card, not the row index — the flattened list
 * interleaves non-post rows (Stories, interests, suggested places) whose positions shift
 * as the feed loads, which would make the same post change colour between renders.
 * A negative ordinal falls back to the first entry rather than indexing out of bounds.
 */
export function headerGlassColorAt(ordinal: number): string {
    const count = HEADER_GLASS_PALETTE.length;
    if (!Number.isFinite(ordinal)) return HEADER_GLASS_PALETTE[0];
    const index = Math.trunc(ordinal) % count;
    return HEADER_GLASS_PALETTE[index < 0 ? index + count : index];
}

/**
 * Convert `#RRGGBB` to `rgba(r, g, b, alpha)`.
 *
 * Concatenating a hex suffix (`hex + 'CC'`) is unsafe here: 8-digit hex is not reliably
 * parsed by Reanimated's `interpolateColor` or by `react-native-linear-gradient` on every
 * Android API level, and a bad colour silently drops the gradient instead of throwing.
 * `rgba()` is accepted everywhere in this stack. Unparseable input returns null so the
 * caller can keep its previous tint instead of flashing an invalid colour.
 */
export function hexToRgba(hex: string, alpha: number): string | null {
    const normalized = normalizeHex(hex);
    if (!normalized) return null;
    const r = parseInt(normalized.slice(1, 3), 16);
    const g = parseInt(normalized.slice(3, 5), 16);
    const b = parseInt(normalized.slice(5, 7), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    const a = Math.min(1, Math.max(0, alpha));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}
