/**
 * Demo MP4 URLs for mock feed / Scenes testing (React Native).
 *
 * Prefer the bundled `bbb.mp4` (Big Buck Bunny sample → react-native-video)
 * so cards work offline and when remote CDNs 403. Logical `/demo-videos/*`
 * slots identify which poster / post id to use.
 */
import { Image, type ImageSourcePropType } from 'react-native';

export const MOCK_FEED_VIDEO_URLS = {
    escapes: '/demo-videos/escapes.mp4',
    fun: '/demo-videos/fun.mp4',
    joyrides: '/demo-videos/joyrides.mp4',
    blazes: '/demo-videos/blazes.mp4',
    elephants: '/demo-videos/elephants.mp4',
} as const;

/** Bundled asset — pass directly to react-native-video `source` (more reliable than URI). */
export const MOCK_FEED_BUNDLED_VIDEO = require('../assets/demo-videos/bbb.mp4');

/** Real frame from bbb.mp4 — use for collection/grid Image thumbs (never mount Video in grids). */
export const MOCK_FEED_BUNDLED_VIDEO_POSTER = require('../assets/demo-videos/bbb-poster.jpg');

const BUNDLED_DEMO_MP4 = Image.resolveAssetSource(MOCK_FEED_BUNDLED_VIDEO);
const BUNDLED_DEMO_URI = typeof BUNDLED_DEMO_MP4?.uri === 'string' ? BUNDLED_DEMO_MP4.uri : '';
const BUNDLED_POSTER = Image.resolveAssetSource(MOCK_FEED_BUNDLED_VIDEO_POSTER);
const BUNDLED_POSTER_URI = typeof BUNDLED_POSTER?.uri === 'string' ? BUNDLED_POSTER.uri : '';

/** HTTPS fallbacks when bundled URI is unavailable (e.g. resolveAssetSource empty). */
const BBB_HTTPS = 'https://www.w3schools.com/html/mov_bbb.mp4';

const HTTPS_FALLBACK_BY_DEMO_PATH: Record<string, string> = {
    [MOCK_FEED_VIDEO_URLS.escapes]: BBB_HTTPS,
    [MOCK_FEED_VIDEO_URLS.fun]: BBB_HTTPS,
    [MOCK_FEED_VIDEO_URLS.joyrides]: BBB_HTTPS,
    [MOCK_FEED_VIDEO_URLS.blazes]: BBB_HTTPS,
    [MOCK_FEED_VIDEO_URLS.elephants]: BBB_HTTPS,
    '/demo-videos/bbb.mp4': BBB_HTTPS,
    '/demo-videos/flower.mp4': BBB_HTTPS,
};

const NATIVE_URI_BY_DEMO_PATH: Record<string, string> = Object.fromEntries(
    Object.entries(HTTPS_FALLBACK_BY_DEMO_PATH).map(([path, https]) => [
        path,
        BUNDLED_DEMO_URI || https,
    ]),
);

export const MOCK_FEED_VIDEO_REMOTE_FALLBACK =
    BUNDLED_DEMO_URI || HTTPS_FALLBACK_BY_DEMO_PATH[MOCK_FEED_VIDEO_URLS.escapes];

/** @deprecated Unsplash stills — unrelated to the MP4; reject if found in storage. */
const LEGACY_FAKE_UNSPLASH_POSTERS = [
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e',
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e',
    'https://images.unsplash.com/photo-1514931109608-ef9bcc8af3c0',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
] as const;

/** @deprecated Kept for type compatibility; prefer resolveDemoVideoPosterUri. */
export const MOCK_FEED_VIDEO_POSTERS = {
    escapes: BUNDLED_POSTER_URI || '/demo-videos/bbb-poster.jpg',
    fun: BUNDLED_POSTER_URI || '/demo-videos/bbb-poster.jpg',
    joyrides: BUNDLED_POSTER_URI || '/demo-videos/bbb-poster.jpg',
    blazes: BUNDLED_POSTER_URI || '/demo-videos/bbb-poster.jpg',
    elephants: BUNDLED_POSTER_URI || '/demo-videos/bbb-poster.jpg',
} as const;

function isRelativeDemoVideoPath(url: string): boolean {
    return url.startsWith('/demo-videos/') || (url.startsWith('/') && /\.(mp4|webm|mov)(\?|#|$)/i.test(url));
}

export function isMockDemoVideoPath(url: string | undefined | null): boolean {
    if (!url) return false;
    if (NATIVE_URI_BY_DEMO_PATH[url]) return true;
    if (BUNDLED_DEMO_URI && url === BUNDLED_DEMO_URI) return true;
    if (url.includes('bbb.mp4') || url.includes('flower.mp4') || url.includes('mov_bbb')) return true;
    return isRelativeDemoVideoPath(url);
}

function looksLikeDemoSlotVideo(url: string): boolean {
    return (
        isMockDemoVideoPath(url) ||
        url.includes('escapes.mp4') ||
        url.includes('fun.mp4') ||
        url.includes('joyrides.mp4') ||
        url.includes('blazes.mp4') ||
        url.includes('elephants.mp4')
    );
}

function nativeUriForDemoPath(url: string): string {
    return NATIVE_URI_BY_DEMO_PATH[url] || MOCK_FEED_VIDEO_REMOTE_FALLBACK;
}

/** Real Big Buck Bunny frame for demo MP4 collection/grid thumbs. */
export function resolveDemoVideoPosterUri(url: string | undefined): string | undefined {
    if (!url || !looksLikeDemoSlotVideo(url)) return undefined;
    return BUNDLED_POSTER_URI || undefined;
}

/** Image `source` for demo video thumbs (prefer bundled require). */
export function resolveDemoVideoPosterSource(url: string | undefined): ImageSourcePropType | undefined {
    // If URL is missing but caller knows it's a demo video, still allow explicit require via empty check below.
    if (url && !looksLikeDemoSlotVideo(url)) return undefined;
    if (!url) return undefined;
    return MOCK_FEED_BUNDLED_VIDEO_POSTER;
}

/**
 * @deprecated Prefer resolveDemoVideoPosterUri — returns real BBB frame for demo paths.
 */
export function resolveMockFeedVideoPosterUrl(url: string | undefined): string | undefined {
    return resolveDemoVideoPosterUri(url);
}

/** True if URL is a deprecated Unsplash “demo poster” (never show as a video thumb). */
export function isFakeMockVideoPosterUrl(url: string | undefined | null): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return false;
    return LEGACY_FAKE_UNSPLASH_POSTERS.some(
        (poster) => trimmed === poster || trimmed.startsWith(poster),
    );
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
