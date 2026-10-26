import type { Post } from '../types';
import type { BoostAnalytics } from '../api/boost';
import { resolvePublicMediaUrl } from '../api/apiBaseUrl';
import { getPostBodyText, isTextOnlyPost, isVideoPost } from './effectiveTextPostStyleNative';

function num(...vals: Array<number | string | null | undefined>): number {
    for (const v of vals) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
}

export function buildInstantAnalytics(post: Post, range: '24h' | '7d' | 'all' = 'all'): BoostAnalytics {
    const impressions = num(post.stats?.views, post.views_count);
    const likes = num(post.stats?.likes, post.likes_count);
    const comments = num(post.stats?.comments, post.comments_count);
    const shares = num(post.stats?.shares, post.shares_count);
    return {
        hasBoost: !!post.isBoosted || !!post.boostFeedType,
        isActive: !!post.isBoosted,
        postId: post.id,
        range,
        feedType: (post.boostFeedType as BoostAnalytics['feedType']) || null,
        activatedAt: null,
        expiresAt: null,
        spendEur: 0,
        analytics: {
            impressions,
            likes,
            comments,
            shares,
            profileVisits: 0,
            messageStarts: 0,
            costPerProfileVisit: null,
            costPerMessageStart: null,
            trend: {
                impressions: impressions > 0 ? [{ bucket: 'post', value: impressions }] : [],
            },
            sourceMatchedEventsCount: 0,
        },
    };
}

/** Keep organic post stats when the API has no boost row (or returns zeros). */
export function mergeBoostAnalytics(post: Post, api: BoostAnalytics | null, range: '24h' | '7d' | 'all'): BoostAnalytics {
    const instant = buildInstantAnalytics(post, range);
    const floor = instant.analytics;
    if (!api || !floor) return instant;
    const a = api.analytics;
    const pick = (apiVal: number | undefined, base: number) => {
        const n = Number(apiVal);
        if (Number.isFinite(n) && n > 0) return n;
        return base;
    };
    const apiTrend = a?.trend;
    return {
        ...instant,
        ...api,
        range: api.range ?? range,
        spendEur: typeof api.spendEur === 'number' ? api.spendEur : instant.spendEur,
        analytics: {
            impressions: pick(a?.impressions, floor.impressions),
            likes: pick(a?.likes, floor.likes),
            comments: pick(a?.comments, floor.comments),
            shares: pick(a?.shares, floor.shares),
            profileVisits: pick(a?.profileVisits, floor.profileVisits),
            messageStarts: pick(a?.messageStarts, floor.messageStarts),
            costPerProfileVisit: a?.costPerProfileVisit ?? null,
            costPerMessageStart: a?.costPerMessageStart ?? null,
            lastUpdatedAt: a?.lastUpdatedAt ?? null,
            trend: (apiTrend?.impressions?.length ?? 0) > 0 ? apiTrend : floor.trend,
            sourceMatchedEventsCount: a?.sourceMatchedEventsCount ?? 0,
        },
    };
}

export function resolveBoostInsightsPreview(post: Post): {
    uri?: string;
    text: string;
    textOnly: boolean;
    isVideo: boolean;
} {
    const textOnly = isTextOnlyPost(post);
    const text = getPostBodyText(post);
    const carousel = (post.mediaItems || []).filter(
        (m) => m?.type === 'image' || m?.type === 'video',
    );
    const first = carousel[0];
    const isVideo = first?.type === 'video' || isVideoPost(post);
    const still =
        first?.posterUrl ||
        first?.thumbnailUrl ||
        first?.thumbnail_url ||
        post.videoPosterUrl ||
        post.thumbnailUrl ||
        post.clientLocalMediaUri;
    const rawMedia = first?.url || post.mediaUrl || post.finalVideoUrl;
    const stillLooksLikeVideo =
        typeof still === 'string' && /\.(mp4|mov|webm|m3u8)(\?|$)/i.test(still);
    const mediaLooksLikeVideo =
        typeof rawMedia === 'string' && /\.(mp4|mov|webm|m3u8)(\?|$)/i.test(rawMedia);
    const preferred = isVideo || mediaLooksLikeVideo
        ? still && !stillLooksLikeVideo
            ? still
            : still || rawMedia
        : rawMedia || still;
    const uri = preferred ? resolvePublicMediaUrl(preferred) || preferred : undefined;
    return { uri, text, textOnly, isVideo };
}
