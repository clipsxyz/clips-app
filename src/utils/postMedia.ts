import type { Post } from '../types';

const VIDEO_URL_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/** True when a post has playable video (Scenes mode is video-only). */
export function postHasVideoMedia(post: Post): boolean {
  if (post.mediaItems?.length) {
    return post.mediaItems.some(
      (item) => item.type === 'video' || VIDEO_URL_RE.test(item.url || ''),
    );
  }
  if (post.mediaType === 'video') return true;
  if (post.mediaUrl && VIDEO_URL_RE.test(post.mediaUrl)) return true;
  return false;
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
