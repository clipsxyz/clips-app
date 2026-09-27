/**
 * Shared ExoPlayer / AVPlayer buffer settings for feed MP4s.
 *
 * Two different jobs, deliberately tuned in opposite directions:
 *
 * - START FAST: `bufferForPlaybackMs` gates the *initial* start, so it stays low
 *   (150ms) to get the first frame up quickly after a card settles.
 * - DON'T STALL AFTERWARDS: the old floor was `minBufferMs: 300` /
 *   `bufferForPlaybackAfterRebufferMs: 200`, which asked ExoPlayer to keep only
 *   0.3s ahead and to resume after 0.2s. On a variable network that resumes
 *   straight back into a stall, so the player micro-rebuffered repeatedly — a
 *   freeze that looked like a start delay but happened mid-clip. The floor is now
 *   4s ahead, resuming after 2.5s.
 *
 * `maxBufferMs` must stay above `minBufferMs`: ExoPlayer stops loading once it
 * holds `minBufferMs`, so a lower cap would simply be inert. 12s is still far
 * under media3's 50s default — feed clips are short, and every extra second of
 * buffer competes with the next card's Range prebuffer for bandwidth.
 */
export const FEED_VIDEO_BUFFER_CONFIG = {
    minBufferMs: 4000,
    maxBufferMs: 12000,
    bufferForPlaybackMs: 150,
    bufferForPlaybackAfterRebufferMs: 2500,
    /** Fallback ExoPlayer SimpleCache when the HTTP proxy is unavailable. */
    cacheSizeMB: 150,
} as const;

type VideoSourceLike = {
    uri?: string | number;
    type?: string;
    shouldCache?: boolean;
    bufferConfig?: typeof FEED_VIDEO_BUFFER_CONFIG;
    [key: string]: unknown;
};

function isRemoteHttpUri(uri: unknown): uri is string {
    return typeof uri === 'string' && /^https?:\/\//i.test(uri.trim());
}

/**
 * Rewrite remote feed/story video URIs through the local LRU proxy and attach
 * an Instant-Start bufferConfig for react-native-video.
 */
export function withFeedVideoCache<T extends VideoSourceLike | number>(source: T): T {
    if (source == null || typeof source === 'number') return source;
    if (typeof source !== 'object') return source;
    const uri = source.uri;
    if (!isRemoteHttpUri(uri)) return source;

    // Origin URL, no SimpleCache / AndroidVideoCache. Those caches blocked the
    // first byte on ColorOS (first-postcard multi-second stall).
    return {
        ...source,
        uri,
        shouldCache: false,
        bufferConfig: {
            ...FEED_VIDEO_BUFFER_CONFIG,
            ...(source.bufferConfig || {}),
            minBufferMs: FEED_VIDEO_BUFFER_CONFIG.minBufferMs,
            bufferForPlaybackMs: FEED_VIDEO_BUFFER_CONFIG.bufferForPlaybackMs,
        },
    };
}
