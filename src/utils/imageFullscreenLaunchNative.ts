import type { Post } from '../types';
import { collectFeedImageUrls } from './feedImageFullscreen';

/**
 * Action handlers for the fullscreen viewer. These come from the *host* screen's live
 * state (feed patches, comment sheets, follow mutations, navigation), so they are handed
 * to the viewer through this in-memory bridge rather than through navigation params —
 * functions are not serializable and would trip React Navigation's state warnings.
 */
export type ImageFullscreenHandlers = {
    onClose?: () => void;
    onLike?: () => void | Promise<void>;
    onComment?: () => void;
    onReclip?: () => void | Promise<void>;
    onShare?: () => void;
    onSave?: () => void;
    isSaved?: boolean;
    onMenu?: () => void;
    onFollow?: () => void | Promise<void>;
    onVisitProfile?: () => void;
};

export type ImageFullscreenLaunchPayload = {
    post: Post;
    startIndex: number;
    urls: string[];
    handlers: ImageFullscreenHandlers;
};

let launchPayload: ImageFullscreenLaunchPayload | null = null;

const listeners = new Set<() => void>();

function emit(): void {
    listeners.forEach((listener) => {
        try {
            listener();
        } catch {
            // A subscriber throwing must never break the store for the others.
        }
    });
}

/**
 * The fullscreen route screen subscribes here so a host-side post mutation (like, follow,
 * reclip) re-renders the open viewer without the host holding a reference to it.
 */
export function subscribeImageFullscreen(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getImageFullscreenLaunch(): ImageFullscreenLaunchPayload | null {
    return launchPayload;
}

/**
 * Open (or re-seed) the viewer. Handlers/startIndex are preserved from the previous
 * payload when omitted, so a mid-open post refresh does not drop the host wiring.
 */
export function setImageFullscreenLaunch(payload: {
    post: Post;
    startIndex?: number;
    handlers?: ImageFullscreenHandlers;
}): void {
    const urls = collectFeedImageUrls(payload.post);
    launchPayload = {
        post: payload.post,
        startIndex: payload.startIndex ?? launchPayload?.startIndex ?? 0,
        urls,
        handlers: payload.handlers ?? launchPayload?.handlers ?? {},
    };
    emit();
}

/** Replace the displayed post (keeps startIndex/handlers) after a host-side mutation. */
export function updateImageFullscreenPost(post: Post): void {
    if (!launchPayload) return;
    launchPayload = {
        ...launchPayload,
        post,
        urls: collectFeedImageUrls(post),
    };
    emit();
}

export function clearImageFullscreenLaunch(): void {
    launchPayload = null;
    emit();
}
