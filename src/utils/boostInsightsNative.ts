import type { Post } from '../types';
import type { BoostAnalytics } from '../api/boost';

export function buildInstantAnalytics(post: Post): BoostAnalytics {
    return {
        hasBoost: !!post.isBoosted || !!post.boostFeedType,
        isActive: !!post.isBoosted,
        postId: post.id,
        range: 'all',
        feedType: (post.boostFeedType as BoostAnalytics['feedType']) || null,
        activatedAt: null,
        expiresAt: null,
        spendEur: 0,
        analytics: {
            impressions: Number(post.stats.views || 0),
            likes: Number(post.stats.likes || 0),
            comments: Number(post.stats.comments || 0),
            shares: Number(post.stats.shares || 0),
            profileVisits: 0,
            messageStarts: 0,
            costPerProfileVisit: null,
            costPerMessageStart: null,
            trend: { impressions: [] },
            sourceMatchedEventsCount: 0,
        },
    };
}
