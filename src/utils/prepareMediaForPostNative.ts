import { extractVideoPosterFrame } from './extractVideoPosterNative';
import { isFiltered, type InstantFilterInfo } from './instantFiltersNative';
import {
    compressImageForUploadNative,
    transcodeVideoForUploadNative,
} from './transcodeVideoForUploadNative';
import { resolveLocalMediaUriForFfmpeg } from './resolveLocalMediaUriForFfmpegNative';
import { normalizeUploadUri, uploadFileFromUri } from './uploadFileNative';
import {
    assertLocalVideoUnderUploadLimit,
    ensureFeedVideoUnderLimits,
} from './autoTrimVideoNative';
import {
    probeLocalVideoBounds,
} from './validateLocalVideoNative';

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
};

type PrepareNativeMediaResult = {
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    videoPosterUrl?: string;
    filterExportFailed?: boolean;
    /** True when Instagram-style FFmpeg compression could not run; original file may be uploaded. */
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
        // Absolute device paths from FFmpeg / FileSystem without a scheme.
        (uri.startsWith('/') && !uri.includes('://'))
    );
}

async function uploadLocalUri(
    uri: string,
    mimeType: string,
    fileName: string,
): Promise<string> {
    if (isRemoteUrl(uri)) {
        return uri;
    }
    // Always normalize to file:// (or resolved local path) before FormData upload.
    const localUri = normalizeUploadUri(uri);
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

    if (!isLocalUri(videoUri)) {
        return undefined;
    }

    try {
        return await extractVideoPosterFrame(videoUri, videoCoverTime);
    } catch {
        return undefined;
    }
}

/**
 * On-device pipeline: transcode local video (720p / bitrate cap / fps + optional filter bake),
 * attach poster, upload, then createPost uses remote URLs.
 * Heavy FFmpeg / network work is async — callers should start this after interactions settle.
 */
export async function prepareMediaForPostNative({
    mediaUrl,
    mediaType,
    filterInfo,
    captureVideoPoster,
    videoCoverTime = 0,
    onStage,
}: PrepareNativeMediaArgs): Promise<PrepareNativeMediaResult> {
    if (!mediaUrl || !mediaType) {
        return {};
    }

    const normalizedUrl = normalizeUploadUri(mediaUrl.trim());
    if (!normalizedUrl) {
        return {};
    }

    let workingUrl = normalizedUrl;
    let videoPosterUrl: string | undefined;
    let filterExportFailed = false;
    let videoCompressFailed = false;

    // Always keep first 60s + compress when long/oversized — never fail before trying.
    if (mediaType === 'video' && isLocalUri(workingUrl)) {
        try {
            const ensured = await ensureFeedVideoUnderLimits(workingUrl, {}, { notify: true });
            workingUrl = ensured.uri;
        } catch (err) {
            throw err instanceof Error ? err : new Error('Could not prepare this video.');
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
            /* keep original */
        }
    }

    if (mediaType === 'video' && isLocalUri(workingUrl)) {
        const alreadyTrimmed = /trim60|trim\d+c/i.test(workingUrl);
        const filterName = shouldBake && filterInfo ? filterInfo.active : null;
        // Skip second Instagram pass when ensure already produced a 60s compact MP4 —
        // re-encoding without -t was leaving huge files that 413'd under PHP limits.
        if (!alreadyTrimmed || filterName) {
            try {
                onStage?.('compress');
                workingUrl = await transcodeVideoForUploadNative(workingUrl, { filterName });
            } catch {
                videoCompressFailed = true;
                if (shouldBake) {
                    filterExportFailed = true;
                }
                try {
                    workingUrl = await resolveLocalMediaUriForFfmpeg(workingUrl);
                } catch {
                    /* upload original URI */
                }
            }
        } else {
            onStage?.('compress');
        }
        try {
            const ensured = await ensureFeedVideoUnderLimits(workingUrl, {}, { notify: false });
            workingUrl = ensured.uri;
        } catch (err) {
            throw err instanceof Error ? err : new Error('Could not prepare this video.');
        }
    }

    if (mediaType === 'video') {
        onStage?.('poster');
        videoPosterUrl = await resolveVideoPosterUrl(workingUrl, coverTime, captureVideoPoster);
        if (!videoPosterUrl && workingUrl !== normalizedUrl) {
            videoPosterUrl = await resolveVideoPosterUrl(normalizedUrl, coverTime, captureVideoPoster);
        }
    }

    if (isLocalUri(workingUrl)) {
        const mime = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
        const name =
            mediaType === 'video' ? `clip-${Date.now()}.mp4` : `photo-${Date.now()}.jpg`;
        onStage?.('upload');

        if (mediaType === 'video') {
            // Hard gate after trim/compress — never start a multi-minute upload that will 413.
            let durationSec: number | null = null;
            try {
                const bounds = await probeLocalVideoBounds(workingUrl);
                durationSec = bounds.durationSec;
            } catch {
                /* ignore probe errors */
            }
            await assertLocalVideoUnderUploadLimit(workingUrl, {
                durationSec,
                stage: 'prepareMediaForPostNative:pre-upload',
            });
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
