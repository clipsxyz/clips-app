import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { mapLaravelStoryToStory, userHasStoriesByHandle, userHasUnviewedStoriesByHandle, clearActiveStoryProbes } from './stories';

  const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

  vi.mock('./client', () => ({
      apiRequest: apiRequestMock,
      fetchStoriesPageApi: vi.fn(),
  }));
  vi.mock('../config/runtimeEnv', async (importOriginal) => {
      const runtimeEnv = await importOriginal<typeof import('../config/runtimeEnv')>();
      return { ...runtimeEnv, isLaravelApiEnabled: () => true };
  });

/**
 * Regression guards for the per-card active-story probe.
 *
 * Every visible feed card asks "does this handle have active stories?" on mount. Two
 * things made that path unsafe: N mounted cards fired N identical GETs per mount (no
 * single-flight), and a refused/rejected request was never cached, so the next render
 * immediately retried — with the endpoint unreachable this turned into a request storm
 * plus a state write per render (the "Maximum update depth exceeded" driver).
 *
 * The probe now shares one in-flight request per key and negative-caches short failures.
 */
describe('active story probe (network safety)', () => {
    beforeEach(() => {
        clearActiveStoryProbes();
        apiRequestMock.mockReset();
        vi.useRealTimers();
    });

    it('single-flights concurrent probes for the same user', async () => {
        apiRequestMock.mockResolvedValue([]);

        const [a, b] = await Promise.all([
            userHasStoriesByHandle('Alice@Dublin', 'viewer-1'),
            userHasStoriesByHandle('alice@dublin', 'viewer-1'),
        ]);

        expect(a).toBe(false);
        expect(b).toBe(false);
        expect(apiRequestMock).toHaveBeenCalledTimes(1);
        expect(apiRequestMock).toHaveBeenCalledWith('/stories/user/Alice%40Dublin?userId=viewer-1');
    });

    it('reuses a successful probe for the TTL window', async () => {
        apiRequestMock.mockResolvedValue([{ id: 's1', has_viewed: false }]);

        const first = await userHasStoriesByHandle('Barry@Galway', 'viewer-1');
        const second = await userHasStoriesByHandle('Barry@Galway', 'viewer-1');

        expect(first).toBe(true);
        expect(second).toBe(true);
        expect(apiRequestMock).toHaveBeenCalledTimes(1);
    });

    it('backs off short failures without hiding stories for the full TTL', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(1_000_000);
        apiRequestMock.mockRejectedValue(new TypeError('Network request failed'));

        expect(await userHasStoriesByHandle('Carol@Limerick', 'viewer-1')).toBe(false);
        expect(apiRequestMock).toHaveBeenCalledTimes(1);

        // Still inside the failure backoff window → graceful false, no new request.
        expect(await userHasStoriesByHandle('Carol@Limerick', 'viewer-1')).toBe(false);
        expect(apiRequestMock).toHaveBeenCalledTimes(1);

        // After the backoff window the probe retries (and fails again).
        vi.setSystemTime(1_000_000 + 6_000);
        expect(await userHasStoriesByHandle('Carol@Limerick', 'viewer-1')).toBe(false);
        expect(apiRequestMock).toHaveBeenCalledTimes(2);
    });

    it('reports unviewed per has_viewed when a viewer id is passed', async () => {
        apiRequestMock.mockResolvedValueOnce([{ id: 's1', has_viewed: true }]);
        expect(await userHasUnviewedStoriesByHandle('Dave@Dublin', 'viewer-1')).toBe(false);

        apiRequestMock.mockResolvedValueOnce([{ id: 's2', has_viewed: false }]);
        expect(await userHasUnviewedStoriesByHandle('Eve@Dublin', 'viewer-1')).toBe(true);
    });
});

/**
 * Regression guards for shared-post stories.
 *
 * transformLaravelStoryToStory is an explicit whitelist. When it dropped
 * shared_from_post_id / shared_from_user_handle / video_poster_url the rail lost the
 * "Shared a post" reference and its thumbnail, and audience was silently rewritten to
 * public — so scoped shares leaked and looked broken after a refresh.
 */
