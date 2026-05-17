import { extractVideoPosterFrame } from './extractVideoPosterNative';
import { isFiltered, type InstantFilterInfo } from './instantFiltersNative';
import { transcodeVideoForUploadNative } from './transcodeVideoForUploadNative';
import { uploadFileFromUri } from './uploadFileNative';

type NativeMediaType = 'image' | 'video' | null;

type PrepareNativeMediaArgs = {
    mediaUrl: string | null;
    mediaType: NativeMediaType;
    filterInfo?: InstantFilterInfo | null;
    /** Captures composer preview (media + optional filter overlay) to a temp JPEG. */
    captureVideoPoster?: () => Promise<string>;
    /** Cover frame time in seconds (used for FFmpeg poster fallback). */
    videoCoverTime?: number;
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
        uri.startsWith('data:')
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
    const result = await uploadFileFromUri(uri, mimeType, fileName);
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
        } catch (err) {
            console.warn('prepareMediaForPostNative: preview poster capture failed', err);
        }
    }

    if (!isLocalUri(videoUri)) {
        return undefined;
    }

    try {
        return await extractVideoPosterFrame(videoUri, videoCoverTime);
    } catch (err) {
        console.warn('prepareMediaForPostNative: FFmpeg poster extraction failed', err);
        return undefined;
    }
}

/**
 * Instagram-style pipeline: transcode local video (scale/bitrate/fps + optional filter bake),
 * attach poster, upload, then createPost uses remote URLs.
 */
export async function prepareMediaForPostNative({
    mediaUrl,
    mediaType,
    filterInfo,
    captureVideoPoster,
    videoCoverTime = 0,
}: PrepareNativeMediaArgs): Promise<PrepareNativeMediaResult> {
    if (!mediaUrl || !mediaType) {
        return {};
    }

    const normalizedUrl = mediaUrl.trim();
    if (!normalizedUrl) {
        return {};
    }

    let workingUrl = normalizedUrl;
    let videoPosterUrl: string | undefined;
    let filterExportFailed = false;
    let videoCompressFailed = false;

    const shouldBake = isFiltered(filterInfo);
    const coverTime = Math.max(0, Number(videoCoverTime) || 0);

    if (shouldBake && filterInfo && mediaType === 'image' && captureVideoPoster) {
        try {
            workingUrl = await captureVideoPoster();
        } catch (err) {
            console.warn('prepareMediaForPostNative: image filter bake failed', err);
            filterExportFailed = true;
        }
    }

    if (mediaType === 'video' && isLocalUri(workingUrl)) {
        const filterName = shouldBake && filterInfo ? filterInfo.active : null;
        try {
            workingUrl = await transcodeVideoForUploadNative(workingUrl, { filterName });
        } catch (err) {
            console.warn('prepareMediaForPostNative: video transcode/compress failed', err);
            videoCompressFailed = true;
            if (shouldBake) {
                filterExportFailed = true;
            }
        }
    }

    if (mediaType === 'video') {
        videoPosterUrl = await resolveVideoPosterUrl(workingUrl, coverTime, captureVideoPoster);
        if (!videoPosterUrl && workingUrl !== normalizedUrl) {
            videoPosterUrl = await resolveVideoPosterUrl(normalizedUrl, coverTime, captureVideoPoster);
        }
    }

    try {
        if (isLocalUri(workingUrl)) {
            const mime = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
            const name = mediaType === 'video' ? `clip-${Date.now()}.mp4` : `photo-${Date.now()}.jpg`;
            workingUrl = await uploadLocalUri(workingUrl, mime, name);
        }

        if (videoPosterUrl && isLocalUri(videoPosterUrl)) {
            videoPosterUrl = await uploadLocalUri(videoPosterUrl, 'image/jpeg', `poster-${Date.now()}.jpg`);
        }
    } catch (err) {
        console.error('prepareMediaForPostNative: upload failed', err);
        throw err;
    }

    return {
        mediaUrl: workingUrl,
        mediaType,
        videoPosterUrl,
        filterExportFailed: filterExportFailed || undefined,
        videoCompressFailed: videoCompressFailed || undefined,
    };
}
