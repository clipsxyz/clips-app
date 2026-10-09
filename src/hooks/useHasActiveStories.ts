import { useEffect, useRef, useState } from 'react';
import { userHasStoriesByHandle, userHasUnviewedStoriesByHandle } from '../api/stories';

export interface UseHasActiveStoriesOptions {
    /** Viewing user id; lets the endpoint report has_viewed so the unviewed ring is accurate. */
    viewerId?: string;
    /** Own profile: ring means "has any stories". Others: ring means "has unviewed stories". */
    isCurrentUser?: boolean;
    /** Raw "has any story" result, consumed by feed menus. Read through a ref — identity changes must not re-trigger the probe effect. */
    onHasStoryChange?: (hasStory: boolean) => void;
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
    { viewerId, isCurrentUser = false, onHasStoryChange }: UseHasActiveStoriesOptions = {},
): boolean {
    const [hasStory, setHasStory] = useState(false);
    const onHasStoryChangeRef = useRef(onHasStoryChange);
    onHasStoryChangeRef.current = onHasStoryChange;
    const hasStoryRef = useRef(false);
    const reportedRef = useRef<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function checkStory() {
            const anyStory = await userHasStoriesByHandle(handle, viewerId);
            const ring =
                isCurrentUser
                    ? anyStory
                    : await userHasUnviewedStoriesByHandle(handle, viewerId);
            if (cancelled) return;
            if (ring !== hasStoryRef.current) {
                hasStoryRef.current = ring;
                setHasStory(ring);
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

    return hasStory;
}