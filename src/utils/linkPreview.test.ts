import { describe, expect, it } from 'vitest';

import { excludeLinkShareFeedPosts, isLinkShareFeedPost } from './linkPreview';

/**
 * The server now excludes these posts in SQL (Post::scopeRenderableInFeed), so a
 * feed page should already be displayable. This client filter is a backstop for
 * mock mode and any server that has not been migrated yet.
 *
 * These cases mirror FeedRenderableMediaTest on the backend. If the two
 * predicates disagree, the client will start stripping posts back out of a page
 * the server correctly filled — reintroducing the short-page stall.
 */
describe('isLinkShareFeedPost', () => {
    it('flags a link preview with no media at all', () => {
        expect(isLinkShareFeedPost({ linkPreview: { url: 'https://example.com' } } as any)).toBe(true);
    });

    it('keeps a link preview that also has a media_url', () => {
        expect(
            isLinkShareFeedPost({
                linkPreview: { url: 'https://example.com' },
                mediaUrl: 'https://example.com/video.mp4',
            } as any),
        ).toBe(false);
    });

    it('keeps a link preview that has a media_items url', () => {
        expect(
            isLinkShareFeedPost({
                linkPreview: { url: 'https://example.com' },
                mediaItems: [{ url: 'https://example.com/a.jpg' }],
            } as any),
        ).toBe(false);
    });

    it('treats blank media_urls as absent', () => {
        expect(
            isLinkShareFeedPost({
                linkPreview: { url: 'https://example.com' },
                mediaUrl: '   ',
            } as any),
        ).toBe(true);
    });

    it('flags a link preview whose every media_items url is blank', () => {
        expect(
            isLinkShareFeedPost({
                linkPreview: { url: 'https://example.com' },
                mediaItems: [{ url: '  ' }, { url: '' }, {}],
            } as any),
        ).toBe(true);
    });

    it('never flags a post with no link preview, even with no media', () => {
        expect(isLinkShareFeedPost({ text_content: 'just words' } as any)).toBe(false);
    });

    it('never flags a post with no link preview and only media', () => {
        expect(isLinkShareFeedPost({ mediaUrl: 'https://example.com/a.jpg' } as any)).toBe(false);
    });
});

describe('excludeLinkShareFeedPosts', () => {
    it('drops only the link-share cards and keeps the rest', () => {
        const kept = excludeLinkShareFeedPosts([
            { id: 'link', linkPreview: { url: 'https://example.com' } },
            { id: 'video', mediaUrl: 'https://example.com/v.mp4' },
            { id: 'link-with-media', linkPreview: { url: 'https://x.com' }, mediaUrl: 'https://x.com/v.mp4' },
            { id: 'text', text_content: 'no media, no link' },
            { id: 'carousel', mediaItems: [{ url: 'https://x.com/a.jpg' }] },
        ] as any[]);

        expect(kept.map((p: any) => p.id)).toEqual(['video', 'link-with-media', 'text', 'carousel']);
    });

    it('returns an empty list when every post is a link-share card', () => {
        const out = excludeLinkShareFeedPosts([
            { id: 'a', linkPreview: { url: 'https://a.com' } },
            { id: 'b', linkPreview: { url: 'https://b.com' } },
        ] as any[]);
        expect(out).toEqual([]);
    });
});
