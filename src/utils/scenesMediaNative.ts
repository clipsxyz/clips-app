import type { Post, PostMediaItem } from '../types';
import { resolveMockFeedVideoUrl } from '../constants/mockFeedVideos';
import { decodeScenesTextSlideContent } from './scenesTextSlideNative';

export type ScenesMediaSlide = {
    url: string;
    type: 'image' | 'video' | 'text';
    posterUrl?: string;
    text?: string;
    textStyle?: PostMediaItem['textStyle'];
};

export function getScenesMediaSlides(post: Post): ScenesMediaSlide[] {
    const fromItems = (post.mediaItems || []).filter(
        (item) => item?.type === 'image' || item?.type === 'video' || item?.type === 'text',
    );
    if (fromItems.length > 0) {
        return fromItems.map((item) => ({
            url: item.url || '',
            type: item.type as ScenesMediaSlide['type'],
            posterUrl: item.posterUrl,
            text:
                item.type === 'text'
                    ? decodeScenesTextSlideContent(item) || post.text || post.caption || ''
                    : undefined,
            textStyle: item.textStyle,
        }));
    }
    if (post.mediaUrl) {
        const type =
            post.mediaType === 'video' || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(post.mediaUrl)
                ? 'video'
                : 'image';
        return [{ url: post.mediaUrl, type }];
    }
    return [];
}

export function resolveScenesVideoUrl(raw: string): string {
    return resolveMockFeedVideoUrl(raw);
}
