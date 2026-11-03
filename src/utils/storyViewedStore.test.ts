import { beforeEach, describe, expect, it } from 'vitest';
import {
    bindStoryViewedUser,
    getStoryViewedVersion,
    hasUnseenStory,
    isHandleStoryRingSeen,
    isStoryMarkedViewed,
    markStoryAsViewed,
    rememberUnseenStory,
    resetStoryViewedStore,
    storyHasViewed,
    subscribeStoryViewed,
} from './storyViewedStore';

describe('storyViewedStore', () => {
    beforeEach(() => {
        resetStoryViewedStore();
    });

    it('marks a story viewed and notifies subscribers', () => {
        const seen: number[] = [];
        const unsub = subscribeStoryViewed(() => seen.push(getStoryViewedVersion()));
        const before = getStoryViewedVersion();
        markStoryAsViewed('story-a', 'Alice@Dublin');
        unsub();
        expect(isStoryMarkedViewed('story-a')).toBe(true);
        expect(isHandleStoryRingSeen('alice@dublin')).toBe(true);
        expect(storyHasViewed({ id: 'story-a', hasViewed: false })).toBe(true);
        expect(getStoryViewedVersion()).toBeGreaterThan(before);
        expect(seen.length).toBeGreaterThan(0);
    });

    it('hasUnseenStory is true only until markStoryAsViewed for that handle', () => {
        rememberUnseenStory('bob@cork', true);
        expect(hasUnseenStory('Bob@Cork')).toBe(true);

        const seen: number[] = [];
        const unsub = subscribeStoryViewed(() => seen.push(getStoryViewedVersion()));
        markStoryAsViewed('story-b', 'bob@cork');
        unsub();

        expect(hasUnseenStory('bob@cork')).toBe(false);
        expect(hasUnseenStory('someone-else@dublin')).toBe(false);
        expect(seen.length).toBeGreaterThan(0);
    });

    it('does not restore an unseen ring after the handle was marked seen', () => {
        markStoryAsViewed('story-c', 'cara@galway');
        rememberUnseenStory('cara@galway', true);
        expect(hasUnseenStory('cara@galway')).toBe(false);
    });

    it('does not treat every Gazetteer@ place as the same watched story', () => {
        rememberUnseenStory('Gazetteer@Cork', true);
        markStoryAsViewed('story-dublin', 'Gazetteer@Dublin');
        expect(isHandleStoryRingSeen('Gazetteer@Dublin')).toBe(true);
        expect(isHandleStoryRingSeen('Gazetteer@Cork')).toBe(false);
        expect(hasUnseenStory('Gazetteer@Cork')).toBe(true);
    });

    it('drops another account’s watched stories when a different person signs in', () => {
        bindStoryViewedUser('user-a');
        markStoryAsViewed('story-g', 'Gazetteer@Dublin');
        expect(isHandleStoryRingSeen('Gazetteer@Dublin')).toBe(true);
        bindStoryViewedUser('user-debs');
        expect(isStoryMarkedViewed('story-g')).toBe(false);
        expect(isHandleStoryRingSeen('Gazetteer@Dublin')).toBe(false);
    });

    it('drops the ring on inbox/feed handles that share the same username', () => {
        rememberUnseenStory('Barry@Galway', true);
        expect(hasUnseenStory('barry')).toBe(true);
        markStoryAsViewed('story-d', 'Barry');
        expect(hasUnseenStory('Barry@Galway')).toBe(false);
        expect(isHandleStoryRingSeen('barry@galway')).toBe(true);
        rememberUnseenStory('Barry@Galway', true);
        expect(hasUnseenStory('Barry@Galway')).toBe(false);
    });
});
