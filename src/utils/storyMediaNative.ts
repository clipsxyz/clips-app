import type { Post, Story } from '../types';
import { getReactNativeDefaultApiBaseUrl, isReactNativeRuntime } from '../config/runtimeEnv';

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

export function isVideoUrl(url?: string | null): boolean {
    return !!(url && VIDEO_EXT.test(url));
}

/** Normalize story media URL so RN can load localhost/relative Laravel assets. */
export function resolveStoryMediaUrl(url?: string | null): string | undefined {
    const raw = (url || '').trim();
    if (!raw) return undefined;
    if (!isReactNativeRuntime()) return raw;

    const apiBase = getReactNativeDefaultApiBaseUrl();
    if (!apiBase) return raw;

    try {
        const api = new URL(apiBase);
        const apiOrigin = `${api.protocol}//${api.host}`;

        if (raw.startsWith('/')) {
            return `${apiOrigin}${raw}`;
        }

        if (!/^https?:\/\//i.test(raw) && !/^data:/i.test(raw) && !/^file:\/\//i.test(raw) && !/^content:\/\//i.test(raw)) {
            return `${apiOrigin}/${raw.replace(/^\/+/, '')}`;
        }

        const parsed = new URL(raw);
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
            parsed.protocol = api.protocol;
            parsed.hostname = api.hostname;
            parsed.port = api.port;
            return parsed.toString();
        }
    } catch {
        // keep as-is
    }
    return raw;
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
