/** Playback state when opening Scenes from the feed (web `videoTimesMap` / `videoMutedMap` parity). */
export type FeedVideoHandoff = {
    currentTime: number;
    muted: boolean;
    /** True when returning from Scenes (seek resume; do not remount the player). */
    fromScenes?: boolean;
};

const handoffByPostId = new Map<string, FeedVideoHandoff>();

export function setFeedVideoHandoff(postId: string, state: FeedVideoHandoff): void {
    if (!postId) return;
    handoffByPostId.set(String(postId), {
        currentTime: Math.max(0, state.currentTime),
        muted: state.muted,
        fromScenes: state.fromScenes === true,
    });
}

export function consumeFeedVideoHandoff(postId: string): FeedVideoHandoff | undefined {
    const key = String(postId);
    const value = handoffByPostId.get(key);
    handoffByPostId.delete(key);
    return value;
}

/** Non-destructive read (e.g. open Scenes with current time without clearing resume state). */
export function peekFeedVideoHandoff(postId: string): FeedVideoHandoff | undefined {
    return handoffByPostId.get(String(postId));
}
