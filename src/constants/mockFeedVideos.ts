/**
 * Demo MP4 URLs for mock feed / Scenes testing.
 *
 * Web (Vite): all slots resolve to `public/demo-videos/flower.mp4`.
 * React Native: each slot uses a different HTTPS sample so Sarah/Bob cards are visually distinct.
 */
const WEB_DEMO_MP4 = '/demo-videos/flower.mp4';

/** Logical slots — path identifies which remote to use on native. */
export const MOCK_FEED_VIDEO_URLS = {
    escapes: '/demo-videos/escapes.mp4',
    fun: '/demo-videos/fun.mp4',
    joyrides: '/demo-videos/joyrides.mp4',
    blazes: '/demo-videos/blazes.mp4',
    elephants: '/demo-videos/elephants.mp4',
} as const;

const NATIVE_REMOTE_BY_DEMO_PATH: Record<string, string> = {
    [MOCK_FEED_VIDEO_URLS.escapes]:
        'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    [MOCK_FEED_VIDEO_URLS.fun]: 'https://www.w3schools.com/html/mov_bbb.mp4',
    // Google sample bucket often returns 403; use MDN flower like escapes.
    [MOCK_FEED_VIDEO_URLS.joyrides]:
        'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    [MOCK_FEED_VIDEO_URLS.blazes]:
        'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    [MOCK_FEED_VIDEO_URLS.elephants]: 'https://www.w3schools.com/html/mov_bbb.mp4',
    '/demo-videos/flower.mp4':
        'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
};

export const MOCK_FEED_VIDEO_REMOTE_FALLBACK =
    NATIVE_REMOTE_BY_DEMO_PATH[MOCK_FEED_VIDEO_URLS.escapes];

/** Thumbnails for demo videos only — must not reuse URLs from mock feed image posts. */
export const MOCK_FEED_VIDEO_POSTERS = {
    // Prefer live Unsplash IDs (several older photo-* links now 404).
    escapes: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800',
    fun: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    joyrides: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
    blazes: 'https://images.unsplash.com/photo-1514931109608-ef9bcc8af3c0?w=800',
    elephants: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800',
} as const;

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

/** Resolve mock video URL for feed Media — local path on web/Vite; per-slot HTTPS on React Native. */
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
    if (url.includes('flower.mp4')) {
        return MOCK_FEED_VIDEO_POSTERS.escapes;
    }
    return undefined;
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
