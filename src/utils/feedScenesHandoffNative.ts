/** Playback state when opening Scenes from the feed (web `videoTimesMap` / `videoMutedMap` parity). */
export type FeedVideoHandoff = {
    currentTime: number;
    muted: boolean;
    /** True when returning from Scenes (seek resume; do not remount the player). */
    fromScenes?: boolean;
    /** Playback URI at handoff — Scenes reads this if nav params drop mediaUrl. */
    mediaUrl?: string;
};

const handoffByPostId = new Map<string, FeedVideoHandoff>();

export function setFeedVideoHandoff(postId: string, state: FeedVideoHandoff): void {
    if (!postId) return;
    const key = String(postId);
    const existing = handoffByPostId.get(key);
    // Remounted feed ExoPlayer reports t≈0 before seek — never clobber a Scenes return time.
    if (
        existing?.fromScenes &&
        !state.fromScenes &&
        Number(state.currentTime) + 0.45 < Number(existing.currentTime)
    ) {
        return;
    }
    handoffByPostId.set(key, {
        currentTime: Math.max(0, state.currentTime),
        muted: state.muted,
        fromScenes: state.fromScenes === true,
        mediaUrl: state.mediaUrl ?? existing?.mediaUrl,
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

/**
 * Post written by Scenes on close (`fromScenes: true`). Feed focus must resume this id,
 * not the sticky pre-Scenes autoplay target.
 */
export function peekScenesReturnHandoff():
    | { postId: string; handoff: FeedVideoHandoff }
    | undefined {
    for (const [postId, handoff] of handoffByPostId) {
        if (handoff.fromScenes) return { postId, handoff };
    }
    return undefined;
}
