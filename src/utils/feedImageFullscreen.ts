import type { Post } from '../types';

const VIDEO_URL_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/**
 * One fullscreen page: either a still or a playable video.
 *
 * WHY THIS EXISTS
 * ---------------
 * The fullscreen surface used to be modelled as "a list of image URLs", and video was
 * dropped from that list entirely. That silently broke every video post opened from the
 * post-detail screen: the modal received zero images, so it rendered either the "No image to
 * show" empty state or, when the post had a caption, a text card -- both on a black shell,
 * with the overlay chrome still visible and no media playing.
 *
 * A slide list keeps image and video as peers so the modal can render whichever it gets.
 */
export type FullscreenSlide = {
    kind: 'image' | 'video';
    url: string;
    /** First frame for video slides, so playback is never a black flash before `onLoad`. */
    posterUrl?: string;
};

/** Best available still for a video slide. Posters are generated for video by the backend. */
export function resolveFullscreenPoster(post: Post): string | undefined {
    const candidates = [post.videoPosterUrl, post.thumbnailUrl];
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim() !== '') return candidate;
    }
    return undefined;
}

/**
 * Every renderable media slide on a post, in carousel order.
 *
 * Text slides are excluded: they are not media, and the modal has a dedicated caption
 * rendering path for a post whose media is entirely text. `data:text/` URLs are excluded
 * because they are not decodable by either <Image> or <Video>.
 *
 * Falls back to the post-level `mediaUrl` when there are no usable `mediaItems`, which is
 * how legacy rows still store image posts.
 */
export function collectFeedFullscreenSlides(post: Post): FullscreenSlide[] {
    const slides: FullscreenSlide[] = [];
    const poster = resolveFullscreenPoster(post);
    const items = post.mediaItems?.length ? post.mediaItems : null;

    if (items) {
        for (const item of items) {
            if (!item?.url) continue;
            if (item.type === 'text') continue;
            if (/^data:text\//i.test(item.url)) continue;
            slides.push(
                item.type === 'video'
                    ? { kind: 'video', url: item.url, posterUrl: poster }
                    : { kind: 'image', url: item.url },
            );
        }
    }

    if (!slides.length) {
        const url = post.mediaUrl;
        if (typeof url === 'string' && url !== '' && !/^data:text\//i.test(url)) {
            const isVideo = post.mediaType === 'video' || VIDEO_URL_RE.test(url);
            slides.push(
                isVideo ? { kind: 'video', url, posterUrl: poster } : { kind: 'image', url },
            );
        }
    }

    return slides;
}

export function collectFeedImageUrls(post: Post): string[] {
    const urls: string[] = [];
    if (post.mediaItems?.length) {
        for (const item of post.mediaItems) {
            if (item.type === 'video' || item.type === 'text') continue;
            if (!item.url) continue;
            // Text slides sometimes ship as data:text URLs — not still images.
            if (/^data:text\//i.test(item.url)) continue;
            urls.push(item.url);
        }
    }
    if (!urls.length && post.mediaUrl && (post.mediaType || 'image') !== 'video') {
        if (!/^data:text\//i.test(post.mediaUrl)) urls.push(post.mediaUrl);
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

/**
 * Map a feed carousel index onto the matching fullscreen SLIDE.
 *
 * Positional mapping is wrong as soon as the carousel and the slide list disagree on what
 * counts as a slide: for a mixed `[video, image, image]` post the old image-only mapping sent
 * carousel index 1 to image 0, so opening the second slide showed the wrong photo. Matching on
 * the active item's URL keeps the fullscreen surface on the slide the user actually tapped.
 */
export function fullscreenSlideIndexForCarousel(post: Post, carouselIndex: number): number {
    const items =
        post.mediaItems && post.mediaItems.length > 0
            ? post.mediaItems
            : post.mediaUrl
              ? [{ url: post.mediaUrl, type: (post.mediaType || 'image') as 'image' | 'video' }]
              : [];
    const slides = collectFeedFullscreenSlides(post);
    if (!slides.length) return 0;

    const active = items[carouselIndex];
    if (active?.url) {
        const byUrl = slides.findIndex((slide) => slide.url === active.url);
        if (byUrl >= 0) return byUrl;
    }
    return Math.min(Math.max(0, carouselIndex), slides.length - 1);
}
