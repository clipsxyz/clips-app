import type { Post, Story } from '../types';
import { timeAgo } from './timeAgo';

export type StoryMetadataItem = {
    label: string;
    type: 'location' | 'venue' | 'audience' | 'timestamp';
};

export function buildStoryMetadataItems(
    story: Story | undefined,
    originalPost: Post | null,
): StoryMetadataItem[] {
    if (!story) return [];
    const isSharedPost = story.sharedFromPost && originalPost?.id === story.sharedFromPost;
    const locationLabel = isSharedPost && originalPost?.locationLabel
        ? originalPost.locationLabel.trim()
        : (story.location && story.location.trim()) || '';
    const venueLabel = isSharedPost && originalPost?.venue
        ? originalPost.venue.trim()
        : (story.venue && story.venue.trim()) || '';
    const out: StoryMetadataItem[] = [];
    if (locationLabel) out.push({ label: locationLabel, type: 'location' });
    if (venueLabel) out.push({ label: venueLabel, type: 'venue' });
    const audienceLabel =
        story.audience === 'close_friends'
            ? 'Friends'
            : story.audience === 'only_me'
              ? 'Private'
              : 'Public';
    out.push({ label: audienceLabel, type: 'audience' });
    if (typeof story.createdAt === 'number' && !Number.isNaN(story.createdAt)) {
        out.push({ label: timeAgo(story.createdAt), type: 'timestamp' });
    }
    return out;
}

export function shouldShowSharedStoryCredit(
    story: Story | undefined,
    originalPost: Post | null,
    groupHandle: string | undefined,
): { show: boolean; authorDisplay: string } {
    if (!story) return { show: false, authorDisplay: '' };
    const isVisualShare =
        !!story.mediaUrl || story.mediaType === 'image' || story.mediaType === 'video';
    const hasOriginalMedia = Boolean(
        originalPost &&
            ((originalPost.mediaUrl && originalPost.mediaUrl.trim() !== '') ||
                (originalPost.mediaItems && originalPost.mediaItems.length > 0)),
    );
    const showExtraBar = !isVisualShare && !(story.sharedFromPost && hasOriginalMedia);
    const author = (story.sharedFromUser || '').trim();
    const display = author.startsWith('@') ? author.slice(1) : author;
    const show =
        !!author && author !== groupHandle && showExtraBar;
    return { show, authorDisplay: display };
}

export function getStoryOverlayText(story: Story | undefined): string {
    if (!story) return '';
    return (
        story.text ||
        (story as { text_content?: string }).text_content ||
        (
            ((story as { mediaItems?: Array<{ type?: string; text?: string }> }).mediaItems || []).find(
                (m) => m?.type === 'text',
            )?.text || ''
        )
    ).trim();
}
