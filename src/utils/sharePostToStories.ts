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
