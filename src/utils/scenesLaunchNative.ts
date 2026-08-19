import type { Post } from '../types';

export type ScenesLaunchPayload = {
    initialPostId: string;
    posts: Post[];
    initialVideoTime?: number;
    initialMuted?: boolean;
    feedLabel?: string;
};

let launchPayload: ScenesLaunchPayload | null = null;

/**
 * In-memory Scenes launch payload. Navigation params can drop large `posts`
 * arrays or file:// URIs on Android, which left fullscreen as a black screen.
 */
export function setScenesLaunchPayload(payload: ScenesLaunchPayload): void {
    launchPayload = {
        initialPostId: String(payload.initialPostId),
        posts: Array.isArray(payload.posts) ? payload.posts.slice() : [],
        initialVideoTime: payload.initialVideoTime,
        initialMuted: payload.initialMuted,
        feedLabel: payload.feedLabel,
    };
}

export function getScenesLaunchPayload(): ScenesLaunchPayload | null {
    return launchPayload;
}

export function clearScenesLaunchPayload(): void {
    launchPayload = null;
}
