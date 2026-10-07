import { createPost } from '../api/posts';
import { isMockMode } from '../api/apiMode';
import {
    prepareCarouselMediaForPostNative,
    type UploadedCarouselItem,
} from './prepareCarouselMediaForPostNative';
import { prepareMediaForPostNative } from './prepareMediaForPostNative';
import {
    completePendingFeedUpload,
    failPendingFeedUpload,
    getPendingFeedUpload,
    type PendingFeedUploadJob,
} from './pendingFeedUploadNative';
import { getUploadOverlayForJob } from './uploadOverlayNative';

function isLocalDeviceMediaUrl(url?: string | null): boolean {
    if (!url) return false;
    return /^(file|content|ph):\/\//i.test(url) || url.startsWith('data:');
}

function assertRemoteMediaForLive(url: string | undefined, label: string): void {
    if (isMockMode()) return;
    if (!url) return;
    if (isLocalDeviceMediaUrl(url)) {
        throw new Error(
            `${label} is still a local device file. Upload to the server failed — check Laravel is reachable (adb reverse tcp:8000) and try again.`,
        );
    }
}

/**
 * Pipeline: prepareMediaForPostNative always runs FFmpeg hard-trim BEFORE multipart upload.
 * There is no client-side UploadTooLarge / byte-size gate in this module.
 */
async function executePendingFeedUpload(job: PendingFeedUploadJob): Promise<void> {
    if (job.isTextOnly) {
        const createdPost = await createPost(
            job.userId,
            job.userHandle,
            job.text,
            job.location,
            undefined,
            undefined,
            undefined,
            undefined,
            job.userLocal,
            job.userRegional,
            job.userNational,
            undefined,
            job.templateId,
            undefined,
            undefined,
            job.textStyle,
            job.taggedUsers && job.taggedUsers.length > 0 ? job.taggedUsers : undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            job.venue,
            job.landmark,
        );
        completePendingFeedUpload(job.tempId, createdPost);
        getUploadOverlayForJob(job.tempId)?.success();
        return;
    }

    const isCarousel =
        Array.isArray(job.localMediaItems) && job.localMediaItems.length > 1;
    const live = !isMockMode();

    if (isCarousel && job.localMediaItems) {
        let uploaded: UploadedCarouselItem[] = job.localMediaItems.map((item) => ({
            url: item.uri,
            type: item.type,
            duration: item.durationSec,
        }));
        let carouselVideoPoster: string | undefined =
            job.localMediaItems.find((i) => i.type === 'video')?.uri || undefined;

        if (live) {
            console.log(
                '[FeedUpload] carousel: FFmpeg trim/scale first via prepareCarouselMediaForPostNative',
            );
            const videoFilter =
                job.mediaType === 'video' ||
                job.localMediaItems.some((i) => i.type === 'video')
                    ? job.filterForExport
                    : null;
            const prepared = await prepareCarouselMediaForPostNative(job.localMediaItems, {
                filterInfo: job.filterForExport,
                videoFilterInfo: videoFilter,
                videoCoverTime: job.videoCoverTime,
            });
            if (prepared.items.length === 0) {
                throw new Error('Carousel upload returned no items.');
            }
            uploaded = prepared.items;
            carouselVideoPoster =
                prepared.videoPosterUrl ||
                prepared.items.find((item) => item.type === 'video' && item.posterUrl)?.posterUrl;
            for (const item of uploaded) {
                assertRemoteMediaForLive(item.url, 'Carousel item');
            }
            assertRemoteMediaForLive(carouselVideoPoster, 'Carousel poster');
        }

        if (uploaded.length === 0) {
            throw new Error('No carousel media to upload.');
        }
        const first = uploaded[0];
        const createdPost = await createPost(
            job.userId,
            job.userHandle,
            job.text,
            job.location,
            first.url,
            first.type,
            undefined,
            job.text || undefined,
            job.userLocal,
            job.userRegional,
            job.userNational,
            job.stickers && job.stickers.length > 0 ? job.stickers : undefined,
            undefined,
            uploaded,
            undefined,
            undefined,
            job.taggedUsers && job.taggedUsers.length > 0 ? job.taggedUsers : undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            job.venue,
            job.landmark,
            undefined,
            undefined,
            carouselVideoPoster,
        );
        completePendingFeedUpload(job.tempId, createdPost);
        getUploadOverlayForJob(job.tempId)?.success();
        return;
    }

    let mediaUrl = job.localMediaUri || undefined;
    let mediaType = job.mediaType || undefined;
    let videoPosterUrl: string | undefined;

    if (live && job.localMediaUri && job.mediaType) {
        const overlay = getUploadOverlayForJob(job.tempId);
        console.log('[FeedUpload] FFmpeg hard-trim FIRST, then upload', {
            tempId: job.tempId,
            mediaType: job.mediaType,
            destination: 'feed',
            uriPreview: String(job.localMediaUri).slice(0, 96),
        });
        const preparedMedia = await prepareMediaForPostNative({
            mediaUrl: job.localMediaUri,
            mediaType: job.mediaType,
            filterInfo: job.filterForExport,
            videoCoverTime: job.videoCoverTime,
            destination: 'feed',
            onStage: (stage) => {
                if (stage === 'compress') {
                    overlay?.progress('This may take a moment.', 'Posting your clip…');
                } else if (stage === 'poster') {
                    overlay?.progress('Almost there…', 'Posting your clip…');
                } else {
                    overlay?.progress('Sharing to your feed…', 'Posting your clip…');
                }
            },
        });
        if (preparedMedia.filterExportFailed && job.filterForExport) {
            console.warn('runBackgroundFeedUploadNative: filter bake partially failed');
        }
        if (preparedMedia.videoCompressFailed && job.mediaType === 'video') {
            console.warn(
                'runBackgroundFeedUploadNative: filter bake failed after trim; uploading trimmed clip',
            );
        }
        mediaUrl = preparedMedia.mediaUrl || mediaUrl;
        mediaType = preparedMedia.mediaType || mediaType;
        videoPosterUrl = preparedMedia.videoPosterUrl;
        assertRemoteMediaForLive(mediaUrl, 'Post media');
        assertRemoteMediaForLive(videoPosterUrl, 'Video poster');
    }

    const createdPost = await createPost(
        job.userId,
        job.userHandle,
        job.text,
        job.location,
        mediaUrl,
        mediaType,
        undefined,
        mediaUrl ? job.text || undefined : undefined,
        job.userLocal,
        job.userRegional,
        job.userNational,
        job.stickers && job.stickers.length > 0 ? job.stickers : undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        job.taggedUsers && job.taggedUsers.length > 0 ? job.taggedUsers : undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        job.venue,
        job.landmark,
        undefined,
        undefined,
        videoPosterUrl,
    );

    completePendingFeedUpload(job.tempId, createdPost);
    getUploadOverlayForJob(job.tempId)?.success();
}

