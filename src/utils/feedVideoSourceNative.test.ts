import { describe, expect, it } from 'vitest';
import {
    FEED_VIDEO_BUFFER_CONFIG,
    withFeedVideoCache,
} from './feedVideoSourceNative';

/**
 * The feed's ExoPlayer tuning is load-bearing in two directions at once: start
 * fast, then keep enough buffer not to stall. `withFeedVideoCache` also
 * re-pins `minBufferMs` and `bufferForPlaybackMs` over any caller override,
 * which is what stops a call site from quietly undoing the instant-start tuning.
 *
 * These rules are invisible in a type check and would only show up as a stutter
 * on a real device, so they are pinned down here.
 */
describe('FEED_VIDEO_BUFFER_CONFIG', () => {
    it('starts playback from a small initial buffer', () => {
        // The whole point of the fast-start half: do not wait for a big buffer
        // before the first frame.
        expect(FEED_VIDEO_BUFFER_CONFIG.bufferForPlaybackMs).toBeLessThanOrEqual(500);
    });

    it('keeps maxBufferMs above minBufferMs', () => {
        // ExoPlayer stops loading once it holds minBufferMs, so a cap at or below
        // the floor would be inert and the two values would contradict.
        expect(FEED_VIDEO_BUFFER_CONFIG.maxBufferMs).toBeGreaterThan(
            FEED_VIDEO_BUFFER_CONFIG.minBufferMs,
        );
    });

    it('keeps a real floor rather than resuming into the next stall', () => {
        // Regression guard for the 300/200 values that caused repeated
        // micro-rebuffering on variable networks.
        expect(FEED_VIDEO_BUFFER_CONFIG.minBufferMs).toBeGreaterThanOrEqual(2000);
        expect(FEED_VIDEO_BUFFER_CONFIG.bufferForPlaybackAfterRebufferMs).toBeGreaterThanOrEqual(
            1000,
        );
    });

    it('stays well under the media3 50s default so buffers stay short', () => {
        // Feed clips are short; hoarding buffer competes with the next card's
        // Range prebuffer for bandwidth.
        expect(FEED_VIDEO_BUFFER_CONFIG.maxBufferMs).toBeLessThanOrEqual(30000);
    });
});

describe('withFeedVideoCache', () => {
    it('turns off disk caching for remote sources', () => {
        // SimpleCache / AndroidVideoCache blocked the first byte on ColorOS.
        const out = withFeedVideoCache({ uri: 'https://cdn.example.com/a.mp4' }) as {
            shouldCache?: boolean;
        };
        expect(out.shouldCache).toBe(false);
    });

    it('attaches the shared buffer config to remote sources', () => {
        const out = withFeedVideoCache({ uri: 'https://cdn.example.com/a.mp4' }) as {
            bufferConfig?: Record<string, number>;
        };
        expect(out.bufferConfig).toMatchObject({
            bufferForPlaybackMs: FEED_VIDEO_BUFFER_CONFIG.bufferForPlaybackMs,
            minBufferMs: FEED_VIDEO_BUFFER_CONFIG.minBufferMs,
        });
    });

    it('leaves local files untouched', () => {
        // Local mock clips never went through the proxy, and forcing a remote
        // buffer config onto them would be meaningless.
        const local = { uri: 'file:///var/mobile/a.mp4' };
        expect(withFeedVideoCache(local)).toBe(local);
    });

    it('leaves data URIs untouched', () => {
        const inline = { uri: 'data:video/mp4;base64,AAAA' };
        expect(withFeedVideoCache(inline)).toBe(inline);
    });

    it('passes a numeric source through unchanged', () => {
        expect(withFeedVideoCache(7 as unknown as { uri: string })).toBe(7);
    });

    it('survives null and undefined', () => {
        expect(withFeedVideoCache(null as unknown as { uri: string })).toBeNull();
        expect(withFeedVideoCache(undefined as unknown as { uri: string })).toBeUndefined();
    });

    it('re-pins the fast-start fields over a caller override', () => {
        // The guard that stops a call site from quietly restoring a slow start.
        const out = withFeedVideoCache({
            uri: 'https://cdn.example.com/a.mp4',
            bufferConfig: { minBufferMs: 99999, bufferForPlaybackMs: 99999 },
        } as never) as { bufferConfig?: Record<string, number> };
        expect(out.bufferConfig?.minBufferMs).toBe(FEED_VIDEO_BUFFER_CONFIG.minBufferMs);
        expect(out.bufferConfig?.bufferForPlaybackMs).toBe(
            FEED_VIDEO_BUFFER_CONFIG.bufferForPlaybackMs,
        );
    });

    it('still lets a caller override the fields that are not pinned', () => {
        // maxBufferMs / bufferForPlaybackAfterRebufferMs are deliberately not
        // pinned, so a specialised surface can tune them.
        const out = withFeedVideoCache({
            uri: 'https://cdn.example.com/a.mp4',
            bufferConfig: { maxBufferMs: 20000 },
        } as never) as { bufferConfig?: Record<string, number> };
        expect(out.bufferConfig?.maxBufferMs).toBe(20000);
    });

    it('preserves the source type for HLS', () => {
        const out = withFeedVideoCache({ uri: 'https://cdn.example.com/a.m3u8', type: 'm3u8' }) as {
            type?: string;
        };
        expect(out.type).toBe('m3u8');
    });

    it('does not mutate the caller source', () => {
        const source = { uri: 'https://cdn.example.com/a.mp4' };
        withFeedVideoCache(source);
        expect(source).toEqual({ uri: 'https://cdn.example.com/a.mp4' });
    });
});
