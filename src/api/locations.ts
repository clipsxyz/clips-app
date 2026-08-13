import { getApiBaseUrl } from './apiBaseUrl';
import { isLaravelApiEnabled } from '../config/runtimeEnv';

function buildPlacesUrl(path: string, params: Record<string, string>): string {
    // Resolve per call — RN module-load can race SourceCode.scriptURL / Metro host.
    const base = getApiBaseUrl().replace(/\/$/, '');
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

/** Mirrors laravel `storage/app/data/locations.json` + popular Discover seeds for offline RN. */
const LOCAL_GAZETTEER: LocationSuggestion[] = [
    { name: 'Finglas', type: 'local', country: 'Ireland', city: 'Dublin', local: 'Finglas', regional: 'Dublin', national: 'Ireland', display_name: 'Finglas' },
    { name: 'Artane', type: 'local', country: 'Ireland', city: 'Dublin', local: 'Artane', regional: 'Dublin', national: 'Ireland', display_name: 'Artane' },
    { name: 'Dublin', type: 'city', country: 'Ireland', regional: 'Dublin', national: 'Ireland', display_name: 'Dublin' },
    { name: 'Cork', type: 'city', country: 'Ireland', regional: 'Cork', national: 'Ireland', display_name: 'Cork' },
    { name: 'Galway', type: 'city', country: 'Ireland', regional: 'Galway', national: 'Ireland', display_name: 'Galway' },
    { name: 'Limerick', type: 'city', country: 'Ireland', regional: 'Limerick', national: 'Ireland', display_name: 'Limerick' },
    { name: 'Paris', type: 'city', country: 'France', regional: 'Paris', national: 'France', display_name: 'Paris' },
    { name: 'London', type: 'city', country: 'United Kingdom', regional: 'London', national: 'United Kingdom', display_name: 'London' },
    { name: 'Manchester', type: 'city', country: 'United Kingdom', regional: 'Manchester', national: 'United Kingdom', display_name: 'Manchester' },
    { name: 'Berlin', type: 'city', country: 'Germany', regional: 'Berlin', national: 'Germany', display_name: 'Berlin' },
    { name: 'Amsterdam', type: 'city', country: 'Netherlands', regional: 'Amsterdam', national: 'Netherlands', display_name: 'Amsterdam' },
    { name: 'Rome', type: 'city', country: 'Italy', regional: 'Rome', national: 'Italy', display_name: 'Rome' },
    { name: 'Madrid', type: 'city', country: 'Spain', regional: 'Madrid', national: 'Spain', display_name: 'Madrid' },
    { name: 'Lisbon', type: 'city', country: 'Portugal', regional: 'Lisbon', national: 'Portugal', display_name: 'Lisbon' },
    { name: 'New York', type: 'city', country: 'United States', regional: 'New York', national: 'United States', display_name: 'New York' },
    { name: 'Los Angeles', type: 'city', country: 'United States', regional: 'Los Angeles', national: 'United States', display_name: 'Los Angeles' },
    { name: 'Toronto', type: 'city', country: 'Canada', regional: 'Toronto', national: 'Canada', display_name: 'Toronto' },
    { name: 'Tokyo', type: 'city', country: 'Japan', regional: 'Tokyo', national: 'Japan', display_name: 'Tokyo' },
    { name: 'Seoul', type: 'city', country: 'South Korea', regional: 'Seoul', national: 'South Korea', display_name: 'Seoul' },
    { name: 'Sydney', type: 'city', country: 'Australia', regional: 'Sydney', national: 'Australia', display_name: 'Sydney' },
    { name: 'Singapore', type: 'city', country: 'Singapore', regional: 'Singapore', national: 'Singapore', display_name: 'Singapore' },
    { name: 'Ireland', type: 'country', national: 'Ireland', display_name: 'Ireland' },
    { name: 'France', type: 'country', national: 'France', display_name: 'France' },
    { name: 'United Kingdom', type: 'country', national: 'United Kingdom', display_name: 'United Kingdom' },
    { name: 'Wembley Stadium', type: 'venue', country: 'United Kingdom', display_name: 'Wembley Stadium' },
    { name: '3Arena', type: 'venue', country: 'Ireland', display_name: '3Arena' },
    { name: 'Croke Park', type: 'venue', country: 'Ireland', display_name: 'Croke Park' },
    { name: 'Eiffel Tower', type: 'landmark', country: 'France', display_name: 'Eiffel Tower' },
    { name: 'Big Ben', type: 'landmark', country: 'United Kingdom', display_name: 'Big Ben' },
    { name: 'Colosseum', type: 'landmark', country: 'Italy', display_name: 'Colosseum' },
];

export function searchLocalGazetteer(
    query: string,
    limit: number,
    mode: 'all' | 'location' | 'venue' | 'landmark',
): LocationSuggestion[] {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];

    const scored = LOCAL_GAZETTEER.map((item) => {
        if (mode !== 'all') {
            const t = item.type;
            if (mode === 'location' && (t === 'venue' || t === 'landmark')) return null;
            if (mode === 'venue' && t !== 'venue') return null;
            if (mode === 'landmark' && t !== 'landmark') return null;
        }
        const name = item.name.toLowerCase();
        const country = (item.country || '').toLowerCase();
        const city = (item.city || '').toLowerCase();
        const isPrefix = name.startsWith(q) || country.startsWith(q) || city.startsWith(q);
        const isIncludes = name.includes(q) || country.includes(q) || city.includes(q);
        if (!isPrefix && !isIncludes) return null;
        return { item, score: isPrefix ? 0 : 1 };
    }).filter(Boolean) as Array<{ item: LocationSuggestion; score: number }>;

    scored.sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name));
    return scored.slice(0, limit).map((s) => s.item);
}

export async function searchLocations(
    query: string,
    limit = 20,
    mode: 'all' | 'location' | 'venue' | 'landmark' = 'all',
    signal?: AbortSignal,
    scope?: SearchLocationsOptions
): Promise<LocationSuggestion[]> {
    const localInstant = searchLocalGazetteer(query, limit, mode);

    // Mock / offline: never wait on Laravel — dropdown should feel instant on RN.
    if (!isLaravelApiEnabled()) {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
        return localInstant;
    }

    const params: Record<string, string> = {
        q: query,
        limit: String(limit),
        mode,
    };
    if (scope?.level) params.level = scope.level;
    if (scope?.country?.trim()) params.country = scope.country.trim();
    if (scope?.region?.trim()) params.region = scope.region.trim();

    // Keep network wait short so typing stays responsive when API is down.
    const timeoutMs = 1500;
    const timeoutCtrl = new AbortController();
    const onAbort = () => timeoutCtrl.abort();
    const timer = setTimeout(onAbort, timeoutMs);
    if (signal) {
        if (signal.aborted) {
            clearTimeout(timer);
            throw new DOMException('Aborted', 'AbortError');
        }
        signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
        const url = buildPlacesUrl('/search/places', params);
        const res = await fetch(url, { signal: timeoutCtrl.signal });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) return data;
        } else {
            const legacyUrl = buildPlacesUrl('/locations/search', {
                q: query,
                limit: String(limit),
            });
            const legacyRes = await fetch(legacyUrl, { signal: timeoutCtrl.signal });
            if (legacyRes.ok) {
                const legacyData = await legacyRes.json();
                if (Array.isArray(legacyData) && legacyData.length > 0) return legacyData;
            }
        }
    } catch (e) {
        if (signal?.aborted) throw e;
        // Timeout / network / wrong host — fall through to local gazetteer
    } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
    }

    if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    return localInstant;
}
