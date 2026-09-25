import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('__DEV__', false);

const { fetchPostsPageMock } = vi.hoisted(() => ({ fetchPostsPageMock: vi.fn() }));

vi.mock('../api/posts', () => ({
    fetchPostsPage: fetchPostsPageMock,
    isDevMockFeedVideoPost: () => false,
}));

vi.mock('../api/messages', () => ({
    isUserBlocked: vi.fn(async () => false),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: vi.fn(async () => null),
        setItem: vi.fn(async () => undefined),
        removeItem: vi.fn(async () => undefined),
    },
}));

vi.mock('react-native', () => {
    const platform = { OS: 'ios', select: (o: Record<string, unknown>) => o.ios };
    return { Platform: platform, default: { Platform: platform } };
});

import { fetchVisibleFeedPage, fetchInitialVisibleFeed } from './nativeFeedLoader';

const base = {
    filter: 'Following',
    viewerUserId: 'u1',
    viewerHandle: 'me',
    prefs: { mutedHandles: new Set(), blockedHandles: new Set<string>(), hiddenPostIds: new Set(), notInterestedPostIds: new Set<string>() },
} as any;

const page = (items: any[], nextCursor: string | number | null) => ({ items, nextCursor });

describe('fetchInitialVisibleFeed walk', () => {
    beforeEach(() => {
        fetchPostsPageMock.mockReset();
    });

    it('returns the first page that has visible posts', async () => {
        fetchPostsPageMock
            .mockResolvedValueOnce(page([], 'c1'))
            .mockResolvedValueOnce(page([{ id: 'p1' }], 'c2'));

        const res = await fetchInitialVisibleFeed(base);
        expect(res.items.map((p: any) => p.id)).toEqual(['p1']);
        expect(res.nextCursor).toBe('c2');
    });

    it('reports a genuine end of feed when the API runs out', async () => {
        fetchPostsPageMock.mockResolvedValueOnce(page([], null));
        const res = await fetchInitialVisibleFeed(base);
        expect(res.nextCursor).toBeNull();
    });

    // Regression: exhausting the walk used to return nextCursor: null, which ends
    // pagination forever and leaves a blank tail even though posts exist server-side.
    it('hands back the advanced cursor when the walk is exhausted', async () => {
        let calls = 0;
        fetchPostsPageMock.mockImplementation(async () => {
            calls += 1;
            return { items: [], nextCursor: `c${calls}` };
        });

        const res = await fetchInitialVisibleFeed(base);

        expect(calls).toBeGreaterThan(1);
        expect(res.items).toEqual([]);
        // Resumes from the last cursor the walk reached, so the next fetch continues.
        expect(res.nextCursor).toBe(`c${calls}`);
        expect(res.nextCursor).not.toBeNull();
    });
});

describe('fetchVisibleFeedPage', () => {
    beforeEach(() => {
        fetchPostsPageMock.mockReset();
    });

    it('passes the cursor and limit through to the API', async () => {
        fetchPostsPageMock.mockResolvedValueOnce(page([{ id: 'p9' }], 'c9'));
        const res = await fetchVisibleFeedPage({ ...base, cursor: 4, limit: 16 } as any);
        expect(res.items.map((p: any) => p.id)).toEqual(['p9']);
        expect(fetchPostsPageMock).toHaveBeenCalledWith(
            'Following',
            4,
            16,
            'u1',
            '',
            '',
            '',
            'me',
        );
    });
});
