import type { Story, StoryGroup, StickerOverlay, StoryViewerIdentity } from '../types';
import { isLaravelApiEnabled } from '../config/runtimeEnv';
import { getAvatarForHandle } from './users';
import {
    isVideoUrl,
    pickStoryMediaUri,
    pickStoryPosterUri,
    resolveStoryMediaUrl,
} from '../utils/storyMediaNative';
import {
    markStoryAsViewed as rememberStoryViewedLocal,
    storyHasViewed,
} from '../utils/storyViewedStore';

let lastStoriesLoadSource: 'api-paged' | 'api-user' | 'mock' = 'mock';
export function getLastStoriesLoadSource(): 'api-paged' | 'api-user' | 'mock' {
    return lastStoriesLoadSource;
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
    // Stories for Sarah@Artane
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

/**
 * `avatarUrl` is not on the shared `Story` type, so it is carried as an intersection
 * here rather than editing types.ts. Story is structurally a subset, so this stays
 * assignable everywhere a Story is expected.
 */
type StoryWithAvatar = Story & { avatarUrl?: string };

/**
 * Reads the mapped avatar off a Story without scattering casts. Arrays typed as
 * `Story[]` erase the intersection, so the four group builders below would otherwise
 * fail to see `avatarUrl`.
 */
function storyAvatarUrl(story: Story): string | undefined {
    return (story as StoryWithAvatar).avatarUrl;
}

export function mapLaravelStoryToStory(story: any): StoryWithAvatar {
    const mediaUrl = pickStoryMediaUri(story);
    const rawType = story.media_type || story.mediaType;
    const mediaType: Story['mediaType'] =
        rawType === 'video' || rawType === 'image'
            ? rawType
            : isVideoUrl(mediaUrl)
              ? 'video'
              : mediaUrl
                ? 'image'
                : undefined;
    const userHandle = String(
        story.user_handle || story.userHandle || story.user?.handle || '',
    ).trim();
    const viewers = mapLaravelStoryViewers(story);
    const uniqueViewersRaw = Number(story.unique_viewers ?? story.uniqueViewers);
    return {
        id: story.id,
        userId: story.user_id || story.userId || story.user?.id,
        userHandle,
        mediaUrl: mediaUrl || undefined,
        mediaType,
        text: story.text || undefined,
        textColor: story.text_color || undefined,
        textSize: story.text_size || undefined,
        location: story.location || undefined,
        venue: story.venue || undefined,
        createdAt: story.created_at ? new Date(story.created_at).getTime() : Date.now(),
        expiresAt: story.expires_at ? new Date(story.expires_at).getTime() : Date.now(),
        views: Number(story.views_count ?? story.views ?? 0) || 0,
        uniqueViewers: Number.isFinite(uniqueViewersRaw) && uniqueViewersRaw > 0 ? uniqueViewersRaw : viewers.length || undefined,
        viewers,
        viewerHandles: viewers.map((viewer) => viewer.handle),
        hasViewed: storyHasViewed({ id: story.id, hasViewed: !!story.has_viewed, has_viewed: !!story.has_viewed }),
        reactions: [],
        replies: [],
        userReaction: story.user_reaction || undefined,
        textStyle: story.text_style || undefined,
        stickers: normalizeStoryStickers(story.stickers),
        taggedUsers: story.tagged_users || undefined,
        videoPosterUrl: pickStoryPosterUri(story) || undefined,
        audience: story.audience || 'public',
        sharedFromPost: story.shared_from_post_id || undefined,
        sharedFromUser: story.shared_from_user_handle || undefined,
        // Real poster avatar from Laravel user relation. Never fall back to the mock
        // Unsplash seed map while live API is on — that injects wrong faces for real users.
        avatarUrl:
            story.avatar_url ||
            story.avatarUrl ||
            story.user?.avatar_url ||
            story.user?.avatarUrl ||
            (!isLaravelApiEnabled() ? getAvatarForHandle(story.user_handle || story.userHandle) : undefined) ||
            undefined,
    };
}

function parseViewedAt(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const ms = Date.parse(value);
        return Number.isFinite(ms) ? ms : undefined;
    }
    return undefined;
}

