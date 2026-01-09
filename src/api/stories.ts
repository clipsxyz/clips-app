import type { Story, StoryGroup, StickerOverlay } from '../types';

// Mock stories data
let stories: Story[] = [
    {
        id: 'story-1',
        userId: 'user-1',
        userHandle: 'John@Dublin',
        mediaUrl: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=800',
        mediaType: 'image',
        text: 'Amazing sunset in Dublin! 🌅',
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
        text: 'Beautiful day for a walk! 🚶',
        createdAt: Date.now() - 3000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 3000,
        location: 'Dublin',
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined
    },
    {
        id: 'story-3',
        userId: 'user-2',
        userHandle: 'Sarah@London',
        mediaUrl: 'https://images.unsplash.com/photo-1517474307977-7c27ca92444a?w=800',
        mediaType: 'image',
        text: 'Love the architecture here! 🏛️',
        createdAt: Date.now() - 10000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 10000,
        location: 'London',
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined
    },
    {
        id: 'story-4',
        userId: 'user-3',
        userHandle: 'Mike@Paris',
        mediaUrl: 'https://images.unsplash.com/photo-1502602898536-47ad22581b52?w=800',
        mediaType: 'image',
        text: 'Beautiful morning in Paris! ☕',
        createdAt: Date.now() - 8000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 8000,
        location: 'Paris',
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined
    },
    {
        id: 'story-5',
        userId: 'user-4',
        userHandle: 'Emma@NewYork',
        mediaUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800',
        mediaType: 'image',
        text: 'City never sleeps! 🌆',
        createdAt: Date.now() - 6000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 6000,
        location: 'New York',
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined
    },
    // Stories for feed users
    {
        id: 'story-6',
        userId: 'user-5',
        userHandle: 'Username@Dublin',
        mediaUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800',
        mediaType: 'image',
        text: 'Beautiful day in Dublin! ☀️',
        createdAt: Date.now() - 4000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 4000,
        location: 'Dublin',
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined
    },
    {
        id: 'story-7',
        userId: 'user-6',
        userHandle: 'Alice@Finglas',
        mediaUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800',
        mediaType: 'image',
        text: 'Great spot for coffee! ☕',
        createdAt: Date.now() - 2000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 2000,
        location: 'Finglas',
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined
    },
    {
        id: 'story-8',
        userId: 'user-7',
        userHandle: 'Sarah@NewYork',
        mediaUrl: 'https://images.unsplash.com/photo-1494522358652-f30e61a0b1b0?w=800',
        mediaType: 'image',
        text: 'Park life! 🌳',
        createdAt: Date.now() - 1000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 1000,
        location: 'New York',
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined
    },
    {
        id: 'story-9',
        userId: 'user-8',
        userHandle: 'Mike@London',
        mediaUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800',
        mediaType: 'image',
        text: 'Thames vibes! 🌊',
        createdAt: Date.now() - 3000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 3000,
        location: 'London',
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined
    },
    // Stories for Sarah@Artane
    {
        id: 'story-sarah-1',
        userId: 'sarah-artane-1',
        userHandle: 'Sarah@Artane',
        mediaUrl: 'https://images.unsplash.com/photo-1543007631-283050bb3e8c?w=800',
        mediaType: 'image',
        text: 'Beautiful morning in Artane! ☀️',
        createdAt: Date.now() - 5000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 5000,
        location: 'Artane, Dublin',
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined
    },
    {
        id: 'story-sarah-2',
        userId: 'sarah-artane-1',
        userHandle: 'Sarah@Artane',
        mediaUrl: 'https://videos.pexels.com/video-files/5439112/5439112-uhd_3840_2160_30fps.mp4',
        mediaType: 'video',
        text: 'Exploring the beautiful coast! 🌊',
        createdAt: Date.now() - 7000,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) - 7000,
        location: 'Howth, Dublin',
        views: 0,
        hasViewed: false,
        reactions: [],
        replies: [],
        userReaction: undefined
    }
];

