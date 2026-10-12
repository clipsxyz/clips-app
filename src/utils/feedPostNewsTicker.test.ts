import { describe, it, expect } from 'vitest';
import type { Post } from '../types';
import {
    buildFeedPostNewsTicker,
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
        expect(data.badgeLabel).toBe('CAROUSEL 3/4');
        expect(data.badgeTone).toBe('yellow');
        expect(data.content).toContain('Slide 3/4 image');
        expect(data.badgeLabel).not.toBe('LIVE');
    });

    it('single video posts get a POST badge and MP4 media type', () => {
        const post = makePost({ mediaType: 'video' });
        const data = buildFeedPostNewsTicker(post, 0, 1);
        expect(data.badgeLabel).toBe('POST');
        expect(data.badgeTone).toBe('emerald');
        expect(data.content).toContain('MP4 video');
    });

    it('single photo posts get a LOCATION badge when a location is present', () => {
        const post = makePost({
            mediaType: 'image',
            mediaItems: [{ url: 'a.jpg', type: 'image' }],
            locationLabel: 'Dublin',
        });
        const data = buildFeedPostNewsTicker(post, 0, 1);
        expect(data.badgeLabel).toBe('LOCATION');
        expect(data.badgeTone).toBe('emerald');
        expect(data.content).toContain('📍 Dublin');
    });

    it('text posts without location get a POST badge and Text post type', () => {
        const post = makePost({});
        const data = buildFeedPostNewsTicker(post, 0, 0);
        expect(data.badgeLabel).toBe('POST');
        expect(data.badgeTone).toBe('emerald');
        expect(data.content).toContain('Text post');
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
        expect(data.content).toContain('1300 views');
        expect(data.content).toContain('42 likes');
        expect(data.content).not.toContain('0 comments');
    });

    it('falls back to Gazetteer for missing location', () => {
        const post = makePost({ mediaType: 'image' });
        const data = buildFeedPostNewsTicker(post);
        expect(data.badgeLabel).toBe('POST');
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