export function mapLaravelStoryViewers(story: any): StoryViewerIdentity[] {
    const rawViewers = Array.isArray(story?.viewers) ? story.viewers : [];
    const fromViewers = rawViewers
        .map((row: any): StoryViewerIdentity | null => {
            const handle = String(row?.handle || row?.username || '').trim();
            if (!handle) return null;
            return {
                userId: row?.user_id || row?.userId || row?.user?.id || undefined,
                handle,
                username: row?.username || row?.user?.username || undefined,
                name: row?.name || row?.display_name || row?.user?.display_name || undefined,
                avatarUrl: row?.avatar_url || row?.avatarUrl || row?.user?.avatar_url || undefined,
                viewedAt: parseViewedAt(row?.viewed_at || row?.viewedAt || row?.created_at),
            };
        })
        .filter((row: StoryViewerIdentity | null): row is StoryViewerIdentity => !!row);
    if (fromViewers.length > 0) return fromViewers;

    const handles = Array.isArray(story?.viewer_handles)
        ? story.viewer_handles
        : Array.isArray(story?.viewerHandles)
          ? story.viewerHandles
          : [];
    return handles
        .map((handle: unknown) => String(handle || '').trim())
        .filter(Boolean)
        .map((handle: string) => ({ handle }));
}

export function storyViewerIdentities(story?: Partial<Story> | null): StoryViewerIdentity[] {
    if (!story) return [];
    if (Array.isArray(story.viewers) && story.viewers.length > 0) {
        return story.viewers.filter((row) => !!row?.handle);
    }
    return (story.viewerHandles || [])
        .map((handle) => String(handle || '').trim())
        .filter(Boolean)
        .map((handle) => ({ handle }));
}

function sortGroupStoriesNewestFirst(groups: StoryGroup[]): StoryGroup[] {
    return groups.map((g) => ({ ...g, stories: sortStoriesNewestFirst(g.stories) }));
}

