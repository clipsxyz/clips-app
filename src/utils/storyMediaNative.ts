import type { ImageSourcePropType } from 'react-native';
import type { Post, Story } from '../types';
import { getReactNativeDefaultApiBaseUrl, isReactNativeRuntime } from '../config/runtimeEnv';
import {
    isMockDemoVideoPath,
    mockFeedVideoSource,
    resolveDemoVideoPosterSource,
    resolveMockFeedVideoPosterUrl,
    resolveMockFeedVideoUrl,
} from '../constants/mockFeedVideos';

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

export function isVideoUrl(url?: string | null): boolean {
    return !!(url && VIDEO_EXT.test(url));
}

/** Pull `/demo-videos/...` path out of absolute or relative URLs. */
function demoVideoPathFromUrl(url: string): string | undefined {
    const trimmed = url.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('/demo-videos/')) return trimmed.split(/[?#]/)[0];
    const match = trimmed.match(/\/demo-videos\/[^/?#]+/i);
    return match ? match[0] : undefined;
}

/**
 * Normalize story media URL so RN can load localhost/relative Laravel assets.
 * Demo `/demo-videos/*` paths are left alone — feed/stories use the bundled MP4.
 */
export function resolveStoryMediaUrl(url?: string | null): string | undefined {
    const raw = (url || '').trim();
    if (!raw) return undefined;
    if (!isReactNativeRuntime()) return raw;

    // Keep demo slots as relative paths so mockFeedVideoSource can map to the bundle.
    if (demoVideoPathFromUrl(raw) || isMockDemoVideoPath(raw)) {
        return demoVideoPathFromUrl(raw) || raw;
    }

    const apiBase = getReactNativeDefaultApiBaseUrl();
    if (!apiBase) return raw;

    try {
        const api = new URL(apiBase);
        const apiOrigin = `${api.protocol}//${api.host}`;

        if (raw.startsWith('/')) {
            return `${apiOrigin}${raw}`;
        }

        if (
            !/^https?:\/\//i.test(raw) &&
            !/^data:/i.test(raw) &&
            !/^file:\/\//i.test(raw) &&
            !/^content:\/\//i.test(raw)
        ) {
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

/** RN story video playback URL string (for rail previews / legacy callers). */
export function resolveStoryVideoPlaybackUrl(url?: string | null): string | undefined {
    const raw = (url || '').trim();
    if (!raw) return undefined;
    const demoPath = demoVideoPathFromUrl(raw);
    if (demoPath) {
        return resolveMockFeedVideoUrl(demoPath);
    }
    if (isMockDemoVideoPath(raw)) {
        return resolveMockFeedVideoUrl(raw);
    }
    const resolved = resolveStoryMediaUrl(raw);
    if (!resolved) return undefined;
    return resolveMockFeedVideoUrl(resolved);
}

const STORY_VIDEO_SOURCE_CACHE = new Map<string, { uri: string }>();

/**
 * Preferred react-native-video `source` for story playback.
 * Same URI → same object so progress ticks don't remount ExoPlayer.
 */
export function storyVideoSource(url?: string | null): { uri: string } | null {
    const raw = (url || '').trim();
    if (!raw) return null;
    const cached = STORY_VIDEO_SOURCE_CACHE.get(raw);
    if (cached) return cached;

    const demoPath = demoVideoPathFromUrl(raw);
    let source: { uri: string } | null = null;
    if (demoPath || isMockDemoVideoPath(raw)) {
        source = mockFeedVideoSource(demoPath || raw);
    } else if (/big_buck_bunny|mov_bbb|bbb\.mp4|mediaelement-files/i.test(raw)) {
        source = mockFeedVideoSource(undefined);
    } else {
        const playback = resolveStoryVideoPlaybackUrl(raw);
        source = playback ? { uri: playback } : null;
    }
    if (source) STORY_VIDEO_SOURCE_CACHE.set(raw, source);
    return source;
}

/** Static poster when story video cannot play (shared post poster or demo thumb). */
export function getStoryVideoPosterFallback(
    mediaUrl?: string | null,
    originalPost?: Post | null,
): string | undefined {
    const fromPost =
        originalPost?.videoPosterUrl ||
        originalPost?.mediaItems?.find((m) => m?.type === 'image' && m.url)?.url;
    if (fromPost) {
        const demo = demoVideoPathFromUrl(fromPost);
        if (demo) return resolveMockFeedVideoPosterUrl(demo);
        return resolveStoryMediaUrl(fromPost);
    }
    const demoPath = demoVideoPathFromUrl(mediaUrl || '') || mediaUrl || undefined;
    return resolveMockFeedVideoPosterUrl(demoPath);
}

export function getStoryVideoPosterSource(
    mediaUrl?: string | null,
    originalPost?: Post | null,
): ImageSourcePropType | undefined {
    const fromPost =
        originalPost?.videoPosterUrl ||
        originalPost?.mediaItems?.find((m) => m?.type === 'image' && m.url)?.url;
    if (fromPost && !demoVideoPathFromUrl(fromPost) && !isMockDemoVideoPath(fromPost)) {
        const uri = resolveStoryMediaUrl(fromPost);
        return uri ? { uri } : undefined;
    }
    const demoPath =
        demoVideoPathFromUrl(fromPost || '') ||
        demoVideoPathFromUrl(mediaUrl || '') ||
        mediaUrl ||
        undefined;
    return resolveDemoVideoPosterSource(demoPath) || undefined;
}

export function isStoryVideo(story?: Story, originalPost?: Post | null): boolean {
    if (!story) return false;
    if (story.mediaType === 'video') return true;
    if (isVideoUrl(story.mediaUrl)) return true;
    if (story.mediaUrl && (demoVideoPathFromUrl(story.mediaUrl) || isMockDemoVideoPath(story.mediaUrl))) {
        return true;
    }
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
