import type { Post } from '../types';

const updatesByPostId = new Map<string, Post>();
const listeners = new Set<(updates: Post[]) => void>();

export function setScenesPostUpdate(post: Post): void {
    if (!post?.id) return;
    updatesByPostId.set(String(post.id), post);
}

/** Push queued post patches to feed subscribers (call when leaving Scenes). */
export function flushScenesPostUpdates(): void {
    if (updatesByPostId.size === 0) return;
    const items = [...updatesByPostId.values()];
    updatesByPostId.clear();
    for (const listener of listeners) {
        listener(items);
    }
}

export function subscribeScenesPostUpdates(listener: (updates: Post[]) => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
