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

function uniqueReclipNames(handles: string[] | undefined | null): string[] {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const raw of handles ?? []) {
        const name = String(raw || '').replace(/^@/, '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(name);
    }
    return names;
}

/** First two followed reclippers on the line. Everyone after that is the More list. */
export function reclipAttributionParts(handles: string[] | undefined | null): {
    label: string | null;
    rest: string[];
} {
    const names = uniqueReclipNames(handles);
    if (names.length < 2) return { label: null, rest: [] };
    return {
        label: `${names[0]} & ${names[1]} reclipped`,
        rest: names.slice(2),
    };
}

export function formatReclipAttribution(handles: string[] | undefined | null): string | null {
    return reclipAttributionParts(handles).label;
}

export function getReclipDisplay(post: Post, _viewerHandle?: string | null): {
    isReclip: boolean;
    displayHandle: string;
    profileHandle: string;
    /** Person who reclipped. Same as the author when this is not a reclip. */
    reclipperHandle: string;
    /** Follow state for the person whose name is on the card. */
    authorFollowing: boolean;
} {
    const isReclip = Boolean(post.isReclipped && post.originalUserHandle);
    const displayHandle = isReclip ? post.originalUserHandle! : post.userHandle;
    const profileHandle = isReclip ? post.originalUserHandle! : post.userHandle;
    return {
        isReclip,
        displayHandle,
        profileHandle,
        reclipperHandle: post.userHandle,
        authorFollowing: isReclip ? post.originalAuthorIsFollowing === true : post.isFollowing === true,
    };
}

export function getPostDisplayCaption(post: Post): string {
    const pick = (...vals: Array<unknown>): string => {
        for (const v of vals) {
            if (typeof v === 'string' && v.trim().length > 0) return v.trim();
        }
        return '';
    };
    return pick(
        post.captionText,
        post.caption,
        post.text,
        post.imageText,
        post.text_content,
    );
}

/** Fields written by the edit sheet. Every surface that paints copy or the ticker reads these. */
export function applyEditedPostFields(
    post: Post,
    fields: { text: string; location: string; venue: string; landmark: string },
): Post {
    const text = fields.text;
    const hasMedia =
        Boolean((post.mediaUrl || '').trim()) ||
        (Array.isArray(post.mediaItems) &&
            post.mediaItems.some(
                (item) =>
                    !!item &&
                    (item.type === 'image' || item.type === 'video') &&
                    typeof item.url === 'string' &&
                    item.url.trim().length > 0,
            ));
    return {
        ...post,
        text,
        text_content: text,
        caption: text,
        captionText: text,
        imageText: hasMedia ? post.imageText : text,
        locationLabel: fields.location.trim() ? fields.location : undefined,
        venue: fields.venue.trim() ? fields.venue : undefined,
        landmark: fields.landmark.trim() ? fields.landmark : undefined,
    };
}
