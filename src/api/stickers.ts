import { Sticker } from '../types';

// Mock stickers data
const stickers: Sticker[] = [
    // Emoji stickers
    { id: 'emoji-1', name: 'Fire', category: 'Emoji', emoji: '🔥', isTrending: true },
    { id: 'emoji-2', name: 'Heart Eyes', category: 'Emoji', emoji: '😍', isTrending: true },
    { id: 'emoji-3', name: 'Party', category: 'Emoji', emoji: '🎉', isTrending: false },
    { id: 'emoji-4', name: 'Star', category: 'Emoji', emoji: '⭐', isTrending: false },
    { id: 'emoji-5', name: 'Thumbs Up', category: 'Emoji', emoji: '👍', isTrending: false },
    { id: 'emoji-6', name: 'Clap', category: 'Emoji', emoji: '👏', isTrending: false },
    { id: 'emoji-7', name: '100', category: 'Emoji', emoji: '💯', isTrending: true },
    { id: 'emoji-8', name: 'Crown', category: 'Emoji', emoji: '👑', isTrending: false },
    { id: 'emoji-9', name: 'Rocket', category: 'Emoji', emoji: '🚀', isTrending: false },
    { id: 'emoji-10', name: 'Diamond', category: 'Emoji', emoji: '💎', isTrending: false },
    { id: 'emoji-11', name: 'Sparkles', category: 'Emoji', emoji: '✨', isTrending: true },
    { id: 'emoji-12', name: 'Muscle', category: 'Emoji', emoji: '💪', isTrending: false },
    { id: 'emoji-13', name: 'OK Hand', category: 'Emoji', emoji: '👌', isTrending: false },
    { id: 'emoji-14', name: 'Pray', category: 'Emoji', emoji: '🙏', isTrending: false },
    { id: 'emoji-15', name: 'Heart', category: 'Emoji', emoji: '❤️', isTrending: true },
    { id: 'emoji-16', name: 'Laughing', category: 'Emoji', emoji: '😂', isTrending: false },
    { id: 'emoji-17', name: 'Cool', category: 'Emoji', emoji: '😎', isTrending: false },
    { id: 'emoji-18', name: 'Wink', category: 'Emoji', emoji: '😉', isTrending: false },
    { id: 'emoji-19', name: 'Kiss', category: 'Emoji', emoji: '😘', isTrending: false },
    { id: 'emoji-20', name: 'Love', category: 'Emoji', emoji: '🥰', isTrending: true },

    // Trending stickers
    { id: 'trend-1', name: 'POV', category: 'Trending', emoji: '📸', isTrending: true, usageCount: 150000 },
    { id: 'trend-2', name: 'Cap', category: 'Trending', emoji: '🧢', isTrending: true, usageCount: 120000 },
    { id: 'trend-3', name: 'No Cap', category: 'Trending', emoji: '🚫', isTrending: true, usageCount: 98000 },
    { id: 'trend-4', name: 'Facts', category: 'Trending', emoji: '✅', isTrending: true, usageCount: 87000 },
    { id: 'trend-5', name: 'Period', category: 'Trending', emoji: '💅', isTrending: true, usageCount: 75000 },

    // Reactions
    { id: 'react-1', name: 'Shocked', category: 'Reactions', emoji: '😱', isTrending: false },
    { id: 'react-2', name: 'Crying', category: 'Reactions', emoji: '😭', isTrending: false },
    { id: 'react-3', name: 'Angry', category: 'Reactions', emoji: '😠', isTrending: false },
    { id: 'react-4', name: 'Surprised', category: 'Reactions', emoji: '😮', isTrending: false },
    { id: 'react-5', name: 'Sleepy', category: 'Reactions', emoji: '😴', isTrending: false },
    { id: 'react-6', name: 'Sick', category: 'Reactions', emoji: '🤒', isTrending: false },
    { id: 'react-7', name: 'Dizzy', category: 'Reactions', emoji: '😵', isTrending: false },
    { id: 'react-8', name: 'Sweat', category: 'Reactions', emoji: '😅', isTrending: false },

    // Decorative
    { id: 'deco-1', name: 'Arrow Up', category: 'Decorative', emoji: '⬆️', isTrending: false },
    { id: 'deco-2', name: 'Arrow Down', category: 'Decorative', emoji: '⬇️', isTrending: false },
    { id: 'deco-3', name: 'Arrow Left', category: 'Decorative', emoji: '⬅️', isTrending: false },
    { id: 'deco-4', name: 'Arrow Right', category: 'Decorative', emoji: '➡️', isTrending: false },
    { id: 'deco-5', name: 'Check Mark', category: 'Decorative', emoji: '✔️', isTrending: false },
    { id: 'deco-6', name: 'Cross Mark', category: 'Decorative', emoji: '❌', isTrending: false },
    { id: 'deco-7', name: 'Question', category: 'Decorative', emoji: '❓', isTrending: false },
    { id: 'deco-8', name: 'Exclamation', category: 'Decorative', emoji: '❗', isTrending: false },
    { id: 'deco-9', name: 'Light Bulb', category: 'Decorative', emoji: '💡', isTrending: false },
    { id: 'deco-10', name: 'Key', category: 'Decorative', emoji: '🔑', isTrending: false },

    // Text stickers (using emoji as placeholder, but would be text in production)
    { id: 'text-1', name: 'POV', category: 'Text', emoji: '📝', isTrending: true },
    { id: 'text-2', name: 'SLAY', category: 'Text', emoji: '💅', isTrending: true },
    { id: 'text-3', name: 'PERIODT', category: 'Text', emoji: '✨', isTrending: true },
    { id: 'text-4', name: 'GOALS', category: 'Text', emoji: '🎯', isTrending: false },
    { id: 'text-5', name: 'VIBES', category: 'Text', emoji: '🎵', isTrending: false },
];

// Sticker categories
export const STICKER_CATEGORIES = ['Emoji', 'Trending', 'Reactions', 'Decorative', 'Text'];

// Mock delay function
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get all stickers, optionally filtered by category
 */
export async function getStickers(category?: string): Promise<Sticker[]> {
    await delay(150);

    let filteredStickers = [...stickers];

    if (category && category !== 'All') {
        filteredStickers = stickers.filter(s => s.category === category);
    }

    // Sort by trending first, then by usage count
    return filteredStickers.sort((a, b) => {
        if (a.isTrending && !b.isTrending) return -1;
        if (!a.isTrending && b.isTrending) return 1;
        if (a.usageCount && b.usageCount) return b.usageCount - a.usageCount;
        return 0;
    });
}

/**
 * Get trending stickers
 */
export async function getTrendingStickers(): Promise<Sticker[]> {
    await delay(100);

    return stickers
        .filter(s => s.isTrending)
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
}

/**
 * Get stickers by category
 */
export async function getStickersByCategory(category: string): Promise<Sticker[]> {
    await delay(100);

    return stickers
        .filter(s => s.category === category)
        .sort((a, b) => {
            if (a.isTrending && !b.isTrending) return -1;
            if (!a.isTrending && b.isTrending) return 1;
            return (b.usageCount || 0) - (a.usageCount || 0);
        });
}

/**
 * Search stickers by name
 */
export async function searchStickers(query: string): Promise<Sticker[]> {
    await delay(100);

    const lowerQuery = query.toLowerCase();
    return stickers
        .filter(s => s.name.toLowerCase().includes(lowerQuery))
        .sort((a, b) => {
            if (a.isTrending && !b.isTrending) return -1;
            if (!a.isTrending && b.isTrending) return 1;
            return (b.usageCount || 0) - (a.usageCount || 0);
        });
}

