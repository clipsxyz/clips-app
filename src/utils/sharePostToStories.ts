import type { Post } from '../types';
import { TEXT_POST_BODY_MAX_LENGTH } from '../constants';
import { isTextOnlyPost } from './effectiveTextPostStyleNative';
import { isTextCardStyleId, TEXT_CARD_STYLES, textCardStyleBackground } from './textCardStyles';

export type SharePostToStoriesPayload = {
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    /** Prefer post.videoPosterUrl so Stories 24 rail does not fall back to demo BBB. */
    videoPosterUrl?: string;
    shareText: string;
    isTextOnlyShare: boolean;
    textStyle?: Post['textStyle'];
    locationLabel?: string;
    venue?: string;
    sharedFromPost?: string;
    sharedFromUser?: string;
};

export const STORY_SHARE_STILL_LIVE_MESSAGE =
    'This card is already on your Stories. You can share it again after it disappears in 24 hours.';

const liveSharedPosts = new Map<string, number>();

/** Remember a card the viewer just put on Stories, until that story's 24 hours are up. */
export function rememberPostSharedToStories(
    postId: string,
    expiresAt = Date.now() + 24 * 60 * 60 * 1000,
): void {
    const id = String(postId || '').trim();
    if (!id) return;
    const previous = liveSharedPosts.get(id) ?? 0;
    liveSharedPosts.set(id, Math.max(previous, expiresAt));
}

export function rememberLiveSharedPosts(
    stories: Array<{ sharedFromPost?: string; expiresAt?: number }>,
    now = Date.now(),
): void {
    for (const story of stories) {
        const id = String(story.sharedFromPost || '').trim();
        if (!id || (story.expiresAt != null && story.expiresAt <= now)) continue;
        rememberPostSharedToStories(id, story.expiresAt ?? now + 24 * 60 * 60 * 1000);
    }
}

/** True while this viewer still has a live story of this newsfeed card. */
export function postIsLiveOnStories(postId: string, now = Date.now()): boolean {
    const id = String(postId || '').trim();
    const until = liveSharedPosts.get(id);
    if (until == null) return false;
    if (until <= now) {
        liveSharedPosts.delete(id);
        return false;
    }
    return true;
}

/** Build createStory args from a feed post (web ShareToStoriesModal parity). */
export function buildSharePostToStoriesPayload(post: Post): SharePostToStoriesPayload {
    const postText = post.text || post.caption || post.imageText || '';
    const truncatedText =
        postText && postText.length > TEXT_POST_BODY_MAX_LENGTH
            ? `${postText.substring(0, TEXT_POST_BODY_MAX_LENGTH)}...`
            : postText;

    const carouselMedia = (post.mediaItems || []).filter(
        (m) => m?.type === 'image' || m?.type === 'video',
    );
    const firstCarousel = carouselMedia[0];
    let mediaUrl = firstCarousel?.url || post.mediaUrl;
    let mediaType: 'image' | 'video' = (firstCarousel?.type || post.mediaType || 'image') as 'image' | 'video';
    const hasRealMediaItems = carouselMedia.length > 0 || Boolean(post.mediaUrl);
    const isTextOnlyShare = isTextOnlyPost(post);
    const shareText = (truncatedText || 'Shared from feed').trim();
    const videoPosterUrl =
        (typeof post.videoPosterUrl === 'string' && post.videoPosterUrl.trim()) ||
        (firstCarousel?.type === 'video' &&
            typeof (firstCarousel as { posterUrl?: string }).posterUrl === 'string' &&
            (firstCarousel as { posterUrl?: string }).posterUrl?.trim()) ||
        undefined;

    if (!mediaUrl && !isTextOnlyShare && !hasRealMediaItems) {
        mediaUrl = undefined;
        mediaType = 'image';
    }

    const cardId = isTextCardStyleId(post.cardStyle) ? post.cardStyle : undefined;
    const cardLook = cardId ? TEXT_CARD_STYLES[cardId] : undefined;
    const textStyle = cardLook
        ? {
              color: cardLook.textColor,
              size: post.textStyle?.size || ('medium' as const),
              background: textCardStyleBackground(cardId),
              fontFamily: post.textStyle?.fontFamily,
          }
        : post.textStyle ??
          (isTextOnlyShare
              ? {
                    color: '#ffffff',
                    size: 'medium' as const,
                    background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 50%, #8b5cf6 100%)',
                }
              : undefined);

    return {
        mediaUrl: isTextOnlyShare ? undefined : mediaUrl,
        mediaType: isTextOnlyShare ? undefined : mediaType,
        videoPosterUrl: isTextOnlyShare ? undefined : videoPosterUrl || undefined,
        shareText,
        isTextOnlyShare,
        textStyle,
        locationLabel: post.locationLabel,
        venue: post.venue,
        sharedFromPost: post.id,
        sharedFromUser: post.userHandle,
    };
}