/** Map errors for the overlay — no custom 413 / size-specific messaging. */
function messageForUploadError(err: unknown): string {
    const raw = err instanceof Error ? err.message : '';
    const name = err instanceof Error ? err.name : '';

    if (
        /Network request failed/i.test(raw) ||
        /Failed to fetch/i.test(raw) ||
        name === 'ConnectionRefused' ||
        /CONNECTION_REFUSED/i.test(raw)
    ) {
        return 'Could not reach the upload server. Check Wi‑Fi / adb reverse and that Laravel is running on port 8000.';
    }
    if (raw) return raw;
    return 'Failed to create post. Please try again.';
}

function reportBackgroundUploadFailure(tempId: string, err: unknown): void {
    const message = messageForUploadError(err);
    console.error('runBackgroundFeedUploadNative:', err);
    try {
        if (typeof failPendingFeedUpload === 'function') {
            failPendingFeedUpload(tempId, message);
        }
    } catch (failErr) {
        console.warn('runBackgroundFeedUploadNative: failPendingFeedUpload error', failErr);
    }
    try {
        const overlay = getUploadOverlayForJob(tempId);
        if (overlay && typeof overlay.error === 'function') {
            overlay.error(message);
        }
    } catch (overlayErr) {
        console.warn('runBackgroundFeedUploadNative: overlay error', overlayErr);
    }
}

export function startBackgroundFeedUpload(tempId: string): void {
    const job = getPendingFeedUpload(tempId);
    if (!job || job.status !== 'uploading') return;

    void executePendingFeedUpload(job).catch((err: unknown) => {
        reportBackgroundUploadFailure(tempId, err);
    });
}
