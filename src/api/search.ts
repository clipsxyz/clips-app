export type SearchSections = {
    users?: { items: any[]; nextCursor: number | null };
    locations?: { items: any[]; nextCursor: number | null };
    posts?: { items: any[]; nextCursor: number | null };
};

// Mock users for testing (Sarah@Artane)
const mockUsers = [
    {
        id: 'sarah-artane-1',
        username: 'sarah',
        display_name: 'Sarah',
        handle: 'Sarah@Artane',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop'
    }
];

export async function unifiedSearch(params: {
    q: string;
    types?: string; // 'users,locations,posts'
    usersCursor?: number;
    locationsCursor?: number;
    postsCursor?: number;
    usersLimit?: number;
    locationsLimit?: number;
    postsLimit?: number;
}) {
    const useLaravelAPI =
        typeof import.meta !== 'undefined' &&
        (import.meta as any).env?.VITE_USE_LARAVEL_API !== 'false';

    const searchParams = new URLSearchParams();
    searchParams.set('q', params.q);
    if (params.types) searchParams.set('types', params.types);
    if (params.usersCursor != null) searchParams.set('usersCursor', String(params.usersCursor));
    if (params.locationsCursor != null) searchParams.set('locationsCursor', String(params.locationsCursor));
    if (params.postsCursor != null) searchParams.set('postsCursor', String(params.postsCursor));
    if (params.usersLimit != null) searchParams.set('usersLimit', String(params.usersLimit));
    if (params.locationsLimit != null) searchParams.set('locationsLimit', String(params.locationsLimit));
    if (params.postsLimit != null) searchParams.set('postsLimit', String(params.postsLimit));

    try {
        // When backend API is disabled (mock mode), skip the network call entirely
        // so dev server doesn't spam ECONNREFUSED proxy errors.
        if (!useLaravelAPI) {
            throw new Error('Laravel API disabled via VITE_USE_LARAVEL_API=false');
        }

        const resp = await fetch(`/api/search?${searchParams.toString()}`);
        
        // Check if response is JSON
        const contentType = resp.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('API returned non-JSON response');
        }
        
        if (!resp.ok) {
            throw new Error(`Search failed with status ${resp.status}`);
        }
        
        const result = await resp.json() as { q: string; sections: SearchSections };
        
        // Add Sarah@Artane to search results if query matches (for testing)
        const qLower = params.q.toLowerCase();
        if (result.sections?.users && (qLower.includes('sarah') || qLower.includes('artane') || qLower.includes('sarah@artane'))) {
            const existingHandles = new Set(result.sections.users.items.map((u: any) => u.handle?.toLowerCase()));
            if (!existingHandles.has('sarah@artane')) {
                // Add Sarah@Artane to the beginning of results
                result.sections.users.items = [mockUsers[0], ...result.sections.users.items];
            }
        }
        
        return result;
    } catch (error) {
        // Fallback: return mock results if API fails (for testing)
        const qLower = params.q.toLowerCase();
        if (params.types?.includes('users') && (qLower.includes('sarah') || qLower.includes('artane') || qLower.includes('sarah@artane'))) {
            return {
                q: params.q,
                sections: {
                    users: {
                        items: mockUsers,
                        nextCursor: null
                    }
                }
            };
        }
        
        // Return empty results instead of throwing error
        return {
            q: params.q,
            sections: {
                users: {
                    items: [],
                    nextCursor: null
                }
            }
        };
    }
}


