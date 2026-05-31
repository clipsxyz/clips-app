type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeStoriesRefresh(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function emitStoriesRefresh(): void {
    listeners.forEach((fn) => {
        try {
            fn();
        } catch (e) {
            console.warn('storiesRefresh listener error', e);
        }
    });
}

/** After native story publish — refreshes Stories 24 rail on the feed. */
export function notifyStoryCreated(_userHandle: string): void {
    emitStoriesRefresh();
}
