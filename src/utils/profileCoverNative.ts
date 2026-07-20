import type { ImageSourcePropType } from 'react-native';

/** Bundled default cover — same asset as web `/placeholders/world-map.jpg`. */
export const DEFAULT_PROFILE_COVER_SOURCE: ImageSourcePropType = require('../assets/world-map.jpg');

/** Remote fallback only if a caller still needs a URI string (e.g. uploads preview). */
export const DEFAULT_PROFILE_COVER_URI =
    'https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg';

function normalizeCover(coverUrl?: string | null): string {
    return String(coverUrl || '').trim();
}

/** True when cover is empty or the stock world-map placeholder (not a user upload). */
export function isStockProfileCover(coverUrl?: string | null): boolean {
    const trimmed = normalizeCover(coverUrl);
    if (!trimmed) return true;
    const lower = trimmed.toLowerCase();
    if (lower.includes('world-map.jpg')) return true;
    if (lower.includes('equirectangular_projection')) return true;
    if (lower.startsWith('/placeholders/')) return true;
    if (lower.includes('/placeholders/world-map')) return true;
    return false;
}

export function hasCustomProfileCover(coverUrl?: string | null): boolean {
    return !isStockProfileCover(coverUrl);
}

/** Image `source` for profile cover hero (local map by default). */
export function resolveProfileCoverSource(coverUrl?: string | null): ImageSourcePropType {
    if (isStockProfileCover(coverUrl)) {
        return DEFAULT_PROFILE_COVER_SOURCE;
    }
    return { uri: normalizeCover(coverUrl) };
}

/** URI string helper — prefer `resolveProfileCoverSource` for Image components. */
export function resolveProfileCoverUri(coverUrl?: string | null): string {
    if (isStockProfileCover(coverUrl)) {
        return DEFAULT_PROFILE_COVER_URI;
    }
    return normalizeCover(coverUrl);
}
