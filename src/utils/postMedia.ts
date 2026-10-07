import type { Post, PostMediaItem } from '../types';

const VIDEO_URL_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

function firstUri(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() && !/^data:text\//i.test(v.trim())) {
      return v.trim();
    }
  }
  return undefined;
}

/** MP4 / playback URI for a post or carousel slide (Laravel video_url, media_url, or mapped fields). */
export function resolvePostPlaybackUri(
  post: Post,
  item?: PostMediaItem | null,
): string | undefined {
  const extra = post as Post & {
    video_url?: string;
    videoUrl?: string;
    media_url?: string;
    final_video_url?: string;
  };
  const slide = item as
    | (PostMediaItem & { video_url?: string; videoUrl?: string; media_url?: string })
    | null
    | undefined;
  if (slide) {
    return firstUri(slide.video_url, slide.videoUrl, slide.media_url, slide.url);
  }
  return firstUri(
    extra.video_url,
    extra.videoUrl,
    extra.finalVideoUrl,
    extra.final_video_url,
    extra.media_url,
    post.mediaUrl,
  );
}

/** True when a post has playable video (Scenes mode is video-only). */
export function postHasVideoMedia(post: Post): boolean {
  if (post.mediaItems?.length) {
    return post.mediaItems.some(
      (item) => item.type === 'video' || VIDEO_URL_RE.test(item.url || ''),
    );
  }
  if (post.mediaType === 'video') return true;
  const extra = post as Post & { video_url?: string; videoUrl?: string };
  if (extra.video_url || extra.videoUrl || post.finalVideoUrl) return true;
  const uri = resolvePostPlaybackUri(post);
  return Boolean(uri && VIDEO_URL_RE.test(uri));
}

/** True when the active feed carousel slide (or sole media) is video. */
export function currentFeedSlideIsVideo(post: Post, carouselIndex = 0): boolean {
  const items = (post.mediaItems || []).filter(
    (item) => item?.type === 'image' || item?.type === 'video',
  );
  if (items.length > 0) {
    const item = items[Math.min(Math.max(0, carouselIndex), items.length - 1)];
    if (item?.type === 'video') return true;
    if (item?.type === 'image') return false;
    return VIDEO_URL_RE.test(item?.url || '');
  }
  return postHasVideoMedia(post);
}

export function isVideoMediaUri(uri?: string | null): boolean {
  return Boolean(uri && VIDEO_URL_RE.test(uri));
}

/** JPEG sitting next to an MP4 (`clip.mp4` → `clip.jpg`) — never use the MP4 as an Image source. */
export function siblingJpegFromVideoUrl(url?: string | null): string | undefined {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!trimmed || !VIDEO_URL_RE.test(trimmed)) return undefined;
  return trimmed.replace(/\.(mp4|webm|mov|m4v)(\?|#|$)/i, '.jpg$2');
}

function stillFromUnknown(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const uri = raw.trim();
  if (!uri || isVideoMediaUri(uri) || /^data:video\//i.test(uri)) return undefined;
  return uri;
}

/**
 * Still for one carousel tile. Always this slide's picture — never another slide's
 * poster or the playing MP4 URL (Android Image cannot decode video).
 */
export function resolveCarouselItemStillUri(
  item: PostMediaItem | null | undefined,
  post: Post,
  index: number,
  items: PostMediaItem[],
): string | undefined {
  if (!item) return undefined;
  const extra = item as PostMediaItem & { poster_url?: string };
  const fromItem = stillFromUnknown(
    firstUri(extra.posterUrl, extra.poster_url, extra.thumbnailUrl, extra.thumbnail_url),
  );
  if (fromItem) return fromItem;

  if (item.type === 'image' || stillFromUnknown(item.url)) {
    const imageUri = stillFromUnknown(item.url);
    if (imageUri) return imageUri;
  }

  const firstVideoIndex = items.findIndex((entry) => entry?.type === 'video');
  if (item.type === 'video' && index === firstVideoIndex) {
    const postPoster = stillFromUnknown(post.videoPosterUrl);
    if (postPoster) return postPoster;
  }

  if (item.type === 'video') {
    return siblingJpegFromVideoUrl(item.url);
  }
  return undefined;
}
