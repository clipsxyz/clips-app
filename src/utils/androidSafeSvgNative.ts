import { PixelRatio, Platform } from 'react-native';

/** Android Canvas rejects oversized bitmaps (~100MB+); stay well under. */
const MAX_SVG_BITMAP_BYTES = 24 * 1024 * 1024;

function maxLogicalSide(): number {
    if (Platform.OS !== 'android') return Number.POSITIVE_INFINITY;
    const scale = Math.max(1, PixelRatio.get());
    // side² * 4 * scale² <= MAX
    return Math.floor(Math.sqrt(MAX_SVG_BITMAP_BYTES / 4) / scale);
}

/** Clamp a square SVG side length for Android density-safe bitmaps. */
export function clampSvgSide(logicalPx: number, fallback = 1): number {
    const n = Number.isFinite(logicalPx) && logicalPx > 0 ? logicalPx : fallback;
    if (Platform.OS !== 'android') return n;
    return Math.min(n, Math.max(64, maxLogicalSide()));
}

/**
 * Clamp a rectangular SVG so width*height at device density stays under the bitmap budget.
 * Returns render size + scale factors to stretch back to the layout box.
 */
export function clampSvgBox(width: number, height: number): {
    svgWidth: number;
    svgHeight: number;
    scaleX: number;
    scaleY: number;
} {
    const w = Number.isFinite(width) && width > 0 ? width : 1;
    const h = Number.isFinite(height) && height > 0 ? height : 1;
    if (Platform.OS !== 'android') {
        return { svgWidth: w, svgHeight: h, scaleX: 1, scaleY: 1 };
    }
    const scale = Math.max(1, PixelRatio.get());
    const maxArea = MAX_SVG_BITMAP_BYTES / 4 / (scale * scale);
    const area = w * h;
    if (area <= maxArea) {
        return { svgWidth: w, svgHeight: h, scaleX: 1, scaleY: 1 };
    }
    const factor = Math.sqrt(maxArea / area);
    const svgWidth = Math.max(1, Math.floor(w * factor));
    const svgHeight = Math.max(1, Math.floor(h * factor));
    return {
        svgWidth,
        svgHeight,
        scaleX: w / svgWidth,
        scaleY: h / svgHeight,
    };
}

export function shouldSkipHeavySvg(width: number, height: number): boolean {
    if (Platform.OS !== 'android') return false;
    const scale = Math.max(1, PixelRatio.get());
    return width * height * scale * scale * 4 > MAX_SVG_BITMAP_BYTES * 1.5;
}
