import type { Post } from '../types';
import { timeAgo } from './timeAgo';

export type NewsTickerBadgeTone = 'emerald' | 'yellow';

export type NewsTickerSegmentKind =
    | 'location'
    | 'venue'
    | 'landmark'
    | 'tagged'
    | 'author'
    | 'timestamp'
    | 'views';

export type NewsTickerSegment = {
    kind: NewsTickerSegmentKind;
    text: string;
};

export type FeedPostNewsTickerData = {
    badgeLabel?: string;
    badgeTone?: NewsTickerBadgeTone;
    content: string;
    segments: NewsTickerSegment[];
};

export const TICKER_SEGMENT_GAP = '  •  ';

function resolvedLocation(post: Post): string {
    const raw = String(post.locationLabel || (post as any).location || '').trim();
    if (raw && raw !== 'Unknown Location') return raw;
    return 'Gazetteer';
}

function ownerHandle(post: Post): string {
    return String(post.originalUserHandle || post.userHandle || 'User').trim() || 'User';
}

function timestampSegment(post: Post): NewsTickerSegment | null {
    const ts =
        post.createdAt != null
            ? typeof post.createdAt === 'string'
                ? parseInt(post.createdAt, 10)
                : post.createdAt
            : null;
    if (typeof ts !== 'number' || Number.isNaN(ts)) return null;
    return { kind: 'timestamp', text: timeAgo(ts) };
}

export function tickerSlideCount(post: Post): number {
    const items = Array.isArray(post.mediaItems) ? post.mediaItems : [];
    return items.filter((item) => item?.type === 'image' || item?.type === 'video').length;
}

export function tickerSlideType(post: Post): 'video' | 'image' | 'text' {
    const items = Array.isArray(post.mediaItems) ? post.mediaItems : [];
    const firstMedia = items.find((item) => item?.type === 'image' || item?.type === 'video');
    if (post.mediaType === 'video' || firstMedia?.type === 'video') return 'video';
    if (post.mediaType === 'image' || firstMedia?.type === 'image') return 'image';
    return 'text';
}

export function currentSlideType(post: Post, total: number, carouselIndex: number): 'video' | 'image' | 'text' {
    if (total <= 1) return tickerSlideType(post);
    const items = (Array.isArray(post.mediaItems) ? post.mediaItems : [])
        .filter((item) => item?.type === 'image' || item?.type === 'video');
    if (items.length === 0) return tickerSlideType(post);
    const slide = items[Math.min(Math.max(0, carouselIndex), items.length - 1)];
    return slide?.type === 'video' ? 'video' : slide?.type === 'image' ? 'image' : 'text';
}

/** Compact view count: 150 → "150", 2800 → "2.8K", 1200000 → "1.2M". */
export function formatViewCount(count: number): string {
    if (!Number.isFinite(count) || count <= 0) return '0';
    if (count >= 1_000_000) {
        const value = count / 1_000_000;
        return `${value >= 100 ? Math.round(value) : Math.round(value * 10) / 10}M`;
    }
    if (count >= 1_000) {
        const value = count / 1_000;
        return `${value >= 100 ? Math.round(value) : Math.round(value * 10) / 10}K`;
    }
    return String(Math.round(count));
}

export function formatViews(count: number): string {
    return formatViewCount(count);
}

function venueSegment(post: Post): NewsTickerSegment | null {
    const venue = String(post.venue || (post as any).venueName || '').trim();
    return venue.length > 0 ? { kind: 'venue', text: venue } : null;
}

function landmarkSegment(post: Post): NewsTickerSegment | null {
    const landmark = String(post.landmark || '').trim();
    return landmark.length > 0 ? { kind: 'landmark', text: landmark } : null;
}

function taggedSegment(post: Post): NewsTickerSegment | null {
    const tagged = Array.isArray((post as any).tagged_users)
        ? (post as any).tagged_users
        : Array.isArray(post.taggedUsers)
          ? post.taggedUsers
          : Array.isArray((post as any).mentions)
            ? (post as any).mentions
            : [];
    const handles = tagged
        .map((h: any) => String(h || '').trim())
        .filter((h: string) => h.length > 0);
    if (handles.length === 0) return null;
    const display = handles.slice(0, 3).map((h: string) => (h.startsWith('@') ? h : `@${h}`)).join(', ');
    const text = handles.length > 3 ? `${display}, +${handles.length - 3}` : display;
    return { kind: 'tagged', text };
}

function viewsSegment(post: Post): NewsTickerSegment {
    const views = Number(
        post.stats?.views ?? (post as any).views_count ?? (post as any).views ?? (post as any).view_count,
    );
    if (!Number.isFinite(views) || views < 0) return { kind: 'views', text: '0 Views' };
    return { kind: 'views', text: `${formatViews(views)} Views` };
}

export function buildFeedPostNewsTicker(
    post: Post,
    carouselIndex = 0,
    slideCount?: number,
): FeedPostNewsTickerData {
    void carouselIndex;
    void slideCount;

    const segments: NewsTickerSegment[] = [
        { kind: 'location', text: resolvedLocation(post) },
        venueSegment(post),
        landmarkSegment(post),
        taggedSegment(post),
        { kind: 'author', text: `Posted by @${ownerHandle(post)}` },
        timestampSegment(post),
        viewsSegment(post),
    ].filter((segment): segment is NewsTickerSegment => segment != null);

    return {
        badgeLabel: '',
        badgeTone: 'emerald',
        content: segments.map((segment) => segment.text).join(TICKER_SEGMENT_GAP),
        segments,
    };
}
