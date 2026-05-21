import type { StickerOverlay } from '../types';

const FEED_STICKER_SCALE = 0.6;

/** Match web feed TextCard / Media sticker positioning (scaled down, spread if centered). */
export function adjustStickersForFeedDisplay(stickers: StickerOverlay[]): StickerOverlay[] {
    return stickers.map((overlay, index) => {
        let adjustedX = overlay.x;
        let adjustedY = overlay.y;
        if (overlay.x >= 45 && overlay.x <= 55 && overlay.y >= 45 && overlay.y <= 55) {
            const total = stickers.length;
            const angle = (index / total) * Math.PI * 2;
            adjustedX = 50 + Math.cos(angle) * 30;
            adjustedY = 50 + Math.sin(angle) * 30;
            adjustedX = Math.max(15, Math.min(85, adjustedX));
            adjustedY = Math.max(15, Math.min(85, adjustedY));
        }
        return {
            ...overlay,
            scale: overlay.scale * FEED_STICKER_SCALE,
            x: adjustedX,
            y: adjustedY,
        };
    });
}
