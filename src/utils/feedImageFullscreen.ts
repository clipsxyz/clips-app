import type { Post } from '../types';

export function collectFeedImageUrls(post: Post): string[] {
    const urls: string[] = [];
    if (post.mediaItems?.length) {
        for (const item of post.mediaItems) {
            if (item.type === 'video') continue;
            if (item.url) urls.push(item.url);
        }
    }
    if (!urls.length && post.mediaUrl && (post.mediaType || 'image') !== 'video') {
        urls.push(post.mediaUrl);
    }
    return urls;
}

/** Map feed carousel index to fullscreen image-only slide index (web FeedCard parity). */
export function imageFullscreenIndexForCarousel(post: Post, carouselIndex: number): number {
    const raw =
        post.mediaItems && post.mediaItems.length > 0
            ? post.mediaItems
            : post.mediaUrl
              ? [{ url: post.mediaUrl, type: (post.mediaType || 'image') as 'image' | 'video' }]
              : [];
    const active = raw[carouselIndex];
    if (!active || active.type !== 'image' || !active.url) return 0;
    const images = collectFeedImageUrls(post);
    const idx = images.findIndex((url) => url === active.url);
    return idx >= 0 ? idx : 0;
}
