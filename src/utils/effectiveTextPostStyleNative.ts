import type { Post } from '../types';
import {
    getEffectiveTextStyleForPost,
    getTextOnlyFallbackBackground,
} from './effectiveTextPostStyle';

/** Body copy for text-only posts (create / API / caption fallbacks). */
export function getPostBodyText(post: Partial<Post> | null | undefined): string {
    if (!post) return '';
    const raw =
        post.text ||
        (post as { text_content?: string }).text_content ||
        post.caption ||
        post.imageText ||
        '';
    return typeof raw === 'string' ? raw.trim() : '';
}

function hasRenderableVisualMedia(post: Partial<Post> | null | undefined): boolean {
    if (!post) return false;
    const mediaUrl = typeof post.mediaUrl === 'string' ? post.mediaUrl.trim() : '';
    if (mediaUrl) return true;
    if (!Array.isArray(post.mediaItems) || post.mediaItems.length === 0) return false;
    return post.mediaItems.some(
        (item) =>
            !!item &&
            (item.type === 'image' || item.type === 'video') &&
            typeof item.url === 'string' &&
            item.url.trim().length > 0,
    );
}

export function isTextOnlyPost(post: Post): boolean {
    return getPostBodyText(post).length > 0 && !hasRenderableVisualMedia(post);
}

export function isVideoPost(post: Post): boolean {
    if (isTextOnlyPost(post)) return false;
    const first = (post.mediaItems || []).find(
        (item) => item?.type === 'image' || item?.type === 'video',
    );
    const type = first?.type || post.mediaType;
    if (type === 'video') return true;
    const url = (first?.url || post.mediaUrl || '').toLowerCase();
    return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
}

export function getTextOnlyBackgroundColor(post: Post): string {
    const style = getEffectiveTextStyleForPost(post);
    const bg = style?.background;
    if (bg && !bg.includes('gradient') && !bg.includes('radial')) {
        return bg;
    }
    if (bg) {
        const hex = bg.match(/#[0-9a-fA-F]{3,8}/);
        if (hex?.[0]) return hex[0];
    }
    return getTextOnlyFallbackBackground(post);
}

export function getTextOnlyTextColor(post: Post): string {
    return getEffectiveTextStyleForPost(post)?.color || '#ffffff';
}

export function getTextOnlyFontSize(post: Post): number {
    const size = getEffectiveTextStyleForPost(post)?.size;
    if (size === 'small') return 14;
    if (size === 'large') return 20;
    return 16;
}
