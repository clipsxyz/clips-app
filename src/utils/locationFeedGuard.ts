import type { Post } from '../types';
import { postMatchesLocationTab } from '../api/posts';

/** Feeds where every card must match author location (not Following / clips). */
export function isLocationScopedFeedTab(tab: string | null | undefined): boolean {
    const t = String(tab || '')
        .trim()
        .toLowerCase();
    if (!t) return false;
    if (t === 'discover' || t === 'following' || t === 'clips') return false;
    return true;
}

/**
 * Final belt-and-suspenders for location feeds.
 * Drop anything that does not belong — even if an inject path or API regresses.
 */
export function filterPostsForLocationFeed<T extends Post>(posts: T[], tab: string): T[] {
    if (!isLocationScopedFeedTab(tab)) return posts;
    return posts.filter((p) => postMatchesLocationTab(p, tab));
}

/** Dev/test helper: report ids that would leak into a foreign place feed. */
export function findLocationFeedLeaks<T extends Post>(posts: T[], tab: string): string[] {
    if (!isLocationScopedFeedTab(tab)) return [];
    return posts
        .filter((p) => !postMatchesLocationTab(p, tab))
        .map((p) => String(p.id));
}
