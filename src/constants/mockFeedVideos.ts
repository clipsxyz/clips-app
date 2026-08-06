/**
 * Demo MP4 URLs for mock feed / Scenes testing.
 *
 * Web (Vite): all slots resolve to `public/demo-videos/bbb.mp4` (Big Buck Bunny).
 * React Native: see `mockFeedVideos.native.ts` (bundled require).
 */
const WEB_DEMO_MP4 = '/demo-videos/bbb.mp4';
const BBB_HTTPS = 'https://www.w3schools.com/html/mov_bbb.mp4';

/** Logical slots — path identifies which poster / post id to use. */
export const MOCK_FEED_VIDEO_URLS = {
    escapes: '/demo-videos/escapes.mp4',
    fun: '/demo-videos/fun.mp4',
    joyrides: '/demo-videos/joyrides.mp4',
    blazes: '/demo-videos/blazes.mp4',
    elephants: '/demo-videos/elephants.mp4',
} as const;

const NATIVE_REMOTE_BY_DEMO_PATH: Record<string, string> = {
    [MOCK_FEED_VIDEO_URLS.escapes]: BBB_HTTPS,
    [MOCK_FEED_VIDEO_URLS.fun]: BBB_HTTPS,
    [MOCK_FEED_VIDEO_URLS.joyrides]: BBB_HTTPS,
    [MOCK_FEED_VIDEO_URLS.blazes]: BBB_HTTPS,
    [MOCK_FEED_VIDEO_URLS.elephants]: BBB_HTTPS,
    '/demo-videos/bbb.mp4': BBB_HTTPS,
    '/demo-videos/flower.mp4': BBB_HTTPS,
};

export const MOCK_FEED_VIDEO_REMOTE_FALLBACK =
    NATIVE_REMOTE_BY_DEMO_PATH[MOCK_FEED_VIDEO_URLS.escapes];

/** Thumbnails for demo videos — real Big Buck Bunny frame (not Unsplash). */
export const MOCK_FEED_VIDEO_POSTERS = {
    escapes: '/demo-videos/bbb-poster.jpg',
    fun: '/demo-videos/bbb-poster.jpg',
    joyrides: '/demo-videos/bbb-poster.jpg',
    blazes: '/demo-videos/bbb-poster.jpg',
    elephants: '/demo-videos/bbb-poster.jpg',
} as const;

/** @deprecated Unsplash stills — reject if found in old collection storage. */
const LEGACY_FAKE_UNSPLASH_POSTERS = [
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e',
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e',
    'https://images.unsplash.com/photo-1514931109608-ef9bcc8af3c0',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
] as const;

function isReactNativeRuntime(): boolean {
    try {
        if (typeof navigator !== 'undefined' && (navigator as { product?: string }).product === 'ReactNative') {
            return true;
        }
    } catch {
        /* ignore */
    }
    return false;
}

function isRelativeDemoVideoPath(url: string): boolean {
    return url.startsWith('/demo-videos/') || (url.startsWith('/') && /\.(mp4|webm|mov)(\?|#|$)/i.test(url));
}

function nativeRemoteForDemoPath(url: string): string {
    return NATIVE_REMOTE_BY_DEMO_PATH[url] ?? MOCK_FEED_VIDEO_REMOTE_FALLBACK;
}

function looksLikeDemoSlotVideo(url: string): boolean {
    return (
        url.startsWith('/demo-videos/') ||
        NATIVE_REMOTE_BY_DEMO_PATH[url] != null ||
        url.includes('bbb.mp4') ||
        url.includes('flower.mp4') ||
        url.includes('mov_bbb') ||
        url.includes('escapes.mp4') ||
        url.includes('fun.mp4') ||
        url.includes('joyrides.mp4') ||
        url.includes('blazes.mp4') ||
        url.includes('elephants.mp4')
    );
}

/** Real Big Buck Bunny frame for demo MP4 collection/grid thumbs. */
export function resolveDemoVideoPosterUri(url: string | undefined): string | undefined {
    if (!url || !looksLikeDemoSlotVideo(url)) return undefined;
    return '/demo-videos/bbb-poster.jpg';
}

/** Web: URI object. Native `.native.ts` returns bundled require. */
export function resolveDemoVideoPosterSource(url: string | undefined): { uri: string } | undefined {
    const uri = resolveDemoVideoPosterUri(url);
    return uri ? { uri } : undefined;
}

/**
 * @deprecated Prefer resolveDemoVideoPosterUri.
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

export function resolveMockFeedVideoUrl(url: string | undefined): string {
    if (isReactNativeRuntime()) {
        if (!url) return MOCK_FEED_VIDEO_REMOTE_FALLBACK;
        if (NATIVE_REMOTE_BY_DEMO_PATH[url]) return NATIVE_REMOTE_BY_DEMO_PATH[url];
        if (isRelativeDemoVideoPath(url)) return nativeRemoteForDemoPath(url);
        if (/\.(mp4|webm|mov)(\?|#|$)/i.test(url) && !/^https?:\/\//i.test(url)) {
            return MOCK_FEED_VIDEO_REMOTE_FALLBACK;
        }
        return url;
    }
    if (!url) return WEB_DEMO_MP4;
    if (url.startsWith('/demo-videos/')) return WEB_DEMO_MP4;
    if (/\.(mp4|webm|mov)(\?|#|$)/i.test(url)) {
        return WEB_DEMO_MP4;
    }
    return url;
}

/** Web: always a URI object. Native `.native.ts` returns bundled require for demo paths. */
export function isMockDemoVideoPath(url: string | undefined | null): boolean {
    if (!url) return false;
    return url.startsWith('/demo-videos/') || NATIVE_REMOTE_BY_DEMO_PATH[url] != null;
}

export function mockFeedVideoSource(url: string | undefined): number | { uri: string } {
    return { uri: resolveMockFeedVideoUrl(url) };
}
