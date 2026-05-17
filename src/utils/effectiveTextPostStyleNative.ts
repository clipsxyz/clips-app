import type { Post } from '../types';
import {
    getEffectiveTextStyleForPost,
    getTextOnlyFallbackBackground,
} from './effectiveTextPostStyle';

export function isTextOnlyPost(post: Post): boolean {
    const hasMediaItems = Array.isArray(post.mediaItems) && post.mediaItems.length > 0;
    return Boolean(post.text?.trim()) && !post.mediaUrl && !hasMediaItems;
}

export function isVideoPost(post: Post): boolean {
    const first = post.mediaItems?.[0];
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
