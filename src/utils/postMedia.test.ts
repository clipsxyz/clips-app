import { describe, expect, it } from 'vitest';
import type { Post, PostMediaItem } from '../types';
import {
  resolveCarouselItemStillUri,
  siblingJpegFromVideoUrl,
} from './postMedia';

function post(partial: Partial<Post>): Post {
  return {
    id: 'p1',
    userHandle: 'Barry@Galway',
    locationLabel: 'Galway',
    tags: [],
    createdAt: Date.now(),
    stats: { likes: 0, views: 0, comments: 0, shares: 0, reclips: 0 },
    ...partial,
  } as Post;
}

describe('resolveCarouselItemStillUri', () => {
  it('uses the image URL for a photo slide', () => {
    const items: PostMediaItem[] = [
      { url: 'https://cdn.example/a.mp4', type: 'video', posterUrl: 'https://cdn.example/a.jpg' },
      { url: 'https://cdn.example/b.jpg', type: 'image' },
    ];
    expect(resolveCarouselItemStillUri(items[1], post({ videoPosterUrl: items[0].posterUrl }), 1, items)).toBe(
      'https://cdn.example/b.jpg',
    );
  });

  it('does not reuse the first video poster on a later video slide', () => {
    const items: PostMediaItem[] = [
      { url: 'https://cdn.example/a.mp4', type: 'video', posterUrl: 'https://cdn.example/a.jpg' },
      { url: 'https://cdn.example/b.mp4', type: 'video' },
    ];
    expect(
      resolveCarouselItemStillUri(items[1], post({ videoPosterUrl: 'https://cdn.example/a.jpg' }), 1, items),
    ).toBe('https://cdn.example/b.jpg');
  });

  it('uses the first clip poster only for the first video slide', () => {
    const items: PostMediaItem[] = [
      { url: 'https://cdn.example/a.mp4', type: 'video' },
      { url: 'https://cdn.example/b.jpg', type: 'image' },
    ];
    expect(
      resolveCarouselItemStillUri(items[0], post({ videoPosterUrl: 'https://cdn.example/a.jpg' }), 0, items),
    ).toBe('https://cdn.example/a.jpg');
  });
});

describe('siblingJpegFromVideoUrl', () => {
  it('swaps the video extension for jpg', () => {
    expect(siblingJpegFromVideoUrl('https://cdn.example/clip.mp4?x=1')).toBe(
      'https://cdn.example/clip.jpg?x=1',
    );
  });
});
