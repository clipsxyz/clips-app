/** Instagram / X–style verified seal: white = personal, blue = business. */

export type VerifiedAccountType = 'personal' | 'business';

/** Instagram business blue */
export const VERIFIED_BADGE_BLUE = '#0095F6';
export const VERIFIED_BADGE_PERSONAL_FILL = '#FFFFFF';
export const VERIFIED_BADGE_PERSONAL_CHECK = '#0F172A';
/** Soft edge so a white seal stays visible on light cards */
export const VERIFIED_BADGE_PERSONAL_STROKE = 'rgba(15, 23, 42, 0.18)';

/**
 * Scalloped verified seal (Material / IG / X style), viewBox 0 0 24 24.
 * Outer badge only — check is drawn separately.
 */
export const VERIFIED_SEAL_PATH =
    'M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82 1.89 3.2L12 21.04l3.4 1.46 1.89-3.2 3.61-.82-.34-3.7L23 12z';

/** Checkmark inset in the seal, viewBox 0 0 24 24 */
export const VERIFIED_CHECK_PATH =
    'M10.09 16.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z';

export function resolveVerifiedAccountType(
    accountType?: string | null,
): VerifiedAccountType {
    return String(accountType || '')
        .trim()
        .toLowerCase() === 'business'
        ? 'business'
        : 'personal';
}
