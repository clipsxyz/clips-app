import type { Post } from '../types';
import { timeAgo } from './timeAgo';

export type NewsTickerBadgeTone = 'emerald' | 'yellow';

export type FeedPostNewsTickerData = {
    badgeLabel: string;
    badgeTone: NewsTickerBadgeTone;
    content: string;
};

const GAP = '   •   ';

function resolvedLocation(post: Post): string {
    const raw = String(post.locationLabel || '').trim();
    return raw && raw !== 'Unknown Location' ? raw : 'Gazetteer';
}

function hasRealLocation(post: Post): boolean {
    const raw = String(post.locationLabel || '').trim();
    return raw.length > 0 && raw !== 'Unknown Location';
}

function ownerHandle(post: Post): string {
    return String(post.originalUserHandle || post.userHandle || 'User').trim() || 'User';
}

function timestampSegment(post: Post): string {
    const ts =
        post.createdAt != null
            ? typeof post.createdAt === 'string'
                ? parseInt(post.createdAt, 10)
                : post.createdAt
            : null;
    if (typeof ts !== 'number' || Number.isNaN(ts)) return '';
    return timeAgo(ts);
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

function viewsSegment(post: Post): string {
    return post.stats.views > 0 ? `${formatViewCount(post.stats.views)} Views` : '';
}

function statsSegment(post: Post): string {
    const parts: string[] = [];
    if (post.stats.likes > 0) parts.push(`${post.stats.likes} likes`);
    if (post.stats.comments > 0) parts.push(`${post.stats.comments} comments`);
    return parts.join(' • ');
}

export function buildFeedPostNewsTicker(
    post: Post,
    carouselIndex = 0,
    slideCount?: number,
): FeedPostNewsTickerData {
    const total = slideCount ?? tickerSlideCount(post);
    const clippedIndex = Math.min(Math.max(0, carouselIndex), Math.max(total - 1, 0));

    const badges: Array<{ label: string; tone: NewsTickerBadgeTone }> = [];
    if (total > 1) {
        badges.push({
            label: `CAROUSEL ${clippedIndex + 1}/${total}`,
            tone: 'yellow',
        });
    } else if (hasRealLocation(post)) {
        badges.push({ label: 'LOCATION', tone: 'emerald' });
    } else {
        badges.push({ label: 'POST', tone: 'emerald' });
    }

    const badge = badges[0];

    const segments = [
        `📍 ${resolvedLocation(post)}`,
        `Posted by @${ownerHandle(post)}`,
        timestampSegment(post),
        viewsSegment(post),
        statsSegment(post),
    ].filter(Boolean);

    return {
        badgeLabel: badge.label,
        badgeTone: badge.tone,
        content: segments.join(GAP),
    };
}