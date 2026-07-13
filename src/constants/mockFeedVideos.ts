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
} as const;

const NATIVE_REMOTE_BY_DEMO_PATH: Record<string, string> = {
    [MOCK_FEED_VIDEO_URLS.escapes]:
        'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    [MOCK_FEED_VIDEO_URLS.fun]: 'https://www.w3schools.com/html/mov_bbb.mp4',
    [MOCK_FEED_VIDEO_URLS.joyrides]:
        'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    '/demo-videos/flower.mp4':
        'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
};

export const MOCK_FEED_VIDEO_REMOTE_FALLBACK =
    NATIVE_REMOTE_BY_DEMO_PATH[MOCK_FEED_VIDEO_URLS.escapes];

/** Thumbnails for demo videos only — must not reuse URLs from mock feed image posts. */
export const MOCK_FEED_VIDEO_POSTERS = {
    escapes: 'https://images.unsplash.com/photo-1469474968028-7fd8a59945c0?w=800',
    fun: 'https://images.unsplash.com/photo-1449824913931-80a239ad0d6c?w=800',
    joyrides: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
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
