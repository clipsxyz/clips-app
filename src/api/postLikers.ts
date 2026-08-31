import { isMockMode } from '../config/runtimeEnv';
import * as apiClient from './client';
import { isFrontendOnlyPostId } from './posts';
import { followOrRequest } from '../utils/followOrRequest';
import { resolvePublicMediaUrl } from './apiBaseUrl';

export type PostLiker = {
    handle: string;
    display_name?: string;
    avatar_url?: string;
    is_following?: boolean;
};

export type PostLikersResult = {
    items: PostLiker[];
    likes_count: number;
    views_count: number;
    fromApi: boolean;
};

function emptyResult(likeCount: number, viewCount: number): PostLikersResult {
    return {
        items: [],
        likes_count: Math.max(0, likeCount),
        views_count: Math.max(0, viewCount),
        fromApi: false,
    };
}

function mapLiker(row: {
    handle?: string;
    display_name?: string;
    avatar_url?: string;
    is_following?: boolean;
}): PostLiker | null {
    const handle = typeof row?.handle === 'string' ? row.handle.trim() : '';
    if (!handle) return null;
    const rawAvatar = typeof row.avatar_url === 'string' ? row.avatar_url.trim() : '';
    return {
        handle,
        display_name: typeof row.display_name === 'string' ? row.display_name : undefined,
        avatar_url: rawAvatar ? resolvePublicMediaUrl(rawAvatar) || rawAvatar : undefined,
        is_following: row.is_following === true,
    };
}

/** Fetch users who liked a post. Never invents mock handles. */
export async function fetchPostLikers(
    postId: string,
    userId: string,
    likeCount: number,
    viewCount = 0,
): Promise<PostLikersResult> {
    if (likeCount <= 0 || isFrontendOnlyPostId(postId) || isMockMode()) {
        return emptyResult(likeCount, viewCount);
    }

    try {
        const response = await apiClient.fetchPostLikes(postId, {
            userId,
            limit: Math.min(100, Math.max(likeCount, 1)),
        });
        const rawItems = Array.isArray(response?.items) ? response.items : [];
        const items: PostLiker[] = rawItems
            .map(mapLiker)
            .filter((row: PostLiker | null): row is PostLiker => row != null);

        return {
            items,
            likes_count: Number(response?.likes_count ?? likeCount) || 0,
            views_count: Number(response?.views_count ?? viewCount) || 0,
            fromApi: true,
        };
    } catch (error) {
        console.warn('fetchPostLikers: API failed', error);
        return emptyResult(likeCount, viewCount);
    }
}

/** Toggle follow from likes sheet with local + API sync. Respects private accounts. */
export async function toggleFollowFromLikesSheet(
    userId: string,
    handle: string,
    nextFollowing: boolean,
    viewerHandle?: string,
): Promise<{ following: boolean; requested: boolean }> {
    return followOrRequest({
        userId,
        targetHandle: handle,
        viewerHandle,
        nextFollowing,
    });
}
