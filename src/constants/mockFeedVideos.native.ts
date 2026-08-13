/**
 * Demo MP4 URLs for mock feed / Scenes testing (React Native).
 *
 * Slot paths stay stable in post data; each slot maps to a *distinct* HTTPS sample
 * so Alice / Sarah / Bob are visibly different clips (needs network).
 *
 * Never map any slot to Big Buck Bunny / bundled bbb.mp4 — that “rainbow” clip
 * was the old shared fallback and confuses shared-to-Stories playback.
 */
import { Image, type ImageSourcePropType } from 'react-native';

export const MOCK_FEED_VIDEO_URLS = {
    escapes: '/demo-videos/escapes.mp4',
    fun: '/demo-videos/fun.mp4',
    joyrides: '/demo-videos/joyrides.mp4',
    blazes: '/demo-videos/blazes.mp4',
    elephants: '/demo-videos/elephants.mp4',
} as const;

/** Bundled asset — offline last-resort only (not used as a visible “demo identity”). */
export const MOCK_FEED_BUNDLED_VIDEO = require('../assets/demo-videos/bbb.mp4');

/** @deprecated Prefer dark poster — BBB frame looks like the old rainbow bug. */
export const MOCK_FEED_BUNDLED_VIDEO_POSTER = require('../assets/demo-videos/bbb-poster.jpg');

const BUNDLED_DEMO_MP4 = Image.resolveAssetSource(MOCK_FEED_BUNDLED_VIDEO);
const BUNDLED_DEMO_URI = typeof BUNDLED_DEMO_MP4?.uri === 'string' ? BUNDLED_DEMO_MP4.uri : '';

/**
 * Distinct public H.264+AAC samples (one per mock slot). Needs network.
 * IMPORTANT: many “10s 1MB” test-videos.co.uk clips are video-only (no sound).
 * Only use URLs verified to contain both `avc1` and `mp4a`.
 * Do NOT use Big Buck Bunny here.
 */
const ESCAPES_HTTPS = 'https://download.samplelib.com/mp4/sample-10s.mp4';
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
    // Legacy paths that used to point at BBB — remap to non-rainbow samples.
    '/demo-videos/bbb.mp4': FUN_HTTPS,
    '/demo-videos/flower.mp4': FUN_HTTPS,
};

const NATIVE_URI_BY_DEMO_PATH: Record<string, string> = { ...HTTPS_BY_DEMO_PATH };

export const MOCK_FEED_VIDEO_REMOTE_FALLBACK =
    HTTPS_BY_DEMO_PATH[MOCK_FEED_VIDEO_URLS.fun] || FUN_HTTPS;

/** @deprecated Unsplash stills — unrelated to the MP4; reject if found in storage. */
const LEGACY_FAKE_UNSPLASH_POSTERS = [
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e',
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e',
    'https://images.unsplash.com/photo-1514931109608-ef9bcc8af3c0',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
] as const;

/** Dark still — never the BBB rainbow poster (reads as the old bug). */
export const MOCK_FEED_VIDEO_POSTERS = {
    escapes: '#121212',
    fun: '#121212',
    joyrides: '#121212',
    blazes: '#121212',
    elephants: '#121212',
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

/** No BBB frame — return undefined so callers use a dark placeholder. */
export function resolveDemoVideoPosterUri(url: string | undefined): string | undefined {
    if (!url || !looksLikeDemoSlotVideo(url)) return undefined;
    return undefined;
}

/** Prefer no poster image over BBB rainbow still. */
export function resolveDemoVideoPosterSource(url: string | undefined): ImageSourcePropType | undefined {
    if (url && !looksLikeDemoSlotVideo(url)) return undefined;
    return undefined;
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

/** Resolve mock video URL string (stories / scenes / URI fallback). */
export function resolveMockFeedVideoUrl(url: string | undefined): string {
    if (!url) return MOCK_FEED_VIDEO_REMOTE_FALLBACK;
    // Uploaded / device media — never substitute the red-flower demo clip.
    if (isPlayableLocalMediaUri(url)) return url;
    if (NATIVE_URI_BY_DEMO_PATH[url]) return NATIVE_URI_BY_DEMO_PATH[url];
    if (isRelativeDemoVideoPath(url)) return nativeUriForDemoPath(url);
    // Legacy BBB hosts → non-rainbow fallback.
    if (/big_buck_bunny|mov_bbb|bbb\.mp4|mediaelement-files/i.test(url)) {
        return MOCK_FEED_VIDEO_REMOTE_FALLBACK;
    }
    // Known demo hosts / slot names only — not every non-http mp4.
    if (!/^https?:\/\//i.test(url) && looksLikeDemoSlotVideo(url)) {
        return nativeUriForDemoPath(url);
    }
    return url;
}

/**
 * Preferred Video `source` for feed/scenes/stories.
 * Demo slots use distinct HTTPS URIs — never the bundled BBB rainbow clip.
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
