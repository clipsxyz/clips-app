import { extractVideoPosterFrame } from './extractVideoPosterNative';
import { isFiltered, type InstantFilterInfo } from './instantFiltersNative';
import {
    compressImageForUploadNative,
    transcodeVideoForUploadNative,
} from './transcodeVideoForUploadNative';
import { normalizeUploadUri, uploadFileFromUri } from './uploadFileNative';
import {
    hardTrimVideoWindowForUpload,
    maxVideoDurationForDestination,
    type VideoUploadDestination,
} from './autoTrimVideoNative';
import { probeLocalVideoBounds } from './validateLocalVideoNative';
import { statLocalFileBytes } from './localFileNative';
import {
    compressVideoForUploadNative,
    VideoCompressCancelled,
} from './compressVideoForUploadNative';

type NativeMediaType = 'image' | 'video' | null;

type PrepareNativeMediaArgs = {
    mediaUrl: string | null;
    mediaType: NativeMediaType;
    filterInfo?: InstantFilterInfo | null;
    /** Captures composer preview (media + optional filter overlay) to a temp JPEG. */
    captureVideoPoster?: () => Promise<string>;
    /** Cover frame time in seconds (used for FFmpeg poster fallback). */
    videoCoverTime?: number;
    onStage?: (stage: 'compress' | 'poster' | 'upload') => void;
    /** 0–1 while react-native-compressor is running. Does not block the UI thread. */
    onCompressProgress?: (fraction: number) => void;
    /**
     * Upload destination controls hard-trim caps:
     * Stories 24 → 0–15s; newsfeed → 0–90s.
     */
    destination?: VideoUploadDestination;
    /** Picker-reported length, so optimize progress matches the clip. */
    videoDurationSec?: number;
};

type PrepareNativeMediaResult = {
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    videoPosterUrl?: string;
    filterExportFailed?: boolean;
    /** True when optional filter bake failed after a successful hard-trim. */
    videoCompressFailed?: boolean;
};

function isRemoteUrl(uri: string): boolean {
    return uri.startsWith('http://') || uri.startsWith('https://');
}

function isLocalUri(uri: string): boolean {
    return (
        uri.startsWith('file://') ||
        uri.startsWith('content://') ||
        uri.startsWith('ph://') ||
        uri.startsWith('data:') ||
        (uri.startsWith('/') && !uri.includes('://'))
    );
}

/** Any non-remote video must be hard-trimmed — including odd Android media schemes. */
function mustHardTrimVideo(uri: string, mediaType: NativeMediaType): boolean {
    if (mediaType !== 'video' || !uri) return false;
    if (isRemoteUrl(uri) || uri.startsWith('data:')) return false;
    return true;
}

function normalizeLocalUri(uri: string): string {
    if (typeof normalizeUploadUri === 'function') {
        return normalizeUploadUri(uri);
    }
    const trimmed = String(uri || '').trim();
    if (trimmed.startsWith('/') && !trimmed.includes('://')) {
        return `file://${trimmed}`;
    }
    return trimmed;
}

async function uploadLocalUri(
    uri: string,
    mimeType: string,
    fileName: string,
): Promise<string> {
    if (isRemoteUrl(uri)) {
        return uri;
    }
    const localUri = normalizeLocalUri(uri);
    console.log('[MediaPrep] HTTP upload AFTER trim/compress:', localUri.slice(0, 120));
    const result = await uploadFileFromUri(localUri, mimeType, fileName);
    const uploaded = result.fileUrl || result.url;
    if (result.success === false) {
        throw new Error('Upload failed');
    }
    if (!uploaded) {
        throw new Error('Upload failed: missing file URL');
    }
    return uploaded;
}

async function resolveVideoPosterUrl(
    videoUri: string,
    videoCoverTime: number,
    captureVideoPoster?: () => Promise<string>,
): Promise<string | undefined> {
    if (captureVideoPoster) {
        try {
            return await captureVideoPoster();
        } catch {
            /* fall through to FFmpeg */
        }
    }

    if (!isLocalUri(videoUri) && isRemoteUrl(videoUri)) {
        return undefined;
    }

    try {
        return await extractVideoPosterFrame(videoUri, videoCoverTime);
    } catch {
        return undefined;
    }
}

/**
 * On-device pipeline order (strict):
 * 1) FFmpeg hard-trim (duration cap)
 * 2) optional filter bake
 * 3) react-native-compressor at 1080p — this file is what gets uploaded
 * 4) HTTP upload (Laravel stores it; no server transcode)
 */
