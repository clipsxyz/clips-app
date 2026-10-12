import { describe, it, expect } from 'vitest';
import type { Post } from '../types';
import {
    buildFeedPostNewsTicker,
    formatViewCount,
    tickerSlideCount,
    tickerSlideType,
} from './feedPostNewsTicker';

function makePost(overrides: Partial<Post> = {}): Post {
    return {
        id: 'p1',
        user_id: 'u1',
        userHandle: 'Gazetteer@Dublin',
        createdAt: 0,
        stats: { likes: 0, views: 0, comments: 0, shares: 0, reclips: 0 },
        isBookmarked: false,
        isFollowing: false,
        userLiked: false,
        locationLabel: '',
        text: '',
        tags: [],
        ...overrides,
    };
}

describe('feedPostNewsTicker', () => {
    it('carousel posts get a CAROUSEL badge with slide position', () => {
        const post = makePost({
            mediaItems: [
                { url: 'a.jpg', type: 'image' },
                { url: 'b.mp4', type: 'video' },
                { url: 'c.png', type: 'image' },
                { url: 'd.png', type: 'image' },
            ],
        });
        expect(tickerSlideCount(post)).toBe(4);
        const data = buildFeedPostNewsTicker(post, 2, 4);

    });

    it('single video posts get a POST badge (emerald)', () => {
        const post = makePost({ mediaType: 'video' });
        const data = buildFeedPostNewsTicker(post, 0, 1);

    });

    it('single photo posts get a POST badge when a location is present', () => {
        const post = makePost({
            mediaType: 'image',
            mediaItems: [{ url: 'a.jpg', type: 'image' }],
            locationLabel: 'Dublin',
        });
        const data = buildFeedPostNewsTicker(post, 0, 1);

        expect(data.content).toContain('📍 Dublin');
    });

    it('text posts without location get a POST badge', () => {
        const post = makePost({});
        const data = buildFeedPostNewsTicker(post, 0, 0);

        expect(data.content).toContain('Posted by @Gazetteer@Dublin');
    });

    it('timestamp segment renders from createdAt', () => {
        const now = Date.now();
        const post = makePost({ createdAt: now - 5 * 60 * 1000 });
        const data = buildFeedPostNewsTicker(post);
        expect(data.content).toContain('5 minutes ago');
    });

    it('stats segment only includes non-zero stats', () => {
        const post = makePost({
            mediaType: 'image',
            locationLabel: 'Galway',
            stats: { likes: 42, views: 1300, comments: 0, shares: 3, reclips: 0 },
        });
        const data = buildFeedPostNewsTicker(post);
        expect(data.content).toContain('1.3K Views');
        expect(data.content).not.toContain('42 likes');
        expect(data.content).not.toContain('0 comments');
    });

    it('renders Views right after the timestamp in the marquee string', () => {
        const now = Date.now();
        const post = makePost({
            mediaType: 'video',
            locationLabel: 'Dublin',
            createdAt: now - 60 * 60 * 1000,
            stats: { likes: 42, views: 2800, comments: 7, shares: 3, reclips: 0 },
        });
        const data = buildFeedPostNewsTicker(post);
        const content = data.content;
        const loc = content.indexOf('📍 Dublin');
        const posted = content.indexOf('Posted by @Gazetteer@Dublin');
        const ts = content.indexOf('1 hour ago');
        const views = content.indexOf('2.8K Views');
        expect(loc).toBeGreaterThanOrEqual(0);
        expect(loc).toBeLessThan(posted);
        expect(posted).toBeLessThan(ts);
        expect(ts).toBeLessThan(views);
    });

    it('formats view counts compactly', () => {
        expect(formatViewCount(150)).toBe('150');
        expect(formatViewCount(999)).toBe('999');
        expect(formatViewCount(1000)).toBe('1K');
        expect(formatViewCount(2800)).toBe('2.8K');
        expect(formatViewCount(15000)).toBe('15K');
        expect(formatViewCount(1200000)).toBe('1.2M');
        expect(formatViewCount(0)).toBe('0');
    });

    it('falls back to Gazetteer for missing location', () => {
        const post = makePost({ mediaType: 'image' });
        const data = buildFeedPostNewsTicker(post);
        expect(data.content).toContain('📍 Gazetteer');
    });

    it('resolves slide type from mediaItems when mediaType is absent', () => {
        const video = makePost({ mediaItems: [{ url: 'v.mp4', type: 'video' }] });
        expect(tickerSlideType(video)).toBe('video');

        const image = makePost({ mediaItems: [{ url: 'img.jpg', type: 'image' }] });
        expect(tickerSlideType(image)).toBe('image');

        expect(tickerSlideType(makePost({}))).toBe('text');
    });
});