describe('mapLaravelStoryToStory shared-post fields', () => {
    const base = {
        id: 's1',
        user_id: 'u1',
        user_handle: 'Gazetteer@Dublin',
        media_url: 'https://example.com/shared.jpg',
        media_type: 'image',
    };

    it('passes through the shared post reference and poster', () => {
        const story = mapLaravelStoryToStory({
            ...base,
            shared_from_post_id: 'post-uuid',
            shared_from_user_handle: 'Alice@Finglas',
            video_poster_url: 'https://example.com/poster.jpg',
        });

        expect(story.sharedFromPost).toBe('post-uuid');
        expect(story.sharedFromUser).toBe('Alice@Finglas');
        expect(story.videoPosterUrl).toBe('https://example.com/poster.jpg');
    });

    it('preserves the audience scope instead of defaulting to public', () => {
        expect(mapLaravelStoryToStory({ ...base, audience: 'close_friends' }).audience).toBe(
            'close_friends',
        );
        expect(mapLaravelStoryToStory({ ...base, audience: 'only_me' }).audience).toBe('only_me');
    });

    it('tolerates stories with no shared reference', () => {
        const story = mapLaravelStoryToStory(base);
        expect(story.sharedFromPost).toBeUndefined();
        expect(story.sharedFromUser).toBeUndefined();
        expect(story.videoPosterUrl).toBeUndefined();
    });

    it('resolves media from mediaUrl, uri, or file_path when media_url is missing', () => {
        expect(
            mapLaravelStoryToStory({
                ...base,
                media_url: undefined,
                mediaUrl: 'https://cdn.example.com/fresh.mp4',
                media_type: 'video',
            }).mediaUrl,
        ).toBe('https://cdn.example.com/fresh.mp4');

        expect(
            mapLaravelStoryToStory({
                ...base,
                media_url: undefined,
                uri: 'https://cdn.example.com/from-uri.jpg',
            }).mediaUrl,
        ).toBe('https://cdn.example.com/from-uri.jpg');

        const fromPath = mapLaravelStoryToStory({
            ...base,
            media_url: undefined,
            media_type: undefined,
            file_path: 'stories/debs-upload.mp4',
        });
        expect(fromPath.mediaUrl).toBe('/storage/stories/debs-upload.mp4');
        expect(fromPath.mediaType).toBe('video');
    });

    it('maps poster aliases and drops device-local file:// stills', () => {
        expect(
            mapLaravelStoryToStory({
                ...base,
                media_type: 'video',
                media_url: 'https://cdn.example.com/clip.mp4',
                thumbnail_url: 'https://cdn.example.com/still.jpg',
            }).videoPosterUrl,
        ).toBe('https://cdn.example.com/still.jpg');

        expect(
            mapLaravelStoryToStory({
                ...base,
                media_type: 'video',
                media_url: 'https://cdn.example.com/clip.mp4',
                video_poster_url: 'file:///data/user/0/com.clipsapp/cache/poster.jpg',
            }).videoPosterUrl,
        ).toBeUndefined();
    });

    it('reads user handle from the nested user relation', () => {
        const story = mapLaravelStoryToStory({
            id: 's2',
            user_id: 'u2',
            user: { id: 'u2', handle: 'Debs@Manchester' },
            media_url: 'https://cdn.example.com/clip.mp4',
            media_type: 'video',
        });
        expect(story.userHandle).toBe('Debs@Manchester');
    });

    it('maps identified viewers instead of dropping them', () => {
        const story = mapLaravelStoryToStory({
            ...base,
            unique_viewers: 2,
            viewer_handles: ['Ava@galway'],
            viewers: [
                {
                    user_id: 'u-ava',
                    handle: 'Ava@galway',
                    username: 'ava',
                    name: 'Ava',
                    avatar_url: 'https://example.com/ava.jpg',
                    viewed_at: '2026-10-30T12:00:00.000Z',
                },
            ],
        });
        expect(story.viewerHandles).toEqual(['Ava@galway']);
        expect(story.viewers?.[0]).toMatchObject({
            handle: 'Ava@galway',
            username: 'ava',
            name: 'Ava',
            avatarUrl: 'https://example.com/ava.jpg',
        });
        expect(story.uniqueViewers).toBe(2);
        expect(story.viewers?.[0]?.viewedAt).toBe(Date.parse('2026-10-30T12:00:00.000Z'));
    });
});