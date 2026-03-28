import { getRuntimeEnv, getReactNativeDefaultApiBaseUrl } from '../config/runtimeEnv';

function resolveLocationsApiBase(): string {
    const envUrl = getRuntimeEnv('VITE_API_URL');
    if (envUrl) return envUrl;
    const rn = getReactNativeDefaultApiBaseUrl();
    if (rn) return rn;
    return 'http://localhost:8000/api';
}

const API_BASE_URL = resolveLocationsApiBase();

export type LocationSuggestion = {
    name: string;
    type: 'local' | 'city' | 'country';
    country?: string;
    city?: string;
};

export async function searchLocations(query: string, limit = 20): Promise<LocationSuggestion[]> {
    const url = new URL(`${API_BASE_URL}/locations/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(limit));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Failed to fetch locations');
    return res.json();
}


