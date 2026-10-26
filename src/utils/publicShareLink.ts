export type PublicShareLink =
    | { kind: 'post'; token?: string; postId?: string }
    | { kind: 'story'; handle: string; storyId: string };

function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function splitPathAndQuery(pathOrUrl: string, search?: string): { pathname: string; query: string } {
    let pathname = pathOrUrl.trim();
    let query = search || '';
    try {
        if (/^https?:\/\//i.test(pathname) || /^[a-z][a-z0-9+.-]*:\/\//i.test(pathname)) {
            const url = new URL(pathname);
            pathname = url.pathname;
            if (!query && url.search) query = url.search;
        }
    } catch {
        /* relative path from native linking */
    }
    if (pathname.includes('?') && !query) {
        const cut = pathname.indexOf('?');
        query = pathname.slice(cut);
        pathname = pathname.slice(0, cut);
    }
    if (query && !query.startsWith('?')) query = `?${query}`;
    return { pathname, query };
}

/**
 * Parse a WhatsApp / web share URL into a guest-viewable post or story target.
 * Accepts full URLs or React Navigation paths (`p/:token`, `stories?user=&story=`).
 */
export function parsePublicShareLink(pathOrUrl: string, search?: string): PublicShareLink | null {
    if (!pathOrUrl && !search) return null;
    const { pathname, query } = splitPathAndQuery(pathOrUrl || '', search);
    const parts = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
    if (parts[0] === 'p' && parts[1]) {
        return { kind: 'post', token: safeDecode(parts[1]) };
    }
    if (parts[0] === 'post' && parts[1]) {
        return { kind: 'post', postId: safeDecode(parts[1]) };
    }
    if (parts[0] === 'stories') {
        const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
        const handle = safeDecode((params.get('user') || '').trim());
        const storyId = safeDecode((params.get('story') || '').trim());
        if (handle && storyId) return { kind: 'story', handle, storyId };
    }
    return null;
}

export function isGuestSharePath(pathname: string, search?: string): boolean {
    return parsePublicShareLink(pathname, search) != null;
}
