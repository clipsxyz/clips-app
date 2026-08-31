import type { Post } from '../types';

export type FeedScenesOverlaySession = {
    postId: string;
    posts: Post[];
    feedLabel: string;
    muted: boolean;
    initialVideoTime?: number;
    navigate: (route: string, params?: object) => void;
};

type Listener = (session: FeedScenesOverlaySession | null) => void;

let session: FeedScenesOverlaySession | null = null;
const listeners = new Set<Listener>();

export function getFeedScenesOverlaySession(): FeedScenesOverlaySession | null {
    return session;
}

export function setFeedScenesOverlaySession(next: FeedScenesOverlaySession | null): void {
    session = next
        ? {
              ...next,
              postId: String(next.postId),
          }
        : null;
    listeners.forEach((listener) => {
        try {
            listener(session);
        } catch {
            /* ignore */
        }
    });
}

export function subscribeFeedScenesOverlaySession(listener: Listener): () => void {
    listeners.add(listener);
    listener(session);
    return () => {
        listeners.delete(listener);
    };
}
