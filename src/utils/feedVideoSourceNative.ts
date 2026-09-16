import { convertToProxyURL, isVideoCacheProxyUri } from './videoCacheProxyNative';

/**
 * Shared ExoPlayer / AVPlayer buffer settings for feed MP4s.
 * Tuned for Instant Start: begin playback as soon as ~1s is buffered.
 *
 * Remote URIs are rewritten via `convertToProxyURL` (react-native-video-cache
 * LRU disk proxy) so Range prebuffer + the active player share one cache.
 */
export const FEED_VIDEO_BUFFER_CONFIG = {
    minBufferMs: 1500,
    maxBufferMs: 12000,
    bufferForPlaybackMs: 1000,
    bufferForPlaybackAfterRebufferMs: 500,
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

    const proxied = convertToProxyURL(uri);
    const usingProxy = isVideoCacheProxyUri(proxied) && proxied !== uri;

    return {
        ...source,
        uri: proxied,
        // Proxy owns the shared disk LRU — avoid double-caching into ExoPlayer SimpleCache.
        // When proxy is unavailable, keep shouldCache so SimpleCache still helps re-scrolls.
        shouldCache: usingProxy ? false : true,
        bufferConfig: {
            ...FEED_VIDEO_BUFFER_CONFIG,
            ...(source.bufferConfig || {}),
            // Always enforce Instant-Start playback thresholds.
            minBufferMs: FEED_VIDEO_BUFFER_CONFIG.minBufferMs,
            bufferForPlaybackMs: FEED_VIDEO_BUFFER_CONFIG.bufferForPlaybackMs,
        },
    };
}
