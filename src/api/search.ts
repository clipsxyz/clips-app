export type SearchSections = {
    users?: { items: any[]; nextCursor: number | null };
    locations?: { items: any[]; nextCursor: number | null };
    posts?: { items: any[]; nextCursor: number | null };
};

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

    const resp = await fetch(`/api/search?${searchParams.toString()}`);
    if (!resp.ok) throw new Error('Search failed');
    return (await resp.json()) as { q: string; sections: SearchSections };
}


