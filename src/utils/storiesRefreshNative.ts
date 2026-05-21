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
