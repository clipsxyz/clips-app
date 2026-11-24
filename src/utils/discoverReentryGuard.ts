/**
 * Suppress Discover re-entry while a system picker, camera, or other external
 * sheet is in front of the app. The resume that follows is not the user
 * coming back from another app.
 */
let handoffDepth = 0;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

export function beginExternalHandoff(): void {
    handoffDepth += 1;
    if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
    }
}

export function endExternalHandoff(): void {
    handoffDepth = Math.max(0, handoffDepth - 1);
    if (handoffDepth > 0) return;
    if (settleTimer) clearTimeout(settleTimer);
    // The resume event can land just after the picker promise resolves.
    settleTimer = setTimeout(() => {
        settleTimer = null;
    }, 1200);
}

export function externalHandoffActive(): boolean {
    return handoffDepth > 0 || settleTimer != null;
}

/** Keep Discover from stealing the screen when a picker or camera calls back. */
export function trackPickerCallback<T extends (...args: any[]) => void>(callback: T): T {
    beginExternalHandoff();
    let ended = false;
    const finish = () => {
        if (ended) return;
        ended = true;
        endExternalHandoff();
    };
    return ((...args: Parameters<T>) => {
        finish();
        callback(...args);
    }) as T;
}

/** Create, composer, and capture screens keep their place when the app resumes. */
export const DISCOVER_REENTRY_FLOW_ROUTES = new Set([
    'InstantCreate',
    'CreateComposer',
    'CreatePost',
    'GalleryPreview',
    'InstantFilters',
    'TextOnlyCreate',
    'StoryLinkCreate',
    'TextOnlyPostDetails',
    'Story24Composer',
    'Clip',
]);
