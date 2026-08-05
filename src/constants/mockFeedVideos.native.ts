/**
 * Demo MP4 URLs for mock feed / Scenes testing (React Native).
 *
 * Prefer the bundled `flower.mp4` (require number → react-native-video) so cards
 * work offline and when remote CDNs 403. Logical `/demo-videos/*` slots identify
 * which poster / post id to use.
 */
import { Image } from 'react-native';

export const MOCK_FEED_VIDEO_URLS = {
    escapes: '/demo-videos/escapes.mp4',
    fun: '/demo-videos/fun.mp4',
    joyrides: '/demo-videos/joyrides.mp4',
    blazes: '/demo-videos/blazes.mp4',
    elephants: '/demo-videos/elephants.mp4',
} as const;

/** Bundled asset — pass directly to react-native-video `source` (more reliable than URI). */
export const MOCK_FEED_BUNDLED_VIDEO = require('../assets/demo-videos/flower.mp4');

const BUNDLED_DEMO_MP4 = Image.resolveAssetSource(MOCK_FEED_BUNDLED_VIDEO);
const BUNDLED_DEMO_URI = typeof BUNDLED_DEMO_MP4?.uri === 'string' ? BUNDLED_DEMO_MP4.uri : '';

/** HTTPS fallbacks when bundled URI is unavailable (e.g. resolveAssetSource empty). */
const HTTPS_FALLBACK_BY_DEMO_PATH: Record<string, string> = {
    [MOCK_FEED_VIDEO_URLS.escapes]:
        'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    [MOCK_FEED_VIDEO_URLS.fun]: 'https://www.w3schools.com/html/mov_bbb.mp4',
    [MOCK_FEED_VIDEO_URLS.joyrides]:
        'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    [MOCK_FEED_VIDEO_URLS.blazes]:
        'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    [MOCK_FEED_VIDEO_URLS.elephants]: 'https://www.w3schools.com/html/mov_bbb.mp4',
    '/demo-videos/flower.mp4':
        'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
};

const NATIVE_URI_BY_DEMO_PATH: Record<string, string> = Object.fromEntries(
    Object.entries(HTTPS_FALLBACK_BY_DEMO_PATH).map(([path, https]) => [
        path,
        BUNDLED_DEMO_URI || https,
    ]),
);

export const MOCK_FEED_VIDEO_REMOTE_FALLBACK =
    BUNDLED_DEMO_URI || HTTPS_FALLBACK_BY_DEMO_PATH[MOCK_FEED_VIDEO_URLS.escapes];

/** Thumbnails for demo videos — working Unsplash IDs (verified 200 from device). */
export const MOCK_FEED_VIDEO_POSTERS = {
    escapes: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800',
    fun: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    joyrides: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
    blazes: 'https://images.unsplash.com/photo-1514931109608-ef9bcc8af3c0?w=800',
    elephants: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800',
} as const;

function isRelativeDemoVideoPath(url: string): boolean {
    return url.startsWith('/demo-videos/') || (url.startsWith('/') && /\.(mp4|webm|mov)(\?|#|$)/i.test(url));
}

export function isMockDemoVideoPath(url: string | undefined | null): boolean {
    if (!url) return false;
    if (NATIVE_URI_BY_DEMO_PATH[url]) return true;
    return isRelativeDemoVideoPath(url);
}

function nativeUriForDemoPath(url: string): string {
    return NATIVE_URI_BY_DEMO_PATH[url] || MOCK_FEED_VIDEO_REMOTE_FALLBACK;
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
    if (url.includes(MOCK_FEED_VIDEO_URLS.blazes) || url.includes('blazes.mp4')) {
        return MOCK_FEED_VIDEO_POSTERS.blazes;
    }
    if (url.includes(MOCK_FEED_VIDEO_URLS.elephants) || url.includes('elephants.mp4')) {
        return MOCK_FEED_VIDEO_POSTERS.elephants;
    }
    if (url.includes('flower.mp4') || (BUNDLED_DEMO_URI && url === BUNDLED_DEMO_URI)) {
        return MOCK_FEED_VIDEO_POSTERS.escapes;
    }
    return undefined;
}

/** Resolve mock video URL string (stories / scenes / URI fallback). Prefer bundled require via `mockFeedVideoSource`. */
export function resolveMockFeedVideoUrl(url: string | undefined): string {
    if (!url) return MOCK_FEED_VIDEO_REMOTE_FALLBACK;
    if (NATIVE_URI_BY_DEMO_PATH[url]) return NATIVE_URI_BY_DEMO_PATH[url];
    if (isRelativeDemoVideoPath(url)) return nativeUriForDemoPath(url);
    if (/\.(mp4|webm|mov)(\?|#|$)/i.test(url) && !/^https?:\/\//i.test(url)) {
        return MOCK_FEED_VIDEO_REMOTE_FALLBACK;
    }
    return url;
}

/** Preferred Video `source` for feed/scenes — bundled require for demo paths. */
export function mockFeedVideoSource(url: string | undefined): number | { uri: string } {
    if (isMockDemoVideoPath(url)) {
        return MOCK_FEED_BUNDLED_VIDEO;
    }
    const resolved = resolveMockFeedVideoUrl(url);
    return { uri: resolved };
}
