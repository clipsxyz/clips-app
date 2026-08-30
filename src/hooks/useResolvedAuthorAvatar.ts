import { useEffect, useState } from 'react';
import { getAvatarForHandle, resolveAvatarImageUri, setAvatarForHandle } from '../api/users';
import { isMockMode } from '../config/runtimeEnv';

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

function handleKey(handle: string): string {
    return handle.replace(/^@/, '').trim().toLowerCase();
}

const audienceAvatarInflight = new Map<string, Promise<string | undefined>>();
const audienceAvatarMiss = new Set<string>();

function fetchAudienceAvatar(handle: string): Promise<string | undefined> {
    const key = handleKey(handle);
    if (!key || audienceAvatarMiss.has(key)) return Promise.resolve(undefined);
    const existing = audienceAvatarInflight.get(key);
    if (existing) return existing;
    const pending = import('../api/client')
        .then(({ fetchProfileAudience }) => fetchProfileAudience(handle))
        .then((audience) => {
            const raw = String(audience?.avatar_url || '').trim();
            if (!raw) {
                audienceAvatarMiss.add(key);
                return undefined;
            }
            const url = resolveAvatarImageUri(raw, handle);
            if (!url) {
                audienceAvatarMiss.add(key);
                return undefined;
            }
            setAvatarForHandle(handle, url);
            return url;
        })
        .catch((error) => {
            if (error && typeof error === 'object' && Number((error as { status?: number }).status) === 429) {
                audienceAvatarMiss.add(key);
            }
            return undefined;
        })
        .finally(() => {
            audienceAvatarInflight.delete(key);
        });
    audienceAvatarInflight.set(key, pending);
    return pending;
}

/**
 * Feed/fullscreen author avatar. Resolves `/storage/...` to a loadable URL
 * and fetches the cheap audience payload once if the post omitted `userAvatarUrl`.
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
        if (resolved || !handle || isMockMode()) return;
        let cancelled = false;
        void fetchAudienceAvatar(handle).then((url) => {
            if (!url || cancelled) return;
            setFetchedUrl(url);
        });
        return () => {
            cancelled = true;
        };
    }, [handle, resolved]);

    return resolved;
}
