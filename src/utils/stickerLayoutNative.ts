/** Keep stickers out of top/bottom chrome on the media preview (matches web). */
export const STICKER_SAFE_ZONE_TOP = 18;
export const STICKER_SAFE_ZONE_BOTTOM = 82;

/** Story composer — keep stickers above the footer rail so they stay draggable. */
export const STORY_STICKER_SAFE_ZONE_TOP = 12;
export const STORY_STICKER_SAFE_ZONE_BOTTOM = 68;

export function clampStickerY(
    y: number,
    opts?: { min?: number; max?: number },
): number {
    const min = opts?.min ?? STICKER_SAFE_ZONE_TOP;
    const max = opts?.max ?? STICKER_SAFE_ZONE_BOTTOM;
    return Math.max(min, Math.min(max, y));
}
