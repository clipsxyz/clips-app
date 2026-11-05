import { isLaravelApiEnabled } from '../config/runtimeEnv';
import * as apiClient from '../api/client';
import { setFollowState } from '../api/posts';
import {
    createFollowRequest,
    hasPendingFollowRequest,
    isProfilePrivate,
    removeFollowRequest,
} from '../api/privacy';
import { emitFollowStatusChanged } from '../hooks/useFollowState';

export type FollowOrRequestResult = {
    following: boolean;
    requested: boolean;
};

/**
 * Follow / unfollow with private-account request semantics.
 * When Laravel is on, always notifies the server; local request state is kept for UI.
 * Private follows require viewerHandle — never silently auto-follow without it.
 */
export async function followOrRequest(opts: {
    userId: string;
    targetHandle: string;
    viewerHandle?: string | null;
    /** Author user id (optional) — used to key global follow-state broadcasts. */
    targetUserId?: string;
    /** Desired following state after the action (true = follow / request, false = unfollow). */
    nextFollowing: boolean;
    /** When true, a failed Laravel follow call rejects instead of keeping the optimistic result. */
    surfaceErrors?: boolean;
}): Promise<FollowOrRequestResult> {
    const result = await runFollowOrRequest(opts);
    // Broadcast so feed headers / quick menus / DM gates update globally.
    emitFollowStatusChanged({
        userId: opts.targetUserId,
        handle: opts.targetHandle,
        isFollowing: result.following,
        hasPendingRequest: result.requested,
    });
    return result;
}

async function runFollowOrRequest(opts: {
    userId: string;
    targetHandle: string;
    viewerHandle?: string | null;
    nextFollowing: boolean;
    surfaceErrors?: boolean;
}): Promise<FollowOrRequestResult> {
    const { userId, targetHandle, viewerHandle, nextFollowing, surfaceErrors } = opts;
    const fail = (err: unknown): never => {
        setFollowState(userId, targetHandle, !nextFollowing);
        throw err instanceof Error ? err : new Error('Could not update follow');
    };
    const viewer = typeof viewerHandle === 'string' ? viewerHandle.trim() : '';

    if (!nextFollowing) {
        setFollowState(userId, targetHandle, false);
        if (viewer) removeFollowRequest(viewer, targetHandle);
        if (isLaravelApiEnabled()) {
            try {
                const result = await apiClient.toggleFollow(targetHandle);
                if (result && typeof result.following === 'boolean') {
                    setFollowState(userId, targetHandle, result.following);
                    if (surfaceErrors && result.following !== false) {
                        throw new Error('Could not update follow');
                    }
                    return { following: result.following, requested: false };
                }
                if (surfaceErrors) throw new Error('Could not update follow');
            } catch (err) {
                if (surfaceErrors) fail(err);
            }
        }
        return { following: false, requested: false };
    }

    const profilePrivate = isProfilePrivate(targetHandle);
    if (!profilePrivate) {
        setFollowState(userId, targetHandle, true);
        if (isLaravelApiEnabled()) {
            try {
                const result = await apiClient.toggleFollow(targetHandle);
                if (result && typeof result.following === 'boolean') {
                    setFollowState(userId, targetHandle, result.following);
                    if (surfaceErrors && result.following !== true && result.status !== 'pending') {
                        throw new Error('Could not update follow');
                    }
                    return {
                        following: result.following,
                        requested: result.status === 'pending',
                    };
                }
                if (surfaceErrors) throw new Error('Could not update follow');
            } catch (err) {
                if (surfaceErrors) fail(err);
            }
        }
        return { following: true, requested: false };
    }

    // Private target: must have a viewer handle to request follow.
    if (!viewer) {
        setFollowState(userId, targetHandle, false);
        return { following: false, requested: false };
    }

    if (hasPendingFollowRequest(viewer, targetHandle)) {
        setFollowState(userId, targetHandle, false);
        return { following: false, requested: true };
    }

    if (isLaravelApiEnabled()) {
        try {
            const result = await apiClient.toggleFollow(targetHandle);
            if (result?.status === 'pending') {
                createFollowRequest(viewer, targetHandle);
                setFollowState(userId, targetHandle, false);
                return { following: false, requested: true };
            }
            if (result?.status === 'accepted' || result?.following === true) {
                setFollowState(userId, targetHandle, true);
                removeFollowRequest(viewer, targetHandle);
                return { following: true, requested: false };
            }
            if (result?.status === 'unfollowed' || result?.following === false) {
                setFollowState(userId, targetHandle, false);
                removeFollowRequest(viewer, targetHandle);
                return { following: false, requested: false };
            }
            if (surfaceErrors) throw new Error('Could not update follow');
        } catch (err) {
            if (surfaceErrors) fail(err);
            // Fall through to local mock request so offline/dev still works.
        }
    }

    createFollowRequest(viewer, targetHandle);
    setFollowState(userId, targetHandle, false);
    return { following: false, requested: true };
}
