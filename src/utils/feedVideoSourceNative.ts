/**
 * Shared ExoPlayer / AVPlayer buffer + disk-cache settings for feed MP4s.
 * `cacheSizeMB` enables react-native-video SimpleCache so re-scrolling
 * reuses previously buffered bytes instead of re-downloading.
 */
export const FEED_VIDEO_BUFFER_CONFIG = {
    minBufferMs: 1500,
    maxBufferMs: 12000,
    bufferForPlaybackMs: 250,
    bufferForPlaybackAfterRebufferMs: 500,
    /** Disk cache budget for previously loaded remote MP4s (Android SimpleCache). */
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
 * Attach shouldCache + bufferConfig for remote HTTP(S) feed videos.
 * Local/file/require sources are returned unchanged.
 */
export function withFeedVideoCache<T extends VideoSourceLike | number>(source: T): T {
    if (source == null || typeof source === 'number') return source;
    if (typeof source !== 'object') return source;
    const uri = source.uri;
    if (!isRemoteHttpUri(uri)) return source;
    return {
        ...source,
        shouldCache: true,
        bufferConfig: {
            ...FEED_VIDEO_BUFFER_CONFIG,
            ...(source.bufferConfig || {}),
        },
    };
}
