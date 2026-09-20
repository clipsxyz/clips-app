import { queryClient, queryKeys } from '../api/queryClient';
import { runAfterInteractions } from './runAfterInteractionsNative';
import { prefetchCachedImages } from '../components/CachedImage.native';
import type { Post } from '../types';
import { isVideoMediaUri, resolveCarouselItemStillUri } from './postMedia';
import {
    collectFeedVideoPrefetchUris,
    prebufferFeedVideos,
} from './prefetchFeedVideoNative';

/** Prefetch profile payload after a press-in / hover intent. */
export function prefetchUserProfile(handle?: string | null): void {
    const h = String(handle || '').trim();
    if (!h) return;
    void runAfterInteractions(async () => {
        await queryClient.prefetchQuery({
            queryKey: queryKeys.userProfile(h),
            queryFn: async () => {
                const { fetchUserProfile } = await import('../api/client');
                return fetchUserProfile(h);
            },
        });
    });
}

/** Prefetch a user's active story group (Stories 24 rail / avatar ring). */
export function prefetchStoryGroup(handle?: string | null): void {
    const h = String(handle || '').trim();
    if (!h) return;
    void runAfterInteractions(async () => {
        await queryClient.prefetchQuery({
            queryKey: queryKeys.storyGroup(h),
            queryFn: async () => {
                const { fetchStoryGroupByHandle } = await import('../api/stories');
                return fetchStoryGroupByHandle(h);
            },
        });
    });
}

/** Warm inbox lists before the Inbox tab mounts fully. */
export function prefetchInbox(handle?: string | null): void {
    const h = String(handle || '').trim();
    if (!h) return;
    void Promise.all([
        queryClient.prefetchQuery({
            queryKey: queryKeys.notifications(h),
            queryFn: async () => {
                const { getNotifications } = await import('../api/notifications');
                return getNotifications(h);
            },
        }),
        queryClient.prefetchQuery({
            queryKey: queryKeys.conversations(h),
            queryFn: async () => {
                const { listConversations } = await import('../api/messages');
                return listConversations(h);
            },
        }),
    ]);
}

/** Collect still/poster/avatar URLs for a feed batch (images only — not MP4s). */
export function collectFeedMediaPrefetchUris(posts: Post[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const push = (raw?: string | null) => {
        const u = String(raw || '').trim();
        if (!u || !/^https?:\/\//i.test(u) || seen.has(u)) return;
        // Never Image.prefetch video binaries.
        if (isVideoMediaUri(u)) return;
        seen.add(u);
        out.push(u);
    };

    for (const post of posts) {
        push(post.videoPosterUrl);
        if (!isVideoMediaUri(post.mediaUrl)) push(post.mediaUrl);
        push((post as { image_url?: string }).image_url);
        push(post.userAvatarUrl);
        push((post as { userAvatar?: string }).userAvatar);
        const items = post.mediaItems;
        if (Array.isArray(items)) {
            for (let i = 0; i < items.length; i += 1) {
                push(resolveCarouselItemStillUri(post, i));
                const it = items[i] as {
                    type?: string;
                    url?: string;
                    posterUrl?: string;
                    image_url?: string;
                };
                push(it?.posterUrl);
                push(it?.image_url);
                if (it?.type !== 'video' && !isVideoMediaUri(it?.url)) {
                    push(it?.url);
                }
            }
        }
    }
    return out;
}

/**
 * Prefetch images + pre-buffer the first ~1.5–2MB of upcoming feed videos.
 * All work runs inside InteractionManager.runAfterInteractions so it never
 * contends with active scroll gestures or the currently playing player.
 */
export function prefetchFeedPostMedia(posts: Post[]): void {
    if (!posts.length) return;
    const imageUris = collectFeedMediaPrefetchUris(posts);
    const videoUris = collectFeedVideoPrefetchUris(posts);
    if (!imageUris.length && !videoUris.length) return;

    void runAfterInteractions(async () => {
        try {
            if (imageUris.length) {
                try {
                    prefetchCachedImages(imageUris);
                } catch {
                    /* ignore image prefetch errors */
                }
            }
            if (videoUris.length) {
                try {
                    await prebufferFeedVideos(videoUris);
                } catch {
                    /* ignore video prebuffer errors */
                }
            }
        } catch {
            /* ignore */
        }
    }).catch(() => {});
}
