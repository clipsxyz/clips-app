import type { Story, StoryGroup, StickerOverlay } from '../types';

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
export async function fetchUserStories(_viewerUserId: string, targetUserId: string): Promise<Story[]> {
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
    poll?: { question: string; option1: string; option2: string; option3?: string }, // Poll data
    taggedUsersPositions?: Array<{ handle: string; x: number; y: number }>, // Tagged users with positions
    question?: string, // Question prompt (e.g., "Ask me anything")
    venue?: string // Venue / place name (for metadata when story is shown on feed)
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
                poll: poll || undefined,
                question: question || undefined, // Question prompt
                venue: venue || undefined
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
                option3: poll.option3,
                votes1: 0,
                votes2: 0,
                votes3: poll.option3 ? 0 : undefined,
                userVote: undefined
            } : undefined),
            question: response.question || (question ? {
                prompt: question,
                responses: []
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

        return newStory;
    }
}

// Mark story as viewed
export async function markStoryViewed(storyId: string, _userId: string): Promise<void> {
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
    likes: number;
    likers: string[]; // user handles who reacted with a heart
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
                likers,
                question: story.question ? {
                    prompt: story.question.prompt,
                    responseCount: story.question.responses?.length || 0,
                    responses: story.question.responses || []
                } : undefined
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
