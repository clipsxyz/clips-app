import type { Post, PostMediaItem } from '../types';
import { mockFeedVideoSource, resolveMockFeedVideoUrl } from '../constants/mockFeedVideos';
import { decodeScenesTextSlideContent } from './scenesTextSlideNative';

export type ScenesMediaSlide = {
    url: string;
    type: 'image' | 'video' | 'text';
    posterUrl?: string;
    text?: string;
    textStyle?: PostMediaItem['textStyle'];
    /** Intrinsic pixel dimensions of THIS slide, preserved so the fullscreen player
     * can fit landscape content instead of forcing it into a portrait frame. */
    width?: number;
    height?: number;
};

export function getScenesMediaSlides(post: Post): ScenesMediaSlide[] {
    const fromItems = (post.mediaItems || []).filter(
        (item) => item?.type === 'image' || item?.type === 'video' || item?.type === 'text',
    );
        if (fromItems.length > 0) {
        return fromItems.map((item) => ({
            url: item.url || post.mediaUrl || '',
            type: item.type as ScenesMediaSlide['type'],
            posterUrl: item.posterUrl,
            text:
                item.type === 'text'
                    ? decodeScenesTextSlideContent(item) || post.text || post.caption || ''
                    : undefined,
            textStyle: item.textStyle,
            width: item.width,
            height: item.height,
        }));
    }
    if (post.mediaUrl) {
        const type =
            post.mediaType === 'video' || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(post.mediaUrl)
                ? 'video'
                : 'image';
        return [{ url: post.mediaUrl, type, width: post.width, height: post.height }];
    }
    return [];
}

export function resolveScenesVideoUrl(raw: string): string {
    return resolveMockFeedVideoUrl(raw);
}

/** Video source for Scenes — bundled require for mock demo paths. */
export function scenesVideoSource(raw: string): { uri: string } {
    return mockFeedVideoSource(raw);
}