function delay(ms = 300): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Get all story groups (grouped by user)
export async function fetchStoryGroups(userId: string): Promise<StoryGroup[]> {
    await delay();

    // Filter out expired stories
    const now = Date.now();
    const activeStories = stories.filter(s => s.expiresAt > now);

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
                avatarUrl: story.userId === userId ? undefined : undefined, // Will be set from user context
                stories: [story]
            });
        }

        return acc;
    }, [] as StoryGroup[]);

    return groups;
}

// Get stories for a specific user
export async function fetchUserStories(userId: string, targetUserId: string): Promise<Story[]> {
    await delay();

    const now = Date.now();
    return stories.filter(s =>
        s.userId === targetUserId && s.expiresAt > now
    ).sort((a, b) => a.createdAt - b.createdAt);
}

// Get story group for a specific user by handle
export async function fetchStoryGroupByHandle(userHandle: string): Promise<StoryGroup | null> {
    await delay();

    const now = Date.now();
    const activeStories = stories.filter(s => s.userHandle === userHandle && s.expiresAt > now);

    if (activeStories.length === 0) return null;

    return {
        userId: activeStories[0].userId,
        userHandle: activeStories[0].userHandle,
        name: activeStories[0].userHandle.split('@')[0],
        avatarUrl: undefined,
        stories: activeStories.sort((a, b) => a.createdAt - b.createdAt)
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
    textStyle?: { color?: string; size?: 'small' | 'medium' | 'large'; background?: string }, // Text style for text-only stories
    stickers?: StickerOverlay[], // Stickers/GIFs for stories
    taggedUsers?: string[], // Tagged users (handles only)
    poll?: { question: string; option1: string; option2: string }, // Poll data
    taggedUsersPositions?: Array<{ handle: string; x: number; y: number }> // Tagged users with positions
): Promise<Story> {
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
                textStyle: textStyle || undefined, // Only color, size, background - no taggedUsersPositions
                stickers: stickers || undefined,
                taggedUsers: taggedUsers || undefined, // Send tagged users to backend
                taggedUsersPositions: taggedUsersPositions || undefined, // Send tagged users with positions
                poll: poll || undefined
            }),
        });

        // Transform Laravel response to frontend Story format
        const now = Date.now();
        const newStory: Story = {
            id: response.id,
            userId: response.user_id || userId,
            userHandle: response.user_handle || userHandle,
            mediaUrl: response.media_url || undefined,
            mediaType: response.media_type || undefined,
            text: response.text || undefined,
            textColor: response.text_color || undefined,
            textSize: response.text_size || undefined,
            textStyle: response.text_style || textStyle || undefined,
            stickers: response.stickers || stickers || undefined,
            taggedUsers: response.tagged_users || taggedUsers || undefined, // Get tagged users from backend
            taggedUsersPositions: response.tagged_users_positions || taggedUsersPositions || undefined, // Get tagged users with positions
            createdAt: new Date(response.created_at).getTime() || now,
            expiresAt: new Date(response.expires_at).getTime() || (now + 24 * 60 * 60 * 1000),
            location: response.location || undefined,
            views: response.views_count || 0,
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
                votes1: 0,
                votes2: 0,
                userVote: undefined
            } : undefined)
        };

        // Also add to local stories array for immediate UI update
        stories.push(newStory);

        return newStory;
    } catch (error) {
        console.error('Error creating story via API, falling back to mock:', error);
        // Fallback to mock implementation if API fails
        await delay();

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
            views: 0,
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
                votes1: 0,
                votes2: 0,
                userVote: undefined
            } : undefined
        };

        stories.push(newStory);

        return newStory;
    }
}

// Mark story as viewed
export async function markStoryViewed(storyId: string, userId: string): Promise<void> {
    await delay();

    const story = stories.find(s => s.id === storyId);
    if (story && !story.hasViewed) {
        story.hasViewed = true;
        story.views += 1;
    }
}

// Increment story view count
export async function incrementStoryViews(storyId: string): Promise<void> {
    await delay();

    const story = stories.find(s => s.id === storyId);
    if (story) {
        story.views += 1;
    }
}

