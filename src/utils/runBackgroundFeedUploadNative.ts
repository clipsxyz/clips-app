import { createPost } from '../api/posts';
import { prepareMediaForPostNative } from './prepareMediaForPostNative';
import {
    completePendingFeedUpload,
    failPendingFeedUpload,
    getPendingFeedUpload,
    type PendingFeedUploadJob,
} from './pendingFeedUploadNative';

async function executePendingFeedUpload(job: PendingFeedUploadJob): Promise<void> {
    let preparedMedia: Awaited<ReturnType<typeof prepareMediaForPostNative>> = {};

    if (job.localMediaUri && job.mediaType) {
        preparedMedia = await prepareMediaForPostNative({
            mediaUrl: job.localMediaUri,
            mediaType: job.mediaType,
            filterInfo: job.filterForExport,
            videoCoverTime: job.videoCoverTime,
        });

        if (preparedMedia.filterExportFailed && job.filterForExport) {
            console.warn(
                'runBackgroundFeedUploadNative: filter bake partially failed',
            );
        }
        if (preparedMedia.videoCompressFailed && job.mediaType === 'video') {
            console.warn(
                'runBackgroundFeedUploadNative: video compression failed; uploading best-effort file',
            );
        }
    }

    const createdPost = await createPost(
        job.userId,
        job.userHandle,
        job.text,
        job.location,
        preparedMedia.mediaUrl,
        preparedMedia.mediaType,
        undefined,
        preparedMedia.mediaUrl ? job.text || undefined : undefined,
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
        preparedMedia.videoPosterUrl,
    );

    completePendingFeedUpload(job.tempId, createdPost);
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
    });
}
