import { apiRequest } from '../api/client';
import { transformLaravelPost } from '../api/posts';
import type { Post } from '../types';
import type { FeedStreamRow } from './feedStreamInjection';
import {
    STORIES24_ADD_YOURS_HANDLE,
    type Stories24RailItem,
} from './stories24Rail';

export type PaidFeedSurface = 'location' | 'following' | 'stories';

export type PaidDeliveryStory = {
    id: string;
    handle: string;
    title?: string;
    thumb?: string | null;
    avatarUrl?: string | null;
};

type PaidDeliveryRow = {
    boostId?: number;
    postId?: string;
    feedType?: Post['boostFeedType'];
    paceGap?: number;
    quality?: number;
    post?: unknown;
    story?: PaidDeliveryStory | null;
};

/** One paid post, already ordered by pace (furthest behind the bought audience first). */
export type PaidSlotPost = Post & { boost: { id: number } };

const LEAD_ORGANIC: Record<'location' | 'following', number> = {
    location: 2,
    following: 4,
};
const ORGANIC_GAP: Record<'location' | 'following', number> = {
    location: 4,
    following: 6,
};

function normalizeHandle(handle: string | null | undefined): string {
    return String(handle || '')
        .trim()
        .toLowerCase()
        .replace(/^@/, '');
}

export function paidSlotPostsFromDelivery(rows: PaidDeliveryRow[] | null | undefined): PaidSlotPost[] {
    const posts: PaidSlotPost[] = [];
    for (const row of rows || []) {
        const boostId = Number(row?.boostId);
        const quality = Number(row?.quality ?? 1);
        if (!row?.post || !Number.isFinite(boostId) || boostId <= 0 || quality <= 0) continue;
        try {
            const post = transformLaravelPost(row.post);
            posts.push({
                ...post,
                isBoosted: true,
                boostFeedType: row.feedType || post.boostFeedType,
                boost: { id: boostId },
            });
        } catch {
            /* A bad candidate must not blank the feed. */
        }
    }
    return posts;
}

/**
 * Keep organic order. Insert the next paid post after the lead organic posts,
 * then again after every gap of organic posts. A paid post already in the
 * organic list is removed so it appears once, in the paid slot.
 */
export function blendPaidFeedRows(
    rows: FeedStreamRow[],
    paidPosts: Post[],
    surface: 'location' | 'following',
): FeedStreamRow[] {
    if (!paidPosts.length) return rows;
    const lead = LEAD_ORGANIC[surface];
    const gap = ORGANIC_GAP[surface];
    const paidIds = new Set(paidPosts.map((post) => String(post.id)));
    const organic = rows.filter(
        (row) => !(row.type === 'post' && paidIds.has(String(row.item.id))),
    );
    const out: FeedStreamRow[] = [];
    let placed = 0;
    let sincePaid = 0;
    let started = false;
    let paidIndex = 0;

    for (const row of organic) {
        if (row.type === 'post' && paidIndex < paidPosts.length && placed >= lead && (!started || sincePaid >= gap)) {
            const paid = paidPosts[paidIndex];
            paidIndex += 1;
            started = true;
            sincePaid = 0;
            out.push({ type: 'post', item: paid, createdAt: paid.createdAt || 0 });
        }
        out.push(row);
        if (row.type === 'post') {
            placed += 1;
            if (started) sincePaid += 1;
        }
    }

    return out;
}

export function placeSponsoredStory(
    items: Stories24RailItem[],
    sponsored: (Stories24RailItem & { boostId?: number }) | null,
): Stories24RailItem[] {
    if (!sponsored?.handle || !sponsored.storyId) return items;
    const key = normalizeHandle(sponsored.handle);
    const without = items.filter((item) => normalizeHandle(item.handle) !== key);
    const existing = items.find((item) => normalizeHandle(item.handle) === key);
    const card: Stories24RailItem = {
        ...existing,
        ...sponsored,
        handle: existing?.handle || sponsored.handle,
        title: existing?.title || sponsored.title || sponsored.handle,
        subtitle: 'Sponsored',
        thumb: existing?.thumb || sponsored.thumb,
        avatarUrl: existing?.avatarUrl || sponsored.avatarUrl,
        storyId: existing?.storyId || sponsored.storyId,
        storyIds: existing?.storyIds || (sponsored.storyId ? [sponsored.storyId] : undefined),
        sponsored: true,
        boostId: sponsored.boostId,
    };

    let storyCards = 0;
    let index = without.length;
    for (let i = 0; i < without.length; i += 1) {
        if (without[i].handle === STORIES24_ADD_YOURS_HANDLE) continue;
        storyCards += 1;
        if (storyCards === 2) {
            index = i + 1;
            break;
        }
    }
    const next = [...without];
    next.splice(index, 0, card);
    return next;
}

export async function fetchPaidDelivery(
    surface: PaidFeedSurface,
    feedType?: 'local' | 'regional' | 'national',
): Promise<PaidDeliveryRow[]> {
    const params = new URLSearchParams({ surface });
    if (surface === 'location' && feedType) params.set('feedType', feedType);
    const data = await apiRequest(`/boosts/delivery?${params.toString()}`) as { candidates?: PaidDeliveryRow[] };
    return Array.isArray(data?.candidates) ? data.candidates : [];
}

/** Count this viewer toward the one view the boost already paid for. */
export function recordPaidReach(boostId: number): void {
    if (!Number.isFinite(boostId) || boostId <= 0) return;
    void apiRequest(`/boosts/${boostId}/track`, {
        method: 'POST',
        body: JSON.stringify({ event: 'reach' }),
    }).catch(() => {
        /* A tracking failure must not block the story. */
    });
}
