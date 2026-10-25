/**
 * Instagram-style avatar ring states, driven by the viewer's relationship to a handle's
 * active stories.
 *
 * - `unseen` — the handle has active stories the viewer has NOT watched: the ring is drawn
 *   in solid white so it reads as "new".
 * - `seen`   — the handle has active stories but the viewer has watched them all: the ring
 *   is muted grey, so it recedes without disappearing.
 * - `none`   — no active stories: the ring is hidden (or drawn as a faint idle outline).
 *
 * Kept free of React Native imports so it can be unit-tested in a bare Node/jsdom
 * environment (importing `Avatar.native` would pull in the native module chain).
 */
export type StoryRingState = 'unseen' | 'seen' | 'none';

/** Unseen ring: solid white (new stories). */
export const STORY_RING_UNSEEN_COLOR = '#FFFFFF';
/** Seen ring: iOS-style muted grey (all stories viewed). */
export const STORY_RING_SEEN_COLOR = '#8E8E93';
/** No-stories ring: the faint idle outline used for plain avatars. Mirrors `AVATAR_IDLE_BORDER_COLOR`. */
export const STORY_RING_NONE_COLOR = 'rgba(255, 255, 255, 0.15)';

/** Inbox header + newsfeed Stories cards: cyan → sky → magenta. */
export const STORY_GRADIENT_RING_COLORS = ['#2DD4BF', '#0EA5E9', '#D946EF'] as const;
export const STORY_GRADIENT_RING_START = { x: 0, y: 1 } as const;
export const STORY_GRADIENT_RING_END = { x: 1, y: 0 } as const;

/** Ring thickness — matches the newsfeed header avatar stroke. */
export const STORY_RING_WIDTH = 0.75;
/** Transparent standoff between the ring and the photo — matches the newsfeed header. */
export const STORY_RING_GAP = 2.5;

export function storyRingState(input: { any: boolean; unviewed: boolean }): StoryRingState {
    if (!input.any) return 'none';
    return input.unviewed ? 'unseen' : 'seen';
}

export function storyRingColor(state: StoryRingState): string {
    switch (state) {
        case 'unseen':
            return STORY_RING_UNSEEN_COLOR;
        case 'seen':
            return STORY_RING_SEEN_COLOR;
        case 'none':
        default:
            return STORY_RING_NONE_COLOR;
    }
}

/** Whether a ring should be painted at all. `none` collapses to the idle outline. */
export function storyRingVisible(state: StoryRingState): boolean {
    return state !== 'none';
}
