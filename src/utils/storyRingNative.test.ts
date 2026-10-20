import { describe, it, expect } from 'vitest';
import {
    STORY_RING_NONE_COLOR,
    STORY_RING_SEEN_COLOR,
    STORY_RING_UNSEEN_COLOR,
    storyRingColor,
    storyRingState,
    storyRingVisible,
} from './storyRingNative';

describe('storyRingState', () => {
    it('is none when the handle has no active stories', () => {
        expect(storyRingState({ any: false, unviewed: false })).toBe('none');
        // unviewed can't be true without any; treat as none if inconsistent.
        expect(storyRingState({ any: false, unviewed: true })).toBe('none');
    });

    it('is unseen when there are unviewed stories', () => {
        expect(storyRingState({ any: true, unviewed: true })).toBe('unseen');
    });

    it('is seen when all stories have been viewed', () => {
        expect(storyRingState({ any: true, unviewed: false })).toBe('seen');
    });
});

describe('storyRingColor', () => {
    it('maps unseen to white', () => {
        expect(storyRingColor('unseen')).toBe(STORY_RING_UNSEEN_COLOR);
        expect(STORY_RING_UNSEEN_COLOR).toBe('#FFFFFF');
    });

    it('maps seen to muted grey', () => {
        expect(storyRingColor('seen')).toBe(STORY_RING_SEEN_COLOR);
        expect(STORY_RING_SEEN_COLOR).toBe('#8E8E93');
    });

    it('maps none to the faint idle outline', () => {
        expect(storyRingColor('none')).toBe(STORY_RING_NONE_COLOR);
    });
});

describe('storyRingVisible', () => {
    it('is true for unseen and seen, false for none', () => {
        expect(storyRingVisible('unseen')).toBe(true);
        expect(storyRingVisible('seen')).toBe(true);
        expect(storyRingVisible('none')).toBe(false);
    });
});
