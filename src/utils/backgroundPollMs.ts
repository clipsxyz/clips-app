import { isViteDevMode } from '../config/runtimeEnv';

function isDevRuntime(): boolean {
    if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
    return isViteDevMode();
}

/** Inbox / notification badge polling. */
export function getInboxUnreadPollMs(): number {
    return isDevRuntime() ? 60_000 : 30_000;
}

/** Web feed "new posts" detector — was 10s. */
export function getFeedNewPostsPollMs(): number {
    return isDevRuntime() ? 90_000 : 45_000;
}

/** Header counts (questions, etc.) on web shell. */
export function getHeaderCountsPollMs(): number {
    return isDevRuntime() ? 60_000 : 30_000;
}

/**
 * Stories 24 rail background refresh.
 * `null` = event-driven only (share created, follow toggled, focus).
 */
export function getStoriesRailPollMs(): number | null {
    return isDevRuntime() ? null : 120_000;
}
