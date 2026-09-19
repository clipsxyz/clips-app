import type { Post } from '../types';
import type { StickerOverlay } from '../types';
import type { InstantFilterInfo } from './instantFiltersNative';

export type PendingCarouselLocalItem = {
    uri: string;
    type: 'image' | 'video';
    videoCoverTime?: number;
    durationSec?: number;
};

export type PendingFeedUploadJob = {
    tempId: string;
    status: 'uploading' | 'failed';
    errorMessage?: string;
    createdAt: number;
    userId: string;
    userHandle: string;
    text: string;
    location: string;
    localMediaUri: string | null;
    localThumbUri: string | null;
    /** When length > 1, feed shows carousel while uploading (web parity). */
    localMediaItems?: PendingCarouselLocalItem[];
    mediaType: 'image' | 'video' | null;
    videoCoverTime: number;
    filterForExport: InstantFilterInfo | null;
    userLocal?: string;
    userRegional?: string;
    userNational?: string;
    stickers?: StickerOverlay[];
    taggedUsers?: string[];
    venue?: string;
    landmark?: string;
    socialFormat?: 'youtube_shorts' | 'tiktok' | 'instagram_reels';
    placeId?: string;
    latitude?: number;
    longitude?: number;
    /** Text-only feed postcard (no media upload). */
    isTextOnly?: boolean;
    textStyle?: {
        color?: string;
        size?: 'small' | 'medium' | 'large';
        background?: string;
        fontFamily?: string;
    };
    templateId?: string;
};

const pendingById = new Map<string, PendingFeedUploadJob>();
const listeners = new Set<() => void>();
type CompleteListener = (tempId: string, post: Post) => void;
const completeListeners = new Set<CompleteListener>();

function notify() {
    listeners.forEach((cb) => {
        try {
            cb();
        } catch (err) {
            console.warn('pendingFeedUploadNative listener error', err);
        }
    });
}

export function subscribePendingFeedUploads(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function subscribePendingFeedUploadComplete(listener: CompleteListener): () => void {
    completeListeners.add(listener);
    return () => completeListeners.delete(listener);
}

export function getPendingFeedUploads(): PendingFeedUploadJob[] {
    return Array.from(pendingById.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function getPendingFeedUpload(tempId: string): PendingFeedUploadJob | undefined {
    return pendingById.get(tempId);
}

export function addPendingFeedUpload(
    job: Omit<PendingFeedUploadJob, 'status' | 'createdAt'>,
): PendingFeedUploadJob {
    const entry: PendingFeedUploadJob = {
        ...job,
        status: 'uploading',
        createdAt: Date.now(),
    };
    pendingById.set(job.tempId, entry);
    notify();
    return entry;
}

export function failPendingFeedUpload(tempId: string, errorMessage: string): void {
    const existing = pendingById.get(tempId);
    if (!existing) return;
    pendingById.set(tempId, {
        ...existing,
        status: 'failed',
        errorMessage: errorMessage || 'Post failed',
    });
    notify();
}

export function dismissPendingFeedUpload(tempId: string): void {
    if (!pendingById.delete(tempId)) return;
    notify();
}

/** True when a job cannot safely run (missing media, empty carousel, etc.). */
export function isCorruptPendingFeedUpload(job: PendingFeedUploadJob): boolean {
    if (job.isTextOnly) return false;
    const hasSingle = Boolean(job.localMediaUri && job.mediaType);
    const hasCarousel =
        Array.isArray(job.localMediaItems) &&
        job.localMediaItems.length > 0 &&
        job.localMediaItems.every(
            (item) => Boolean(item?.uri) && (item.type === 'image' || item.type === 'video'),
        );
    return !hasSingle && !hasCarousel;
}

const STALE_UPLOADING_MS = 45 * 60 * 1000;

/**
 * Drop failed / corrupt / abandoned uploading jobs so they cannot loop forever
 * or keep the feed re-rendering. Safe to call on app boot and when the feed mounts.
 */
export function clearStalePendingFeedUploads(opts?: {
    /** Also drop `uploading` jobs older than this (default 45m). */
    staleUploadingMs?: number;
}): number {
    const staleMs = opts?.staleUploadingMs ?? STALE_UPLOADING_MS;
    const now = Date.now();
    let removed = 0;
    for (const [id, job] of pendingById) {
        const corrupt = isCorruptPendingFeedUpload(job);
        const failed = job.status === 'failed';
        const abandonedUploading =
            job.status === 'uploading' && now - job.createdAt > staleMs;
        if (corrupt || failed || abandonedUploading) {
            pendingById.delete(id);
            removed += 1;
        }
    }
    if (removed > 0) notify();
    return removed;
}

/** Boot-time sweep — remove anything that cannot resume after a reload. */
export function clearPendingFeedUploadsOnBoot(): number {
    // In-memory queue does not survive process death; any leftover `uploading`
    // entry after a Fast Refresh / soft restart has no runner — drop it.
    let removed = 0;
    for (const [id, job] of pendingById) {
        if (job.status === 'failed' || job.status === 'uploading' || isCorruptPendingFeedUpload(job)) {
            pendingById.delete(id);
            removed += 1;
        }
    }
    if (removed > 0) notify();
    return removed;
}

export function completePendingFeedUpload(tempId: string, post: Post): void {
    pendingById.delete(tempId);
    notify();
    completeListeners.forEach((cb) => {
        try {
            cb(tempId, post);
        } catch (err) {
            console.warn('pendingFeedUploadNative complete listener error', err);
        }
    });
}

export function pendingUploadToPost(job: PendingFeedUploadJob): Post {
    if (job.isTextOnly) {
        return {
            id: job.tempId,
            user_id: job.userId,
            userHandle: job.userHandle,
            locationLabel: job.location,
            venue: job.venue,
            landmark: job.landmark,
            tags: [],
            text: job.text || undefined,
            caption: job.text || undefined,
            textStyle: job.textStyle,
            templateId: job.templateId,
            taggedUsers: job.taggedUsers,
            userLocal: job.userLocal,
            userRegional: job.userRegional,
            userNational: job.userNational,
            createdAt: job.createdAt,
            stats: { likes: 0, views: 0, comments: 0, shares: 0, reclips: 0 },
            isBookmarked: false,
            isFollowing: false,
            userLiked: false,
            clientUploadStatus: job.status,
            clientUploadError: job.errorMessage,
        };
    }

    const previewUri = job.localThumbUri || job.localMediaUri || undefined;
    const carouselLocal =
        job.localMediaItems && job.localMediaItems.length > 1
            ? job.localMediaItems.map((item) => ({
                  url: item.uri,
                  type: item.type,
                  posterUrl: item.type === 'image' ? item.uri : undefined,
              }))
            : undefined;
    const firstCarousel = job.localMediaItems?.[0];
    return {
        id: job.tempId,
        user_id: job.userId,
        userHandle: job.userHandle,
        locationLabel: job.location,
        venue: job.venue,
        landmark: job.landmark,
        tags: [],
        mediaUrl: previewUri,
        mediaItems: carouselLocal,
        mediaType: job.mediaType || undefined,
        videoPosterUrl:
            firstCarousel?.type === 'video' || job.mediaType === 'video' ? previewUri : undefined,
        text: job.text || undefined,
        caption: job.text || undefined,
        createdAt: job.createdAt,
        stats: { likes: 0, views: 0, comments: 0, shares: 0, reclips: 0 },
        isBookmarked: false,
        isFollowing: false,
        userLiked: false,
        clientUploadStatus: job.status,
        clientLocalMediaUri: previewUri,
        clientUploadError: job.errorMessage,
    };
}
