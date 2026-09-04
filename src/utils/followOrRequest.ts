import { isMockMode } from '../api/apiMode';
import * as apiClient from '../api/client';
import { setFollowState } from '../api/posts';
import {
    createFollowRequest,
    hasPendingFollowRequest,
    isProfilePrivate,
    removeFollowRequest,
} from '../api/privacy';

export type FollowOrRequestResult = {
    following: boolean;
    requested: boolean;
};

function applyServerFollowResult(
    userId: string,
    targetHandle: string,
    viewer: string,
    result: { following?: boolean; status?: string } | null | undefined,
): FollowOrRequestResult | null {
    if (!result) return null;
    if (result.status === 'pending') {
        if (viewer) createFollowRequest(viewer, targetHandle);
        setFollowState(userId, targetHandle, false);
        return { following: false, requested: true };
    }
    if (result.status === 'accepted' || result.following === true) {
        if (viewer) removeFollowRequest(viewer, targetHandle);
        setFollowState(userId, targetHandle, true);
        return { following: true, requested: false };
    }
    if (result.status === 'unfollowed' || result.following === false) {
        if (viewer) removeFollowRequest(viewer, targetHandle);
        setFollowState(userId, targetHandle, false);
        return { following: false, requested: false };
    }
    return null;
}

/**
 * Follow / unfollow with private-account request semantics.
 * Live API: Laravel is the source of truth. Local cache is updated from the response
 * and rolled back if the request fails — never leave a ghost follow that empties Following.
 */
export async function followOrRequest(opts: {
    userId: string;
    targetHandle: string;
    viewerHandle?: string | null;
    /** Desired following state after the action (true = follow / request, false = unfollow). */
    nextFollowing: boolean;
}): Promise<FollowOrRequestResult> {
    const { userId, targetHandle, viewerHandle, nextFollowing } = opts;
    const viewer = typeof viewerHandle === 'string' ? viewerHandle.trim() : '';

    if (!nextFollowing) {
        if (viewer) removeFollowRequest(viewer, targetHandle);
        if (!isMockMode()) {
            try {
                const result = await apiClient.toggleFollow(targetHandle, false);
                const applied = applyServerFollowResult(userId, targetHandle, viewer, result);
                if (applied) return applied;
                setFollowState(userId, targetHandle, true);
                return { following: true, requested: false };
            } catch (err) {
                setFollowState(userId, targetHandle, true);
                throw err;
            }
        }
        setFollowState(userId, targetHandle, false);
        return { following: false, requested: false };
    }

    const profilePrivate = isProfilePrivate(targetHandle);
    if (!profilePrivate) {
        if (!isMockMode()) {
            try {
                const result = await apiClient.toggleFollow(targetHandle, true);
                const applied = applyServerFollowResult(userId, targetHandle, viewer, result);
                if (applied) return applied;
                setFollowState(userId, targetHandle, false);
                return { following: false, requested: false };
            } catch (err) {
                setFollowState(userId, targetHandle, false);
                throw err;
            }
        }
        setFollowState(userId, targetHandle, true);
        return { following: true, requested: false };
    }

    if (!viewer) {
        setFollowState(userId, targetHandle, false);
        return { following: false, requested: false };
    }

    if (!isMockMode()) {
        try {
            const result = await apiClient.toggleFollow(targetHandle, true);
            const applied = applyServerFollowResult(userId, targetHandle, viewer, result);
            if (applied) return applied;
        } catch {
            // Fall through to local request so offline/dev still works.
        }
    }

    if (hasPendingFollowRequest(viewer, targetHandle)) {
        setFollowState(userId, targetHandle, false);
        return { following: false, requested: true };
    }

    createFollowRequest(viewer, targetHandle);
    setFollowState(userId, targetHandle, false);
    return { following: false, requested: true };
}
