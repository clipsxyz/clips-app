export type BoostStoreDuration = 6 | 12 | 24 | 72;

/** Product IDs that match Google Play Console and App Store Connect. */
export const BOOST_STORE_SKUS: Record<BoostStoreDuration, string> = {
    6: 'gazetteer.boost.6h',
    12: 'gazetteer.boost.12h',
    24: 'gazetteer.boost.24h',
    72: 'gazetteer.boost.72h',
};

export function boostStoreSku(durationHours: number): string | null {
    if (durationHours === 6 || durationHours === 12 || durationHours === 24 || durationHours === 72) {
        return BOOST_STORE_SKUS[durationHours];
    }
    return null;
}
