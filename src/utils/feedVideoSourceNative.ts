/**
 * Shared ExoPlayer / AVPlayer buffer settings for feed MP4s.
 * Tuned for Instant Start: begin playback as soon as ~200ms is buffered.
 */
export const FEED_VIDEO_BUFFER_CONFIG = {
    minBufferMs: 300,
    maxBufferMs: 8000,
    bufferForPlaybackMs: 150,
    bufferForPlaybackAfterRebufferMs: 200,
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
