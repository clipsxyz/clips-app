import type { Post } from '../types';
import { TEXT_POST_BODY_MAX_LENGTH } from '../constants';
import { isTextOnlyPost } from './effectiveTextPostStyleNative';

export type SharePostToStoriesPayload = {
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
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

    if (!mediaUrl && !isTextOnlyShare && !hasRealMediaItems) {
        mediaUrl = undefined;
        mediaType = 'image';
    }

    return {
        mediaUrl: isTextOnlyShare ? undefined : mediaUrl,
        mediaType: isTextOnlyShare ? undefined : mediaType,
        shareText,
        isTextOnlyShare,
        textStyle:
            post.textStyle ??
            (isTextOnlyShare
                ? {
                      color: '#ffffff',
                      size: 'medium',
                      background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 50%, #8b5cf6 100%)',
                  }
                : undefined),
        locationLabel: post.locationLabel,
        venue: post.venue,
        sharedFromPost: post.id,
        sharedFromUser: post.userHandle,
    };
}
