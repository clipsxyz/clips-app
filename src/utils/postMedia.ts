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
