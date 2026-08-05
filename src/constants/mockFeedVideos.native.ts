/**
 * Demo MP4 URLs for mock feed / Scenes testing (React Native).
 *
 * Prefer the bundled `flower.mp4` so feed cards work offline / when remote CDNs 403.
 * Logical `/demo-videos/*` slots still map for poster resolution and mock post ids.
 */
import { Image } from 'react-native';

export const MOCK_FEED_VIDEO_URLS = {
    escapes: '/demo-videos/escapes.mp4',
    fun: '/demo-videos/fun.mp4',
    joyrides: '/demo-videos/joyrides.mp4',
} as const;

const BUNDLED_DEMO_MP4 = Image.resolveAssetSource(
    // Metro bundles mp4 via assetExts; URI works with react-native-video.
    require('../assets/demo-videos/flower.mp4'),
);

const BUNDLED_DEMO_URI = BUNDLED_DEMO_MP4?.uri ?? '';

/** Remote fallbacks when a non-demo absolute URL fails — prefer same host as web docs. */
const NATIVE_REMOTE_BY_DEMO_PATH: Record<string, string> = {
    [MOCK_FEED_VIDEO_URLS.escapes]: BUNDLED_DEMO_URI,
    [MOCK_FEED_VIDEO_URLS.fun]: BUNDLED_DEMO_URI,
    [MOCK_FEED_VIDEO_URLS.joyrides]: BUNDLED_DEMO_URI,
    '/demo-videos/flower.mp4': BUNDLED_DEMO_URI,
};

export const MOCK_FEED_VIDEO_REMOTE_FALLBACK = BUNDLED_DEMO_URI;

/** Thumbnails for demo videos — working Unsplash IDs (verified 200 from device). */
export const MOCK_FEED_VIDEO_POSTERS = {
    escapes: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800',
    fun: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    joyrides: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
} as const;

function isRelativeDemoVideoPath(url: string): boolean {
    return url.startsWith('/demo-videos/') || (url.startsWith('/') && /\.(mp4|webm|mov)(\?|#|$)/i.test(url));
}

function nativeUriForDemoPath(url: string): string {
    return NATIVE_REMOTE_BY_DEMO_PATH[url] || MOCK_FEED_VIDEO_REMOTE_FALLBACK;
}

/** Poster image for a demo feed video path (RN rail / story fallback when MP4 fails). */
export function resolveMockFeedVideoPosterUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    if (url.includes(MOCK_FEED_VIDEO_URLS.escapes) || url.includes('escapes.mp4')) {
        return MOCK_FEED_VIDEO_POSTERS.escapes;
    }
    if (url.includes(MOCK_FEED_VIDEO_URLS.fun) || url.includes('fun.mp4')) {
        return MOCK_FEED_VIDEO_POSTERS.fun;
    }
    if (url.includes(MOCK_FEED_VIDEO_URLS.joyrides) || url.includes('joyrides.mp4')) {
        return MOCK_FEED_VIDEO_POSTERS.joyrides;
    }
    if (url.includes('flower.mp4') || url === BUNDLED_DEMO_URI) {
        return MOCK_FEED_VIDEO_POSTERS.escapes;
    }
    return undefined;
}

/** Resolve mock video URL — bundled asset on React Native. */
export function resolveMockFeedVideoUrl(url: string | undefined): string {
    if (!url) return MOCK_FEED_VIDEO_REMOTE_FALLBACK;
    if (NATIVE_REMOTE_BY_DEMO_PATH[url]) return NATIVE_REMOTE_BY_DEMO_PATH[url];
    if (isRelativeDemoVideoPath(url)) return nativeUriForDemoPath(url);
    if (/\.(mp4|webm|mov)(\?|#|$)/i.test(url) && !/^https?:\/\//i.test(url)) {
        return MOCK_FEED_VIDEO_REMOTE_FALLBACK;
    }
    return url;
}
