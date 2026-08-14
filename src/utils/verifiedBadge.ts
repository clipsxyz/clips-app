/** Instagram-style verified tick: white = personal, blue = business. */

export type VerifiedAccountType = 'personal' | 'business';

export const VERIFIED_BADGE_BLUE = '#0095F6';
export const VERIFIED_BADGE_PERSONAL_BG = '#FFFFFF';
export const VERIFIED_BADGE_PERSONAL_CHECK = '#0F172A';

export function resolveVerifiedAccountType(
    accountType?: string | null,
): VerifiedAccountType {
    return String(accountType || '')
        .trim()
        .toLowerCase() === 'business'
        ? 'business'
        : 'personal';
}
