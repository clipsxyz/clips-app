import type { Post } from '../types';

export type BoostPostStatus = 'ready' | 'active' | 'ended';

export type BoostPostFilter = 'all' | BoostPostStatus;

export type BoostPostCounts = {
    all: number;
    ready: number;
    active: number;
    ended: number;
};

export function classifyBoostStatus(p: Post): BoostPostStatus {
    if (p.boostStatus === 'active' || p.boostStatus === 'ready' || p.boostStatus === 'ended') {
        return p.boostStatus;
    }
    if (p.isBoosted) return 'active';
    if (p.boostFeedType && !p.isBoosted) return 'ended';
    return 'ready';
}

export type BoostEmptyAction = 'ready' | 'create';

export function boostFilterEmptyState(
    filter: BoostPostFilter,
): { title: string; message: string; action: BoostEmptyAction; actionLabel: string } {
    if (filter === 'active') {
        return {
            title: 'No Active Boosts',
            message: "Tap 'Ready' to pick a post and boost your reach!",
            action: 'ready',
            actionLabel: 'View Ready',
        };
    }
    if (filter === 'ended') {
        return {
            title: 'No Past Boosts Yet',
            message: 'Finished boost runs and performance records will appear here.',
            action: 'ready',
            actionLabel: 'View Ready',
        };
    }
    return {
        title: 'No Posts Available',
        message: 'Create a post first to get started.',
        action: 'create',
        actionLabel: 'Create Post',
    };
}

export function getQualityLabel(p: Post): { label: string; tone: 'emerald' | 'sky' | 'amber' } {
    const engagement =
        (p.stats.likes + p.stats.comments + p.stats.shares) / Math.max(1, p.stats.views || 1);
    if (engagement >= 0.07 && (p.stats.views || 0) >= 250) {
        return { label: 'Best candidate', tone: 'emerald' };
    }
    if (engagement >= 0.035) {
        return { label: 'Good candidate', tone: 'sky' };
    }
    return { label: 'Needs stronger post', tone: 'amber' };
}

export function getQualityReason(p: Post): string {
    const views = Math.max(1, p.stats.views || 1);
    const engagement = (p.stats.likes + p.stats.comments + p.stats.shares) / views;
    const postAgeDays = (Date.now() - (p.createdAt || 0)) / (1000 * 60 * 60 * 24);
    if (engagement >= 0.07 && views >= 250) {
        return 'High engagement and strong recent performance.';
    }
    if (engagement >= 0.035) {
        return postAgeDays <= 7
            ? 'Solid engagement with fresh recency signal.'
            : 'Solid engagement; likely to perform with broader reach.';
    }
    return views < 120
        ? 'Try growing organic engagement first before boosting.'
        : 'Consider improving hook/caption for better conversion.';
}

export function estimateReachTeaser(p: Post): string {
    const engagement =
        (p.stats.likes + p.stats.comments + p.stats.shares) / Math.max(1, p.stats.views || 1);
    const base = Math.max(800, Math.round((p.stats.views || 0) * 2.2 + engagement * 1000));
    const low = Math.round(base * 0.78);
    const high = Math.round(base * 1.32);
    const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);
    return `Estimated reach ${fmt(low)}-${fmt(high)}`;
}

export function boostStatusLabel(status: BoostPostStatus): string {
    if (status === 'active') return 'Active boost';
    if (status === 'ended') return 'Ended boost';
    return 'Ready to boost';
}
