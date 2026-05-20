import type { Post, Story } from '../types';

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

export function isVideoUrl(url?: string | null): boolean {
    return !!(url && VIDEO_EXT.test(url));
}

export function isStoryVideo(story?: Story, originalPost?: Post | null): boolean {
    if (!story) return false;
    if (story.mediaType === 'video') return true;
    if (isVideoUrl(story.mediaUrl)) return true;
    if (story.sharedFromPost && originalPost) {
        if (originalPost.mediaType === 'video') return true;
        const item = originalPost.mediaItems?.[0];
        if (item?.type === 'video' || isVideoUrl(item?.url)) return true;
    }
    return false;
}

export function getPostMediaUrl(post?: Post | null): string | undefined {
    if (!post) return undefined;
    const direct = (post.mediaUrl || '').trim();
    if (direct) return direct;
    const item = post.mediaItems?.find((m) => m?.url);
    return (item?.url || '').trim() || undefined;
}

export function postHasRealMedia(post?: Post | null): boolean {
    return !!getPostMediaUrl(post);
}
