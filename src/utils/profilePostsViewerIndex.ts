import type { Post } from '../types';

/**
 * Index resolution for the profile posts fullscreen viewer.
 *
 * The profile grid renders a *tab-filtered* list (`filteredPosts`), while the
 * underlying profile state is the raw unfiltered `posts` array. The viewer must
 * resolve the tapped post against the exact array it renders, otherwise the
 * scroll offset and the viewability-driven "which video is active" pick land on
 * a different clip.
 *
 * These helpers are intentionally pure and dependency-free so the mapping can be
 * unit tested without mounting the list.
 */

function samePostId(a: Post | null | undefined, b: string | null | undefined): boolean {
    if (!a || b == null) return false;
    return String(a.id) === String(b);
}

/**
 * Index of the tapped post inside the array the viewer actually renders.
 * Returns -1 when the id is absent so callers can fall back to index 0.
 */
export function resolveViewerStartIndex(posts: Post[], initialPostId: string | null | undefined): number {
    if (!initialPostId) return posts.length > 0 ? 0 : -1;
    const index = posts.findIndex((post) => samePostId(post, initialPostId));
    return index;
}

/**
 * The post the viewer should activate on open.
 *
 * Prefers the tapped post, but only when it actually has playable video. A photo
 * or text-only post must fall through to the nearest playable video, otherwise
 * viewability immediately "corrects" the selection to whatever else is mounted.
 */
export function resolveViewerStartPost(
    posts: Post[],
    initialPostId: string | null | undefined,
    hasVideoMedia: (post: Post) => boolean,
): Post | null {
    if (posts.length === 0) return null;
    const index = resolveViewerStartIndex(posts, initialPostId);
    if (index >= 0) {
        const tapped = posts[index];
        if (hasVideoMedia(tapped)) return tapped;
    }
    return posts.find((post) => hasVideoMedia(post)) ?? null;
}

/**
 * `true` when a viewability report has caught up with the post the user tapped.
 *
 * The list renders its first window before the 120ms scroll lands, so the initial
 * viewability callback reports index 0. Without this guard the first-rendered
 * card steals the active slot and the wrong video plays until the scroll lands.
 */
export function shouldDeferViewabilityActivation(
    pendingStartPostId: string | null,
    viewablePostId: string | null | undefined,
): boolean {
    if (pendingStartPostId == null) return false;
    if (viewablePostId == null) return true;
    return String(viewablePostId) !== String(pendingStartPostId);
}
