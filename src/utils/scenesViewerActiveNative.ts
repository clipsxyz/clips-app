/** True while fullscreen Scenes is mounted — feed must not keep a live ExoPlayer underneath. */
let scenesViewerActive = false;
const listeners = new Set<(active: boolean) => void>();

export function setScenesViewerActive(active: boolean): void {
    if (scenesViewerActive === active) return;
    scenesViewerActive = active;
    listeners.forEach((l) => {
        try {
            l(active);
        } catch {
            /* ignore */
        }
    });
}

export function isScenesViewerActive(): boolean {
    return scenesViewerActive;
}

export function subscribeScenesViewerActive(listener: (active: boolean) => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
