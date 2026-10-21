import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./prepareMediaForPostNative', () => ({
    prepareMediaForPostNative: vi.fn(async ({ mediaUrl }: { mediaUrl: string | null }) => ({
        mediaUrl: `https://cdn.example/${mediaUrl ?? ''}`,
        mediaType: 'image' as const,
    })),
}));

import { prepareMediaForPostNative } from './prepareMediaForPostNative';
import { prepareCarouselMediaForPostNative } from './prepareCarouselMediaForPostNative';

describe('prepareCarouselMediaForPostNative', () => {
    beforeEach(() => {
        vi.mocked(prepareMediaForPostNative).mockImplementation(
            async ({ mediaUrl, mediaType }) => ({
                mediaUrl: `https://cdn.example/${mediaUrl ?? ''}`,
                mediaType: mediaType === 'video' ? 'video' : 'image',
                videoPosterUrl:
                    mediaType === 'video' ? `https://cdn.example/poster-${mediaUrl}` : undefined,
            }),
        );
        vi.mocked(prepareMediaForPostNative).mockClear();
    });

    it('uploads each image and returns ordered items', async () => {
        const result = await prepareCarouselMediaForPostNative([
            { uri: 'file:///a.jpg', type: 'image' },
            { uri: 'file:///b.jpg', type: 'image' },
        ]);
        expect(result.items).toHaveLength(2);
        expect(result.items[0].url).toContain('a.jpg');
        expect(result.items[1].url).toContain('b.jpg');
        expect(prepareMediaForPostNative).toHaveBeenCalledTimes(2);
    });

    it('uploads MP4 slides and returns poster for first video', async () => {
        const result = await prepareCarouselMediaForPostNative([
            { uri: 'file:///clip.mp4', type: 'video' },
            { uri: 'file:///b.jpg', type: 'image' },
        ]);
        expect(result.items[0].type).toBe('video');
        expect(result.items[0].posterUrl).toContain('poster');
        expect(result.videoPosterUrl).toContain('poster');
        expect(prepareMediaForPostNative).toHaveBeenCalledWith(
            expect.objectContaining({ mediaType: 'video' }),
        );
    });

    it('uses per-slide videoCoverTime for each MP4', async () => {
        await prepareCarouselMediaForPostNative([
            { uri: 'file:///a.jpg', type: 'image' },
            { uri: 'file:///b.mp4', type: 'video', videoCoverTime: 2.5 },
            { uri: 'file:///c.mp4', type: 'video', videoCoverTime: 7 },
        ]);
        expect(prepareMediaForPostNative).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ mediaType: 'video', videoCoverTime: 2.5 }),
        );
        expect(prepareMediaForPostNative).toHaveBeenNthCalledWith(
            3,
            expect.objectContaining({ mediaType: 'video', videoCoverTime: 7 }),
        );
    });

    it('carries picked width/height through to the uploaded items', async () => {
        // The feed needs these to lay the card out on first paint; without them the post is
        // persisted NULL and the card snaps to its real ratio on ExoPlayer onLoad.
        const result = await prepareCarouselMediaForPostNative([
            { uri: 'file:///a.jpg', type: 'image', width: 1920, height: 1080 },
            { uri: 'file:///b.mp4', type: 'video', width: 1080, height: 1920 },
        ]);
        expect(result.items[0]).toMatchObject({ width: 1920, height: 1080 });
        expect(result.items[1]).toMatchObject({ width: 1080, height: 1920 });
    });

    it('omits dimensions when the picked asset had none', async () => {
        const result = await prepareCarouselMediaForPostNative([
            { uri: 'file:///a.jpg', type: 'image' },
        ]);
        expect(result.items[0].width).toBeUndefined();
        expect(result.items[0].height).toBeUndefined();
    });
});
