import { apiRequest } from '../api/client';

const boostIdByPost = new Map<string, number>();
const reachSent = new Set<string>();
const onScreen = new Set<string>();
const pending = new Map<string, { boostId: number; reach: boolean }>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function rememberBoostIds(entries: Record<string, number> | undefined): void {
    if (!entries) return;
    for (const [postId, boostId] of Object.entries(entries)) {
        const id = Number(boostId);
        if (postId && Number.isFinite(id) && id > 0) {
            boostIdByPost.set(String(postId), id);
        }
    }
}

export function boostIdForPost(postId: string): number | undefined {
    return boostIdByPost.get(String(postId));
}

/** Attach `{ boost: { id } }` when this post has an active boost id. */
export function withActiveBoost<T extends { id?: string | number; boost?: { id?: number } | null }>(post: T): T {
    const id = post?.id != null ? boostIdForPost(String(post.id)) : undefined;
    if (!id) return post;
    if (post.boost?.id === id) return post;
    return { ...post, boost: { id } };
}

/** Queue impression (and a one-time reach) for boosted posts that just became visible. */
export function noteBoostedPostsVisible(posts: Array<{ id?: string; isBoosted?: boolean }>): void {
    const seenNow = new Set<string>();
    for (const post of posts) {
        if (!post?.isBoosted || post.id == null) continue;
        const key = String(post.id);
        const boostId = boostIdByPost.get(key);
        if (!boostId) continue;
        seenNow.add(key);
        if (onScreen.has(key)) continue;
        onScreen.add(key);
        const reach = !reachSent.has(key);
        if (reach) reachSent.add(key);
        pending.set(key, { boostId, reach });
    }
    for (const key of onScreen) {
        if (!seenNow.has(key)) onScreen.delete(key);
    }
    scheduleFlush();
}

function scheduleFlush(): void {
    if (flushTimer || pending.size === 0) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        const batch = [...pending.values()];
        pending.clear();
        for (const item of batch) {
            void sendEvent(item.boostId, 'impression');
            if (item.reach) void sendEvent(item.boostId, 'reach');
        }
    }, 400);
}

async function sendEvent(boostId: number, event: 'impression' | 'reach'): Promise<void> {
    try {
        await apiRequest(`/boosts/${boostId}/track`, {
            method: 'POST',
            body: JSON.stringify({ event }),
        });
    } catch {
        /* Tracking must never affect scrolling or navigation. */
    }
}
