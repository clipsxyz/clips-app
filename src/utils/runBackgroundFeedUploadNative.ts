import { createPost } from '../api/posts';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { prepareCarouselMediaForPostNative } from './prepareCarouselMediaForPostNative';
import { prepareMediaForPostNative } from './prepareMediaForPostNative';
import {
    completePendingFeedUpload,
    failPendingFeedUpload,
    getPendingFeedUpload,
    type PendingFeedUploadJob,
} from './pendingFeedUploadNative';
import { getUploadOverlayForJob } from './uploadOverlayNative';

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

    if (isCarousel && job.localMediaItems) {
        let uploaded = job.localMediaItems.map((item) => ({
            url: item.uri,
            type: item.type,
            duration: item.durationSec,
        }));
        let carouselVideoPoster: string | undefined =
            job.localMediaItems.find((i) => i.type === 'video')?.uri || undefined;

        if (isLaravelApiEnabled()) {
            try {
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
                if (prepared.items.length > 0) {
                    uploaded = prepared.items;
                    carouselVideoPoster =
                        prepared.videoPosterUrl ||
                        prepared.items.find((item) => item.type === 'video' && item.posterUrl)
                            ?.posterUrl;
                }
            } catch (err) {
                console.warn(
                    'runBackgroundFeedUploadNative: carousel upload failed, using local media',
                    err,
                );
            }
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

    if (isLaravelApiEnabled() && job.localMediaUri && job.mediaType) {
        try {
            const preparedMedia = await prepareMediaForPostNative({
                mediaUrl: job.localMediaUri,
                mediaType: job.mediaType,
                filterInfo: job.filterForExport,
                videoCoverTime: job.videoCoverTime,
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
        } catch (err) {
            console.warn(
                'runBackgroundFeedUploadNative: media upload failed, using local media',
                err,
            );
        }
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
