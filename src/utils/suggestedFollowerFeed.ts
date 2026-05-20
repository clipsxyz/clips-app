import type { Post } from '../types';
import type { User } from '../types';

export const SUGGESTED_FOLLOWER_DISMISSED_KEY = 'clips:suggestedFollowerDismissed';
export const SUGGESTED_FOLLOWER_HIDDEN_HANDLES_KEY = 'clips:suggestedFollowerHiddenHandles';

/** Minimum posts with image/video required before we show someone in the suggested follower card. */
export const MIN_MEDIA_POSTS_FOR_SUGGESTED_FOLLOWER = 1;

export type SuggestedFollowerPreview = {
  postId: string;
  thumbnailUrl: string;
  isVideo: boolean;
  views: number;
  /** Gazetteer system-rendered clip with licensed background music baked in. */
  gazetteerMusic: boolean;
};

export type SuggestedFollowerSuggestion = {
  userHandle: string;
  displayName: string;
  avatarUrl?: string;
  contextLabel: string;
  accountType?: 'personal' | 'business';
  previews: SuggestedFollowerPreview[];
  /** Licensed bed preview URL for "Sample music" on the card (feed videos stay muted). */
  musicPreviewUrl: string;
  /** Used for follow / optimistic updates. */
  representativePost: Post;
};

const VIDEO_URL_RE = /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i;

function isVideoUrl(url: string): boolean {
  return VIDEO_URL_RE.test(url);
}

function postThumbVisual(p: Post): { url: string; isVideo: boolean } | undefined {
  const items = p.mediaItems?.filter((m) => m.url && m.type !== 'text');
  if (items && items.length > 0) {
    const videoItem =
      items.find((m) => m.type === 'video') || items.find((m) => m.url && isVideoUrl(m.url));
    if (videoItem?.url) return { url: videoItem.url, isVideo: true };
    const imgItem = items.find((m) => m.type === 'image');
    if (imgItem?.url) return { url: imgItem.url, isVideo: isVideoUrl(imgItem.url) };
    const first = items[0];
    if (first?.url) return { url: first.url, isVideo: isVideoUrl(first.url) };
  }
  const url = p.mediaUrl || p.finalVideoUrl;
  if (!url) return undefined;
  const isVideo =
    p.mediaType === 'video' || isVideoUrl(url) || (!!p.finalVideoUrl && url === p.finalVideoUrl);
  return { url, isVideo };
}

function normalizeHandle(h: string): string {
  return String(h || '').trim().toLowerCase();
}

function contextLabelFor(user: User | null | undefined, post: Post): string {
  const regional = (user?.regional || post.userRegional || '').trim();
  const local = (user?.local || post.userLocal || '').trim();
  if (regional && local) return `Active near ${local} · ${regional}`;
  if (regional) return `Trending in ${regional}`;
  if (local) return `Near ${local}`;
  return 'Suggested for your feed';
}

/** True when post is a Gazetteer system clip (preview shows licensed music badge). */
export function postHasGazetteerMusic(post: Post): boolean {
  if (post.tags?.includes('gazetteer_suggested')) return true;
  if (post.tags?.includes('gazetteer_music')) return true;
  const withMusic = post as Post & { musicTrackId?: number };
  return Boolean(withMusic.musicTrackId);
}

export function buildSuggestedFollowerFromPosts(
  posts: Post[],
  viewer: User | null | undefined,
  hiddenHandles: Set<string>,
): SuggestedFollowerSuggestion | null {
  if (!viewer) return null;
  const viewerKey = normalizeHandle(viewer.handle);
  const byHandle = new Map<string, Post[]>();

  for (const p of posts) {
    const key = normalizeHandle(p.userHandle);
    if (!key || key === viewerKey) continue;
    if (p.isFollowing) continue;
    if (hiddenHandles.has(key)) continue;
    const list = byHandle.get(key) || [];
    list.push(p);
    byHandle.set(key, list);
  }

  let bestHandle = '';
  let bestPosts: Post[] = [];
  let bestScore = -1;

  for (const [handle, list] of byHandle) {
    const visual = list.filter((p) => postThumbVisual(p));
    if (visual.length < MIN_MEDIA_POSTS_FOR_SUGGESTED_FOLLOWER) continue;
    const score = visual.reduce((sum, p) => sum + (p.stats?.views ?? 0), 0) + visual.length * 10;
    if (score > bestScore) {
      bestScore = score;
      bestHandle = handle;
      bestPosts = visual;
    }
  }

  if (!bestHandle || bestPosts.length < MIN_MEDIA_POSTS_FOR_SUGGESTED_FOLLOWER) return null;

  bestPosts.sort((a, b) => (b.stats?.views ?? 0) - (a.stats?.views ?? 0));
  const rep = bestPosts[0];
  const previews: SuggestedFollowerPreview[] = bestPosts.slice(0, 3).map((p) => {
    const vis = postThumbVisual(p)!;
    const isVideo = vis.isVideo;
    return {
      postId: String(p.id),
      thumbnailUrl: vis.url,
      isVideo,
      views: p.stats?.views ?? 0,
      gazetteerMusic: isVideo && postHasGazetteerMusic(p),
    };
  });

  return {
    userHandle: rep.userHandle,
    displayName: rep.userHandle,
    avatarUrl: undefined,
    contextLabel: contextLabelFor(viewer, rep),
    accountType: rep.userAccountType,
    previews,
    representativePost: rep,
  };
}
