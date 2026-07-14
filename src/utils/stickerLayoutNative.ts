/** Keep stickers out of top/bottom chrome on the media preview (matches web). */
export const STICKER_SAFE_ZONE_TOP = 18;
export const STICKER_SAFE_ZONE_BOTTOM = 82;

/** Story composer — header/footer float on media; allow lower placement. */
export const STORY_STICKER_SAFE_ZONE_TOP = 10;
export const STORY_STICKER_SAFE_ZONE_BOTTOM = 90;

export function clampStickerY(
    y: number,
    opts?: { min?: number; max?: number },
): number {
    const min = opts?.min ?? STICKER_SAFE_ZONE_TOP;
    const max = opts?.max ?? STICKER_SAFE_ZONE_BOTTOM;
    return Math.max(min, Math.min(max, y));
}
