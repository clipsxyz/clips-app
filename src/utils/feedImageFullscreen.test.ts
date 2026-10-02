import { describe, expect, it } from 'vitest';

import type { Post } from '../types';
import {
    collectFeedFullscreenSlides,
    collectFeedImageUrls,
    fullscreenSlideIndexForCarousel,
    imageFullscreenIndexForCarousel,
    resolveFullscreenPoster,
} from './feedImageFullscreen';

const base = {
    id: 'p1',
    userHandle: '@a',
    stats: { views: 0, likes: 0, comments: 0, shares: 0, reclips: 0 },
} as unknown as Post;

const imagePost = (extra: Partial<Post> = {}): Post =>
    ({
        ...base,
        mediaType: 'image',
        mediaUrl: 'http://h/a.jpg',
        ...extra,
    }) as Post;

const videoPost = (extra: Partial<Post> = {}): Post =>
    ({
        ...base,
        mediaType: 'video',
        mediaUrl: 'http://h/a.mp4',
        videoPosterUrl: 'http://h/a.jpg',
        ...extra,
    }) as Post;

describe('collectFeedFullscreenSlides', () => {
    it('keeps a video post as a playable slide instead of dropping it', () => {
        // The regression: video was filtered out of the fullscreen payload entirely, so the
        // modal had zero media and rendered a black shell over the overlay chrome.
        const slides = collectFeedFullscreenSlides(videoPost());

        expect(slides).toHaveLength(1);
        expect(slides[0]).toMatchObject({ kind: 'video', url: 'http://h/a.mp4' });
    });

    it('attaches the poster to a video slide so playback is not a black flash', () => {
        const [slide] = collectFeedFullscreenSlides(videoPost());

        expect(slide.posterUrl).toBe('http://h/a.jpg');
    });

    it('omits the poster key when the post has none', () => {
        const [slide] = collectFeedFullscreenSlides(
            videoPost({ videoPosterUrl: undefined, thumbnailUrl: undefined }),
        );

        expect(slide.posterUrl).toBeUndefined();
    });

    it('treats a video post with no mediaItems as one video slide, not zero', () => {
        // Post-level mediaUrl fallback. Previously this produced an empty list.
        const slides = collectFeedFullscreenSlides(
            videoPost({ mediaItems: undefined }),
        );

        expect(slides).toEqual([
            { kind: 'video', url: 'http://h/a.mp4', posterUrl: 'http://h/a.jpg' },
        ]);
    });

    it('detects video by extension when mediaType disagrees', () => {
        const slides = collectFeedFullscreenSlides(
            imagePost({ mediaType: 'image', mediaUrl: 'http://h/clip.mp4' }),
        );

        expect(slides[0].kind).toBe('video');
    });

    it('renders mixed image and video carousels in order', () => {
        const slides = collectFeedFullscreenSlides(
            videoPost({
                mediaItems: [
                    { url: 'http://h/1.mp4', type: 'video' },
                    { url: 'http://h/2.jpg', type: 'image' },
                    { url: 'http://h/3.jpg', type: 'image' },
                ],
            }),
        );

        expect(slides.map((s) => s.kind)).toEqual(['video', 'image', 'image']);
    });

    it('excludes text slides, which are not media', () => {
        const slides = collectFeedFullscreenSlides(
            imagePost({
                mediaItems: [
                    { url: 'data:text/hello', type: 'text' },
                    { url: 'http://h/2.jpg', type: 'image' },
                ],
            }),
        );

        expect(slides).toHaveLength(1);
        expect(slides[0].url).toBe('http://h/2.jpg');
    });

    it('returns nothing for a text-only post', () => {
        expect(collectFeedFullscreenSlides({ ...base, text: 'caption' } as Post)).toEqual([]);
    });

    it('never yields a data:text URL, which neither Image nor Video can decode', () => {
        const slides = collectFeedFullscreenSlides(
            imagePost({ mediaType: 'text', mediaUrl: 'data:text/plain,hello' } as unknown as Partial<Post>),
        );

        expect(slides).toEqual([]);
    });
});

describe('resolveFullscreenPoster', () => {
    it('prefers videoPosterUrl over thumbnailUrl', () => {
        expect(
            resolveFullscreenPoster(
                videoPost({ thumbnailUrl: 'http://h/thumb.jpg' }) as Post,
            ),
        ).toBe('http://h/a.jpg');
    });

    it('falls back to thumbnailUrl', () => {
        expect(
            resolveFullscreenPoster({
                ...base,
                thumbnailUrl: 'http://h/thumb.jpg',
            } as Post),
        ).toBe('http://h/thumb.jpg');
    });

    it('ignores blank strings', () => {
        expect(
            resolveFullscreenPoster({ ...base, videoPosterUrl: '   ' } as Post),
        ).toBeUndefined();
    });
});

describe('collectFeedImageUrls', () => {
    it('is unchanged for image posts', () => {
        expect(collectFeedImageUrls(imagePost())).toEqual(['http://h/a.jpg']);
    });

    it('still excludes video, preserving existing share/stories behaviour', () => {
        expect(collectFeedImageUrls(videoPost())).toEqual([]);
    });

    it('still excludes text slides and data:text URLs', () => {
        expect(
            collectFeedImageUrls(
                imagePost({
                    mediaItems: [
                        { url: 'data:text/x', type: 'text' },
                        { url: 'http://h/2.jpg', type: 'image' },
                    ],
                }),
            ),
        ).toEqual(['http://h/2.jpg']);
    });
});

describe('fullscreenSlideIndexForCarousel', () => {
    it('maps the tapped carousel index onto the matching slide', () => {
        // Positional mapping over an image-only list sent this to image 0 instead of image 1.
        const post = videoPost({
            mediaItems: [
                { url: 'http://h/1.mp4', type: 'video' },
                { url: 'http://h/2.jpg', type: 'image' },
                { url: 'http://h/3.jpg', type: 'image' },
            ],
        });

        expect(fullscreenSlideIndexForCarousel(post, 0)).toBe(0);
        expect(fullscreenSlideIndexForCarousel(post, 1)).toBe(1);
        expect(fullscreenSlideIndexForCarousel(post, 2)).toBe(2);
    });

    it('clamps an out-of-range index', () => {
        const post = videoPost({
            mediaItems: [
                { url: 'http://h/1.mp4', type: 'video' },
                { url: 'http://h/2.jpg', type: 'image' },
            ],
        });

        expect(fullscreenSlideIndexForCarousel(post, 99)).toBe(1);
    });

    it('returns 0 when there is nothing to show', () => {
        expect(fullscreenSlideIndexForCarousel({ ...base, text: 'caption' } as Post, 3)).toBe(0);
    });

    it('still maps image carousels the same way as the legacy image-only helper', () => {
        const post = imagePost({
            mediaItems: [
                { url: 'http://h/1.jpg', type: 'image' },
                { url: 'http://h/2.jpg', type: 'image' },
            ],
        });

        expect(fullscreenSlideIndexForCarousel(post, 1)).toBe(
            imageFullscreenIndexForCarousel(post, 1),
        );
    });
});