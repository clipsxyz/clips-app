import { Image } from 'react-native';
import type { Post } from '../types';
import {
    postHasVideoMedia,
    resolveCarouselItemStillUri,
    resolvePostPlaybackUri,
    siblingJpegFromVideoUrl,
} from './postMedia';

export type FeedMediaSize = { width: number; height: number };

const sizeByPostId = new Map<string, FeedMediaSize>();
const inFlight = new Set<string>();
const listeners = new Set<(postId: string, size: FeedMediaSize) => void>();

function isLandscapeSize(size: FeedMediaSize): boolean {
    return size.width > size.height * 1.15;
}

export function peekFeedMediaSize(postId: string): FeedMediaSize | null {
    return sizeByPostId.get(String(postId)) ?? null;
}

export function rememberFeedMediaSize(postId: string, width: number, height: number): FeedMediaSize | null {
    if (!(width > 0 && height > 0) || !postId) return peekFeedMediaSize(postId);
    const key = String(postId);
    const next = { width, height };
    const prev = sizeByPostId.get(key);
    if (prev && isLandscapeSize(prev)) return prev;
    if (prev && !isLandscapeSize(next)) return prev;
    sizeByPostId.set(key, next);
    listeners.forEach((fn) => {
        try {
            fn(key, next);
        } catch {
            /* ignore */
        }
    });
    return next;
}

export function subscribeFeedMediaSize(
    listener: (postId: string, size: FeedMediaSize) => void,
): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function posterUriForPost(post: Post): string | undefined {
    const items = (post.mediaItems || []).filter(
        (item) => item?.type === 'image' || item?.type === 'video',
    );
    const fromSlide = resolveCarouselItemStillUri(items[0], post, 0, items);
    if (fromSlide) return fromSlide;
    const extra = post as { thumbnailUrl?: string; thumbnail_url?: string };
    const poster = String(post.videoPosterUrl || extra.thumbnailUrl || extra.thumbnail_url || '').trim();
    if (poster && !/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(poster)) return poster;
    return siblingJpegFromVideoUrl(resolvePostPlaybackUri(post));
}

/** Measure posters as soon as a feed page lands so landscape frames exist before scroll. */
export function prefetchFeedMediaSizes(posts: Post[]): void {
    for (const post of posts) {
        const id = String(post.id || '');
        if (!id || peekFeedMediaSize(id) || inFlight.has(id)) continue;
        if (!postHasVideoMedia(post)) continue;
        const uri = posterUriForPost(post);
        if (!uri) continue;
        inFlight.add(id);
        Image.getSize(
            uri,
            (width, height) => {
                inFlight.delete(id);
                rememberFeedMediaSize(id, width, height);
            },
            () => {
                inFlight.delete(id);
            },
        );
    }
}
