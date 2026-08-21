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

/**
 * Follow / unfollow with private-account request semantics.
 * When Laravel is on, always notifies the server; local request state is kept for UI.
 * Private follows require viewerHandle — never silently auto-follow without it.
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
        setFollowState(userId, targetHandle, false);
        if (viewer) removeFollowRequest(viewer, targetHandle);
        if (!isMockMode()) {
            try {
                const result = await apiClient.toggleFollow(targetHandle);
                if (result && typeof result.following === 'boolean') {
                    setFollowState(userId, targetHandle, result.following);
                    return { following: result.following, requested: false };
                }
            } catch {
                // keep local unfollow
            }
        }
        return { following: false, requested: false };
    }

    const profilePrivate = isProfilePrivate(targetHandle);
    if (!profilePrivate) {
        setFollowState(userId, targetHandle, true);
        if (!isMockMode()) {
            try {
                const result = await apiClient.toggleFollow(targetHandle);
                if (result && typeof result.following === 'boolean') {
                    setFollowState(userId, targetHandle, result.following);
                    return { following: result.following, requested: false };
                }
            } catch {
                // keep optimistic follow
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

    if (!isMockMode()) {
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
        } catch {
            // Fall through to local mock request so offline/dev still works.
        }
    }

    createFollowRequest(viewer, targetHandle);
    setFollowState(userId, targetHandle, false);
    return { following: false, requested: true };
}
