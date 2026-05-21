import type { Post } from '../types';
import { timeAgo } from './timeAgo';

export type FeedPostMetadataItem = {
    label: string;
    type: 'location' | 'venue' | 'landmark' | 'timestamp';
};

export function buildPostMetadataItems(post: Post): FeedPostMetadataItem[] {
    const out: FeedPostMetadataItem[] = [];
    const locationLabel = (post.locationLabel || '').trim();
    if (locationLabel && locationLabel !== 'Unknown Location') {
        out.push({ label: locationLabel, type: 'location' });
    }
    const venue = (post.venue || '').trim();
    if (venue) out.push({ label: venue, type: 'venue' });
    const landmark = (post.landmark || '').trim();
    if (landmark) out.push({ label: landmark, type: 'landmark' });
    const ts =
        post.createdAt != null
            ? typeof post.createdAt === 'string'
                ? parseInt(post.createdAt, 10)
                : post.createdAt
            : null;
    if (typeof ts === 'number' && !Number.isNaN(ts)) {
        out.push({ label: timeAgo(ts), type: 'timestamp' });
    }
    return out;
}

export function getPostSocialSourceLabel(post: Post): string | null {
    switch (post.socialFormat) {
        case 'youtube_shorts':
            return 'YouTube Shorts';
        case 'tiktok':
            return 'TikTok';
        case 'instagram_reels':
            return 'Instagram Reels';
        default:
            return null;
    }
}

export function getReclipDisplay(post: Post, viewerHandle?: string | null): {
    isReclip: boolean;
    displayHandle: string;
    profileHandle: string;
} {
    const isReclip = Boolean(
        post.isReclipped &&
            post.originalUserHandle &&
            viewerHandle &&
            post.userHandle === viewerHandle &&
            post.userReclipped,
    );
    const displayHandle = isReclip ? post.originalUserHandle! : post.userHandle;
    const profileHandle = isReclip ? post.originalUserHandle! : post.userHandle;
    return { isReclip, displayHandle, profileHandle };
}

export function getPostDisplayCaption(post: Post): string {
    const pick = (...vals: Array<unknown>): string => {
        for (const v of vals) {
            if (typeof v === 'string' && v.trim().length > 0) return v.trim();
        }
        return '';
    };
    return pick(
        (post as { captionText?: string }).captionText,
        post.caption,
        post.text,
        post.imageText,
        (post as { text_content?: string }).text_content,
    );
}
