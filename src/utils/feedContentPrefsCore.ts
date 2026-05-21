import type { Post } from '../types';

export type FeedContentPrefs = {
    mutedHandles: Set<string>;
    blockedHandles: Set<string>;
    hiddenPostIds: Set<string>;
    notInterestedPostIds: Set<string>;
};

export type FeedContentPrefsPayload = {
    muted_handles?: string[];
    blocked_handles?: string[];
    hidden_post_ids?: string[];
    not_interested_post_ids?: string[];
    mutedHandles?: string[];
    blockedHandles?: string[];
    hiddenPostIds?: string[];
    notInterestedPostIds?: string[];
};

export function normalizeFeedHandle(handle: string): string {
    return String(handle || '').replace(/^@/, '').trim().toLowerCase();
}

export function payloadToFeedContentPrefs(payload: FeedContentPrefsPayload): FeedContentPrefs {
    const pick = (...keys: Array<string[] | undefined>): Set<string> => {
        const out = new Set<string>();
        for (const arr of keys) {
            if (!Array.isArray(arr)) continue;
            for (const raw of arr) {
                if (typeof raw !== 'string' || !raw.trim()) continue;
                const normalized = normalizeFeedHandle(raw);
                if (normalized) out.add(normalized);
            }
        }
        return out;
    };
    const pickIds = (...keys: Array<string[] | undefined>): Set<string> => {
        const out = new Set<string>();
        for (const arr of keys) {
            if (!Array.isArray(arr)) continue;
            for (const raw of arr) {
                const id = String(raw || '').trim();
                if (id) out.add(id);
            }
        }
        return out;
    };
    return {
        mutedHandles: pick(payload.muted_handles, payload.mutedHandles),
        blockedHandles: pick(payload.blocked_handles, payload.blockedHandles),
        hiddenPostIds: pickIds(payload.hidden_post_ids, payload.hiddenPostIds),
        notInterestedPostIds: pickIds(payload.not_interested_post_ids, payload.notInterestedPostIds),
    };
}

export function mergeFeedContentPrefs(local: FeedContentPrefs, remote: FeedContentPrefs): FeedContentPrefs {
    return {
        mutedHandles: new Set([...local.mutedHandles, ...remote.mutedHandles]),
        blockedHandles: new Set([...local.blockedHandles, ...remote.blockedHandles]),
        hiddenPostIds: new Set([...local.hiddenPostIds, ...remote.hiddenPostIds]),
        notInterestedPostIds: new Set([...local.notInterestedPostIds, ...remote.notInterestedPostIds]),
    };
}

export function shouldFilterFeedPost(post: Post, prefs: FeedContentPrefs): boolean {
    const handle = normalizeFeedHandle(post.userHandle || '');
    if (handle && (prefs.mutedHandles.has(handle) || prefs.blockedHandles.has(handle))) return true;
    if (post.id && prefs.hiddenPostIds.has(post.id)) return true;
    if (post.id && prefs.notInterestedPostIds.has(post.id)) return true;
    return false;
}

export function filterPostsByContentPrefs(posts: Post[], prefs: FeedContentPrefs): Post[] {
    return posts.filter((p) => !shouldFilterFeedPost(p, prefs));
}
