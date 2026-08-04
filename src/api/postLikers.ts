import { isLaravelApiEnabled } from '../config/runtimeEnv';
import * as apiClient from './client';
import { isFrontendOnlyPostId } from './posts';
import { followOrRequest } from '../utils/followOrRequest';
import {
    generateFeedLikerHandles,
    getFollowingSetForHandles,
} from '../utils/feedLikesSheet';
import { getAvatarForHandle } from './users';

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

function mockLikers(userId: string, likeCount: number): PostLikersResult {
    const handles = generateFeedLikerHandles(likeCount);
    const following = getFollowingSetForHandles(userId, handles);
    return {
        items: handles.map((handle) => ({
            handle,
            avatar_url: getAvatarForHandle(handle) || undefined,
            is_following: following.has(handle),
        })),
        likes_count: likeCount,
        views_count: 0,
        fromApi: false,
    };
}

/** Fetch users who liked a post; uses Laravel API when available, mock fallback otherwise. */
export async function fetchPostLikers(
    postId: string,
    userId: string,
    likeCount: number,
    viewCount = 0,
): Promise<PostLikersResult> {
    if (likeCount <= 0) {
        return { items: [], likes_count: 0, views_count: viewCount, fromApi: false };
    }

    if (isFrontendOnlyPostId(postId) || !isLaravelApiEnabled()) {
        const mock = mockLikers(userId, likeCount);
        return { ...mock, views_count: viewCount || mock.views_count };
    }

    try {
        const response = await apiClient.fetchPostLikes(postId, {
            userId,
            limit: Math.min(100, likeCount),
        });
        const items: PostLiker[] = (response?.items || []).map(
            (row: {
                handle?: string;
                display_name?: string;
                avatar_url?: string;
                is_following?: boolean;
            }) => ({
                handle: row.handle || '',
                display_name: row.display_name,
                avatar_url: row.avatar_url || getAvatarForHandle(row.handle || '') || undefined,
                is_following: row.is_following === true,
            }),
        ).filter((row: PostLiker) => row.handle);

        if (items.length > 0) {
            return {
                items,
                likes_count: response.likes_count ?? likeCount,
                views_count: response.views_count ?? viewCount,
                fromApi: true,
            };
        }
    } catch (error) {
        console.warn('fetchPostLikers: API failed, using mock fallback', error);
    }

    const mock = mockLikers(userId, likeCount);
    return { ...mock, views_count: viewCount || mock.views_count };
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
