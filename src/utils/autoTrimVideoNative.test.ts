import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
    Platform: { OS: 'ios' },
    ToastAndroid: { show: vi.fn(), LONG: 1 },
    Alert: { alert: vi.fn() },
}));

vi.mock('./ffmpegNative', () => ({
    executeFfmpeg: vi.fn(async () => undefined),
    makeSiblingOutputPath: vi.fn(
        (_uri: string, suffix: string) => `/tmp/out-${suffix}.mp4`,
    ),
    toFfmpegPath: vi.fn((uri: string) => uri.replace(/^file:\/\//, '')),
    toFileUri: vi.fn((path: string) =>
        path.startsWith('file://') ? path : `file://${path}`,
    ),
}));

vi.mock('./resolveLocalMediaUriForFfmpegNative', () => ({
    resolveLocalMediaUriForFfmpeg: vi.fn(async (uri: string) => uri),
}));

vi.mock('./uploadFileNative', () => ({
    normalizeNativeUploadUri: (uri: string) => uri,
}));

vi.mock('./localFileNative', () => ({
    statLocalFileBytes: vi.fn(async () => 1_000_000),
}));

describe('autoTrimVideoNative caps', () => {
    it('uses 15s for Stories 24 and 90s for newsfeed', async () => {
        const mod = await import('./autoTrimVideoNative');
        expect(mod.MAX_STORIES_VIDEO_DURATION_SEC).toBe(15);
        expect(mod.MAX_FEED_VIDEO_DURATION_SEC).toBe(90);
        expect(mod.maxVideoDurationForDestination('stories')).toBe(15);
        expect(mod.maxVideoDurationForDestination('feed')).toBe(90);
    });

    it('hardTrimVideoWindowForUpload always runs FFmpeg with -ss 0 -t N and never returns original', async () => {
        const { executeFfmpeg } = await import('./ffmpegNative');
        vi.mocked(executeFfmpeg).mockClear();

        const mod = await import('./autoTrimVideoNative');
        const result = await mod.hardTrimVideoWindowForUpload('file:///tmp/in.mp4', 'stories', {
            startTime: 0,
            endTime: 15,
            notify: false,
        });

        expect(executeFfmpeg).toHaveBeenCalled();
        const cmd = String(vi.mocked(executeFfmpeg).mock.calls[0]?.[0] || '');
        expect(cmd).toMatch(/-ss 0/);
        expect(cmd).toMatch(/-t 15/);
        expect(cmd).toMatch(/-preset ultrafast/);
        expect(cmd).toMatch(/scale='min\(720/);
        expect(cmd).toMatch(/-b:v 1200k/);
        expect(cmd).toMatch(/-maxrate 1500k/);
        expect(cmd).toMatch(/-bufsize 2000k/);
        expect(cmd).toMatch(/-c:a aac/);
        expect(cmd).toMatch(/-b:a 96k/);
        expect(result.uri).not.toBe('file:///tmp/in.mp4');
        expect(result.wasTrimmed).toBe(true);
        expect(result.durationSec).toBe(15);
    });

    it('propagates FFmpeg failure without returning the original URI', async () => {
        const { executeFfmpeg } = await import('./ffmpegNative');
        vi.mocked(executeFfmpeg).mockRejectedValueOnce(
            new Error('FFmpeg failed to trim video: mock stack'),
        );

        const mod = await import('./autoTrimVideoNative');
        await expect(
            mod.hardTrimVideoWindowForUpload('file:///tmp/in.mp4', 'stories', {
                startTime: 0,
                endTime: 15,
                notify: false,
            }),
        ).rejects.toThrow(/FFmpeg failed to trim video/);
    });

    it('hardTrim for feed uses -t 90', async () => {
        const { executeFfmpeg } = await import('./ffmpegNative');
        vi.mocked(executeFfmpeg).mockClear();

        const mod = await import('./autoTrimVideoNative');
        const result = await mod.hardTrimVideoWindowForUpload('file:///tmp/long.mp4', 'feed', {
            startTime: 0,
            endTime: 90,
            notify: false,
        });

        const cmd = String(vi.mocked(executeFfmpeg).mock.calls[0]?.[0] || '');
        expect(cmd).toMatch(/-t 90/);
        expect(result.durationSec).toBe(90);
        expect(result.wasTrimmed).toBe(true);
    });

    it('ensureFeedVideoUnderLimits always trims even without duration hints', async () => {
        const { executeFfmpeg } = await import('./ffmpegNative');
        vi.mocked(executeFfmpeg).mockClear();

        const mod = await import('./autoTrimVideoNative');
        const result = await mod.ensureFeedVideoUnderLimits(
            'file:///tmp/unknown.mp4',
            {},
            { notify: false, maxSeconds: 90 },
        );

        expect(executeFfmpeg).toHaveBeenCalled();
        expect(result.wasTrimmed).toBe(true);
        expect(result.uri).not.toBe('file:///tmp/unknown.mp4');
    });

    it('assertLocalVideoUnderUploadLimit is a no-op and never throws UploadTooLarge', async () => {
        const { statLocalFileBytes } = await import('./localFileNative');
        vi.mocked(statLocalFileBytes).mockResolvedValue(500 * 1024 * 1024);

        const mod = await import('./autoTrimVideoNative');
        await expect(
            mod.assertLocalVideoUnderUploadLimit('file:///tmp/huge-raw.mp4', {
                stage: 'should-not-block',
            }),
        ).resolves.toBe(500 * 1024 * 1024);
    });
});
