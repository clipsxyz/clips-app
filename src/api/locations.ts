import { getRuntimeEnv, getReactNativeDefaultApiBaseUrl } from '../config/runtimeEnv';

function resolveLocationsApiBase(): string {
    const envUrl = getRuntimeEnv('VITE_API_URL');
    if (envUrl) {
        // React Native: avoid localhost API URL on physical devices.
        if (typeof window === 'undefined') {
            try {
                const parsed = new URL(envUrl);
                if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
                    const rn = getReactNativeDefaultApiBaseUrl();
                    if (rn) {
                        const rnParsed = new URL(rn);
                        parsed.protocol = rnParsed.protocol;
                        parsed.hostname = rnParsed.hostname;
                        parsed.port = rnParsed.port;
                        return parsed.toString().replace(/\/$/, '');
                    }
                }
            } catch {
                // Keep original env URL when invalid/relative.
            }
        }
        return envUrl;
    }
    const rn = getReactNativeDefaultApiBaseUrl();
    if (rn) return rn;
    return 'http://localhost:8000/api';
}

const API_BASE_URL = resolveLocationsApiBase();

export type LocationSuggestion = {
    name: string;
    type: 'local' | 'city' | 'country' | 'location' | 'venue' | 'landmark';
    country?: string;
    city?: string;
    place_id?: string | null;
};

export async function searchLocations(
    query: string,
    limit = 20,
    mode: 'all' | 'location' | 'venue' | 'landmark' = 'all'
): Promise<LocationSuggestion[]> {
    const url = new URL(`${API_BASE_URL}/search/places`);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('mode', mode);
    const res = await fetch(url.toString());
    if (res.ok) return res.json();

    // Backward-compat fallback for environments without the new endpoint.
    const legacy = new URL(`${API_BASE_URL}/locations/search`);
    legacy.searchParams.set('q', query);
    legacy.searchParams.set('limit', String(limit));
    const legacyRes = await fetch(legacy.toString());
    if (!legacyRes.ok) throw new Error('Failed to fetch locations');
    return legacyRes.json();
}


