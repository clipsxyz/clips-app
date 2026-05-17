import { getApiBaseUrl } from './apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();

function buildPlacesUrl(path: string, params: Record<string, string>): string {
    const base = API_BASE_URL.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const fullPath = `${base}${normalizedPath}`;
    const url = fullPath.startsWith('http')
        ? new URL(fullPath)
        : new URL(fullPath, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    return url.toString();
}

export type LocationSuggestion = {
    name: string;
    type: 'local' | 'city' | 'country' | 'location' | 'venue' | 'landmark';
    country?: string;
    city?: string;
    local?: string;
    regional?: string;
    national?: string;
    display_name?: string;
    feed_level?: 'local' | 'regional' | 'national';
    place_id?: string | null;
};

export type SignupLocationLevel = 'country' | 'region' | 'local';

export type SearchLocationsOptions = {
    level?: SignupLocationLevel;
    country?: string;
    region?: string;
};

export async function searchLocations(
    query: string,
    limit = 20,
    mode: 'all' | 'location' | 'venue' | 'landmark' = 'all',
    signal?: AbortSignal,
    scope?: SearchLocationsOptions
): Promise<LocationSuggestion[]> {
    const params: Record<string, string> = {
        q: query,
        limit: String(limit),
        mode,
    };
    if (scope?.level) params.level = scope.level;
    if (scope?.country?.trim()) params.country = scope.country.trim();
    if (scope?.region?.trim()) params.region = scope.region.trim();

    const url = buildPlacesUrl('/search/places', params);
    const res = await fetch(url, { signal });
    if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    }

    const legacyUrl = buildPlacesUrl('/locations/search', {
        q: query,
        limit: String(limit),
    });
    const legacyRes = await fetch(legacyUrl, { signal });
    if (!legacyRes.ok) throw new Error('Failed to fetch locations');
    const legacyData = await legacyRes.json();
    return Array.isArray(legacyData) ? legacyData : [];
}
