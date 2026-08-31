/** Hide the main tab bar while the feed Scenes overlay covers the window. */
let feedScenesFullscreen = false;
const listeners = new Set<(active: boolean) => void>();

export function setFeedScenesFullscreen(active: boolean): void {
    if (feedScenesFullscreen === active) return;
    feedScenesFullscreen = active;
    listeners.forEach((l) => {
        try {
            l(active);
        } catch {
            /* ignore */
        }
    });
}

export function isFeedScenesFullscreen(): boolean {
    return feedScenesFullscreen;
}

export function subscribeFeedScenesFullscreen(listener: (active: boolean) => void): () => void {
    listeners.add(listener);
    listener(feedScenesFullscreen);
    return () => {
        listeners.delete(listener);
    };
}
