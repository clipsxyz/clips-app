import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { userHasStoriesByHandle, userHasUnviewedStoriesByHandle } from '../api/stories';
import { storyRingState } from '../utils/storyRingNative';
import type { StoryRingState } from '../utils/storyRingNative';
import {
    getStoryViewedVersion,
    hasUnseenStory as hasUnseenStoryFromStore,
    isHandleStoryRingSeen,
    rememberUnseenStory,
    subscribeStoryViewed,
} from '../utils/storyViewedStore';

export interface UseHasActiveStoriesOptions {
    /** Viewing user id; lets the endpoint report has_viewed so the unviewed ring is accurate. */
    viewerId?: string;
    /** Own profile: ring means "has any stories". Others: ring means "has unviewed stories". */
    isCurrentUser?: boolean;
    /** Raw "has any story" result, consumed by feed menus. Read through a ref — identity changes must not re-trigger the probe effect. */
    onHasStoryChange?: (hasStory: boolean) => void;
    /** When false, skip the network probe (inbox rows already know unseen from the thread list). */
    enabled?: boolean;
    /** Optimistic unseen from a conversation/list payload until the probe (or a view) settles. */
    initialUnseen?: boolean;
}

export interface StoryRingResult {
    /** Three-state ring: unseen (white) / seen (grey) / none. */
    state: StoryRingState;
    /** True when the handle has any active story. */
    hasStory: boolean;
    /** True when the viewer has not watched every active story. */
    hasUnviewed: boolean;
}

/** Shared probe body: answers "has any" + "has unviewed" from one cached request pair. */
function useStoryProbe(
    handle: string,
    { viewerId, isCurrentUser = false, onHasStoryChange, enabled = true }: UseHasActiveStoriesOptions,
): StoryRingResult {
    useSyncExternalStore(subscribeStoryViewed, getStoryViewedVersion);
    const handleSeen = isHandleStoryRingSeen(handle);
    const [result, setResult] = useState<StoryRingResult>({
        state: 'none',
        hasStory: false,
        hasUnviewed: false,
    });
    const onHasStoryChangeRef = useRef(onHasStoryChange);
    onHasStoryChangeRef.current = onHasStoryChange;
    const resultRef = useRef<StoryRingResult>(result);
    const reportedRef = useRef<boolean | null>(null);

    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        async function checkStory() {
            const anyStory = await userHasStoriesByHandle(handle, viewerId);
            const unviewed = isCurrentUser
                ? anyStory
                : await userHasUnviewedStoriesByHandle(handle, viewerId);
            if (cancelled) return;
            const next: StoryRingResult = {
                state: storyRingState({ any: anyStory, unviewed }),
                hasStory: anyStory,
                hasUnviewed: unviewed,
            };
            const prev = resultRef.current;
            if (
                prev.hasStory !== next.hasStory ||
                prev.hasUnviewed !== next.hasUnviewed ||
                prev.state !== next.state
            ) {
                resultRef.current = next;
                setResult(next);
            }
            if (anyStory !== reportedRef.current) {
                reportedRef.current = anyStory;
                onHasStoryChangeRef.current?.(anyStory);
            }
        }
        checkStory();
        return () => {
            cancelled = true;
        };
    }, [handle, viewerId, isCurrentUser, enabled, handleSeen]);

    if (handleSeen && result.hasStory) {
        return {
            ...result,
            hasUnviewed: false,
            state: storyRingState({ any: true, unviewed: false }),
        };
    }
    return result;
}

/**
 * Full story-ring state for the feed header / profile hero. Prefer this over
 * `useHasActiveStories` when the ring must distinguish unseen vs seen.
 */
export function useStoryRingState(
    handle: string,
    options: UseHasActiveStoriesOptions = {},
): StoryRingResult {
    return useStoryProbe(handle, options);
}

/**
 * Rings/menus that depend on "does {handle} have active stories".
 *
 * This answers from one cached probe (see STORY_PROBE_TTL_MS) instead of two
 * uncached round-trips per card, and it never restarts the probe from a render cycle:
 * the callback is read through a ref (so an unstable `onHasStoryChange` identity is
 * harmless) and both state and the callback are only updated when the reported value
 * actually changed. Without that guard an inline callback in the parent turns every
 * render into a network round-trip and a state write — the classic "Maximum update
 * depth exceeded" driver.
 */
export function useHasActiveStories(
    handle: string,
    options: UseHasActiveStoriesOptions = {},
): boolean {
    const { isCurrentUser = false } = options;
    const result = useStoryProbe(handle, options);
    // Preserve the historical contract: own profile rings on "any story", others ring on
    // "unviewed story". New callers that need the distinction use `useStoryRingState`.
    return isCurrentUser ? result.hasStory : result.hasUnviewed;
}

/**
 * Shared unseen-story getter for every avatar ring (feed header, inbox, rail).
 * Equivalent to `useStoriesStore(s => s.hasUnseenStory(userId))`.
 * Returns true only while this author has active stories the viewer has not opened.
 */
export function useHasUnseenStory(
    userIdOrHandle: string,
    options: UseHasActiveStoriesOptions = {},
): boolean {
    const { enabled = true, initialUnseen = false } = options;
    const viewedVersion = useSyncExternalStore(subscribeStoryViewed, getStoryViewedVersion);
    const ring = useStoryProbe(userIdOrHandle, options);
    useEffect(() => {
        if (!userIdOrHandle) return;
        if (isHandleStoryRingSeen(userIdOrHandle)) {
            rememberUnseenStory(userIdOrHandle, false);
            return;
        }
        if (initialUnseen) {
            rememberUnseenStory(userIdOrHandle, true);
        }
        if (!enabled) return;
        if (ring.hasUnviewed) {
            rememberUnseenStory(userIdOrHandle, true);
        } else if (ring.hasStory) {
            rememberUnseenStory(userIdOrHandle, false);
        }
    }, [userIdOrHandle, enabled, initialUnseen, ring.hasUnviewed, ring.hasStory, viewedVersion]);

    if (isHandleStoryRingSeen(userIdOrHandle)) return false;
    if (hasUnseenStoryFromStore(userIdOrHandle)) return true;
    // Feed cards: never keep a gradient from a stale probe after the author was marked seen.
    // Inbox rows (probe off) may show `initialUnseen` until the store is seeded.
    if (!enabled) return !!initialUnseen;
    return false;
}
