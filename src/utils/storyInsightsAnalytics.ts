import type { StoryInsight } from '../api/stories';

export type StoryReachTier = 'local' | 'regional' | 'discover';

export type StoryInsightsOverviewStats = {
    totalViews: number;
    uniqueViewers: number;
    completionRate: number;
    directShares: number;
    localViews: number;
    regionalViews: number;
    discoverViews: number;
};

export type StoryInsightRowStats = {
    views: number;
    completionRate: number;
    directShares: number;
};

function norm(value: string | undefined | null): string {
    return String(value || '').trim().toLowerCase();
}

export function placeTokenFromHandle(handle: string | undefined | null): string {
    const raw = String(handle || '').trim();
    const at = raw.lastIndexOf('@');
    if (at < 0) return '';
    return raw.slice(at + 1).trim();
}

export function classifyStoryViewOrigin(
    viewerHandle: string | undefined | null,
    creator?: { local?: string; regional?: string; national?: string } | null,
): StoryReachTier {
    const place = norm(placeTokenFromHandle(viewerHandle));
    if (!place) return 'discover';
    const local = norm(creator?.local);
    const regional = norm(creator?.regional);
    const national = norm(creator?.national);
    if (local && (place === local || place.includes(local) || local.includes(place))) {
        return 'local';
    }
    if (regional && (place === regional || place.includes(regional) || regional.includes(place))) {
        return 'regional';
    }
    if (national && (place === national || place.includes(national))) {
        return 'regional';
    }
    return 'discover';
}

function engagedHandlesForInsight(item: StoryInsight): Set<string> {
    const handles = new Set<string>();
    for (const handle of item.likers || []) {
        const key = norm(handle);
        if (key) handles.add(key);
    }
    for (const row of item.reactions || []) {
        const key = norm(row.userHandle);
        if (key) handles.add(key);
    }
    for (const row of item.replies || []) {
        const key = norm(row.userHandle);
        if (key) handles.add(key);
    }
    return handles;
}

export function storyInsightRowStats(item: StoryInsight): StoryInsightRowStats {
    const viewers = (item.viewers || []).filter((h) => norm(h));
    const views = Math.max(Number(item.views || 0), viewers.length);
    const engaged = engagedHandlesForInsight(item);
    const completionDenom = viewers.length > 0 ? viewers.length : views;
    const completed = viewers.length > 0
        ? viewers.filter((h) => engaged.has(norm(h))).length
        : engaged.size;
    const completionRate =
        completionDenom <= 0 ? 0 : Math.min(100, Math.round((completed / completionDenom) * 100));
    return {
        views,
        completionRate,
        directShares: (item.replies || []).length,
    };
}

export function summarizeStoryInsights(
    insights: StoryInsight[] | undefined | null,
    creator?: { local?: string; regional?: string; national?: string } | null,
): StoryInsightsOverviewStats {
    const list = insights || [];
    let totalViews = 0;
    let directShares = 0;
    let localViews = 0;
    let regionalViews = 0;
    let discoverViews = 0;
    const uniqueViewers = new Set<string>();
    const uniqueEngaged = new Set<string>();

    for (const item of list) {
        const viewers = (item.viewers || []).filter((h) => norm(h));
        const views = Math.max(Number(item.views || 0), viewers.length);
        totalViews += views;
        directShares += (item.replies || []).length;
        const engaged = engagedHandlesForInsight(item);

        for (const handle of viewers) {
            const key = norm(handle);
            uniqueViewers.add(key);
            if (engaged.has(key)) uniqueEngaged.add(key);
            const tier = classifyStoryViewOrigin(handle, creator);
            if (tier === 'local') localViews += 1;
            else if (tier === 'regional') regionalViews += 1;
            else discoverViews += 1;
        }

        const leftover = Math.max(0, views - viewers.length);
        if (leftover > 0) discoverViews += leftover;
    }

    const completionDenom = uniqueViewers.size > 0 ? uniqueViewers.size : totalViews;
    const completionRate =
        completionDenom <= 0
            ? 0
            : Math.min(100, Math.round((uniqueEngaged.size / completionDenom) * 100));

    return {
        totalViews,
        uniqueViewers: uniqueViewers.size,
        completionRate,
        directShares,
        localViews,
        regionalViews,
        discoverViews,
    };
}

export function reachPercent(part: number, total: number): number {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.round((part / total) * 100));
}
