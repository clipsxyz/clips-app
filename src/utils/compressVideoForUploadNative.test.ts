import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native-compressor', () => ({
    Video: {
        compress: vi.fn(async (_uri: string, _opts: unknown, onProgress?: (n: number) => void) => {
            onProgress?.(1);
            return 'file:///tmp/compressed.mp4';
        }),
        cancelCompression: vi.fn(),
    },
}));

describe('upload video compression preset', () => {
    it('keeps 1080p and a 6 Mbps ceiling', async () => {
        const { uploadVideoCompressOptions, UPLOAD_VIDEO_BITRATE, UPLOAD_VIDEO_MAX_EDGE } =
            await import('./compressVideoForUploadNative');
        expect(UPLOAD_VIDEO_MAX_EDGE).toBe(1080);
        expect(UPLOAD_VIDEO_BITRATE).toBe(6_000_000);
        expect(uploadVideoCompressOptions()).toMatchObject({
            compressionMethod: 'manual',
            maxSize: 1080,
            bitrate: 6_000_000,
        });
    });

    it('returns the compressed local uri', async () => {
        const { compressVideoForUploadNative } = await import('./compressVideoForUploadNative');
        const uri = await compressVideoForUploadNative('file:///tmp/in.mp4');
        expect(uri).toBe('file:///tmp/compressed.mp4');
    });
});