// Add reaction to story
export async function addStoryReaction(storyId: string, userId: string, userHandle: string, emoji: string): Promise<void> {
    await delay();

    const story = stories.find(s => s.id === storyId);
    if (story) {
        // Remove existing reaction from this user
        story.reactions = story.reactions.filter(r => r.userId !== userId);

        // Add new reaction
        story.reactions.push({
            id: `reaction-${Date.now()}`,
            userId,
            userHandle,
            emoji,
            createdAt: Date.now()
        });

        story.userReaction = emoji;
    }
}

// Add reply to story
export async function addStoryReply(storyId: string, userId: string, userHandle: string, text: string): Promise<void> {
    await delay();

    const story = stories.find(s => s.id === storyId);
    if (story) {
        story.replies.push({
            id: `reply-${Date.now()}`,
            userId,
            userHandle,
            text,
            createdAt: Date.now()
        });
    }
}

// Vote on a poll in a story
export async function voteOnPoll(storyId: string, userId: string, option: 'option1' | 'option2'): Promise<void> {
    await delay();

    const story = stories.find(s => s.id === storyId);
    if (story && story.poll) {
        // If user already voted, remove their previous vote
        if (story.poll.userVote === 'option1') {
            story.poll.votes1 = (story.poll.votes1 || 0) - 1;
        } else if (story.poll.userVote === 'option2') {
            story.poll.votes2 = (story.poll.votes2 || 0) - 1;
        }

        // Add new vote
        if (option === 'option1') {
            story.poll.votes1 = (story.poll.votes1 || 0) + 1;
        } else {
            story.poll.votes2 = (story.poll.votes2 || 0) + 1;
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
    likes: number;
    likers: string[]; // user handles who reacted with a heart
}

export async function getStoryInsightsForUser(userHandle: string): Promise<StoryInsight[]> {
    await delay();

    const now = Date.now();
    const ownStories = stories.filter(s => s.userHandle === userHandle && s.expiresAt > now);

    return ownStories
        .map<StoryInsight>(story => {
            const heartReactions = (story.reactions || []).filter(r => r.emoji === '❤️');
            const likers = Array.from(new Set(heartReactions.map(r => r.userHandle)));
            return {
                storyId: story.id,
                mediaUrl: story.mediaUrl,
                mediaType: story.mediaType,
                text: story.text,
                createdAt: story.createdAt,
                likes: likers.length,
                likers
            };
        })
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
    await delay();

    const now = Date.now();
    const activeStories = stories.filter(s => s.userHandle === userHandle && s.expiresAt > now);
    return activeStories.length > 0;
}

// Check if a user has unviewed stories by userHandle
export async function userHasUnviewedStoriesByHandle(userHandle: string): Promise<boolean> {
    await delay();

    const now = Date.now();
    const unviewedStories = stories.filter(s =>
        s.userHandle === userHandle &&
        s.expiresAt > now &&
        !s.hasViewed
    );
    return unviewedStories.length > 0;
}

// Get stories for followed users only
export async function fetchFollowedUsersStoryGroups(userId: string, followedUserHandles: string[]): Promise<StoryGroup[]> {
    await delay();

    // Filter out expired stories
    const now = Date.now();
    const activeStories = stories.filter(s => s.expiresAt > now);

    // Group stories by user and filter by followed users
    const groups = activeStories.reduce((acc, story) => {
        // Only include stories from followed users or current user
        if (story.userId === userId || followedUserHandles.includes(story.userHandle)) {
            const existingGroup = acc.find(g => g.userId === story.userId);

            if (existingGroup) {
                existingGroup.stories.push(story);
            } else {
                acc.push({
                    userId: story.userId,
                    userHandle: story.userHandle,
                    name: story.userHandle.split('@')[0],
                    avatarUrl: undefined,
                    stories: [story]
                });
            }
        }

        return acc;
    }, [] as StoryGroup[]);

    return groups;
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
