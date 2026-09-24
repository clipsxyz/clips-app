import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { Post } from '../types';
import { queryKeys } from '../api/queryClient';
import {
    fetchInitialVisibleFeed,
    fetchVisibleFeedPage,
    type NativeFeedFetchParams,
} from '../utils/nativeFeedLoader';
import type { FeedContentPrefs } from '../utils/feedContentPrefsMobile';

export type HomeFeedPage = {
    items: Post[];
    nextCursor: string | number | null;
    followingCount?: number;
};

export type HomeFeedQueryInput = {
    filter: string;
    viewerUserId: string;
    viewerHandle?: string;
    userLocal?: string;
    userRegional?: string;
    userNational?: string;
    /** Prefs are read inside queryFn via getter so mute/hide updates don't thrash the key. */
    getPrefs: () => FeedContentPrefs;
    enabled?: boolean;
};

const EMPTY_WALK_MAX = 6;

async function fetchHomeFeedPage(
    input: HomeFeedQueryInput,
    pageParam: string | number,
): Promise<HomeFeedPage> {
    const base: Omit<NativeFeedFetchParams, 'cursor'> = {
        filter: input.filter,
        viewerUserId: input.viewerUserId,
        viewerHandle: input.viewerHandle,
        userLocal: input.userLocal,
        userRegional: input.userRegional,
        userNational: input.userNational,
        prefs: input.getPrefs(),
        limit: 16,
    };

    const isFirst =
        pageParam === 0 ||
        pageParam === '0' ||
        pageParam === '' ||
        pageParam == null;

    if (isFirst) {
        return fetchInitialVisibleFeed(base);
    }

    let walkCursor: string | number | null = pageParam;
    let followingCount: number | undefined;
    for (let step = 0; step < EMPTY_WALK_MAX; step += 1) {
        const page = await fetchVisibleFeedPage({ ...base, cursor: walkCursor });
        if (typeof page.followingCount === 'number') followingCount = page.followingCount;
        if (page.items.length > 0) {
            return { ...page, followingCount };
        }
        if (page.nextCursor == null) {
            return { items: [], nextCursor: null, followingCount };
        }
        walkCursor = page.nextCursor;
    }
    return { items: [], nextCursor: null, followingCount };
}

export function homeFeedQueryKey(input: Pick<HomeFeedQueryInput, 'filter' | 'viewerUserId' | 'viewerHandle'>) {
    return queryKeys.homeFeed(input.filter, input.viewerUserId, input.viewerHandle);
}

/**
 * Cursor-based Instagram-style home feed pagination via React Query.
 * `getNextPageParam` reads Laravel `nextCursor`; pages flatten in the consumer.
 */
export function useHomeFeedInfinite(input: HomeFeedQueryInput) {
    const queryKey = homeFeedQueryKey(input);
    const getPrefs = input.getPrefs;

    const query = useInfiniteQuery({
        queryKey,
        enabled: input.enabled !== false && Boolean(input.filter) && Boolean(input.viewerUserId),
        initialPageParam: 0 as string | number,
        queryFn: ({ pageParam }) => fetchHomeFeedPage({ ...input, getPrefs }, pageParam),
        getNextPageParam: (lastPage) => {
            const raw = lastPage as HomeFeedPage & { next_cursor?: string | number | null };
            const cursor =
                raw.nextCursor !== undefined && raw.nextCursor !== null
                    ? raw.nextCursor
                    : raw.next_cursor !== undefined
                      ? raw.next_cursor
                      : null;
            if (cursor === null || cursor === undefined) return undefined;
            return cursor;
        },
        staleTime: 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnMount: false,
        retry: 1,
    });

    const flatPosts = useMemo(() => {
        const pages = query.data?.pages;
        if (!pages?.length) return [] as Post[];
        return pages.flatMap((p) => p.items);
    }, [query.data?.pages]);

    const pageBatches = useMemo(() => {
        const pages = query.data?.pages;
        if (!pages?.length) return [] as Post[][];
        return pages.map((p) => p.items);
    }, [query.data?.pages]);

    const followingCount = useMemo(() => {
        const pages = query.data?.pages;
        if (!pages?.length) return undefined;
        for (let i = pages.length - 1; i >= 0; i -= 1) {
            if (typeof pages[i].followingCount === 'number') {
                return pages[i].followingCount;
            }
        }
        return undefined;
    }, [query.data?.pages]);

    return {
        ...query,
        queryKey,
        flatPosts,
        pageBatches,
        followingCount,
    };
}
