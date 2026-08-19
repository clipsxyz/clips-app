import { createPost } from '../api/posts';
import { isMockMode } from '../api/apiMode';
import { prepareCarouselMediaForPostNative } from './prepareCarouselMediaForPostNative';
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
        let uploaded = job.localMediaItems.map((item) => ({
            url: item.uri,
            type: item.type,
            duration: item.durationSec,
        }));
        let carouselVideoPoster: string | undefined =
            job.localMediaItems.find((i) => i.type === 'video')?.uri || undefined;

        if (live) {
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
        const preparedMedia = await prepareMediaForPostNative({
            mediaUrl: job.localMediaUri,
            mediaType: job.mediaType,
            filterInfo: job.filterForExport,
            videoCoverTime: job.videoCoverTime,
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
                'runBackgroundFeedUploadNative: video compression failed; uploading best-effort file',
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

/**
 * Compress, upload, and createPost in the background after navigating to the feed.
 */
export function startBackgroundFeedUpload(tempId: string): void {
    const job = getPendingFeedUpload(tempId);
    if (!job || job.status !== 'uploading') return;

    void executePendingFeedUpload(job).catch((err: unknown) => {
        const message =
            err instanceof Error ? err.message : 'Failed to create post. Please try again.';
        console.error('runBackgroundFeedUploadNative:', err);
        failPendingFeedUpload(tempId, message);
        getUploadOverlayForJob(tempId)?.error(message);
    });
}
