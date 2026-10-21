import { apiRequest } from './client';
import { getRuntimeEnv, isMockMode } from '../config/runtimeEnv';

export type SearchSections = {
    users?: { items: any[]; nextCursor: number | string | null; hasMore?: boolean };
    locations?: { items: any[]; nextCursor: number | string | null; hasMore?: boolean };
    posts?: { items: any[]; nextCursor: number | string | null; hasMore?: boolean };
};

export type SearchUser = {
    handle: string;
    displayName?: string;
    avatarUrl?: string;
    username?: string;
};

/** Flatten Laravel `/search` user payloads into a stable client list. */
export function parseSearchUsers(result: unknown): SearchUser[] {
    const root = result && typeof result === 'object' ? (result as Record<string, any>) : {};
    const nested = root.sections?.users?.items
        ?? root.data?.sections?.users?.items
        ?? root.users?.items
        ?? root.data?.users
        ?? root.items
        ?? root.users;
    const list = Array.isArray(nested) ? nested : Array.isArray(root) ? root : [];
    return list
        .map((u: any) => {
            const row = u?.user && typeof u.user === 'object' ? u.user : u;
            const handle = String(row?.handle || row?.userHandle || '').trim();
            const displayName = String(
                row?.display_name || row?.displayName || row?.name || handle,
            ).trim();
            return {
                handle,
                displayName: displayName || undefined,
                avatarUrl: row?.avatar_url || row?.avatarUrl || undefined,
                username: row?.username ? String(row.username) : undefined,
            };
        })
        .filter((u: SearchUser) => !!u.handle);
}

function useLiveSearchApi(): boolean {
    if (isMockMode()) return false;
    if (getRuntimeEnv('VITE_USE_LARAVEL_API') === 'false') return false;
    return true;
}

function emptySearchResult(q: string): { q: string; sections: SearchSections } {
    return {
        q,
        sections: {
            users: { items: [], nextCursor: null },
        },
    };
}

/** In-memory directory used only when `EXPO_PUBLIC_USE_MOCK=true` / Laravel is explicitly off. */
const mockUsers = [
    {
        id: 'sarah-artane-1',
        username: 'sarah',
        display_name: 'Sarah',
        handle: 'Sarah@Artane',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    },
    {
        id: 'bob-artane-1',
        username: 'bob',
        display_name: 'Bob',
        handle: 'Bob@Artane',
        avatar_url: undefined,
    },
    {
        id: 'ava-dublin-1',
        username: 'ava',
        display_name: 'Ava',
        handle: 'Ava@Dublin',
        avatar_url: undefined,
    },
    {
        id: 'clips24-1',
        username: 'clips24',
        display_name: 'Clips 24',
        handle: 'Clips24',
        avatar_url: undefined,
    },
];

function mockUserSearch(q: string): { q: string; sections: SearchSections } {
    const qLower = q.toLowerCase();
    const items = mockUsers.filter((u) => {
        return (
            u.handle.toLowerCase().includes(qLower) ||
            (u.display_name && u.display_name.toLowerCase().includes(qLower)) ||
            (u.username && u.username.toLowerCase().includes(qLower))
        );
    });
    return {
        q,
        sections: {
            users: { items, nextCursor: null },
        },
    };
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
    const searchParams = new URLSearchParams();
    searchParams.set('q', params.q);
    if (params.types) searchParams.set('types', params.types);
    if (params.usersCursor != null) searchParams.set('usersCursor', String(params.usersCursor));
    if (params.locationsCursor != null) searchParams.set('locationsCursor', String(params.locationsCursor));
    if (params.postsCursor != null) searchParams.set('postsCursor', String(params.postsCursor));
    if (params.usersLimit != null) searchParams.set('usersLimit', String(params.usersLimit));
    if (params.locationsLimit != null) searchParams.set('locationsLimit', String(params.locationsLimit));
    if (params.postsLimit != null) searchParams.set('postsLimit', String(params.postsLimit));

    if (!useLiveSearchApi()) {
        if (params.types?.includes('users') || !params.types) {
            return mockUserSearch(params.q);
        }
        return emptySearchResult(params.q);
    }

    try {
        return (await apiRequest(`/search?${searchParams.toString()}`, {
            method: 'GET',
            timeoutMs: 6000,
        })) as { q: string; sections: SearchSections };
    } catch {
        return emptySearchResult(params.q);
    }
}
