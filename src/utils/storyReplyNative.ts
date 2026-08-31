import type { Post, Story } from '../types';
import { getStoryVideoPosterFallback, isStoryVideo } from './storyMediaNative';

/** Resolve media URL for DM preview — story may only have `sharedFromPost` until the card loads. */
export function getEffectiveStoryMediaUrlForReply(
    story: Story | undefined,
    originalPost: Post | null,
): string | undefined {
    if (!story) return undefined;
    const fromStory = (story.mediaUrl || '').trim();
    if (fromStory) return fromStory;
    if (story.sharedFromPost && originalPost) {
        const fromPost = (originalPost.mediaUrl || '').trim();
        if (fromPost) return fromPost;
        const item = originalPost.mediaItems?.find((m) => m?.type === 'image' || m?.type === 'video');
        return (item?.url || '').trim() || undefined;
    }
    return undefined;
}

/** Image or video URL for story-reply DM context (web generateStoryReplyThumbnail parity). */
export async function resolveStoryReplyThumbnail(
    story: Story,
    originalPost: Post | null,
    sharedPostForContext: Post | null,
): Promise<string | undefined> {
    let mediaUrl = getEffectiveStoryMediaUrlForReply(story, originalPost);
    const postForContext = originalPost || sharedPostForContext;
    if (!mediaUrl && postForContext) {
        mediaUrl =
            (postForContext.mediaUrl || '').trim() ||
            (postForContext.mediaItems?.find((m) => m.type === 'image' || m.type === 'video')?.url || '').trim() ||
            undefined;
    }
    if (!mediaUrl) return undefined;

    const looksLikeVideoUrl = /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(mediaUrl);
    const isVideoFromOriginal =
        !!postForContext &&
        (postForContext.mediaType === 'video' || postForContext.mediaItems?.[0]?.type === 'video');
    const isVideoStory =
        isStoryVideo(story) || looksLikeVideoUrl || (story.sharedFromPost && isVideoFromOriginal);

    if (isVideoStory) {
        const poster = getStoryVideoPosterFallback(mediaUrl);
        return poster || mediaUrl;
    }

    return mediaUrl;
}

export function buildStoryReplyContext(
    story: Story,
    toHandle: string,
    originalPost: Post | null,
    sharedPostForContext: Post | null,
) {
    const postForContext = originalPost || sharedPostForContext;
    const contextOwner =
        (story.sharedFromUser || '').trim() ||
        (story.sharedFromPost ? postForContext?.userHandle || toHandle : toHandle);
    const rawContextText = story.sharedFromPost
        ? postForContext?.text || story.text || ''
        : story.text || '';
    const storyContextText = rawContextText.trim().slice(0, 120);
    const isVisualStory =
        !!story.mediaUrl ||
        story.mediaType === 'image' ||
        story.mediaType === 'video' ||
        (story.sharedFromPost &&
            !!(
                (postForContext?.mediaUrl && postForContext.mediaUrl.trim() !== '') ||
                (postForContext?.mediaItems && postForContext.mediaItems.length > 0)
            ));
    return { contextOwner, storyContextText, isVisualStory };
}
