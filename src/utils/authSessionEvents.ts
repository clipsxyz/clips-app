type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Fired when an authenticated API call returns 401. AuthProvider logs the user out. */
export function emitUnauthorized(): void {
    unauthorizedListeners.forEach((listener) => {
        try {
            listener();
        } catch {
            /* ignore */
        }
    });
}

export function onUnauthorized(listener: UnauthorizedListener): () => void {
    unauthorizedListeners.add(listener);
    return () => {
        unauthorizedListeners.delete(listener);
    };
}
