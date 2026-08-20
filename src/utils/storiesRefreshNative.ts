import { invalidateStoryPresenceCache } from '../api/stories';

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeStoriesRefresh(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function emitStoriesRefresh(): void {
    invalidateStoryPresenceCache();
    listeners.forEach((fn) => {
        try {
            fn();
        } catch (e) {
            console.warn('storiesRefresh listener error', e);
        }
    });
}

/** After native story publish — refreshes Stories 24 rail and avatar rings. */
export function notifyStoryCreated(_userHandle: string): void {
    emitStoriesRefresh();
}
