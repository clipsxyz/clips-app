/**
 * Shared ExoPlayer / AVPlayer buffer + disk-cache settings for feed MP4s.
 * `cacheSizeMB` enables react-native-video SimpleCache so re-scrolling
 * reuses previously buffered bytes instead of re-downloading.
 */
export const FEED_VIDEO_BUFFER_CONFIG = {
    minBufferMs: 4000,
    maxBufferMs: 30000,
    bufferForPlaybackMs: 1200,
    bufferForPlaybackAfterRebufferMs: 2000,
    /** Disk cache budget for previously loaded remote MP4s (Android SimpleCache). */
    cacheSizeMB: 256,
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

const cachedSources = new Map<string, object>();

/**
 * Attach shouldCache + bufferConfig for remote HTTP(S) feed videos.
 * Local/file/require sources are returned unchanged.
 */
export function withFeedVideoCache<T extends VideoSourceLike | number>(source: T): T {
    if (source == null || typeof source === 'number') return source;
    if (typeof source !== 'object') return source;
    const uri = source.uri;
    if (!isRemoteHttpUri(uri)) return source;
    const cacheKey = `${uri.trim()}|${String(source.type || 'mp4')}`;
    const hit = cachedSources.get(cacheKey);
    if (hit) return hit as T;
    const next = {
        ...source,
        shouldCache: true,
        bufferConfig: {
            ...FEED_VIDEO_BUFFER_CONFIG,
            ...(source.bufferConfig || {}),
        },
    };
    cachedSources.set(cacheKey, next);
    return next;
}
