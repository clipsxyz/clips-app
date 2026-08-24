import type { Story, StoryGroup, StickerOverlay } from '../types';
import { isMockMode } from '../config/runtimeEnv';
import { getAvatarForHandle } from './users';
import { resolveStoryMediaUrl } from '../utils/storyMediaNative';
import { mapApiLinkPreview } from '../utils/linkPreview';

let lastStoriesLoadSource: 'api-paged' | 'api-user' | 'mock' = 'mock';
export function getLastStoriesLoadSource(): 'api-paged' | 'api-user' | 'mock' {
    return lastStoriesLoadSource;
}

const storyGroupCache = new Map<string, { at: number; group: StoryGroup | null }>();
const STORY_GROUP_CACHE_MS = 20_000;

function storyGroupCacheKey(handle: string, viewerUserId?: string): string {
    return `${handle.trim().toLowerCase()}|${viewerUserId || ''}`;
}

export function invalidateStoryPresenceCache(userHandle?: string): void {
    if (!userHandle) {
        storyGroupCache.clear();
        return;
    }
    const needle = userHandle.trim().toLowerCase();
    for (const key of [...storyGroupCache.keys()]) {
        if (key.startsWith(`${needle}|`)) storyGroupCache.delete(key);
    }
}

// Mock stories data – tuned to showcase the new Instagram-style story types
let stories: Story[] = [
    // John – mix of text-only and photo stories
    {
        id: 'story-1',
        userId: 'user-1',
        userHandle: 'John@Dublin',
        // Text-only Instagram-style story using the new textStyle field
        text: 'Quick coffee before work ☕',
        textStyle: {
            color: '#ffffff',
            size: 'medium',
            // Soft gradient similar to the text backgrounds in the new viewer
            background: 'linear-gradient(135deg, #FF4ECB 0%, #8F5BFF 50%, #24C6DC 100%)'
        },
        createdAt: Date.now() - 5000, // 5 seconds ago
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 5000, // 24 hours - 5 seconds
        location: 'Dublin',
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined
    },
    {
        id: 'story-2',
        userId: 'user-1',
        userHandle: 'John@Dublin',
        mediaUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        mediaType: 'image',
        createdAt: Date.now() - 3000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 3000,
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined,
        stickers: [
            {
                id: 'text-sticker-story-2',
                stickerId: 'text-sticker-story-2',
                sticker: {
                    id: 'text-sticker-story-2',
                    name: 'Beautiful day for a walk! 🚶',
                    category: 'Text',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 75,
                scale: 1.0,
                rotation: 0,
                opacity: 1,
                textContent: 'Beautiful day for a walk! 🚶',
                textColor: '#FFFFFF',
                fontSize: 'medium'
            },
            {
                id: 'location-sticker-story-2',
                stickerId: 'location-sticker-story-2',
                sticker: {
                    id: 'location-sticker-story-2',
                    name: 'Dublin',
                    category: 'Location',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 85,
                scale: 0.9,
                rotation: 0,
                opacity: 1,
                textContent: 'Dublin',
                textColor: '#FFFFFF',
                fontSize: 'small'
            }
        ]
    },
    {
        id: 'story-3',
        userId: 'user-2',
        userHandle: 'Sarah@London',
        mediaUrl: 'https://images.unsplash.com/photo-1517474307977-7c27ca92444a?w=800',
        mediaType: 'image',
        createdAt: Date.now() - 10000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 10000,
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined,
        stickers: [
            {
                id: 'text-sticker-story-3',
                stickerId: 'text-sticker-story-3',
                sticker: {
                    id: 'text-sticker-story-3',
                    name: 'Love the architecture here! 🏛️',
                    category: 'Text',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 75,
                scale: 1.0,
                rotation: 0,
                opacity: 1,
                textContent: 'Love the architecture here! 🏛️',
                textColor: '#FFFFFF',
                fontSize: 'medium'
            },
            {
                id: 'location-sticker-story-3',
                stickerId: 'location-sticker-story-3',
                sticker: {
                    id: 'location-sticker-story-3',
                    name: 'London',
                    category: 'Location',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 85,
                scale: 0.9,
                rotation: 0,
                opacity: 1,
                textContent: 'London',
                textColor: '#FFFFFF',
                fontSize: 'small'
            }
        ]
    },
    {
        id: 'story-4',
        userId: 'user-3',
        userHandle: 'Mike@Paris',
        mediaUrl: 'https://images.unsplash.com/photo-1502602898536-47ad22581b52?w=800',
        mediaType: 'image',
        createdAt: Date.now() - 8000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 8000,
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined,
        stickers: [
            {
                id: 'text-sticker-story-4',
                stickerId: 'text-sticker-story-4',
                sticker: {
                    id: 'text-sticker-story-4',
                    name: 'Beautiful morning in Paris! ☕',
                    category: 'Text',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 75,
                scale: 1.0,
                rotation: 0,
                opacity: 1,
                textContent: 'Beautiful morning in Paris! ☕',
                textColor: '#FFFFFF',
                fontSize: 'medium'
            },
            {
                id: 'location-sticker-story-4',
                stickerId: 'location-sticker-story-4',
                sticker: {
                    id: 'location-sticker-story-4',
                    name: 'Paris',
                    category: 'Location',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 85,
                scale: 0.9,
                rotation: 0,
                opacity: 1,
                textContent: 'Paris',
                textColor: '#FFFFFF',
                fontSize: 'small'
            }
        ]
    },
    {
        id: 'story-5',
        userId: 'user-4',
        userHandle: 'Emma@NewYork',
        mediaUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800',
        mediaType: 'image',
        createdAt: Date.now() - 6000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 6000,
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined,
        stickers: [
            {
                id: 'text-sticker-story-5',
                stickerId: 'text-sticker-story-5',
                sticker: {
                    id: 'text-sticker-story-5',
                    name: 'City never sleeps! 🌆',
                    category: 'Text',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 75,
                scale: 1.0,
                rotation: 0,
                opacity: 1,
                textContent: 'City never sleeps! 🌆',
                textColor: '#FFFFFF',
                fontSize: 'medium'
            },
            {
                id: 'location-sticker-story-5',
                stickerId: 'location-sticker-story-5',
                sticker: {
                    id: 'location-sticker-story-5',
                    name: 'New York',
                    category: 'Location',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 85,
                scale: 0.9,
                rotation: 0,
                opacity: 1,
                textContent: 'New York',
                textColor: '#FFFFFF',
                fontSize: 'small'
            }
        ]
    },
    // Stories for feed users
    {
        id: 'story-6',
        userId: 'user-5',
        userHandle: 'Username@Dublin',
        mediaUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800',
        mediaType: 'image',
        createdAt: Date.now() - 4000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 4000,
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined,
        stickers: [
            {
                id: 'text-sticker-story-6',
                stickerId: 'text-sticker-story-6',
                sticker: {
                    id: 'text-sticker-story-6',
                    name: 'Beautiful day in Dublin! ☀️',
                    category: 'Text',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 75,
                scale: 1.0,
                rotation: 0,
                opacity: 1,
                textContent: 'Beautiful day in Dublin! ☀️',
                textColor: '#FFFFFF',
                fontSize: 'medium'
            },
            {
                id: 'location-sticker-story-6',
                stickerId: 'location-sticker-story-6',
                sticker: {
                    id: 'location-sticker-story-6',
                    name: 'Dublin',
                    category: 'Location',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 85,
                scale: 0.9,
                rotation: 0,
                opacity: 1,
                textContent: 'Dublin',
                textColor: '#FFFFFF',
                fontSize: 'small'
            }
        ]
    },
    {
        id: 'story-7',
        userId: 'user-6',
        userHandle: 'Alice@Finglas',
        mediaUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800',
        mediaType: 'image',
        createdAt: Date.now() - 2000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 2000,
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined,
        stickers: [
            {
                id: 'text-sticker-story-7',
                stickerId: 'text-sticker-story-7',
                sticker: {
                    id: 'text-sticker-story-7',
                    name: 'Great spot for coffee! ☕',
                    category: 'Text',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 75,
                scale: 1.0,
                rotation: 0,
                opacity: 1,
                textContent: 'Great spot for coffee! ☕',
                textColor: '#FFFFFF',
                fontSize: 'medium'
            },
            {
                id: 'location-sticker-story-7',
                stickerId: 'location-sticker-story-7',
                sticker: {
                    id: 'location-sticker-story-7',
                    name: 'Finglas',
                    category: 'Location',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 85,
                scale: 0.9,
                rotation: 0,
                opacity: 1,
                textContent: 'Finglas',
                textColor: '#FFFFFF',
                fontSize: 'small'
            }
        ]
    },
    {
        id: 'story-8',
        userId: 'user-7',
        userHandle: 'Sarah@NewYork',
        mediaUrl: 'https://images.unsplash.com/photo-1494522358652-f30e61a0b1b0?w=800',
        mediaType: 'image',
        createdAt: Date.now() - 1000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 1000,
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined,
        stickers: [
            {
                id: 'text-sticker-story-8',
                stickerId: 'text-sticker-story-8',
                sticker: {
                    id: 'text-sticker-story-8',
                    name: 'Park life! 🌳',
                    category: 'Text',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 75,
                scale: 1.0,
                rotation: 0,
                opacity: 1,
                textContent: 'Park life! 🌳',
                textColor: '#FFFFFF',
                fontSize: 'medium'
            },
            {
                id: 'location-sticker-story-8',
                stickerId: 'location-sticker-story-8',
                sticker: {
                    id: 'location-sticker-story-8',
                    name: 'New York',
                    category: 'Location',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 85,
                scale: 0.9,
                rotation: 0,
                opacity: 1,
                textContent: 'New York',
                textColor: '#FFFFFF',
                fontSize: 'small'
            }
        ]
    },
    {
        id: 'story-9',
        userId: 'user-8',
        userHandle: 'Mike@London',
        mediaUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800',
        mediaType: 'image',
        createdAt: Date.now() - 3000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 3000,
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined,
        stickers: [
            {
                id: 'text-sticker-story-9',
                stickerId: 'text-sticker-story-9',
                sticker: {
                    id: 'text-sticker-story-9',
                    name: 'Thames vibes! 🌊',
                    category: 'Text',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 75,
                scale: 1.0,
                rotation: 0,
                opacity: 1,
                textContent: 'Thames vibes! 🌊',
                textColor: '#FFFFFF',
                fontSize: 'medium'
            },
            {
                id: 'location-sticker-story-9',
                stickerId: 'location-sticker-story-9',
                sticker: {
                    id: 'location-sticker-story-9',
                    name: 'London',
                    category: 'Location',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 85,
                scale: 0.9,
                rotation: 0,
                opacity: 1,
                textContent: 'London',
                textColor: '#FFFFFF',
                fontSize: 'small'
            }
        ]
    },
    // Stories for Sarah@Artane – include a poll story to match the new poll card style
    {
        id: 'story-sarah-1',
        userId: 'sarah-artane-1',
        userHandle: 'Sarah@Artane',
        mediaUrl: 'https://images.unsplash.com/photo-1543007631-283050bb3e8c?w=800',
        mediaType: 'image',
        createdAt: Date.now() - 5000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 5000,
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined,
        stickers: [
            {
                id: 'location-sticker-sarah-1',
                stickerId: 'location-sticker-sarah-1',
                sticker: {
                    id: 'location-sticker-sarah-1',
                    name: 'Artane, Dublin',
                    category: 'Location',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 85,
                scale: 0.9,
                rotation: 0,
                opacity: 1,
                textContent: 'Artane, Dublin',
                textColor: '#FFFFFF',
                fontSize: 'small'
            }
        ],
        poll: {
            question: 'Where should I go later?',
            option1: 'Howth',
            option2: 'Malahide',
            votes1: 32,
            votes2: 21
        }
    },
    {
        id: 'story-sarah-2',
        userId: 'sarah-artane-1',
        userHandle: 'Sarah@Artane',
        mediaUrl: 'https://videos.pexels.com/video-files/5439112/5439112-uhd_3840_2160_30fps.mp4',
        mediaType: 'video',
        createdAt: Date.now() - 7000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 7000,
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined,
        stickers: [
            {
                id: 'text-sticker-sarah-2',
                stickerId: 'text-sticker-sarah-2',
                sticker: {
                    id: 'text-sticker-sarah-2',
                    name: 'Exploring the beautiful coast! 🌊',
                    category: 'Text',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 75,
                scale: 1.0,
                rotation: 0,
                opacity: 1,
                textContent: 'Exploring the beautiful coast! 🌊',
                textColor: '#FFFFFF',
                fontSize: 'medium'
            },
            {
                id: 'location-sticker-sarah-2',
                stickerId: 'location-sticker-sarah-2',
                sticker: {
                    id: 'location-sticker-sarah-2',
                    name: 'Howth, Dublin',
                    category: 'Location',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false
                },
                x: 50,
                y: 85,
                scale: 0.9,
                rotation: 0,
                opacity: 1,
                textContent: 'Howth, Dublin',
                textColor: '#FFFFFF',
                fontSize: 'small'
            }
        ]
    },
    // Ava@galway — demo Clips 24 stories for inbox reply/reaction testing
    {
        id: 'story-ava-1',
        userId: 'ava-galway-1',
        userHandle: 'Ava@galway',
        text: 'Galway evenings hit different 🌅 Who’s around?',
        textStyle: {
            color: '#ffffff',
            size: 'large',
            background: 'linear-gradient(160deg, #0ea5e9 0%, #0369a1 45%, #0f172a 100%)',
        },
        createdAt: Date.now() - 120000,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 - 120000,
        location: 'Galway',
        views: 12,
        viewerHandles: ['Bob@Ireland', 'Sarah@Artane'],
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined,
    },
    {
        id: 'story-ava-2',
        userId: 'ava-galway-1',
        userHandle: 'Ava@galway',
        mediaUrl: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=800',
        mediaType: 'image',
        text: 'Salt air + coffee run',
        createdAt: Date.now() - 90000,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 - 90000,
        location: 'Salthill',
        views: 8,
        viewerHandles: ['Bob@Ireland'],
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined,
        stickers: [
            {
                id: 'location-sticker-ava-2',
                stickerId: 'location-sticker-ava-2',
                sticker: {
                    id: 'location-sticker-ava-2',
                    name: 'Salthill, Galway',
                    category: 'Location',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false,
                },
                x: 50,
                y: 88,
                scale: 0.9,
                rotation: 0,
                opacity: 1,
                textContent: 'Salthill, Galway',
                textColor: '#FFFFFF',
                fontSize: 'small',
            },
        ],
    },
    {
        id: 'story-ava-3',
        userId: 'ava-galway-1',
        userHandle: 'Ava@galway',
        mediaUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
        mediaType: 'image',
        createdAt: Date.now() - 45000,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 - 45000,
        location: 'Galway',
        views: 5,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined,
        stickers: [
            {
                id: 'text-sticker-ava-3',
                stickerId: 'text-sticker-ava-3',
                sticker: {
                    id: 'text-sticker-ava-3',
                    name: 'Reply if you’re free later ✨',
                    category: 'Text',
                    emoji: undefined,
                    url: undefined,
                    isTrending: false,
                },
                x: 50,
                y: 78,
                scale: 1,
                rotation: 0,
                opacity: 1,
                textContent: 'Reply if you’re free later ✨',
                textColor: '#FFFFFF',
                fontSize: 'medium',
            },
        ],
    },
];

function delay(ms = 300): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeStickerOverlay(sticker: any): StickerOverlay {
    return {
        ...sticker,
        textContent: sticker?.textContent ?? sticker?.text_content ?? undefined,
        textColor: sticker?.textColor ?? sticker?.text_color ?? undefined,
        fontSize: sticker?.fontSize ?? sticker?.font_size ?? undefined,
        linkUrl: sticker?.linkUrl ?? sticker?.link_url ?? undefined,
        linkName: sticker?.linkName ?? sticker?.link_name ?? undefined,
        linkStyle: sticker?.linkStyle ?? sticker?.link_style ?? undefined,
    } as StickerOverlay;
}

function normalizeStoryStickers(stickers: any): StickerOverlay[] | undefined {
    if (!Array.isArray(stickers)) return undefined;
    return stickers.map(normalizeStickerOverlay);
}

/** Newest first (Instagram-style): first slide is the latest post in the 24h window. */
export function sortStoriesNewestFirst(stories: Story[]): Story[] {
    return [...stories].sort((a, b) => b.createdAt - a.createdAt);
}

/** Rewrite denormalized handles after a passport name/handle change (mock store). */
export function renameStoryHandlesEverywhere(oldHandle: string, newHandle: string): void {
    const oldNorm = String(oldHandle || '')
        .replace(/^@/, '')
        .trim()
        .toLowerCase();
    const nextHandle = String(newHandle || '').replace(/^@/, '').trim();
    if (!oldNorm || !nextHandle || oldNorm === nextHandle.toLowerCase()) return;

    const rewrite = (h?: string | null) => {
        if (!h) return h;
        const n = String(h).replace(/^@/, '').trim().toLowerCase();
        return n === oldNorm ? nextHandle : h;
    };

    stories = stories.map((s) => ({
        ...s,
        userHandle: rewrite(s.userHandle) || s.userHandle,
        sharedFromUserHandle: (s as any).sharedFromUserHandle
            ? rewrite((s as any).sharedFromUserHandle)
            : (s as any).sharedFromUserHandle,
        taggedUsers: Array.isArray(s.taggedUsers)
            ? s.taggedUsers.map((t) => rewrite(t) || t)
            : s.taggedUsers,
        reactions: Array.isArray(s.reactions)
            ? s.reactions.map((r) => ({
                  ...r,
                  userHandle: rewrite(r.userHandle) || r.userHandle,
              }))
            : s.reactions,
        replies: Array.isArray(s.replies)
            ? s.replies.map((r) => ({
                  ...r,
                  userHandle: rewrite(r.userHandle) || r.userHandle,
              }))
            : s.replies,
    }));
}

export type StoriesPage = {
    items: Story[];
    nextCursor: string | null;
    hasMore: boolean;
};

function mapLaravelStoryToStory(story: any): Story {
    const handle = story.user_handle || story.user?.handle || '';
    return {
        id: story.id,
        userId: story.user_id || story.user?.id,
        userHandle: handle,
        mediaUrl: resolveStoryMediaUrl(story.media_url) || undefined,
        mediaType: story.media_type || undefined,
        text: story.text || undefined,
        textColor: story.text_color || undefined,
        textSize: story.text_size || undefined,
        location: story.location || undefined,
        venue: story.venue || undefined,
        createdAt: story.created_at ? new Date(story.created_at).getTime() : Date.now(),
        expiresAt: story.expires_at
            ? new Date(story.expires_at).getTime()
            : (story.created_at
                ? new Date(story.created_at).getTime() + 24 * 60 * 60 * 1000
                : Date.now() + 24 * 60 * 60 * 1000),
        views: story.views_count || 0,
        hasViewed: !!story.has_viewed,
        reactions: [],
        replies: [],
        userReaction: story.user_reaction || undefined,
        textStyle: story.text_style || undefined,
        stickers: normalizeStoryStickers(story.stickers),
        taggedUsers: story.tagged_users || undefined,
        sharedFromPost: story.shared_from_post_id || story.sharedFromPost || undefined,
        sharedFromUser: story.shared_from_user_handle || story.sharedFromUser || undefined,
        videoPosterUrl: resolveStoryMediaUrl(story.video_poster_url) || undefined,
        linkPreview: mapApiLinkPreview(story.link_preview ?? story.linkPreview),
    };
}

function mapLaravelStoryGroups(raw: any[]): StoryGroup[] {
    return raw.map((group) => {
        const handle = group.user_handle || group.userHandle || '';
        const storiesRaw = Array.isArray(group.stories) ? group.stories : [];
        const mappedStories = sortStoriesNewestFirst(storiesRaw.map((s: any) => mapLaravelStoryToStory({
            ...s,
            user_handle: s.user_handle || handle,
            user_id: s.user_id || group.user_id,
        })));
        return {
            userId: group.user_id || mappedStories[0]?.userId,
            userHandle: handle || mappedStories[0]?.userHandle,
            name: group.user_name || (handle || mappedStories[0]?.userHandle || '').split('@')[0],
            avatarUrl: group.avatar_url || getAvatarForHandle(handle || mappedStories[0]?.userHandle || ''),
            stories: mappedStories,
        };
    }).filter((g) => g.userId && g.stories.length > 0);
}

function sortGroupStoriesNewestFirst(groups: StoryGroup[]): StoryGroup[] {
    return groups.map((g) => ({ ...g, stories: sortStoriesNewestFirst(g.stories) }));
}

// Get all story groups (grouped by user)
export async function fetchStoryGroups(userId: string): Promise<StoryGroup[]> {
    if (!isMockMode()) {
        try {
            const { apiRequest } = await import('./client');
            const params = new URLSearchParams();
            if (userId) params.append('userId', userId);
            const response = await apiRequest(`/stories?${params.toString()}`);
            const raw = Array.isArray(response) ? response : [];
            lastStoriesLoadSource = 'api-paged';
            return sortGroupStoriesNewestFirst(mapLaravelStoryGroups(raw));
        } catch (error) {
            console.warn('Failed to fetch story groups from API, falling back to mock:', error);
        }
    }

    lastStoriesLoadSource = 'mock';
    await delay();

    // Filter out expired stories
    const now = Date.now();
    const activeStories = stories.filter(s => {
        if (s.expiresAt <= now) return false;
        const audience = s.audience || 'public';
        if (s.userId === userId) return true;
        return audience === 'public';
    });

    // Group stories by user
    const groups = activeStories.reduce((acc, story) => {
        const existingGroup = acc.find(g => g.userId === story.userId);

        if (existingGroup) {
            existingGroup.stories.push(story);
        } else {
            acc.push({
                userId: story.userId,
                userHandle: story.userHandle,
                name: story.userHandle.split('@')[0],
                avatarUrl: getAvatarForHandle(story.userHandle),
                stories: [story]
            });
        }

        return acc;
    }, [] as StoryGroup[]);

    return sortGroupStoriesNewestFirst(groups);
}

/**
 * Optional paged stories endpoint for large accounts/feeds.
 * Returns flat story items in newest-first order with a keyset cursor.
 */
export async function fetchStoriesPage(cursor: string | null, limit = 20, userId?: string): Promise<StoriesPage> {
    const { fetchStoriesPage: fetchStoriesPageApi } = await import('./client');
    const response = await fetchStoriesPageApi(cursor, limit, userId);
    const rawItems = Array.isArray(response?.items) ? response.items : [];
    const items: Story[] = rawItems.map((story: any) => mapLaravelStoryToStory(story));

    return {
        items,
        nextCursor: typeof response?.nextCursor === 'string' ? response.nextCursor : null,
        hasMore: !!response?.hasMore,
    };
}

// Get stories for a specific user
export async function fetchUserStories(viewerUserId: string, targetUserId: string, followedUserHandles: string[] = []): Promise<Story[]> {
    if (!isMockMode()) {
        try {
            const allGroups = await fetchFollowedUsersStoryGroups(viewerUserId, followedUserHandles);
            const targetGroup = allGroups.find((group) => group.userId === targetUserId);
            lastStoriesLoadSource = 'api-user';
            return targetGroup ? sortStoriesNewestFirst(targetGroup.stories) : [];
        } catch (error) {
            console.warn('Failed to fetch user stories from API, falling back to mock:', error);
        }
    }

    lastStoriesLoadSource = 'mock';
    await delay();

    const now = Date.now();
    return stories.filter(s =>
        s.userId === targetUserId &&
        s.expiresAt > now &&
        (() => {
            const audience = s.audience || 'public';
            if (viewerUserId === targetUserId) return true;
            if (audience === 'public') return true;
            if (audience === 'only_me') return false;
            return followedUserHandles.includes(s.userHandle);
        })()
    ).sort((a, b) => b.createdAt - a.createdAt);
}

// Get story group for a specific user by handle
export async function fetchStoryGroupByHandle(userHandle: string, viewerUserId?: string): Promise<StoryGroup | null> {
    const cacheKey = storyGroupCacheKey(userHandle, viewerUserId);
    const cached = storyGroupCache.get(cacheKey);
    if (cached && Date.now() - cached.at < STORY_GROUP_CACHE_MS) {
        return cached.group;
    }

    if (!isMockMode()) {
        try {
            const { apiRequest } = await import('./client');
            const encoded = encodeURIComponent(userHandle);
            const params = new URLSearchParams();
            if (viewerUserId) params.append('userId', viewerUserId);
            const qs = params.toString();
            const response = await apiRequest(`/stories/user/${encoded}${qs ? `?${qs}` : ''}`);
            const rawStories = Array.isArray(response) ? response : [];
            if (rawStories.length === 0) {
                lastStoriesLoadSource = 'api-user';
                storyGroupCache.set(cacheKey, { at: Date.now(), group: null });
                return null;
            }
            const mapped = rawStories.map((story: any) => mapLaravelStoryToStory(story));
            lastStoriesLoadSource = 'api-user';
            const group = {
                userId: mapped[0].userId,
                userHandle: mapped[0].userHandle || userHandle,
                name: (mapped[0].userHandle || userHandle).split('@')[0],
                avatarUrl: getAvatarForHandle(mapped[0].userHandle || userHandle),
                stories: sortStoriesNewestFirst(mapped),
            };
            storyGroupCache.set(cacheKey, { at: Date.now(), group });
            return group;
        } catch (error) {
            console.warn('Failed to fetch story group by handle from API, falling back to mock:', error);
        }
    }

    lastStoriesLoadSource = 'mock';
    await delay();

    const now = Date.now();
    const target = (userHandle || '').trim().toLowerCase();
    const activeStories = stories.filter(s => (s.userHandle || '').trim().toLowerCase() === target && s.expiresAt > now);

    if (activeStories.length === 0) return null;

    return {
        userId: activeStories[0].userId,
        userHandle: activeStories[0].userHandle,
        name: activeStories[0].userHandle.split('@')[0],
        avatarUrl: getAvatarForHandle(activeStories[0].userHandle),
        stories: activeStories.sort((a, b) => b.createdAt - a.createdAt),
    };
}

// Create a new story
export async function createStory(
    userId: string,
    userHandle: string,
    mediaUrl?: string, // Optional for text-only stories
    mediaType?: 'image' | 'video', // Optional for text-only stories
    text?: string,
    location?: string,
    textColor?: string,
    textSize?: 'small' | 'medium' | 'large',
    sharedFromPost?: string,
    sharedFromUser?: string,
    textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string; fontFamily?: string }, // Text style for text-only stories
    stickers?: StickerOverlay[], // Stickers/GIFs for stories
    taggedUsers?: string[], // Tagged users (handles only)
    poll?: { question: string; option1: string; option2: string; option3?: string }, // Poll data
    taggedUsersPositions?: Array<{ handle: string; x: number; y: number }>, // Tagged users with positions
    question?: string, // Question prompt (e.g., "Ask me anything")
    venue?: string, // Venue / place name (for metadata when story is shown on feed)
    videoPosterUrl?: string, // Still for Stories 24 rail thumbs
    audience: 'public' | 'close_friends' | 'only_me' = 'public'
): Promise<Story> {
    const buildMockStory = async (): Promise<Story> => {
        await delay();

        const now = Date.now();
        const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours from now

        const newStory: Story = {
            id: `story-${Date.now()}`,
            userId,
            userHandle,
            mediaUrl: (() => {
                const raw = (mediaUrl || '').trim();
                // Keep demo slot paths relative; RN maps each slot to its HTTPS sample
                // (never bundled BBB). Absolute URLs pass through resolveStoryMediaUrl.
                if (raw.startsWith('/demo-videos/') || /\/demo-videos\//i.test(raw)) {
                    const match = raw.match(/\/demo-videos\/[^/?#]+/i);
                    return match ? match[0] : raw;
                }
                return resolveStoryMediaUrl(mediaUrl) || undefined;
            })(),
            mediaType: mediaType || undefined,
            text,
            textColor,
            textSize,
            textStyle: textStyle || undefined,
            stickers: stickers || undefined,
            taggedUsers: taggedUsers || undefined,
            createdAt: now,
            expiresAt,
            location,
            venue: venue || undefined,
            videoPosterUrl: videoPosterUrl || undefined,
            audience: audience || 'public',
            views: 0,
            viewerHandles: [],
            hasViewed: false,
            reactions: [],
            replies: [],
            userReaction: undefined,
            sharedFromPost,
            sharedFromUser,
            poll: poll ? {
                question: poll.question,
                option1: poll.option1,
                option2: poll.option2,
                option3: poll.option3,
                votes1: 0,
                votes2: 0,
                votes3: poll.option3 ? 0 : undefined,
                userVote: undefined
            } : undefined,
            question: question ? {
                prompt: question,
                responses: []
            } : undefined
        };

        stories.push(newStory);
        invalidateStoryPresenceCache(userHandle);
        return newStory;
    };

    // Same gate as posts: live mode is EXPO_PUBLIC_USE_MOCK=false.
    if (isMockMode()) {
        return buildMockStory();
    }

    // Use real Laravel API — dedicated helper, same as createPost (bypasses apiRequest allowlist).
    const { createStory: createStoryApi } = await import('./client');

    try {
        const response = await createStoryApi({
            media_url: mediaUrl || undefined,
            media_type: mediaType || undefined,
            text: text || undefined,
            location: location || undefined,
            text_color: textColor || undefined,
            text_size: textSize || undefined,
            shared_from_post_id: sharedFromPost || undefined,
            shared_from_user_handle: sharedFromUser || undefined,
            textStyle: textStyle || undefined,
            stickers: stickers || undefined,
            taggedUsers: taggedUsers || undefined,
            taggedUsersPositions: taggedUsersPositions || undefined,
            poll: poll || undefined,
            question: question || undefined,
            venue: venue || undefined,
            video_poster_url: videoPosterUrl || undefined,
            audience: audience || 'public',
        });

        if (!response?.id) {
            throw new Error('Story was not saved (missing id in API response)');
        }

        // Transform Laravel response to frontend Story format
        const now = Date.now();
        const newStory: Story = {
            id: response.id,
            userId: response.user_id || userId,
            userHandle: response.user_handle || userHandle,
            mediaUrl: resolveStoryMediaUrl(response.media_url || mediaUrl) || undefined,
            mediaType: response.media_type || mediaType || undefined,
            // Keep local text data if backend response omits it (prevents blank text-only stories).
            text: response.text || text || undefined,
            textColor: response.text_color || textColor || undefined,
            textSize: response.text_size || textSize || undefined,
            textStyle: response.text_style || textStyle || undefined,
            stickers: normalizeStoryStickers(response.stickers) || stickers || undefined,
            taggedUsers: response.tagged_users || taggedUsers || undefined, // Get tagged users from backend
            taggedUsersPositions: response.tagged_users_positions || taggedUsersPositions || undefined, // Get tagged users with positions
            createdAt: new Date(response.created_at).getTime() || now,
            expiresAt: new Date(response.expires_at).getTime() || (now + 24 * 60 * 60 * 1000),
            location: response.location || location || undefined,
            venue: response.venue || venue || undefined,
            videoPosterUrl:
                resolveStoryMediaUrl(response.video_poster_url || videoPosterUrl) || undefined,
            linkPreview: mapApiLinkPreview(response.link_preview ?? response.linkPreview),
            audience: response.audience || audience || 'public',
            views: response.views_count || 0,
            viewerHandles: Array.isArray((response as any).viewer_handles)
                ? (response as any).viewer_handles
                : [],
            hasViewed: response.has_viewed || false,
            reactions: response.reactions || [],
            replies: response.replies || [],
            userReaction: response.user_reaction || undefined,
            sharedFromPost: response.shared_from_post_id || sharedFromPost || undefined,
            sharedFromUser: response.shared_from_user_handle || sharedFromUser || undefined,
            poll: response.poll || (poll ? {
                question: poll.question,
                option1: poll.option1,
                option2: poll.option2,
                option3: poll.option3,
                votes1: 0,
                votes2: 0,
                votes3: poll.option3 ? 0 : undefined,
                userVote: undefined
            } : undefined),
            question: response.question || (question ? {
                prompt: question,
                responses: []
            } : undefined),
        };

        // Also add to local stories array for immediate UI update
        stories.push(newStory);
        invalidateStoryPresenceCache(userHandle);

        return newStory;
    } catch (error: any) {
        const isConnectionFallback =
            error?.name === 'ConnectionRefused' || error?.message === 'CONNECTION_REFUSED';
        if (!isConnectionFallback) {
            console.warn('createStory API failed:', error);
            throw error;
        }
        console.warn('createStory API unreachable, using local story until Laravel is back:', error);

        const now = Date.now();
        const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours from now

        const newStory: Story = {
            id: `story-${Date.now()}`,
            userId,
            userHandle,
            mediaUrl: mediaUrl || undefined,
            mediaType: mediaType || undefined,
            text,
            textColor,
            textSize,
            textStyle: textStyle || undefined,
            stickers: stickers || undefined,
            taggedUsers: taggedUsers || undefined,
            createdAt: now,
            expiresAt,
            location,
            venue: venue || undefined,
            videoPosterUrl: videoPosterUrl || undefined,
            audience: audience || 'public',
            views: 0,
            viewerHandles: [],
            hasViewed: false,
            reactions: [],
            replies: [],
            userReaction: undefined,
            sharedFromPost,
            sharedFromUser,
            poll: poll ? {
                question: poll.question,
                option1: poll.option1,
                option2: poll.option2,
                option3: poll.option3,
                votes1: 0,
                votes2: 0,
                votes3: poll.option3 ? 0 : undefined,
                userVote: undefined
            } : undefined,
            question: question ? {
                prompt: question,
                responses: []
            } : undefined
        };

        stories.push(newStory);
        invalidateStoryPresenceCache(userHandle);

        return newStory;
    }
}

// Mark story as viewed
export async function markStoryViewed(storyId: string, _userId: string, viewerHandle?: string): Promise<void> {
    await delay();

    const story = stories.find(s => s.id === storyId);
    if (story) {
        const normalizedHandle = (viewerHandle || '').trim();
        if (!Array.isArray(story.viewerHandles)) story.viewerHandles = [];
        const alreadyCounted = normalizedHandle
            ? story.viewerHandles.some((h) => (h || '').trim().toLowerCase() === normalizedHandle.toLowerCase())
            : story.hasViewed;
        if (!alreadyCounted) {
            if (normalizedHandle) story.viewerHandles.push(normalizedHandle);
            story.views += 1;
        }
        story.hasViewed = true;
    }
}

// Increment story view count
export async function incrementStoryViews(storyId: string): Promise<void> {
    await delay();

    // Kept for backward compatibility; view counts are now deduped in markStoryViewed.
    const _story = stories.find(s => s.id === storyId);
    void _story;
}

// Add reaction to story
export async function addStoryReaction(storyId: string, userId: string, userHandle: string, emoji: string): Promise<void> {
    const pushMockReaction = () => {
        const story = stories.find(s => s.id === storyId);
        if (story) {
            story.reactions = story.reactions.filter(r => r.userId !== userId);
            story.reactions.push({
                id: `reaction-${Date.now()}`,
                userId,
                userHandle,
                emoji,
                createdAt: Date.now()
            });
            story.userReaction = emoji;
        }
    };

    if (!isMockMode()) {
        try {
            const { apiRequest } = await import('./client');
            await apiRequest(`/stories/${storyId}/reaction`, {
                method: 'POST',
                body: JSON.stringify({ emoji }),
            });
            pushMockReaction();
            return;
        } catch (error: any) {
            const isConnectionFallback =
                error?.name === 'ConnectionRefused' || error?.message === 'CONNECTION_REFUSED';
            if (!isConnectionFallback) throw error;
        }
    }

    await delay();
    pushMockReaction();
}

// Add reply to story
export async function addStoryReply(storyId: string, userId: string, userHandle: string, text: string): Promise<void> {
    const pushMockReply = () => {
        const story = stories.find((s) => s.id === storyId);
        if (story) {
            if (!Array.isArray(story.replies)) story.replies = [];
            story.replies.push({
                id: `reply-${Date.now()}`,
                userId,
                userHandle,
                text,
                createdAt: Date.now(),
            });
        }
    };

    if (!isMockMode()) {
        try {
            const { apiRequest } = await import('./client');
            await apiRequest(`/stories/${storyId}/reply`, {
                method: 'POST',
                body: JSON.stringify({ text }),
            });
            pushMockReply();
            return;
        } catch (error: any) {
            const isConnectionFallback =
                error?.name === 'ConnectionRefused' || error?.message === 'CONNECTION_REFUSED';
            if (!isConnectionFallback) throw error;
        }
    }

    await delay();
    pushMockReply();
}

// Add answer to question in story - stores question in questions API (not messages)
export async function addQuestionAnswer(storyId: string, userId: string, userHandle: string, text: string): Promise<void> {
    await delay();

    const story = stories.find(s => s.id === storyId);
    if (story && story.question) {
        const storyCreatorHandle = story.userHandle;
        
        // Store question in questions API (not messages)
        const { addQuestion } = await import('./questions');
        await addQuestion(
            storyId,
            story.question.prompt || 'Ask me anything',
            storyCreatorHandle,
            userId,
            userHandle,
            text
        );
        
        // Also store in story for insights (optional, for tracking)
        if (!story.question.responses) {
            story.question.responses = [];
        }
        story.question.responses.push({
            id: `answer-${Date.now()}`,
            userId,
            userHandle,
            text,
            createdAt: Date.now()
        });
    }
}

// Vote on a poll in a story
export async function voteOnPoll(storyId: string, _userId: string, option: 'option1' | 'option2' | 'option3'): Promise<void> {
    await delay();

    const story = stories.find(s => s.id === storyId);
    if (story && story.poll) {
        // If user already voted, remove their previous vote
        if (story.poll.userVote === 'option1') {
            story.poll.votes1 = (story.poll.votes1 || 0) - 1;
        } else if (story.poll.userVote === 'option2') {
            story.poll.votes2 = (story.poll.votes2 || 0) - 1;
        } else if (story.poll.userVote === 'option3') {
            story.poll.votes3 = (story.poll.votes3 || 0) - 1;
        }

        // Add new vote
        if (option === 'option1') {
            story.poll.votes1 = (story.poll.votes1 || 0) + 1;
        } else if (option === 'option2') {
            story.poll.votes2 = (story.poll.votes2 || 0) + 1;
        } else if (option === 'option3') {
            story.poll.votes3 = (story.poll.votes3 || 0) + 1;
        }

        story.poll.userVote = option;
    }
}

// Story insights for a given user (likes on their stories)
export interface StoryInsight {
    storyId: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    text?: string;
    createdAt: number;
    views: number;
    viewers: string[];
    likes: number;
    likers: string[]; // user handles who reacted (heart/thumbs-up)
    /** All emoji reactions (Instagram-style attribution). */
    reactions: Array<{ userHandle: string; emoji: string; createdAt: number }>;
    replies: Array<{ userHandle: string; text: string; createdAt: number }>;
    question?: {
        prompt: string;
        responseCount: number;
        responses: Array<{
            id: string;
            userId: string;
            userHandle: string;
            text: string;
            createdAt: number;
        }>;
    };
}

export async function getStoryInsightsForUser(userHandle: string): Promise<StoryInsight[]> {
    await delay();

    const now = Date.now();
    const normalizedHandle = (userHandle || '').trim().toLowerCase();
    const ownStories = stories.filter((s) => {
        if ((s.userHandle || '').trim().toLowerCase() !== normalizedHandle) return false;
        if (s.expiresAt <= now) return false;
        return true;
    });

    return ownStories
        .map<StoryInsight>(story => {
            const ownerNorm = normalizedHandle;
            // All reactions except the owner's own (IG: your self-taps aren't activity).
            const reactionRows = (story.reactions || [])
                .filter((r) => (r.userHandle || '').trim().toLowerCase() !== ownerNorm)
                .map((r) => ({
                    userHandle: r.userHandle,
                    emoji: r.emoji,
                    createdAt: r.createdAt || story.createdAt,
                }))
                .sort((a, b) => b.createdAt - a.createdAt);

            const likeReactions = reactionRows.filter(
                (r) => r.emoji === '❤️' || r.emoji === '♥️' || r.emoji === '❤' || r.emoji === '👍',
            );
            const likers = Array.from(new Set(likeReactions.map((r) => r.userHandle)));
            const viewers = Array.from(
                new Set(
                    (story.viewerHandles || [])
                        .map((h) => (h || '').trim())
                        .filter((h) => !!h && h.toLowerCase() !== normalizedHandle)
                )
            );
            const views = Math.max(Number(story.views || 0), viewers.length);
            const replyRows = (story.replies || [])
                .filter((r) => (r.userHandle || '').trim().toLowerCase() !== ownerNorm)
                .map((r) => ({
                    userHandle: r.userHandle,
                    text: r.text,
                    createdAt: r.createdAt,
                }));
            const questionResponseCount = story.question?.responses?.length || 0;
            return {
                storyId: story.id,
                mediaUrl: story.mediaUrl,
                mediaType: story.mediaType,
                text: story.text,
                createdAt: story.createdAt,
                views,
                viewers,
                likes: likers.length,
                likers,
                reactions: reactionRows,
                replies: replyRows,
                question: story.question ? {
                    prompt: story.question.prompt,
                    responseCount: questionResponseCount,
                    responses: story.question.responses || []
                } : undefined
            };
        })
        // Surface stories with real other-person activity (or views).
        .filter(
            (item) =>
                item.views > 0 ||
                item.likes > 0 ||
                item.reactions.length > 0 ||
                item.replies.length > 0 ||
                (item.question?.responseCount || 0) > 0,
        )
        // Newest stories first
        .sort((a, b) => b.createdAt - a.createdAt);
}

// Check if a user has stories by userId
export async function userHasStories(userId: string): Promise<boolean> {
    await delay();

    const now = Date.now();
    const activeStories = stories.filter(s => s.userId === userId && s.expiresAt > now);
    return activeStories.length > 0;
}

// Check if a user has stories by userHandle
export async function userHasStoriesByHandle(userHandle: string): Promise<boolean> {
    const target = (userHandle || '').trim();
    if (!target) return false;

    if (!isMockMode()) {
        try {
            const group = await fetchStoryGroupByHandle(target);
            if (group && group.stories.length > 0) return true;
        } catch (error) {
            console.warn('userHasStoriesByHandle API failed, falling back to mock:', error);
        }
    }

    await delay();

    const now = Date.now();
    const needle = target.toLowerCase();
    const activeStories = stories.filter(s => (s.userHandle || '').trim().toLowerCase() === needle && s.expiresAt > now);
    return activeStories.length > 0;
}

// Check if a user has unviewed stories by userHandle
export async function userHasUnviewedStoriesByHandle(userHandle: string, viewerUserId?: string): Promise<boolean> {
    const target = (userHandle || '').trim();
    if (!target) return false;

    if (!isMockMode()) {
        try {
            const group = await fetchStoryGroupByHandle(target, viewerUserId);
            if (!group) return false;
            return group.stories.some((s) => !s.hasViewed);
        } catch (error) {
            console.warn('userHasUnviewedStoriesByHandle API failed, falling back to mock:', error);
        }
    }

    await delay();

    const now = Date.now();
    const needle = target.toLowerCase();
    const unviewedStories = stories.filter(s =>
        (s.userHandle || '').trim().toLowerCase() === needle &&
        s.expiresAt > now &&
        !s.hasViewed
    );
    return unviewedStories.length > 0;
}

// Get stories for followed users only
export async function fetchFollowedUsersStoryGroups(userId: string, followedUserHandles: string[]): Promise<StoryGroup[]> {
    const followedSet = new Set(
        (followedUserHandles || [])
            .map((h) => (h || '').trim().toLowerCase().replace(/^@/, ''))
            .filter(Boolean),
    );

    if (!isMockMode()) {
        try {
            const groups = await fetchStoryGroups(userId);
            const viewerId = String(userId || '');
            const filtered = groups.filter((group) => {
                const handle = (group.userHandle || '').trim().toLowerCase().replace(/^@/, '');
                return String(group.userId) === viewerId || followedSet.has(handle);
            });

            // Merge in local stories so a just-created row still shows if the GET races the POST.
            const now = Date.now();
            const localActive = stories.filter((s) => {
                if (s.expiresAt <= now) return false;
                const audience = s.audience || 'public';
                if (String(s.userId) === viewerId) return true;
                if (!followedSet.has((s.userHandle || '').trim().toLowerCase())) return false;
                if (audience === 'only_me') return false;
                return true;
            });
            const byUser = new Map<string, StoryGroup>();
            for (const group of filtered) {
                byUser.set(String(group.userId), {
                    ...group,
                    stories: [...group.stories],
                });
            }
            const seenIds = new Set(filtered.flatMap((g) => g.stories.map((s) => String(s.id))));
            for (const local of localActive) {
                const key = String(local.id);
                if (seenIds.has(key)) continue;
                seenIds.add(key);
                const existing = byUser.get(String(local.userId));
                if (existing) {
                    existing.stories.push(local);
                } else {
                    byUser.set(String(local.userId), {
                        userId: local.userId,
                        userHandle: local.userHandle,
                        name: local.userHandle.split('@')[0],
                        avatarUrl: getAvatarForHandle(local.userHandle),
                        stories: [local],
                    });
                }
            }

            lastStoriesLoadSource = 'api-paged';
            return sortGroupStoriesNewestFirst(Array.from(byUser.values()));
        } catch (error) {
            console.warn('Failed to fetch followed users stories from API, falling back to mock:', error);
        }
    }

    lastStoriesLoadSource = 'mock';
    await delay();

    // Filter out expired stories
    const now = Date.now();
    const activeStories = stories.filter(s => {
        if (s.expiresAt <= now) return false;
        const audience = s.audience || 'public';
        if (s.userId === userId) return true;
        if (!followedSet.has((s.userHandle || '').trim().toLowerCase())) return false;
        if (audience === 'only_me') return false;
        return true; // public + close_friends for followed users
    });

    // Group stories by user (already filtered to self + followed)
    const groups = activeStories.reduce((acc, story) => {
        const existingGroup = acc.find(g => g.userId === story.userId);

        if (existingGroup) {
            existingGroup.stories.push(story);
        } else {
            acc.push({
                userId: story.userId,
                userHandle: story.userHandle,
                name: story.userHandle.split('@')[0],
                avatarUrl: getAvatarForHandle(story.userHandle),
                stories: [story]
            });
        }

        return acc;
    }, [] as StoryGroup[]);

    return sortGroupStoriesNewestFirst(groups);
}

// Utility: check if a story media is still active (not expired)
export async function isStoryMediaActive(mediaUrl: string): Promise<boolean> {
    const now = Date.now();
    return stories.some(s => s.mediaUrl === mediaUrl && s.expiresAt > now);
}

// Utility: check if a media URL was ever a story (regardless of expiration)
export function wasEverAStory(mediaUrl: string): boolean {
    return stories.some(s => s.mediaUrl === mediaUrl);
}

// Seed mock 24hr stories for a user (for testing)
export async function seedMockStoriesForUser(userHandle: string, userId: string = `user-${userHandle}`): Promise<void> {
    const now = Date.now();
    const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours from now
    
    const mockStories: Story[] = [
        {
            id: `story-${userHandle}-1-${Date.now()}`,
            userId: userId,
            userHandle: userHandle,
            text: 'Just posted a new story! 📸',
            textStyle: {
                color: '#ffffff',
                size: 'medium',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            },
            createdAt: now - 10000,
            expiresAt: expiresAt - 10000,
            views: 0,
            hasViewed: false,
            reactions: [],
            replies: [],
            userReaction: undefined
        },
        {
            id: `story-${userHandle}-2-${Date.now()}`,
            userId: userId,
            userHandle: userHandle,
            mediaUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
            mediaType: 'image',
            createdAt: now - 5000,
            expiresAt: expiresAt - 5000,
            views: 0,
            hasViewed: false,
            reactions: [],
            replies: [],
            userReaction: undefined,
            stickers: [
                {
                    id: `text-sticker-${userHandle}-1`,
                    stickerId: `text-sticker-${userHandle}-1`,
                    sticker: {
                        id: `text-sticker-${userHandle}-1`,
                        name: 'Check this out! 🎉',
                        category: 'Text',
                        emoji: undefined,
                        url: undefined,
                        isTrending: false
                    },
                    x: 50,
                    y: 75,
                    scale: 1.0,
                    rotation: 0,
                    opacity: 1,
                    textContent: 'Check this out! 🎉',
                    textColor: '#FFFFFF',
                    fontSize: 'medium'
                }
            ]
        },
        {
            id: `story-${userHandle}-3-${Date.now()}`,
            userId: userId,
            userHandle: userHandle,
            text: 'Another story update! ✨',
            textStyle: {
                color: '#ffffff',
                size: 'large',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
            },
            createdAt: now - 2000,
            expiresAt: expiresAt - 2000,
            views: 0,
            hasViewed: false,
            reactions: [],
            replies: [],
            userReaction: undefined
        }
    ];
    
    // Add stories to the array
    stories.push(...mockStories);
    
    // Dispatch event to update UI
    window.dispatchEvent(new CustomEvent('storiesUpdated'));
}
