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

function currentSlideType(post: Post, total: number, carouselIndex: number): 'video' | 'image' | 'text' {
    if (total <= 1) return tickerSlideType(post);
    const items = (Array.isArray(post.mediaItems) ? post.mediaItems : [])
        .filter((item) => item?.type === 'image' || item?.type === 'video');
    if (items.length === 0) return tickerSlideType(post);
    const slide = items[Math.min(Math.max(0, carouselIndex), items.length - 1)];
    return slide?.type === 'video' ? 'video' : slide?.type === 'image' ? 'image' : 'text';
}

function statsSegment(post: Post): string {
    const parts: string[] = [];
    if (post.stats.views > 0) parts.push(`${post.stats.views} views`);
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
    const type = currentSlideType(post, total, carouselIndex);
    const clippedIndex = Math.min(Math.max(0, carouselIndex), Math.max(total - 1, 0));

    const mediaSegment =
        total > 1
            ? `Slide ${clippedIndex + 1}/${total} ${type}`
            : type === 'video'
              ? 'MP4 video'
              : type === 'image'
                ? 'Photo'
                : 'Text post';

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
        mediaSegment,
        statsSegment(post),
    ].filter(Boolean);

    return {
        badgeLabel: badge.label,
        badgeTone: badge.tone,
        content: segments.join(GAP),
    };
}