import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./prepareMediaForPostNative', () => ({
    prepareMediaForPostNative: vi.fn(async ({ mediaUrl }: { mediaUrl: string }) => ({
        mediaUrl: `https://cdn.example/${mediaUrl}`,
        mediaType: 'image' as const,
    })),
}));

import { prepareMediaForPostNative } from './prepareMediaForPostNative';
import { prepareCarouselMediaForPostNative } from './prepareCarouselMediaForPostNative';

describe('prepareCarouselMediaForPostNative', () => {
    beforeEach(() => {
        vi.mocked(prepareMediaForPostNative).mockImplementation(
            async ({ mediaUrl, mediaType }: { mediaUrl: string; mediaType: 'image' | 'video' }) => ({
                mediaUrl: `https://cdn.example/${mediaUrl}`,
                mediaType,
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
});
