import { InteractionManager } from 'react-native';

/**
 * Defer work until navigation/transition animations finish.
 * Prefer for secondary fetches and heavy non-critical mounts on tab screens.
 */
export function runAfterInteractions<T>(task: () => T | Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const handle = InteractionManager.runAfterInteractions(() => {
            try {
                Promise.resolve(task()).then(resolve, reject);
            } catch (err) {
                reject(err);
            }
        });
        // InteractionManager.handle cancel is best-effort if caller abandons.
        void handle;
    });
}
