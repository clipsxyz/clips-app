export function parseCoord(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
    }
    return null;
}

export function googleMapsSearchUrl(
    latitude?: number | null,
    longitude?: number | null,
    address?: string | null,
): string {
    if (
        typeof latitude === 'number' &&
        Number.isFinite(latitude) &&
        typeof longitude === 'number' &&
        Number.isFinite(longitude)
    ) {
        return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(address || '').trim())}`;
}

export function readBusinessAddress(
    source: Record<string, unknown> | null | undefined,
): { address: string; latitude: number | null; longitude: number | null } | null {
    if (!source) return null;
    const address = String(source.businessAddress ?? source.business_address ?? '').trim();
    if (!address) return null;
    return {
        address,
        latitude: parseCoord(source.latitude),
        longitude: parseCoord(source.longitude),
    };
}
