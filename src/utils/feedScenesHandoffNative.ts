/** Playback state when opening Scenes from the feed (web `videoTimesMap` / `videoMutedMap` parity). */
export type FeedVideoHandoff = {
    currentTime: number;
    muted: boolean;
};

const handoffByPostId = new Map<string, FeedVideoHandoff>();

export function setFeedVideoHandoff(postId: string, state: FeedVideoHandoff): void {
    if (!postId) return;
    handoffByPostId.set(String(postId), {
        currentTime: Math.max(0, state.currentTime),
        muted: state.muted,
    });
}

export function consumeFeedVideoHandoff(postId: string): FeedVideoHandoff | undefined {
    const key = String(postId);
    const value = handoffByPostId.get(key);
    handoffByPostId.delete(key);
    return value;
}
