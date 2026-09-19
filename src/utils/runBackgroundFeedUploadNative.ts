import { Alert } from 'react-native';
import { createPost } from '../api/posts';
import { isMockMode } from '../api/apiMode';
import { prepareCarouselMediaForPostNative } from './prepareCarouselMediaForPostNative';
import { prepareMediaForPostNative } from './prepareMediaForPostNative';
import {
    completePendingFeedUpload,
    dismissPendingFeedUpload,
    failPendingFeedUpload,
    getPendingFeedUpload,
    isCorruptPendingFeedUpload,
    type PendingFeedUploadJob,
} from './pendingFeedUploadNative';
import { getUploadOverlayForJob } from './uploadOverlayNative';
import { validateLocalVideoForUpload } from './validateLocalVideoNative';
import { assertLocalVideoUnderUploadLimit } from './autoTrimVideoNative';
import { runAfterInteractions } from './runAfterInteractionsNative';

/** Prevents double-start / retry loops for the same temp id. */
const inFlightTempIds = new Set<string>();

function isLocalDeviceMediaUrl(url?: string | null): boolean {
    if (!url) return false;
    return /^(file|content|ph):\/\//i.test(url) || url.startsWith('data:');
}

function messageForUploadError(err: unknown): string {
    const raw = err instanceof Error ? err.message : '';
    const name = err instanceof Error ? err.name : '';
    if (
        name === 'UploadTooLarge' ||
        /\b413\b/.test(raw) ||
        /file too large/i.test(raw) ||
        /too large to upload/i.test(raw)
    ) {
        return 'This clip is too large to upload. Try a shorter video.';
    }
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

function assertRemoteMediaForLive(url: string | undefined, label: string): void {
    if (isMockMode()) return;
    if (!url) return;
    if (isLocalDeviceMediaUrl(url)) {
        throw new Error(
            `${label} is still a local device file. Upload to the server failed — check Laravel is reachable (adb reverse tcp:8000) and try again.`,
        );
    }
}

/** Auto-trim / size-gate local videos before any network or heavy compress work. */
async function preflightLocalVideoUri(
    uri: string,
    durationSec?: number,
): Promise<{ uri: string; durationSec?: number }> {
    const check = await validateLocalVideoForUpload(
        uri,
        { durationSec },
        { notifyTrim: false },
    );
    if (!check.ok) {
        const err = new Error(check.message);
        if (check.reason === 'size') err.name = 'UploadTooLarge';
        throw err;
    }
    const nextUri = check.uri || check.bounds.uri || uri;
    const nextDuration = check.bounds.durationSec ?? durationSec;
    await assertLocalVideoUnderUploadLimit(nextUri, {
        durationSec: nextDuration,
        stage: 'runBackgroundFeedUploadNative:preflight',
    });
    return {
        uri: nextUri,
        durationSec: nextDuration,
    };
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
            job.socialFormat,
            undefined,
            undefined,
            job.placeId,
            job.latitude,
            job.longitude,
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
            const preflightItems = [];
            for (const item of job.localMediaItems) {
                if (item.type === 'video') {
                    const next = await preflightLocalVideoUri(item.uri, item.durationSec);
                    preflightItems.push({
                        ...item,
                        uri: next.uri,
                        durationSec: next.durationSec,
                    });
                } else {
                    preflightItems.push(item);
                }
            }
            const prepared = await prepareCarouselMediaForPostNative(preflightItems, {
                filterInfo: job.filterForExport,
                videoFilterInfo: videoFilter,
                videoCoverTime: job.videoCoverTime,
            });
            if (prepared.items.length === 0) {
                throw new Error('Carousel upload returned no items.');
            }
            uploaded = prepared.items.map((item) => ({
                url: item.url,
                type: item.type,
                duration: item.duration,
                posterUrl: item.posterUrl,
            }));
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
            job.socialFormat,
            undefined,
            carouselVideoPoster,
            job.placeId,
            job.latitude,
            job.longitude,
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
        let localUri = job.localMediaUri;
        if (job.mediaType === 'video') {
            const durationSec =
                job.localMediaItems?.find((item) => item.uri === localUri)?.durationSec ??
                job.localMediaItems?.[0]?.durationSec;
            const next = await preflightLocalVideoUri(localUri, durationSec);
            localUri = next.uri;
        }
        let lastStage: string | null = null;
        const preparedMedia = await prepareMediaForPostNative({
            mediaUrl: localUri,
            mediaType: job.mediaType,
            filterInfo: job.filterForExport,
            videoCoverTime: job.videoCoverTime,
            onStage: (stage) => {
                // Deduplicate stage updates — avoid overlay / feed re-render storms.
                if (stage === lastStage) return;
                lastStage = stage;
                if (stage === 'compress') {
                    overlay?.progress('This may take a moment.', 'Posting your clip…');
                } else if (stage === 'poster') {
                    overlay?.progress('Almost there…', 'Posting your clip…');
                } else {
                    overlay?.progress('Sharing to your feed…', 'Posting your clip…');
                }
            },
        });
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
        job.socialFormat,
        undefined,
        videoPosterUrl,
        job.placeId,
        job.latitude,
        job.longitude,
    );

    completePendingFeedUpload(job.tempId, createdPost);
    getUploadOverlayForJob(job.tempId)?.success();
}

/**
 * Compress, upload, and createPost after the current navigation/transition settles
 * so FFmpeg + multipart work do not contend with the UI thread.
 */
export function startBackgroundFeedUpload(tempId: string): void {
    if (inFlightTempIds.has(tempId)) return;

    const job = getPendingFeedUpload(tempId);
    if (!job) return;

    if (isCorruptPendingFeedUpload(job)) {
        dismissPendingFeedUpload(tempId);
        getUploadOverlayForJob(tempId)?.dismiss();
        return;
    }

    if (job.status !== 'uploading') return;

    inFlightTempIds.add(tempId);

    void runAfterInteractions(async () => {
        const latest = getPendingFeedUpload(tempId);
        if (!latest || latest.status !== 'uploading' || isCorruptPendingFeedUpload(latest)) {
            if (latest && isCorruptPendingFeedUpload(latest)) {
                dismissPendingFeedUpload(tempId);
            }
            return;
        }
        await executePendingFeedUpload(latest);
    })
        .catch((err: unknown) => {
            const message = messageForUploadError(err);
            failPendingFeedUpload(tempId, message);
            getUploadOverlayForJob(tempId)?.error(message);
            if (
                err instanceof Error &&
                (err.name === 'UploadTooLarge' ||
                    /\b413\b/.test(err.message) ||
                    /too large/i.test(message))
            ) {
                Alert.alert('File too large', message);
            }
        })
        .finally(() => {
            inFlightTempIds.delete(tempId);
        });
}
