import type { Post } from '../types';
import { collectFeedImageUrls } from './feedImageFullscreen';

export type ImageFullscreenLaunchPayload = {
    post: Post;
    startIndex: number;
    urls: string[];
};

let launchPayload: ImageFullscreenLaunchPayload | null = null;

/** Keep still-image URIs in memory so fullscreen is not a black frame if the card snapshot drops them. */
export function setImageFullscreenLaunch(payload: { post: Post; startIndex?: number }): void {
    const urls = collectFeedImageUrls(payload.post);
    launchPayload = {
        post: payload.post,
        startIndex: payload.startIndex ?? 0,
        urls,
    };
}

export function getImageFullscreenLaunch(): ImageFullscreenLaunchPayload | null {
    return launchPayload;
}

export function clearImageFullscreenLaunch(): void {
    launchPayload = null;
}
