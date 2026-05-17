/** Fallback map image when no custom profile cover is set (matches web ViewProfile fallback). */
export const DEFAULT_PROFILE_COVER_URI =
    'https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg';

export function resolveProfileCoverUri(coverUrl?: string | null): string {
    const trimmed = String(coverUrl || '').trim();
    return trimmed || DEFAULT_PROFILE_COVER_URI;
}

export function hasCustomProfileCover(coverUrl?: string | null): boolean {
    return Boolean(String(coverUrl || '').trim());
}
