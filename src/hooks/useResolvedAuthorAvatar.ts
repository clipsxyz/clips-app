import { useEffect, useState } from 'react';
import { getAvatarForHandle, resolveAvatarImageUri, setAvatarForHandle } from '../api/users';

function sameHandle(a?: string | null, b?: string | null): boolean {
    const na = String(a || '')
        .replace(/^@/, '')
        .trim()
        .toLowerCase();
    const nb = String(b || '')
        .replace(/^@/, '')
        .trim()
        .toLowerCase();
    return Boolean(na && nb && na === nb);
}

/**
 * Feed/fullscreen author avatar. Resolves `/storage/...` to a loadable URL
 * and fetches the profile once if the post was cached without `userAvatarUrl`.
 */
export function useResolvedAuthorAvatar(opts: {
    handle?: string | null;
    explicitUrl?: string | null;
    viewerHandle?: string | null;
    viewerAvatarUrl?: string | null;
}): string | undefined {
    const { handle, explicitUrl, viewerHandle, viewerAvatarUrl } = opts;
    const ownUrl = sameHandle(handle, viewerHandle) ? viewerAvatarUrl : undefined;
    const [fetchedUrl, setFetchedUrl] = useState<string | undefined>();
    const resolved = resolveAvatarImageUri(
        explicitUrl || ownUrl || fetchedUrl || getAvatarForHandle(handle),
        handle,
    );

    useEffect(() => {
        if (resolved || !handle) return;
        let cancelled = false;
        void import('../api/client')
            .then(({ fetchUserProfile }) => fetchUserProfile(handle))
            .then((payload: any) => {
                const raw = String(payload?.avatar_url || payload?.avatarUrl || '').trim();
                if (!raw || cancelled) return;
                const url = resolveAvatarImageUri(raw, handle);
                if (!url) return;
                setAvatarForHandle(handle, url);
                setFetchedUrl(url);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [handle, resolved]);

    return resolved;
}
