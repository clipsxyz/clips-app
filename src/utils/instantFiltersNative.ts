import type { ViewStyle } from 'react-native';

export const INSTANT_FILTER_NAMES = ['None', 'B&W', 'Sepia', 'Vivid', 'Cool', 'Vignette', 'Beauty'] as const;

export type InstantFilterName = (typeof INSTANT_FILTER_NAMES)[number];

export type InstantFilterInfo = {
    active: InstantFilterName;
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
    exportFailed?: boolean;
};

export function buildFilterInfo(active: InstantFilterName): InstantFilterInfo {
    return {
        active,
        brightness: 1,
        contrast: 1,
        saturation: 1,
        hue: 0,
        exportFailed: false,
    };
}

export function isFiltered(info?: InstantFilterInfo | null): boolean {
    if (!info) return false;
    return info.active !== 'None';
}

/** FFmpeg video filter chain approximating the RN overlay previews. */
export function getFfmpegVideoFilter(filterName: InstantFilterName): string | null {
    switch (filterName) {
        case 'None':
            return null;
        case 'B&W':
            return 'hue=s=0';
        case 'Sepia':
            return 'colorchannelmixer=0.393:0.769:0.189:0:0.349:0.686:0.168:0:0.272:0.534:0.131';
        case 'Vivid':
            return 'eq=saturation=1.45:contrast=1.12';
        case 'Cool':
            return 'eq=saturation=1.15:gamma_b=1.1';
        case 'Vignette':
            return 'vignette=angle=PI/4';
        case 'Beauty':
            return 'eq=brightness=0.04:saturation=1.08';
        default:
            return null;
    }
}

/** Preview-only overlay on top of Image/Video (not baked into export). */
export function getFilterOverlayStyle(filterName: InstantFilterName): ViewStyle | null {
    switch (filterName) {
        case 'None':
            return null;
        case 'B&W':
            return { backgroundColor: 'rgba(120, 120, 120, 0.42)' };
        case 'Sepia':
            return { backgroundColor: 'rgba(112, 66, 20, 0.38)' };
        case 'Vivid':
            return { backgroundColor: 'rgba(255, 180, 0, 0.18)' };
        case 'Cool':
            return { backgroundColor: 'rgba(80, 140, 255, 0.28)' };
        case 'Vignette':
            return {
                backgroundColor: 'transparent',
                borderWidth: 24,
                borderColor: 'rgba(0, 0, 0, 0.55)',
            };
        case 'Beauty':
            return { backgroundColor: 'rgba(255, 192, 203, 0.22)' };
        default:
            return null;
    }
}
