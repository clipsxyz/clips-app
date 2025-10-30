const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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


