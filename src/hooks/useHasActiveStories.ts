import { useEffect, useRef, useState } from 'react';
import { userHasStoriesByHandle, userHasUnviewedStoriesByHandle } from '../api/stories';
import { storyRingState } from '../utils/storyRingNative';
import type { StoryRingState } from '../utils/storyRingNative';

export interface UseHasActiveStoriesOptions {
    /** Viewing user id; lets the endpoint report has_viewed so the unviewed ring is accurate. */
    viewerId?: string;
    /** Own profile: ring means "has any stories". Others: ring means "has unviewed stories". */
    isCurrentUser?: boolean;
    /** Raw "has any story" result, consumed by feed menus. Read through a ref — identity changes must not re-trigger the probe effect. */
    onHasStoryChange?: (hasStory: boolean) => void;
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
    { viewerId, isCurrentUser = false, onHasStoryChange }: UseHasActiveStoriesOptions,
): StoryRingResult {
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
    }, [handle, viewerId, isCurrentUser]);

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