export async function prepareMediaForPostNative({
    mediaUrl,
    mediaType,
    filterInfo,
    captureVideoPoster,
    videoCoverTime = 0,
    onStage,
    onCompressProgress,
    destination = 'feed',
    videoDurationSec,
}: PrepareNativeMediaArgs): Promise<PrepareNativeMediaResult> {
    if (!mediaUrl || !mediaType) {
        return {};
    }

    const normalizedUrl = normalizeLocalUri(mediaUrl.trim());
    if (!normalizedUrl) {
        return {};
    }

    let workingUrl = normalizedUrl;
    let videoPosterUrl: string | undefined;
    let filterExportFailed = false;
    let videoCompressFailed = false;
    let trimFailed = false;
    const maxSeconds = maxVideoDurationForDestination(destination);
    const trimEndTime = maxSeconds;

    // ─── STEP 1: FFmpeg first. No size gates before this. ───
    if (mustHardTrimVideo(workingUrl, mediaType)) {
        onStage?.('compress');
        console.log(
            '[MediaPrep] FFmpeg hard-trim FIRST (before any size check or upload)',
            { destination, maxSeconds: trimEndTime, uri: workingUrl.slice(0, 96) },
        );

        const rawSize = await statLocalFileBytes(workingUrl);

        if (typeof hardTrimVideoWindowForUpload !== 'function') {
            throw new Error('Video trim is unavailable. Rebuild the app with FFmpeg linked.');
        }

        try {
            const hardTrim = await hardTrimVideoWindowForUpload(workingUrl, destination, {
                startTime: 0,
                endTime: trimEndTime,
                notify: true,
                sourceDurationSec: videoDurationSec,
                onProgress: onCompressProgress,
            });

            if (!hardTrim.wasTrimmed || !hardTrim.uri || hardTrim.uri === workingUrl) {
                throw new Error('Could not trim this video. Try another clip.');
            }
            workingUrl = hardTrim.uri;
            const trimmedSize =
                hardTrim.sizeBytes ?? (await statLocalFileBytes(workingUrl));
            console.log(
                '[MediaPrep] Original video size:',
                rawSize,
                'Trimmed video size:',
                trimmedSize,
            );
        } catch (err) {
            if (
                err instanceof VideoCompressCancelled ||
                (err instanceof Error && err.name === 'FfmpegCancelled')
            ) {
                throw new VideoCompressCancelled();
            }
            trimFailed = true;
            videoCompressFailed = true;
            const detail =
                err instanceof Error
                    ? (err as Error & { detail?: string }).detail || err.message
                    : String(err);
            console.warn('[MediaPrep] FFmpeg trim failed; uploading the original video', {
                uri: workingUrl.slice(0, 160),
                detail,
            });
        }
    }

    const shouldBake = isFiltered(filterInfo);
    const coverTime = Math.max(0, Number(videoCoverTime) || 0);

    if (shouldBake && filterInfo && mediaType === 'image' && captureVideoPoster) {
        try {
            workingUrl = await captureVideoPoster();
        } catch {
            filterExportFailed = true;
        }
    }

    if (mediaType === 'image' && isLocalUri(workingUrl) && !shouldBake) {
        try {
            onStage?.('compress');
            workingUrl = await compressImageForUploadNative(workingUrl);
        } catch {
            /* keep original image */
        }
    }

    // Optional filter bake on already-trimmed clip — failure keeps the trimmed file (never raw).
    if (mediaType === 'video' && mustHardTrimVideo(workingUrl, mediaType)) {
        const filterName = shouldBake && filterInfo ? filterInfo.active : null;
        if (filterName) {
            try {
                onStage?.('compress');
                const filtered = await transcodeVideoForUploadNative(workingUrl, {
                    filterName,
                    maxDurationSec: trimEndTime,
                });
                if (filtered && filtered !== normalizedUrl) {
                    workingUrl = filtered;
                }
            } catch {
                videoCompressFailed = true;
                filterExportFailed = true;
            }
        }
    }

    // A finished hard-trim is already the 1080p upload file. A second encode
    // left the optimize bar at 0% for the whole first pass.
    if (
        mediaType === 'video' &&
        isLocalUri(workingUrl) &&
        !isRemoteUrl(workingUrl) &&
        trimFailed
    ) {
        onStage?.('compress');
        try {
            const compressed = await compressVideoForUploadNative(workingUrl, (fraction) => {
                onCompressProgress?.(fraction);
            });
            if (compressed && compressed !== normalizedUrl) {
                workingUrl = compressed;
            }
        } catch (err) {
            if (err instanceof VideoCompressCancelled) throw err;
            videoCompressFailed = true;
        }
    }

    if (mediaType === 'video') {
        onStage?.('poster');
        videoPosterUrl = await resolveVideoPosterUrl(workingUrl, coverTime, captureVideoPoster);
    }

    if (
        mediaType === 'video' &&
        workingUrl === normalizedUrl &&
        !isRemoteUrl(workingUrl) &&
        !videoCompressFailed
    ) {
        throw new Error('Refusing to upload untrimmed video. Trim step did not run.');
    }

    // ─── STEP 2: upload only the trimmed/compressed file ───
    if (!isRemoteUrl(workingUrl) && (isLocalUri(workingUrl) || mediaType === 'video')) {
        const mime = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
        const name =
            mediaType === 'video' ? `clip-${Date.now()}.mp4` : `photo-${Date.now()}.jpg`;
        onStage?.('upload');

        if (mediaType === 'video') {
            try {
                const bounds = await probeLocalVideoBounds(workingUrl);
                const durationSec = bounds.durationSec;
                if (!trimFailed && durationSec != null && durationSec > trimEndTime + 0.5) {
                    throw new Error(
                        `Video is still ${Math.ceil(durationSec)}s after trim (max ${trimEndTime}s).`,
                    );
                }
            } catch (err) {
                if (err instanceof Error && err.message.includes('after trim')) {
                    throw err;
                }
            }
        }

        workingUrl = await uploadLocalUri(workingUrl, mime, name);
    }

    if (videoPosterUrl && isLocalUri(videoPosterUrl)) {
        videoPosterUrl = await uploadLocalUri(
            videoPosterUrl,
            'image/jpeg',
            `poster-${Date.now()}.jpg`,
        );
    }

    return {
        mediaUrl: workingUrl,
        mediaType,
        videoPosterUrl,
        filterExportFailed: filterExportFailed || undefined,
        videoCompressFailed: videoCompressFailed || undefined,
    };
}
