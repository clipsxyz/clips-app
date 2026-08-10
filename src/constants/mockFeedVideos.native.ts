/**
 * Demo MP4 URLs for mock feed / Scenes testing (React Native).
 *
 * Slot paths stay stable in post data; each slot maps to a *distinct* HTTPS sample
 * so Alice / Sarah / Bob are visibly different clips (needs network).
 */
import { Image, type ImageSourcePropType } from 'react-native';

export const MOCK_FEED_VIDEO_URLS = {
    escapes: '/demo-videos/escapes.mp4',
    fun: '/demo-videos/fun.mp4',
    joyrides: '/demo-videos/joyrides.mp4',
    blazes: '/demo-videos/blazes.mp4',
    elephants: '/demo-videos/elephants.mp4',
} as const;

/** Bundled asset — offline fallback / collection thumbs. */
export const MOCK_FEED_BUNDLED_VIDEO = require('../assets/demo-videos/bbb.mp4');

/** Real frame from bbb.mp4 — use for collection/grid Image thumbs (never mount Video in grids). */
export const MOCK_FEED_BUNDLED_VIDEO_POSTER = require('../assets/demo-videos/bbb-poster.jpg');

const BUNDLED_DEMO_MP4 = Image.resolveAssetSource(MOCK_FEED_BUNDLED_VIDEO);
const BUNDLED_DEMO_URI = typeof BUNDLED_DEMO_MP4?.uri === 'string' ? BUNDLED_DEMO_MP4.uri : '';
const BUNDLED_POSTER = Image.resolveAssetSource(MOCK_FEED_BUNDLED_VIDEO_POSTER);
const BUNDLED_POSTER_URI = typeof BUNDLED_POSTER?.uri === 'string' ? BUNDLED_POSTER.uri : '';

/**
 * Distinct public H.264+AAC samples (one per mock slot). Needs network.
 * IMPORTANT: many “10s 1MB” test-videos.co.uk clips are video-only (no sound).
 * Only use URLs verified to contain both `avc1` and `mp4a`.
 */
const ESCAPES_HTTPS =
    'https://github.com/mediaelement/mediaelement-files/raw/master/big_buck_bunny.mp4';
const FUN_HTTPS = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
/** Bob */
const JOYRIDES_HTTPS = 'https://download.samplelib.com/mp4/sample-5s.mp4';
/** Alice 1 */
const BLAZES_HTTPS =
    'https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4';
/** Alice 2 */
const ELEPHANTS_HTTPS =
    'https://samplefile.com/samples/download/video/mp4/mp4_15s_sample_file_868KB.mp4';

const HTTPS_BY_DEMO_PATH: Record<string, string> = {
    [MOCK_FEED_VIDEO_URLS.escapes]: ESCAPES_HTTPS,
    [MOCK_FEED_VIDEO_URLS.fun]: FUN_HTTPS,
    [MOCK_FEED_VIDEO_URLS.joyrides]: JOYRIDES_HTTPS,
    [MOCK_FEED_VIDEO_URLS.blazes]: BLAZES_HTTPS,
    [MOCK_FEED_VIDEO_URLS.elephants]: ELEPHANTS_HTTPS,
    '/demo-videos/bbb.mp4': ESCAPES_HTTPS,
    '/demo-videos/flower.mp4': FUN_HTTPS,
};

const NATIVE_URI_BY_DEMO_PATH: Record<string, string> = { ...HTTPS_BY_DEMO_PATH };

export const MOCK_FEED_VIDEO_REMOTE_FALLBACK =
    HTTPS_BY_DEMO_PATH[MOCK_FEED_VIDEO_URLS.fun] || BUNDLED_DEMO_URI || FUN_HTTPS;

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
    // Only explicit mock slots — never treat filesystem/local paths as demos.
    return url.startsWith('/demo-videos/') || Boolean(NATIVE_URI_BY_DEMO_PATH[url]);
}

/** Local / in-app media URIs must play as-is (never remap to flower/demo samples). */
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

export function isMockDemoVideoPath(url: string | undefined | null): boolean {
    if (!url) return false;
    if (NATIVE_URI_BY_DEMO_PATH[url]) return true;
    if (BUNDLED_DEMO_URI && url === BUNDLED_DEMO_URI) return true;
    if (url.includes('bbb.mp4') || url.includes('flower.mp4') || url.includes('mov_bbb')) return true;
    if (
        url.includes('test-videos.co.uk') ||
        url.includes('samplelib.com') ||
        url.includes('samplefile.com') ||
        url.includes('learningcontainer.com') ||
        url.includes('mediaelement-files') ||
        url.includes('cc0-videos/flower') ||
        url.includes('Big_Buck_Bunny') ||
        url.includes('big_buck_bunny') ||
        url.includes('Jellyfish') ||
        url.includes('Sintel')
    ) {
        return true;
    }
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

/** Resolve mock video URL string (stories / scenes / URI fallback). */
export function resolveMockFeedVideoUrl(url: string | undefined): string {
    if (!url) return MOCK_FEED_VIDEO_REMOTE_FALLBACK;
    // Uploaded / device media — never substitute the red-flower demo clip.
    if (isPlayableLocalMediaUri(url)) return url;
    if (NATIVE_URI_BY_DEMO_PATH[url]) return NATIVE_URI_BY_DEMO_PATH[url];
    if (isRelativeDemoVideoPath(url)) return nativeUriForDemoPath(url);
    // Known demo hosts / slot names only — not every non-http mp4.
    if (!/^https?:\/\//i.test(url) && looksLikeDemoSlotVideo(url)) {
        return nativeUriForDemoPath(url);
    }
    return url;
}

/**
 * Preferred Video `source` for feed/scenes.
 * Demo slots use distinct HTTPS URIs. Bundled require only for unknown paths.
 */
export function mockFeedVideoSource(url: string | undefined): number | { uri: string } {
    if (url && NATIVE_URI_BY_DEMO_PATH[url]) {
        return { uri: NATIVE_URI_BY_DEMO_PATH[url] };
    }
    if (isMockDemoVideoPath(url)) {
        return { uri: resolveMockFeedVideoUrl(url) };
    }
    const resolved = resolveMockFeedVideoUrl(url);
    return { uri: resolved };
}
