import type { Post } from '../types';

export type BoostPostStatus = 'ready' | 'active' | 'ended';

export function classifyBoostStatus(p: Post): BoostPostStatus {
    if (p.isBoosted) return 'active';
    if (p.boostFeedType && !p.isBoosted) return 'ended';
    return 'ready';
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
