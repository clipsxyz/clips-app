import { useEffect, useMemo, useState } from 'react';
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

    const defaults = useMemo<FollowStateValue>(
        () => ({
            isFollowing: opts.isFollowing === true,
            hasPendingRequest: opts.hasPendingRequest === true,
        }),
        [opts.isFollowing, opts.hasPendingRequest],
    );

    const [state, setState] = useState<FollowStateValue>(() => {
        const cached = handle ? cache.get(handle) : undefined;
        if (cached) {
            return {
                isFollowing: cached.isFollowing === true,
                hasPendingRequest: cached.hasPendingRequest === true,
            };
        }
        return defaults;
    });

    // Adopt fresh props when no broadcast has been seen for this handle yet
    // (pull-to-refresh refetches, remounts after viewer change, etc).
    useEffect(() => {
        if (handle && cache.has(handle)) return;
        setState(defaults);
    }, [defaults, handle]);

    useEffect(() => {
        if (!handle) return undefined;
        return onFollowStatusChanged((payload) => {
            if (!matchesHook(payload, handle, userId)) return;
            setState({
                isFollowing: payload.isFollowing === true,
                hasPendingRequest: payload.hasPendingRequest === true,
            });
        });
    }, [handle, userId]);

    return state;
}