// Get all story groups (grouped by user)
export async function fetchStoryGroups(userId: string): Promise<StoryGroup[]> {
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
                avatarUrl: storyAvatarUrl(story) || getAvatarForHandle(story.userHandle),
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
export async function fetchStoriesPage(
    cursor: string | null,
    limit = 20,
    userId?: string,
    filter?: string,
): Promise<StoriesPage> {
    const { fetchStoriesPage: fetchStoriesPageApi } = await import('./client');
    const response = await fetchStoriesPageApi(cursor, limit, userId, filter);
    const rawItems = Array.isArray(response?.items) ? response.items : [];
    const items: Story[] = rawItems.map((story: any) => mapLaravelStoryToStory(story));

    return {
        items,
        nextCursor: typeof response?.nextCursor === 'string' ? response.nextCursor : null,
        hasMore: !!response?.hasMore,
    };
}

// Get stories for a specific user
export async function fetchUserStories(
    viewerUserId: string,
    targetUserId: string,
    followedUserHandles: string[] = [],
    targetHandle?: string,
): Promise<Story[]> {
    if (isLaravelApiEnabled()) {
        try {
            const handle = (targetHandle || '').trim();
            if (handle) {
                const byHandle = await fetchStoryGroupByHandle(handle);
                if (byHandle?.stories?.length) {
                    lastStoriesLoadSource = 'api-user';
                    return sortStoriesNewestFirst(byHandle.stories);
                }
            }
            const allGroups = await fetchFollowedUsersStoryGroups(viewerUserId, followedUserHandles);
            const targetGroup = allGroups.find((group) => group.userId === targetUserId);
            lastStoriesLoadSource = 'api-user';
            return targetGroup ? sortStoriesNewestFirst(targetGroup.stories) : [];
        } catch (error) {
            console.warn('Failed to fetch user stories from API:', error);
            lastStoriesLoadSource = 'api-user';
            return [];
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
export async function fetchStoryGroupByHandle(userHandle: string): Promise<StoryGroup | null> {
    if (isLaravelApiEnabled()) {
        try {
            const { apiRequest } = await import('./client');
            const encoded = encodeURIComponent(userHandle);
            const response = await apiRequest(`/stories/user/${encoded}`);
            const rawStories = Array.isArray(response) ? response : [];
            if (rawStories.length === 0) return null;
            const stories = rawStories.map((story: any) => mapLaravelStoryToStory(story));
            lastStoriesLoadSource = 'api-user';
            const handle = (stories[0].userHandle || userHandle || '').trim();
            return {
                userId: stories[0].userId,
                userHandle: handle,
                name: handle.split('@')[0] || 'User',
                avatarUrl: storyAvatarUrl(stories[0]) || getAvatarForHandle(handle),
                stories: sortStoriesNewestFirst(stories),
            };
        } catch (error) {
            console.warn('Failed to fetch story group by handle from API:', error);
            lastStoriesLoadSource = 'api-user';
            return null;
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
        avatarUrl: storyAvatarUrl(activeStories[0]) || getAvatarForHandle(activeStories[0].userHandle),
        stories: activeStories.sort((a, b) => b.createdAt - a.createdAt),
    };
}

/** Guest-safe single story from a WhatsApp/web share link. */
export async function fetchPublicStory(userHandle: string, storyId: string): Promise<Story | null> {
    const handle = (userHandle || '').trim();
    const id = (storyId || '').trim();
    if (!handle || !id) return null;

    if (isLaravelApiEnabled()) {
        try {
            const { apiRequest } = await import('./client');
            const params = new URLSearchParams({ user: handle, story: id });
            const response = await apiRequest(`/public/stories?${params.toString()}`);
            if (!response || typeof response !== 'object') return null;
            return mapLaravelStoryToStory(response);
        } catch (error) {
            console.warn('Failed to fetch public story from API:', error);
            return null;
        }
    }

    lastStoriesLoadSource = 'mock';
    await delay();
    const now = Date.now();
    const handleKey = handle.replace(/^@/, '').toLowerCase();
    const idKey = id.toLowerCase();
    const match = stories.find((s) => {
        if ((s.id || '').toLowerCase() !== idKey) return false;
        if ((s.userHandle || '').replace(/^@/, '').toLowerCase() !== handleKey) return false;
        if (s.expiresAt <= now) return false;
        const audience = s.audience || 'public';
        return audience === 'public';
    });
    return match || null;
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
    taggedUsersPositions?: Array<{ handle: string; x: number; y: number }>, // Tagged users with positions
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
        };

        stories.push(newStory);
        return newStory;
    };

    // In mock mode, skip API call completely to avoid noisy fallback errors.
    if (!isLaravelApiEnabled()) {
        return buildMockStory();
    }

    // Use real Laravel API
    const { apiRequest } = await import('./client');

    try {
        const response = await apiRequest('/stories', {
            method: 'POST',
            body: JSON.stringify({
                media_url: mediaUrl || undefined,
                media_type: mediaType || undefined,
                text: text || undefined,
                location: location || undefined,
                text_color: textColor || undefined,
                text_size: textSize || undefined,
                shared_from_post_id: sharedFromPost || undefined,
                shared_from_user_handle: sharedFromUser || undefined,
                textStyle: textStyle || undefined, // Only color, size, background - no taggedUsersPositions
                stickers: stickers || undefined,
                taggedUsers: taggedUsers || undefined, // Send tagged users to backend
                taggedUsersPositions: taggedUsersPositions || undefined, // Send tagged users with positions
                venue: venue || undefined,
                video_poster_url: videoPosterUrl || undefined,
                audience: audience || 'public',
            }),
        });

        // Transform Laravel response to frontend Story format
        const now = Date.now();
        const newStory: Story = {
            id: response.id,
            userId: response.user_id || userId,
            userHandle: response.user_handle || userHandle,
            mediaUrl: pickStoryMediaUri(response) || resolveStoryMediaUrl(response.media_url || mediaUrl) || undefined,
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
                pickStoryPosterUri(response) ||
                pickStoryPosterUri({ videoPosterUrl, video_poster_url: videoPosterUrl }) ||
                undefined,
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
        };

          // Also add to local stories array for immediate UI update
          stories.push(newStory);

          // A brand-new story must show up in feed headers immediately.
          clearActiveStoryProbes();
          return newStory;
      } catch (error: any) {
        console.warn('createStory API failed:', error);
        throw error;
    }
}

/** Instant local seen (rail rings) without waiting for the view POST. */
export function markStoryAsViewedLocal(storyId: string, handle?: string | null): void {
    const story = stories.find((s) => s.id === storyId);
    if (story) {
        story.hasViewed = true;
    }
    rememberStoryViewedLocal(storyId, handle || story?.userHandle);
    clearActiveStoryProbes();
}

// Mark story as viewed
export async function markStoryViewed(
    storyId: string,
    _userId: string,
    viewerHandle?: string,
    authorHandle?: string | null,
): Promise<void> {
    const story = stories.find((s) => s.id === storyId);
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
    markStoryAsViewedLocal(storyId, authorHandle || story?.userHandle);

    if (isLaravelApiEnabled()) {
        try {
            const { apiRequest } = await import('./client');
            await apiRequest(`/stories/${encodeURIComponent(storyId)}/view`, { method: 'POST' });
        } catch (error) {
            console.warn('markStoryViewed API failed:', error);
        }
        return;
    }

    await delay();
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

    if (isLaravelApiEnabled()) {
        try {
            const { apiRequest } = await import('./client');
            await apiRequest(`/stories/${storyId}/reaction`, {
                method: 'POST',
                body: JSON.stringify({ emoji }),
            });
            pushMockReaction();
            return;
        } catch (error: any) {
            throw error;
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

    if (isLaravelApiEnabled()) {
        try {
            const { apiRequest } = await import('./client');
            await apiRequest(`/stories/${storyId}/reply`, {
                method: 'POST',
                body: JSON.stringify({ text }),
            });
            pushMockReply();
            return;
        } catch (error: any) {
            throw error;
        }
    }

    await delay();
    pushMockReply();
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
}

export async function fetchStoryInsights(storyId: string): Promise<{
    storyId: string;
    views: number;
    uniqueViewers: number;
    viewers: StoryViewerIdentity[];
}> {
    const empty = {
        storyId,
        views: 0,
        uniqueViewers: 0,
        viewers: [] as StoryViewerIdentity[],
    };
    if (!storyId || !isLaravelApiEnabled()) return empty;
    try {
        const { apiRequest } = await import('./client');
        const response = await apiRequest(`/stories/${encodeURIComponent(storyId)}/insights`);
        const viewers = mapLaravelStoryViewers(response);
        return {
            storyId: String(response?.story_id || storyId),
            views: Number(response?.views_count ?? response?.views ?? 0) || 0,
            uniqueViewers: Number(response?.unique_viewers ?? viewers.length) || viewers.length,
            viewers,
        };
    } catch (error) {
        console.warn('fetchStoryInsights failed:', error);
        return empty;
    }
}

export async function getStoryInsightsForUser(userHandle: string): Promise<StoryInsight[]> {
    const now = Date.now();
    const normalizedHandle = (userHandle || '').trim().toLowerCase();

    if (isLaravelApiEnabled()) {
        try {
            const { apiRequest } = await import('./client');
            const response = await apiRequest('/stories/insights');
            const rows = Array.isArray(response?.insights)
                ? response.insights
                : Array.isArray(response)
                  ? response
                  : [];
            return rows.map((row: any) => {
                const viewers = mapLaravelStoryViewers(row)
                    .map((viewer) => viewer.handle)
                    .filter((handle) => handle.trim().toLowerCase() !== normalizedHandle);
                const reactionRows: Array<{ userHandle: string; emoji: string; createdAt: number }> = Array.isArray(
                    row?.reactions,
                )
                    ? row.reactions
                          .filter((r: any) => (r?.userHandle || '').trim().toLowerCase() !== normalizedHandle)
                          .map((r: any) => ({
                              userHandle: String(r.userHandle || ''),
                              emoji: String(r.emoji || ''),
                              createdAt: Number(r.createdAt || now),
                          }))
                    : [];
                const likeReactions = reactionRows.filter(
                    (r) => r.emoji === '❤️' || r.emoji === '♥️' || r.emoji === '❤' || r.emoji === '👍',
                );
                const likers = Array.from(new Set(likeReactions.map((r) => r.userHandle)));
                const replyRows: Array<{ userHandle: string; text: string; createdAt: number }> = Array.isArray(
                    row?.replies,
                )
                    ? row.replies
                          .filter((r: any) => (r?.userHandle || '').trim().toLowerCase() !== normalizedHandle)
                          .map((r: any) => ({
                              userHandle: String(r.userHandle || ''),
                              text: String(r.text || ''),
                              createdAt: Number(r.createdAt || now),
                          }))
                    : [];
                return {
                    storyId: String(row.story_id || row.storyId || ''),
                    mediaUrl: row.media_url || row.mediaUrl || undefined,
                    mediaType: row.media_type || row.mediaType || undefined,
                    text: row.text || undefined,
                    createdAt: row.created_at ? new Date(row.created_at).getTime() : now,
                    views: Math.max(Number(row.views || row.views_count || 0), viewers.length),
                    viewers,
                    likes: likers.length,
                    likers,
                    reactions: reactionRows,
                    replies: replyRows,
                } satisfies StoryInsight;
            });
        } catch (error) {
            console.warn('getStoryInsightsForUser API failed:', error);
        }
    }

    await delay();

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
            };
        })
        // Surface stories with real other-person activity (or views).
        .filter(
            (item) =>
                item.views > 0 ||
                item.likes > 0 ||
                item.reactions.length > 0 ||
                item.replies.length > 0,
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

/**
 * Active-story probe backing the feed avatar ring and the "View stories" quick action.
 *
 * Every visible feed card runs these checks on mount, so the live branch answers both
 * questions from ONE cached `GET /stories/user/{handle}` response instead of two
 * uncached round-trips per card while scrolling. The endpoint only returns `active()`
 * stories, which is exactly the 24-hour window the menu is supposed to honour.
 */
type ActiveStoryProbe = { any: boolean; unviewed: boolean };

/** Long enough to absorb scroll churn, short enough that a viewed ring still clears. */
const STORY_PROBE_TTL_MS = 30_000;
/** While the endpoint is unreachable, don't hammer it — short enough not to mask a recovery. */
const STORY_PROBE_FAILURE_TTL_MS = 5_000;
/** Throttle repeated offline logs so a down backend can't flood the console every render. */
const STORY_PROBE_WARN_EVERY_MS = 30_000;
const storyProbes = new Map<string, { at: number; value: ActiveStoryProbe }>();
const storyProbeFailures = new Map<string, number>();
const storyProbeInflight = new Map<string, Promise<ActiveStoryProbe>>();
let lastStoryProbeWarnAt = 0;

/** Invalidate after viewing/creating so the ring and menu react immediately. */
export function clearActiveStoryProbes(): void {
    storyProbes.clear();
    storyProbeFailures.clear();
    storyProbeInflight.clear();
}

async function probeActiveStories(userHandle: string, userId?: string): Promise<ActiveStoryProbe> {
    const handle = (userHandle || '').trim();
    if (!handle) return { any: false, unviewed: false };

    const key = `${handle.toLowerCase()}|${userId || ''}`;
    const cached = storyProbes.get(key);
    if (cached && Date.now() - cached.at < STORY_PROBE_TTL_MS) return cached.value;

    // Negative cache: the last attempt just failed (e.g. backend down). Answer from the
    // cached failure for a few seconds instead of starting another request per card mount.
    const failedAt = storyProbeFailures.get(key);
    if (failedAt != null && Date.now() - failedAt < STORY_PROBE_FAILURE_TTL_MS) {
        return { any: false, unviewed: false };
    }

    // Single-flight: a whole feed of mounted cards asks the same question at once. Share
    // one in-flight request per key instead of firing N identical GETs per mount.
    const inflight = storyProbeInflight.get(key);
    if (inflight) return inflight;

    const request = (async (): Promise<ActiveStoryProbe> => {
        try {
            const { apiRequest } = await import('./client');
            const query = userId ? `?userId=${encodeURIComponent(String(userId))}` : '';
            const response = await apiRequest(`/stories/user/${encodeURIComponent(handle)}${query}`);
            const list: any[] = Array.isArray(response) ? response : [];
            const value: ActiveStoryProbe = {
                any: list.length > 0,
                // has_viewed is only reported when the viewer id is passed.
                unviewed: userId
                    ? list.some((s: any) => !storyHasViewed({ id: s?.id, has_viewed: !!s?.has_viewed }))
                    : list.length > 0,
            };
            storyProbes.set(key, { at: Date.now(), value });
            storyProbeFailures.delete(key);
            return value;
        } catch (error) {
            // Never cache a failure as a 30s "no stories" answer, but back off briefly so
            // a down endpoint can't amplify into a request storm from every card mount.
            storyProbeFailures.set(key, Date.now());
            const now = Date.now();
            if (now - lastStoryProbeWarnAt >= STORY_PROBE_WARN_EVERY_MS) {
                lastStoryProbeWarnAt = now;
                console.warn('Active story probe failed:', handle, error);
            }
            return { any: false, unviewed: false };
        } finally {
            storyProbeInflight.delete(key);
        }
    })();
    storyProbeInflight.set(key, request);
    return request;
}

// Check if a user has stories by userHandle
export async function userHasStoriesByHandle(userHandle: string, userId?: string): Promise<boolean> {
    if (isLaravelApiEnabled()) {
        return (await probeActiveStories(userHandle, userId)).any;
    }

    await delay();

    const now = Date.now();
    const target = (userHandle || '').trim().toLowerCase();
    const activeStories = stories.filter(s => (s.userHandle || '').trim().toLowerCase() === target && s.expiresAt > now);
    return activeStories.length > 0;
}

// Check if a user has unviewed stories by userHandle
export async function userHasUnviewedStoriesByHandle(userHandle: string, userId?: string): Promise<boolean> {
    if (isLaravelApiEnabled()) {
        return (await probeActiveStories(userHandle, userId)).unviewed;
    }

    await delay();

    const now = Date.now();
    const target = (userHandle || '').trim().toLowerCase();
    const unviewedStories = stories.filter(s =>
        (s.userHandle || '').trim().toLowerCase() === target &&
        s.expiresAt > now &&
        !s.hasViewed
    );
    return unviewedStories.length > 0;
}

// Get stories for followed users only
export async function fetchFollowedUsersStoryGroups(
    userId: string,
    followedUserHandles: string[],
): Promise<StoryGroup[]> {
    if (isLaravelApiEnabled()) {
        try {
            const collected: Story[] = [];
            let cursor: string | null = null;
            let pages = 0;
            const maxPages = 5;

            do {
                // Never pass the newsfeed location filter — Ireland/Discover must not
                // leak unfollowed authors into the Stories 24 rail.
                const page = await fetchStoriesPage(cursor, 50, userId);
                collected.push(...page.items);
                cursor = page.nextCursor;
                pages += 1;
                if (!page.hasMore) break;
            } while (cursor && pages < maxPages);

            // The API (/stories/paged) is scoped to the viewer plus accepted follows.
            // When the local follow cache has handles, drop anyone not in that set so a
            // stale location-scoped payload cannot leak into the rail. An empty cache is
            // trusted (follows made on another device). Direct profile/feed opens use
            // fetchUserStories / fetchStoryGroupByHandle, not this rail list.
            const followedSet = new Set(
                (followedUserHandles || [])
                    .map((h) => (h || '').trim().toLowerCase().replace(/^@/, ''))
                    .filter(Boolean),
            );
            const filtered = collected.filter((story) => {
                if (story.userId === userId) return true;
                if ((story.audience || 'public') === 'only_me') return false;
                if (followedSet.size === 0) return true;
                const handle = (story.userHandle || '').trim().toLowerCase().replace(/^@/, '');
                return followedSet.has(handle);
            });

            const byUser = new Map<string, StoryGroup>();
            for (const story of filtered) {
                const existing = byUser.get(story.userId);
                if (existing) {
                    existing.stories.push(story);
                } else {
                    const handle = (story.userHandle || '').trim() || story.userId || 'unknown';
                    byUser.set(story.userId, {
                        userId: story.userId,
                        userHandle: handle,
                        name: handle.split('@')[0] || 'User',
                        avatarUrl: storyAvatarUrl(story) || undefined,
                        stories: [story],
                    });
                }
            }

            lastStoriesLoadSource = 'api-paged';
            return sortGroupStoriesNewestFirst(Array.from(byUser.values()));
        } catch (error) {
            console.warn('Failed to fetch followed users stories from API:', error);
            lastStoriesLoadSource = 'api-paged';
            return [];
        }
    }

    lastStoriesLoadSource = 'mock';
    await delay();

    // Filter out expired stories
    const now = Date.now();
    const followedSet = new Set(
        (followedUserHandles || []).map((h) => (h || '').trim().toLowerCase()).filter(Boolean),
    );
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
                avatarUrl: storyAvatarUrl(story) || getAvatarForHandle(story.userHandle),
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
