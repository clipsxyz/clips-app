/** Keep stickers out of top/bottom chrome on the media preview (matches web). */
export const STICKER_SAFE_ZONE_TOP = 18;
export const STICKER_SAFE_ZONE_BOTTOM = 82;

export function clampStickerY(y: number): number {
    return Math.max(STICKER_SAFE_ZONE_TOP, Math.min(STICKER_SAFE_ZONE_BOTTOM, y));
}
