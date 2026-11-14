import { useEffect, useState } from 'react';
import { emitStoriesRefresh } from '../utils/storiesRefreshNative';

/**
 * Global follow-state event bus.
 *
 * Follow/unfollow toggles anywhere in the app (View Profile, feed quick-actions,
 * suggested-follower cards, likers modal) broadcast a FollowStatusPayload through
 * `emitFollowStatusChanged`. Feed headers, quick menus and profile rows subscribe
 * via `useFollowState` so they react to changes for their author's handle without
 * waiting for a refetch.
 *
 * Matching is by normalized handle (lowercase, no leading '@'); a non-empty userId
 * on both sides is used as a secondary guard. The latest emission per handle is
 * cached so components mounted *after* a toggle still show the fresh state.
 */

export type FollowStatusPayload = {
    /** Author user id (optional — feed posts usually carry `post.user_id`). */
    userId?: string | number | null;
    /** Author handle, e.g. `@Barry@Galway` or `Barry@Galway`. */
    handle: string;
    isFollowing: boolean;
    hasPendingRequest?: boolean;
};

export type FollowStateValue = {
    isFollowing: boolean;
    hasPendingRequest: boolean;
};

type FollowStatusListener = (payload: FollowStatusPayload) => void;

const listeners = new Set<FollowStatusListener>();
const cache = new Map<string, FollowStatusPayload>();

function normalizeHandle(handle: string): string {
    return String(handle || '')
        .trim()
        .replace(/^@+/, '')
        .toLowerCase();
}

/** Broadcast a follow-state change for an author to every subscriber. */
export function emitFollowStatusChanged(payload: FollowStatusPayload): void {
    const key = normalizeHandle(payload.handle);
    if (!key) return;
    const entry: FollowStatusPayload = { ...payload, handle: key };
    cache.set(key, entry);
    listeners.forEach((listener) => listener(entry));
    // Follow graph changed — Stories 24 must refetch so the new author appears
    // on every location feed without waiting for the (often-disabled) poll.
    emitStoriesRefresh();
}

/** Subscribe to follow-state changes. Returns an unsubscribe function. */
export function onFollowStatusChanged(listener: FollowStatusListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Drop every cached entry (e.g. after a viewer switch / logout). */
export function clearFollowStatusCache(): void {
    cache.clear();
}

function matchesHook(payload: FollowStatusPayload, handle: string, userId: string): boolean {
    if (payload.handle !== handle) return false;
    const payloadUserId = payload.userId != null ? String(payload.userId) : '';
    return !userId || !payloadUserId || userId === payloadUserId;
}

/**
 * Subscribe to live follow state for a single author.
 *
 * The effective state is the last broadcast for the handle when one exists,
 * otherwise it falls back to the caller's props (e.g. a frozen `post.isFollowing`).
 */
export function useFollowState(opts: {
    userId?: string | number | null;
    handle?: string | null;
    isFollowing?: boolean;
    hasPendingRequest?: boolean;
}): FollowStateValue {
    const handle = normalizeHandle(opts.handle || '');
    const userId = opts.userId != null ? String(opts.userId) : '';

    const [, setVersion] = useState(0);

    useEffect(() => {
        if (!handle) return undefined;
        return onFollowStatusChanged((payload) => {
            if (!matchesHook(payload, handle, userId)) return;
            setVersion((version) => version + 1);
        });
    }, [handle, userId]);

    // Read the shared cache during render so every card for this person shows the
    // same label. A per-card copy was staying on Following after a later post had
    // already moved the author back to Follow.
    const cached = handle ? cache.get(handle) : undefined;
    if (cached && matchesHook(cached, handle, userId)) {
        return {
            isFollowing: cached.isFollowing === true,
            hasPendingRequest: cached.hasPendingRequest === true,
        };
    }

    return {
        isFollowing: opts.isFollowing === true,
        hasPendingRequest: opts.hasPendingRequest === true,
    };
}