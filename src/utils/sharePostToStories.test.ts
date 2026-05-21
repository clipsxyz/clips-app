import { describe, expect, it } from 'vitest';
import { buildSharePostToStoriesPayload } from './sharePostToStories';
import type { Post } from '../types';

describe('buildSharePostToStoriesPayload', () => {
    it('text-only post shares without media url', () => {
        const post = {
            id: 't1',
            text: 'Hello world',
            userHandle: '@a',
            stats: { views: 0, likes: 0, comments: 0, shares: 0, reclips: 0 },
        } as Post;
        const payload = buildSharePostToStoriesPayload(post);
        expect(payload.isTextOnlyShare).toBe(true);
        expect(payload.mediaUrl).toBeUndefined();
        expect(payload.shareText).toContain('Hello');
    });

    it('media post includes media url', () => {
        const post = {
            id: 'm1',
            text: 'Caption',
            mediaUrl: 'https://example.com/a.jpg',
            mediaType: 'image',
            userHandle: '@a',
            stats: { views: 0, likes: 0, comments: 0, shares: 0, reclips: 0 },
        } as Post;
        const payload = buildSharePostToStoriesPayload(post);
        expect(payload.isTextOnlyShare).toBe(false);
        expect(payload.mediaUrl).toBe('https://example.com/a.jpg');
        expect(payload.mediaType).toBe('image');
    });

    it('caption-only post without media triggers canvas path on clients', () => {
        const post = {
            id: 'c1',
            caption: 'No media caption',
            userHandle: '@a',
            stats: { views: 0, likes: 0, comments: 0, shares: 0, reclips: 0 },
        } as Post;
        const payload = buildSharePostToStoriesPayload(post);
        expect(payload.isTextOnlyShare).toBe(false);
        expect(payload.mediaUrl).toBeUndefined();
        expect(payload.shareText).toContain('caption');
    });
});
