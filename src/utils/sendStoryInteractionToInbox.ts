import type { Post, Story } from '../types';
import { appendMessage } from '../api/messages';
import {
    buildStoryReplyContext,
    resolveStoryReplyThumbnail,
} from './storyReplyNative';

type DeliverArgs = {
    fromHandle: string;
    toHandle: string;
    story: Story;
    originalPost?: Post | null;
    sharedPostForContext?: Post | null;
};

/**
 * Instagram-style: story text reply → DM thread with the story owner
 * (conversation bumps to top of their Messages inbox).
 *
 * Do NOT send a follow-up "You replied…" as the owner — on Laravel,
 * `appendMessage(from, to)` always sends as the authenticated user, so that
 * call becomes a self-message and throws (breaking the inbox handoff).
 */
export async function deliverStoryReplyToInbox({
    fromHandle,
    toHandle,
    story,
    originalPost = null,
    sharedPostForContext = null,
    replyText,
}: DeliverArgs & { replyText: string }): Promise<void> {
    const normalized = replyText.trim();
    if (!normalized || !fromHandle || !toHandle) return;
    if (fromHandle.trim().toLowerCase() === toHandle.trim().toLowerCase()) return;

    const storyThumb = await resolveStoryReplyThumbnail(story, originalPost, sharedPostForContext);
    const { contextOwner, storyContextText, isVisualStory } = buildStoryReplyContext(
        story,
        toHandle,
        originalPost,
        sharedPostForContext,
    );

    // Optional story sticker / thumb ahead of the reply (IG-style context).
    if (storyThumb) {
        try {
            await appendMessage(fromHandle, toHandle, {
                text: 'Replied to your story',
                imageUrl: storyThumb,
                storyId: story.id,
                storyContextOwner: contextOwner || undefined,
            });
        } catch (error) {
            console.warn('Story reply context message failed:', error);
        }
    }

    await appendMessage(fromHandle, toHandle, {
        text: normalized,
        imageUrl: isVisualStory ? undefined : storyThumb,
        storyId: story.id,
        storyContextText: isVisualStory ? undefined : storyContextText || undefined,
        storyContextOwner: contextOwner || undefined,
    });
}

/**
 * Instagram-style: story emoji / heart reaction → DM with story context.
 */
export async function deliverStoryReactionToInbox({
    fromHandle,
    toHandle,
    story,
    originalPost = null,
    sharedPostForContext = null,
    emoji,
}: DeliverArgs & { emoji: string }): Promise<void> {
    const reaction = (emoji || '').trim();
    if (!reaction || !fromHandle || !toHandle) return;
    if (fromHandle.trim().toLowerCase() === toHandle.trim().toLowerCase()) return;

    const storyThumb = await resolveStoryReplyThumbnail(story, originalPost, sharedPostForContext);
    const { contextOwner } = buildStoryReplyContext(
        story,
        toHandle,
        originalPost,
        sharedPostForContext,
    );

    await appendMessage(fromHandle, toHandle, {
        text: reaction,
        imageUrl: storyThumb,
        storyId: story.id,
        storyContextOwner: contextOwner || undefined,
        storyContextText: 'Reacted to your story',
    });
}
