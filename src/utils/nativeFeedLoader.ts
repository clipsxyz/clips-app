import { fetchPostsPage, isDevMockFeedVideoPost } from '../api/posts';
import { isUserBlocked } from '../api/messages';
import { isLaravelApiEnabled, isReactNativeRuntime } from '../config/runtimeEnv';
import type { Post } from '../types';
import {
    filterPostsByContentPrefs,
    type FeedContentPrefs,
} from './feedContentPrefsMobile';
import { getArchivedFeedPostIdsMobile } from './feedEngagementPrefsMobile';

export type NativeFeedFetchParams = {
    filter: string;
    cursor: string | number | null;
    limit?: number;
    viewerUserId: string;
    viewerHandle?: string;
    userLocal?: string;
    userRegional?: string;
    userNational?: string;
    prefs: FeedContentPrefs;
};

type FilterVisibleOpts = {
    viewerUserId: string;
    viewerHandle?: string;
    prefs: FeedContentPrefs;
    /** Reuse across page walks — avoids repeated AsyncStorage reads on RN. */
    archivedIds?: Set<string>;
};

export async function filterVisibleFeedPosts(
    items: Post[],
    opts: FilterVisibleOpts,
): Promise<Post[]> {
    let visible = items;
    if (opts.viewerHandle) {
        const checks = await Promise.all(
            items.map(async (item) => ({
                item,
                blocked: await isUserBlocked(opts.viewerHandle!, item.userHandle),
            })),
        );
        visible = checks.filter((row) => !row.blocked).map((row) => row.item);
    }
    const archivedIds =
        opts.archivedIds ?? (await getArchivedFeedPostIdsMobile(opts.viewerUserId));
    visible = visible.filter((item) => !archivedIds.has(item.id));
    return filterPostsByContentPrefs(visible, opts.prefs, {
        isProtectedDevMockVideo: isDevMockFeedVideoPost,
    });
}

export async function fetchVisibleFeedPage(
    params: NativeFeedFetchParams,
    archivedIds?: Set<string>,
): Promise<{ items: Post[]; nextCursor: string | number | null }> {
    const page = await fetchPostsPage(
        params.filter,
        params.cursor,
        params.limit ?? 8,
        params.viewerUserId,
        params.userLocal ?? '',
        params.userRegional ?? '',
        params.userNational ?? '',
        params.viewerHandle ?? '',
    );
    const items = await filterVisibleFeedPosts(page.items, {
        viewerUserId: params.viewerUserId,
        viewerHandle: params.viewerHandle,
        prefs: params.prefs,
        archivedIds,
    });
    return { items, nextCursor: page.nextCursor ?? null };
}

const INITIAL_FEED_PAGE_WALK_MAX = isReactNativeRuntime() ? 6 : 24;

/** Walk mock/API pages until we find visible posts or hit the end. */
export async function fetchInitialVisibleFeed(
    params: Omit<NativeFeedFetchParams, 'cursor'>,
): Promise<{ items: Post[]; nextCursor: string | number | null }> {
    const archivedIds = await getArchivedFeedPostIdsMobile(params.viewerUserId);

    // Mock/dev on device: one larger page is enough; skip slow multi-page walks.
    if (!isLaravelApiEnabled()) {
        return fetchVisibleFeedPage(
            { ...params, cursor: 0, limit: 16 },
            archivedIds,
        );
    }

    let cursor: string | number | null = 0;
    for (let step = 0; step < INITIAL_FEED_PAGE_WALK_MAX; step += 1) {
        const page = await fetchVisibleFeedPage({ ...params, cursor }, archivedIds);
        if (page.items.length > 0) {
            return page;
        }
        if (page.nextCursor == null) {
            return { items: [], nextCursor: null };
        }
        cursor = page.nextCursor;
    }
    return { items: [], nextCursor: null };
}
