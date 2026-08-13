/**
 * Demo MP4 URLs for mock feed / Scenes testing (web).
 *
 * Slot paths stay stable in post data; each slot maps to a *distinct* HTTPS sample
 * so Alice / Sarah / Bob are visibly different (parity with `mockFeedVideos.native.ts`).
 *
 * Never map slots to Big Buck Bunny — that rainbow clip was the old shared fallback.
 */
/** Logical slots — path identifies which poster / post id to use. */
export const MOCK_FEED_VIDEO_URLS = {
    escapes: '/demo-videos/escapes.mp4',
    fun: '/demo-videos/fun.mp4',
    joyrides: '/demo-videos/joyrides.mp4',
    blazes: '/demo-videos/blazes.mp4',
    elephants: '/demo-videos/elephants.mp4',
} as const;

const ESCAPES_HTTPS = 'https://download.samplelib.com/mp4/sample-10s.mp4';
const FUN_HTTPS = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
const JOYRIDES_HTTPS = 'https://download.samplelib.com/mp4/sample-5s.mp4';
const BLAZES_HTTPS =
    'https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4';
const ELEPHANTS_HTTPS =
    'https://samplefile.com/samples/download/video/mp4/mp4_15s_sample_file_868KB.mp4';

const HTTPS_BY_DEMO_PATH: Record<string, string> = {
    [MOCK_FEED_VIDEO_URLS.escapes]: ESCAPES_HTTPS,
    [MOCK_FEED_VIDEO_URLS.fun]: FUN_HTTPS,
    [MOCK_FEED_VIDEO_URLS.joyrides]: JOYRIDES_HTTPS,
    [MOCK_FEED_VIDEO_URLS.blazes]: BLAZES_HTTPS,
    [MOCK_FEED_VIDEO_URLS.elephants]: ELEPHANTS_HTTPS,
    // Legacy BBB paths → non-rainbow sample
    '/demo-videos/bbb.mp4': FUN_HTTPS,
    '/demo-videos/flower.mp4': FUN_HTTPS,
};

export const MOCK_FEED_VIDEO_REMOTE_FALLBACK = FUN_HTTPS;

/** Dark placeholders — never BBB rainbow poster. */
export const MOCK_FEED_VIDEO_POSTERS = {
    escapes: '#121212',
    fun: '#121212',
    joyrides: '#121212',
    blazes: '#121212',
    elephants: '#121212',
} as const;

/** @deprecated Kept for type parity with native; do not render as a thumb. */
export const MOCK_FEED_BUNDLED_VIDEO_POSTER = {
    uri: '',
} as const;

/** @deprecated Unsplash stills — reject if found in old collection storage. */
const LEGACY_FAKE_UNSPLASH_POSTERS = [
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e',
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e',
    'https://images.unsplash.com/photo-1514931109608-ef9bcc8af3c0',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
] as const;

function isRelativeDemoVideoPath(url: string): boolean {
    return url.startsWith('/demo-videos/') || HTTPS_BY_DEMO_PATH[url] != null;
}

/** Local / in-app media URIs must play as-is (never remap to demo samples). */
export function isPlayableLocalMediaUri(url: string | undefined | null): boolean {
    if (!url || typeof url !== 'string') return false;
    const u = url.trim();
    return (
        /^file:/i.test(u) ||
        /^content:/i.test(u) ||
        /^ph:/i.test(u) ||
        /^assets-library:/i.test(u) ||
        /^blob:/i.test(u) ||
        /^data:/i.test(u)
    );
}

function httpsForDemoPath(url: string): string {
    return HTTPS_BY_DEMO_PATH[url] ?? MOCK_FEED_VIDEO_REMOTE_FALLBACK;
}

function looksLikeDemoSlotVideo(url: string): boolean {
    return (
        url.startsWith('/demo-videos/') ||
        HTTPS_BY_DEMO_PATH[url] != null ||
        url.includes('bbb.mp4') ||
        url.includes('flower.mp4') ||
        url.includes('mov_bbb') ||
        url.includes('big_buck_bunny') ||
        url.includes('escapes.mp4') ||
        url.includes('fun.mp4') ||
        url.includes('joyrides.mp4') ||
        url.includes('blazes.mp4') ||
        url.includes('elephants.mp4')
    );
}

/** No BBB frame — callers should use video preview or a dark cell. */
export function resolveDemoVideoPosterUri(url: string | undefined): string | undefined {
    if (!url || !looksLikeDemoSlotVideo(url)) return undefined;
    return undefined;
}

/** Web: no poster image for demos (avoid rainbow still). */
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
    if (!url) return MOCK_FEED_VIDEO_REMOTE_FALLBACK;
    if (isPlayableLocalMediaUri(url)) return url;
    if (HTTPS_BY_DEMO_PATH[url]) return HTTPS_BY_DEMO_PATH[url];
    if (isRelativeDemoVideoPath(url)) return httpsForDemoPath(url);
    if (/big_buck_bunny|mov_bbb|bbb\.mp4|mediaelement-files/i.test(url)) {
        return MOCK_FEED_VIDEO_REMOTE_FALLBACK;
    }
    if (!/^https?:\/\//i.test(url) && looksLikeDemoSlotVideo(url)) {
        return httpsForDemoPath(url);
    }
    return url;
}

export function isMockDemoVideoPath(url: string | undefined | null): boolean {
    if (!url) return false;
    return (
        url.startsWith('/demo-videos/') ||
        HTTPS_BY_DEMO_PATH[url] != null ||
        /bbb\.mp4|mov_bbb|big_buck_bunny/i.test(url)
    );
}

export function mockFeedVideoSource(url: string | undefined): number | { uri: string } {
    return { uri: resolveMockFeedVideoUrl(url) };
}
