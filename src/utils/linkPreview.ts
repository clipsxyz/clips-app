import type { LinkPreview, Post } from '../types';

const URL_RE = /https?:\/\/[^\s<>"']+/i;
const BARE_HOST_RE =
    /(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/[^\s<>"']*)?/i;
const DIRECT_VIDEO_EXT_RE = /\.(mp4|m4v|webm|mov|m3u8)(?:$|[/?#])/i;
const DIRECT_VIDEO_QUERY_RE = /[?&](?:format|type|ext|mime)=(?:mp4|m3u8|m4v|webm|video(?:\/mp4)?)(?:&|$)/i;

export function extractFirstHttpUrl(text: string): string | undefined {
    if (!text) return undefined;
    const https = text.match(URL_RE);
    if (https) return https[0].replace(/[.,);!?]+$/g, '');
    const bare = text.match(BARE_HOST_RE);
    if (!bare) return undefined;
    const raw = bare[0].replace(/[.,);!?]+$/g, '');
    if (!raw || raw.includes('@')) return undefined;
    return `https://${raw.replace(/^https?:\/\//i, '')}`;
}

export function fallbackLinkPreview(url: string): LinkPreview {
    const host = linkAttachmentHostLabel(url);
    return {
        url,
        title: host,
        source: host,
    };
}

/** True when the URL itself is a playable video file or stream, not a watch page. */
export function isDirectVideoUrl(url?: string | null): boolean {
    if (!url) return false;
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) return false;
    const noHash = trimmed.split('#')[0];
    if (DIRECT_VIDEO_EXT_RE.test(noHash)) return true;
    if (DIRECT_VIDEO_QUERY_RE.test(noHash)) return true;
    return false;
}

export function isInstagramUrl(url?: string | null): boolean {
    if (!url) return false;
    try {
        const host = new URL(withHttp(url)).hostname.replace(/^www\./i, '').toLowerCase();
        return host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am';
    } catch {
        return /instagram\.com|instagr\.am/i.test(url);
    }
}

export type InstagramShareKind = 'story' | 'reel' | 'post';

function withHttp(url: string): string {
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function instagramPath(url: string): string {
    try {
        return new URL(withHttp(url)).pathname.toLowerCase();
    } catch {
        return url.toLowerCase();
    }
}

/** Classify an Instagram link as a story, reel, or post from the URL path. */
export function instagramShareKind(url?: string | null): InstagramShareKind | null {
    if (!url || !isInstagramUrl(url)) return null;
    const path = instagramPath(url);
    if (path.includes('/stories/')) return 'story';
    if (/(^|\/)(reel|reels|tv)(\/|$)/.test(path)) return 'reel';
    if (/(^|\/)(p|share)(\/|$)/.test(path)) return 'post';
    return null;
}

/** Card line for Instagram links, e.g. "Check out my Instagram reel". */
export function instagramSharePrompt(url?: string | null): string | undefined {
    const kind = instagramShareKind(url);
    if (kind === 'story') return 'Check out my Instagram story';
    if (kind === 'reel') return 'Check out my Instagram reel';
    if (kind === 'post') return 'Check out my Instagram post';
    if (isInstagramUrl(url)) return 'Check out my Instagram';
    return undefined;
}

export function linkPreviewPlaybackUri(preview: LinkPreview): string | undefined {
    const candidates = [preview.videoUrl, preview.isDirectVideo ? preview.url : undefined, preview.url];
    for (const candidate of candidates) {
        if (isDirectVideoUrl(candidate)) return candidate;
    }
    return undefined;
}

export function linkPreviewPlaysInlineVideo(preview: LinkPreview): boolean {
    return Boolean(linkPreviewPlaybackUri(preview));
}

/** CDN hosts (TikTok etc.) often 403 without a site Referer. */
export function mediaRequestHeaders(uri?: string | null): Record<string, string> | undefined {
    if (!uri) return undefined;
    try {
        const host = new URL(uri).hostname.replace(/^www\./i, '').toLowerCase();
        if (
            host.includes('tiktok') ||
            host.includes('musical.ly') ||
            host.includes('ibytex') ||
            host.endsWith('.ttwstatic.com')
        ) {
            return { Referer: 'https://www.tiktok.com/', Origin: 'https://www.tiktok.com' };
        }
    } catch {
        /* ignore */
    }
    return undefined;
}

export function instagramFallbackPreview(url: string): LinkPreview {
    return {
        url,
        title: instagramSharePrompt(url) || 'Instagram',
        description: 'View on Instagram',
        source: 'Instagram',
    };
}

export function linkPreviewNeedsInstagramPlaceholder(preview: LinkPreview): boolean {
    if (linkPreviewPlaysInlineVideo(preview)) return false;
    if (preview.imageUrl) return false;
    return preview.source.toLowerCase() === 'instagram' || isInstagramUrl(preview.url);
}

export function linkAttachmentHostLabel(url?: string | null): string {
    if (!url) return 'instagram.com';
    try {
        return new URL(url).hostname.replace(/^www\./i, '').toLowerCase() || 'instagram.com';
    } catch {
        return 'instagram.com';
    }
}

export function mapApiLinkPreview(raw: any): LinkPreview | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const url = typeof raw.url === 'string' ? raw.url.trim() : '';
    if (!url) return undefined;
    const source =
        (typeof raw.source === 'string' && raw.source.trim()) ||
        (typeof raw.site_name === 'string' && raw.site_name.trim()) ||
        (typeof raw.siteName === 'string' && raw.siteName.trim()) ||
        'Link';
    const imageUrl =
        (typeof raw.image_url === 'string' && raw.image_url.trim()) ||
        (typeof raw.imageUrl === 'string' && raw.imageUrl.trim()) ||
        (typeof raw.thumbnail_url === 'string' && raw.thumbnail_url.trim()) ||
        (typeof raw.thumbnailUrl === 'string' && raw.thumbnailUrl.trim()) ||
        undefined;
    const videoUrlRaw =
        (typeof raw.video_url === 'string' && raw.video_url.trim()) ||
        (typeof raw.videoUrl === 'string' && raw.videoUrl.trim()) ||
        undefined;
    const videoUrl = videoUrlRaw && isDirectVideoUrl(videoUrlRaw) ? videoUrlRaw : undefined;
    const isDirectVideo =
        raw.is_direct_video === true ||
        raw.isDirectVideo === true ||
        Boolean(videoUrl) ||
        isDirectVideoUrl(url);
    return {
        url,
        title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : undefined,
        description:
            typeof raw.description === 'string' && raw.description.trim()
                ? raw.description.trim()
                : undefined,
        imageUrl,
        siteName:
            typeof raw.site_name === 'string'
                ? raw.site_name
                : typeof raw.siteName === 'string'
                    ? raw.siteName
                    : undefined,
        source,
        isDirectVideo,
        videoUrl: videoUrl || (isDirectVideoUrl(url) ? url : undefined),
    };
}

export function captionWithoutLinkUrl(caption: string, url?: string): string {
    if (!caption) return '';
    if (!url) return caption.trim();
    const withoutScheme = url.replace(/^https?:\/\//i, '');
    return caption
        .replace(url, ' ')
        .replace(withoutScheme, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function getPostCaptionWithoutLink(post: Post, caption: string): string {
    return captionWithoutLinkUrl(caption, post.linkPreview?.url);
}

function postHasRenderableMedia(post: {
    mediaUrl?: string | null;
    mediaItems?: Array<{ url?: string | null }> | null;
}): boolean {
    const mediaUrl = typeof post.mediaUrl === 'string' ? post.mediaUrl.trim() : '';
    if (mediaUrl) return true;
    return Boolean(
        Array.isArray(post.mediaItems) &&
            post.mediaItems.some((item) => Boolean(item?.url && String(item.url).trim())),
    );
}

/** Text-only OG/share card — these belong in Stories 24, not the news feed. */
export function isLinkShareFeedPost(post: {
    linkPreview?: LinkPreview;
    mediaUrl?: string | null;
    mediaItems?: Array<{ url?: string | null }> | null;
}): boolean {
    if (!post.linkPreview) return false;
    return !postHasRenderableMedia(post);
}

export function excludeLinkShareFeedPosts<T extends Parameters<typeof isLinkShareFeedPost>[0]>(
    posts: T[],
): T[] {
    return posts.filter((post) => !isLinkShareFeedPost(post));
}
