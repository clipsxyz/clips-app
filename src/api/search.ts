import { apiRequest } from './client';
import { isMockMode } from '../config/runtimeEnv';
import { resolvePublicMediaUrl } from './apiBaseUrl';
import { setAvatarForHandle } from './users';

export type SearchSections = {
    users?: { items: any[]; nextCursor: number | string | null; hasMore?: boolean };
    locations?: { items: any[]; nextCursor: number | string | null; hasMore?: boolean };
    posts?: { items: any[]; nextCursor: number | string | null; hasMore?: boolean };
};

// Mock users for testing (Sarah, Bob, Ava, Clips24)
const mockUsers = [
    {
        id: 'sarah-artane-1',
        username: 'sarah',
        display_name: 'Sarah',
        handle: 'Sarah@Artane',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop'
    },
    {
        id: 'bob-artane-1',
        username: 'bob',
        display_name: 'Bob',
        handle: 'Bob@Artane',
        avatar_url: undefined
    },
    {
        id: 'ava-dublin-1',
        username: 'ava',
        display_name: 'Ava',
        handle: 'Ava@Dublin',
        avatar_url: undefined
    },
    {
        id: 'clips24-1',
        username: 'clips24',
        display_name: 'Clips 24',
        handle: 'Clips24',
        avatar_url: undefined
    }
];

function compactSearchText(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Client-side match aligned with Laravel user search (handle, @prefix, place, username). */
export function userMatchesSearchQuery(
    user: {
        handle?: string;
        display_name?: string;
        displayName?: string;
        username?: string;
        local?: string;
        regional?: string;
        national?: string;
        location_local?: string;
        location_regional?: string;
        location_national?: string;
    },
    rawQuery: string,
): boolean {
    const needle = String(rawQuery || '').trim().replace(/^@+/, '').toLowerCase();
    if (!needle) return false;
    const compactNeedle = compactSearchText(needle);
    const fields = [
        user.handle,
        user.display_name,
        user.displayName,
        user.username,
        user.local,
        user.regional,
        user.national,
        user.location_local,
        user.location_regional,
        user.location_national,
    ]
        .filter(Boolean)
        .map((v) => String(v));
    const hay = fields.join(' ').toLowerCase();
    if (hay.includes(needle)) return true;
    if (user.handle && user.handle.toLowerCase().startsWith(`${needle}@`)) return true;
    if (compactNeedle.length >= 2) {
        const compactHay = compactSearchText(fields.join(''));
        if (compactHay.includes(compactNeedle)) return true;
    }
    return false;
}

function asItemList(value: unknown): any[] {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>);
    return [];
}

function withResolvedUserAvatars(result: { q: string; sections: SearchSections }) {
    const items = asItemList(result.sections?.users?.items);
    if (!result.sections?.users) return result;
    result.sections.users.items = items.map((u: any) => {
        const raw = u?.avatar_url || u?.avatarUrl;
        const resolved = typeof raw === 'string' && raw.trim() ? resolvePublicMediaUrl(raw.trim()) || raw.trim() : undefined;
        if (u?.handle && resolved) {
            setAvatarForHandle(u.handle, resolved);
        }
        return resolved ? { ...u, avatar_url: resolved, avatarUrl: resolved } : u;
    });
    return result;
}

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
    const useLaravelAPI = !isMockMode();

    const searchParams = new URLSearchParams();
    const q = String(params.q || '').trim().replace(/^@+/, '');
    searchParams.set('q', q);
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

        const result = await apiRequest(`/search?${searchParams.toString()}`, {
            method: 'GET',
            timeoutMs: 12000,
        }) as { q: string; sections: SearchSections };

        if (result?.sections?.users) {
            result.sections.users.items = asItemList(result.sections.users.items);
        }
        
        // Add Sarah@Artane to search results if query matches (for testing)
        const qLower = q.toLowerCase();
        if (result.sections?.users && (qLower.includes('sarah') || qLower.includes('artane') || qLower.includes('sarah@artane'))) {
            const existingHandles = new Set(result.sections.users.items.map((u: any) => u.handle?.toLowerCase()));
            if (!existingHandles.has('sarah@artane')) {
                // Add Sarah@Artane to the beginning of results
                result.sections.users.items = [mockUsers[0], ...result.sections.users.items];
            }
        }
        
        return withResolvedUserAvatars(result);
    } catch (error) {
        console.warn('[unifiedSearch] live search failed', error);
        const qLower = q.toLowerCase();
        if (params.types?.includes('users')) {
            const filteredUsers = mockUsers.filter((u) => userMatchesSearchQuery(u, qLower));

            if (filteredUsers.length > 0) {
                return {
                    q: params.q,
                    sections: {
                        users: {
                            items: filteredUsers,
                            nextCursor: null
                        }
                    }
                };
            }
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


