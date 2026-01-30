import type { Post } from '../types';
import type { BoostFeedType } from '../components/BoostSelectionModal';

/**
 * BOOST SYSTEM WITH EPOCH TIME TRACKING
 * 
 * Similar to Instagram/Meta Boost:
 * - All boost events tracked with epoch timestamps (milliseconds)
 * - Boost duration: 6 hours from activation
 * - Boost expires automatically after 6 hours
 * - Boost can be applied to local, regional, or national feeds
 */

// Mock boosted posts storage
interface BoostedPost {
    postId: string;
    userId: string;
    feedType: BoostFeedType;
    price: number;
    activatedAt: number; // Epoch timestamp when boost was activated
    expiresAt: number; // Epoch timestamp when boost expires (activatedAt + 6 hours)
    isActive: boolean;
}

let boostedPosts: BoostedPost[] = [];

// 6 hours in milliseconds
const BOOST_DURATION_MS = 6 * 60 * 60 * 1000;

/**
 * Activate boost for a post
 * 
 * @param postId - Post ID to boost
 * @param userId - User ID who is boosting
 * @param feedType - Feed type (local, regional, national)
 * @param price - Price paid for boost
 * @returns Boosted post with expiration timestamp
 */
export async function activateBoost(
    postId: string,
    userId: string,
    feedType: BoostFeedType,
    price: number
): Promise<BoostedPost> {
    const now = Date.now(); // Current epoch timestamp
    const expiresAt = now + BOOST_DURATION_MS; // 6 hours from now

    // Check if post is already boosted
    const existingBoost = boostedPosts.find(
        bp => bp.postId === postId && bp.isActive
    );

    if (existingBoost) {
        // Update existing boost
        existingBoost.feedType = feedType;
        existingBoost.price = price;
        existingBoost.activatedAt = now;
        existingBoost.expiresAt = expiresAt;
        existingBoost.isActive = true;
        return existingBoost;
    }

    // Create new boost
    const boostedPost: BoostedPost = {
        postId,
        userId,
        feedType,
        price,
        activatedAt: now, // Epoch timestamp
        expiresAt, // Epoch timestamp
        isActive: true
    };

    boostedPosts.push(boostedPost);
    return boostedPost;
}

/**
 * Check if a post is currently boosted
 * Uses epoch time to check if boost has expired
 * 
 * @param postId - Post ID to check
 * @returns Boosted post if active, null if not boosted or expired
 */
export async function getActiveBoost(postId: string): Promise<BoostedPost | null> {
    const now = Date.now(); // Current epoch timestamp

    // Find active boost for this post
    const boost = boostedPosts.find(
        bp => bp.postId === postId && bp.isActive && bp.expiresAt > now
    );

    // If boost exists but has expired, mark it as inactive
    if (boost && boost.expiresAt <= now) {
        boost.isActive = false;
        return null;
    }

    return boost || null;
}

/**
 * Get post IDs that have an active boost for a given feed type (for promoting in feed).
 * Instagram-style: boosted posts are injected into the feed in the matching location tier.
 *
 * @param feedType - local | regional | national
 * @returns Array of post IDs that are currently boosted for this feed type
 */
export async function getActiveBoostedPostIds(feedType: BoostFeedType): Promise<string[]> {
    const now = Date.now();
    const active = boostedPosts.filter(
        bp => bp.isActive && bp.expiresAt > now && bp.feedType === feedType
    );
    return active.map(bp => bp.postId);
}

/**
 * Get all active boosts for a user
 * Filters out expired boosts using epoch time
 * 
 * @param userId - User ID
 * @returns Array of active boosted posts
 */
export async function getUserActiveBoosts(userId: string): Promise<BoostedPost[]> {
    const now = Date.now(); // Current epoch timestamp

    // Filter active boosts for this user that haven't expired
    const activeBoosts = boostedPosts.filter(
        bp => bp.userId === userId && bp.isActive && bp.expiresAt > now
    );

    // Mark expired boosts as inactive
    boostedPosts.forEach(bp => {
        if (bp.userId === userId && bp.isActive && bp.expiresAt <= now) {
            bp.isActive = false;
        }
    });

    return activeBoosts;
}

/**
 * Get time remaining for a boost in milliseconds
 * 
 * @param postId - Post ID
 * @returns Time remaining in milliseconds, or 0 if not boosted or expired
 */
export async function getBoostTimeRemaining(postId: string): Promise<number> {
    const boost = await getActiveBoost(postId);
    if (!boost) return 0;

    const now = Date.now();
    const remaining = boost.expiresAt - now; // Time difference in milliseconds
    return Math.max(0, remaining);
}

/**
 * Check if a post should be shown in a boosted feed
 * Uses epoch time to check if boost is still active
 * 
 * @param post - Post to check
 * @param feedType - Feed type to check boost for
 * @returns true if post should be shown as boosted, false otherwise
 */
export async function shouldShowAsBoosted(
    post: Post,
    feedType: 'local' | 'regional' | 'national' | 'following'
): Promise<boolean> {
    const boost = await getActiveBoost(post.id);
    if (!boost || !boost.isActive) return false;

    // Check if boost matches the feed type
    if (feedType === 'local' && boost.feedType === 'local') return true;
    if (feedType === 'regional' && boost.feedType === 'regional') return true;
    if (feedType === 'national' && boost.feedType === 'national') return true;

    return false;
}

/**
 * Clean up expired boosts
 * Called periodically to remove expired boosts
 */
export async function cleanupExpiredBoosts(): Promise<void> {
    const now = Date.now(); // Current epoch timestamp

    boostedPosts.forEach(bp => {
        if (bp.isActive && bp.expiresAt <= now) {
            bp.isActive = false;
        }
    });

    // Optionally remove old inactive boosts (older than 7 days)
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    boostedPosts = boostedPosts.filter(
        bp => bp.isActive || bp.expiresAt > sevenDaysAgo
    );
}

/**
 * Get boost statistics for a post
 * 
 * @param postId - Post ID
 * @returns Boost statistics
 */
export async function getBoostStats(postId: string): Promise<{
    isActive: boolean;
    timeRemaining: number; // Milliseconds
    feedType: BoostFeedType | null;
    activatedAt: number | null; // Epoch timestamp
    expiresAt: number | null; // Epoch timestamp
}> {
    const boost = await getActiveBoost(postId);
    const timeRemaining = await getBoostTimeRemaining(postId);

    if (!boost) {
        return {
            isActive: false,
            timeRemaining: 0,
            feedType: null,
            activatedAt: null,
            expiresAt: null
        };
    }

    return {
        isActive: true,
        timeRemaining,
        feedType: boost.feedType,
        activatedAt: boost.activatedAt,
        expiresAt: boost.expiresAt
    };
}

