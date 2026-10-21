import type { LocationSuggestion } from '../api/locations';
import type { Post } from '../types';
import { setFeedPreloadPostIds } from './feedActiveVideoNative';

/**
 * Overlay visibility for the home feed lives here — NOT in FeedScreen useState —
 * so opening comments / share / the location picker does not re-render the FlatList host.
 *
 * Playback suspend for the comments sheet is a separate listener so mounted video
 * cells can unmount TextureViews without FeedCard / renderItem identity changing.
 */

type Listener = () => void;

export type FeedLocationPickerPayload = {
    suggestion: LocationSuggestion;
    kind: 'location' | 'venue' | 'landmark';
};

export type FeedOverlaySnapshot = {
    commentsPost: Post | null;
    sharePost: Post | null;
    locationPicker: FeedLocationPickerPayload | null;
};

const overlayListeners = new Set<Listener>();
const playbackBlockListeners = new Set<(blocked: boolean) => void>();

let snapshot: FeedOverlaySnapshot = {
    commentsPost: null,
    sharePost: null,
    locationPicker: null,
};

function emitOverlay(): void {
    overlayListeners.forEach((fn) => fn());
}

function commentsOpen(next: FeedOverlaySnapshot): boolean {
    return next.commentsPost != null;
}

function setSnapshot(next: FeedOverlaySnapshot): void {
    const prevBlocked = commentsOpen(snapshot);
    snapshot = next;
    emitOverlay();
    const nextBlocked = commentsOpen(snapshot);
    if (prevBlocked === nextBlocked) return;
    if (nextBlocked) {
        setFeedPreloadPostIds([]);
    }
    playbackBlockListeners.forEach((fn) => fn(nextBlocked));
}

export function getFeedOverlaySnapshot(): FeedOverlaySnapshot {
    return snapshot;
}

export function subscribeFeedOverlaySnapshot(listener: Listener): () => void {
    overlayListeners.add(listener);
    return () => {
        overlayListeners.delete(listener);
    };
}

export function getFeedOverlayBlocksPlayback(): boolean {
    return commentsOpen(snapshot);
}

export function subscribeFeedOverlayBlocksPlayback(
    listener: (blocked: boolean) => void,
): () => void {
    playbackBlockListeners.add(listener);
    listener(commentsOpen(snapshot));
    return () => {
        playbackBlockListeners.delete(listener);
    };
}

export function openFeedCommentsOverlay(post: Post): void {
    setSnapshot({ ...snapshot, commentsPost: post });
}

export function closeFeedCommentsOverlay(): void {
    if (!snapshot.commentsPost) return;
    setSnapshot({ ...snapshot, commentsPost: null });
}

export function openFeedShareOverlay(post: Post): void {
    setSnapshot({ ...snapshot, sharePost: post });
}

export function closeFeedShareOverlay(): void {
    if (!snapshot.sharePost) return;
    setSnapshot({ ...snapshot, sharePost: null });
}

export function openFeedLocationPicker(payload: FeedLocationPickerPayload): void {
    setSnapshot({ ...snapshot, locationPicker: payload });
}

export function closeFeedLocationPicker(): void {
    if (!snapshot.locationPicker) return;
    setSnapshot({ ...snapshot, locationPicker: null });
}

type OpenDmThread = (handle: string, postId: string, isMutual?: boolean) => void;

let openDmThreadImpl: OpenDmThread | null = null;

export function registerFeedDmOpener(fn: OpenDmThread): () => void {
    openDmThreadImpl = fn;
    return () => {
        if (openDmThreadImpl === fn) openDmThreadImpl = null;
    };
}

export function openFeedDmThread(handle: string, postId: string, isMutual?: boolean): void {
    openDmThreadImpl?.(handle, postId, isMutual);
}
