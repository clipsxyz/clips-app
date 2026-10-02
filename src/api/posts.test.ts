import { describe, it, expect } from 'vitest';
import { transformLaravelPost } from './posts';

/**
 * Regression guards for the media-dimension passthrough.
 *
 * transformLaravelPost() rebuilds each post as an EXPLICIT WHITELIST rather than spreading
 * the API response, which means any new server field is dropped by default and fails
 * silently -- no type error, just `undefined` at runtime.
 *
 * That is exactly what happened to width/height/aspect_ratio: the backfill wrote correct
 * values to the database and the API returned them, but the mapper discarded them, so every
 * card still laid out as a 1:1 square until the video fired onLoad and then visibly
 * reflowed. These tests pin the mapping so a future field addition cannot repeat it.
 */
describe('transformLaravelPost media dimensions', () => {
  const base = {
    id: 'p1',
    user_handle: 'someone',
    media_url: 'http://localhost:8000/storage/uploads/a/b.mp4',
    media_type: 'video',
  };

  it('passes through snake_case dimensions from the API', () => {
    const post = transformLaravelPost({ ...base, width: 405, height: 720, aspect_ratio: 0.5625 });

    expect(post.width).toBe(405);
    expect(post.height).toBe(720);
    expect(post.aspectRatio).toBe(0.5625);
  });

  it('accepts the camelCase alias too', () => {
    const post = transformLaravelPost({ ...base, width: 1920, height: 1080, aspectRatio: 16 / 9 });

    expect(post.width).toBe(1920);
    expect(post.height).toBe(1080);
    expect(post.aspectRatio).toBeCloseTo(16 / 9, 6);
  });

  it('leaves dimensions undefined for un-backfilled rows rather than defaulting to 1', () => {
    // Text-only posts, and media whose file is missing, have no dimensions. Faking a value
    // here would pin the card to the wrong ratio instead of letting it measure at runtime.
    const post = transformLaravelPost({ ...base, width: null, height: null, aspect_ratio: null });

    expect(post.width).toBeUndefined();
    expect(post.height).toBeUndefined();
    expect(post.aspectRatio).toBeUndefined();
  });

  it('omits the keys entirely when the API sends nothing', () => {
    const post = transformLaravelPost({ ...base });

    expect(post.width).toBeUndefined();
    expect(post.height).toBeUndefined();
  });

  it('preserves per-item dimensions inside mediaItems', () => {
    const post = transformLaravelPost({
      ...base,
      width: 1080,
      height: 1920,
      media_items: [
        { url: 'http://localhost:8000/storage/uploads/a/1.mp4', type: 'video', width: 1080, height: 1920 },
        { url: 'http://localhost:8000/storage/uploads/a/2.jpg', type: 'image', width: 720, height: 540 },
      ],
    });

    expect(post.mediaItems).toHaveLength(2);
    expect(post.mediaItems?.[0]).toMatchObject({ width: 1080, height: 1920 });
    expect(post.mediaItems?.[1]).toMatchObject({ width: 720, height: 540 });
  });

  it('handles dimensions that live only on media_items, not the post row', () => {
    // Still-image posts historically stored media solely in media_items.
    const post = transformLaravelPost({
      id: 'p2',
      user_handle: 'someone',
      media_items: [
        { url: 'http://localhost:8000/storage/uploads/a/1.jpg', type: 'image', width: 640, height: 480 },
      ],
    });

    expect(post.mediaItems?.[0]).toMatchObject({ width: 640, height: 480 });
    expect(post.mediaUrl).toBeTruthy();
  });
});

describe('transformLaravelPost dominant color', () => {
  const base = {
    id: 'p1',
    user_handle: 'someone',
    media_url: 'http://localhost:8000/storage/uploads/a/1.jpg',
    media_type: 'image',
  };

  it('maps the snake_case API field onto dominantColor', () => {
    const post = transformLaravelPost({ ...base, dominant_color: '#2C2A26' });

    expect(post.dominantColor).toBe('#2C2A26');
  });

  it('accepts the camelCase spelling too', () => {
    // The API emits snake_case alongside a camelCase alias in places; accepting both means a
    // response shape change cannot silently drop the ambient tint back to the fallback.
    const post = transformLaravelPost({ ...base, dominantColor: '#313331' } as never);

    expect(post.dominantColor).toBe('#313331');
  });

  it('leaves dominantColor undefined for text-only posts', () => {
    // No sampleable media means no colour. Leaving it undefined lets the canvas hold its
    // fallback instead of tinting a text card with something invented.
    const post = transformLaravelPost({ id: 'p2', user_handle: 'someone', text: 'caption only' });

    expect(post.dominantColor).toBeUndefined();
  });

  it('does not coerce an explicit null into a colour', () => {
    const post = transformLaravelPost({ ...base, dominant_color: null });

    expect(post.dominantColor).toBeUndefined();
  });
});