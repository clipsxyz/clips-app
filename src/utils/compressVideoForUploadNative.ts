/** Long edge stays 1080p. Bitrate is bits/sec — 6 Mbps, not the old 1.2 Mbps cap. */
export const UPLOAD_VIDEO_MAX_EDGE = 1080;
export const UPLOAD_VIDEO_BITRATE = 6_000_000;

export class VideoCompressCancelled extends Error {
    constructor() {
        super('Video compression cancelled');
        this.name = 'VideoCompressCancelled';
    }
}

export function uploadVideoCompressOptions() {
    return {
        compressionMethod: 'manual' as const,
        maxSize: UPLOAD_VIDEO_MAX_EDGE,
        bitrate: UPLOAD_VIDEO_BITRATE,
        minimumFileSizeForCompress: 0,
    };
}

let activeCancel: (() => void) | null = null;

type CompressorVideoApi = {
    compress: (
        uri: string,
        options: Record<string, unknown>,
        onProgress?: (progress: number) => void,
    ) => Promise<string>;
    cancelCompression: (cancellationId: string) => void;
};

/**
 * Loaded only when a video is compressed. A missing native binary throws inside
 * react-native-compressor at import time (TurboModuleRegistry.getEnforcing), so
 * this must not run during app startup.
 */
async function loadCompressorVideo(): Promise<CompressorVideoApi | null> {
    try {
        const mod = await import('react-native-compressor');
        const video = mod.Video as CompressorVideoApi | undefined;
        if (!video || typeof video.compress !== 'function') return null;
        return video;
    } catch (err) {
        console.warn('[VideoCompress] native compressor is not linked on this device', err);
        return null;
    }
}

/** Stop the in-flight Video.compress() without blocking the JS thread. */
export function cancelActiveVideoCompression(): void {
    try {
        activeCancel?.();
    } catch (err) {
        console.warn('[VideoCompress] cancel failed', err);
    }
}

/**
 * On-device size pass. Resolves with a local file URI. Native work is async;
 * cancel via cancelActiveVideoCompression().
 */
export async function compressVideoForUploadNative(
    inputUri: string,
    onProgress?: (fraction: number) => void,
): Promise<string> {
    const source = String(inputUri || '').trim();
    if (!source) return source;

    const Video = await loadCompressorVideo();
    if (!Video) {
        console.warn('[VideoCompress] skipping compression; uploading the current file');
        return source;
    }

    let cancellationId = '';
    let cancelled = false;
    const cancel = () => {
        cancelled = true;
        if (!cancellationId) return;
        try {
            Video.cancelCompression(cancellationId);
        } catch (err) {
            console.warn('[VideoCompress] native cancel failed', err);
        }
    };
    activeCancel = cancel;

    try {
        const output = await Video.compress(
            source,
            {
                ...uploadVideoCompressOptions(),
                getCancellationId: (id: string) => {
                    cancellationId = id;
                    if (cancelled) cancel();
                },
            },
            (progress: number) => {
                const fraction = Math.max(0, Math.min(1, Number(progress) || 0));
                onProgress?.(fraction);
            },
        );
        if (cancelled) throw new VideoCompressCancelled();
        const next = String(output || '').trim();
        return next || source;
    } catch (err) {
        if (cancelled || err instanceof VideoCompressCancelled) {
            throw err instanceof VideoCompressCancelled ? err : new VideoCompressCancelled();
        }
        console.warn('[VideoCompress] falling back to the trimmed file', err);
        return source;
    } finally {
        if (activeCancel === cancel) activeCancel = null;
    }
}
