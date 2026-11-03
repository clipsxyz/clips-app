import { describe, expect, it } from 'vitest';
import {
    STORIES24_ADD_YOURS_HANDLE,
    STORIES24_RAIL_MAX_CARDS,
    orderStories24RailItems,
    orderStoryGroupsLikeRail,
    rankStories24RailItems,
    type Stories24RailItem,
} from './stories24Rail';
import { markStoryAsViewed, resetStoryViewedStore } from './storyViewedStore';

const card = (handle: string): Stories24RailItem => ({ handle, title: `Story ${handle}` });

const cards = (count: number, prefix = 'user') =>
    Array.from({ length: count }, (_, i) => card(`${prefix}${i}`));

describe('rankStories24RailItems', () => {
    it('caps the rail at 9 story cards and ranks them 0..8', () => {
        const ranked = rankStories24RailItems(cards(12));
        expect(ranked).toHaveLength(STORIES24_RAIL_MAX_CARDS);
        expect(ranked.map((r) => r.item.handle)).toEqual(
            Array.from({ length: 9 }, (_, i) => `user${i}`),
        );
        expect(ranked.map((r) => r.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('keeps Add yours visible and unranked without spending a rank slot', () => {
        const items = [card(STORIES24_ADD_YOURS_HANDLE), ...cards(12)];
        const ranked = rankStories24RailItems(items);
        expect(ranked[0]).toEqual({ item: items[0], index: null });
        expect(ranked).toHaveLength(STORIES24_RAIL_MAX_CARDS + 1);
        expect(ranked[1].item.handle).toBe('user0');
        expect(ranked[9].item.handle).toBe('user8');
        expect(ranked.some((r) => r.item.handle === 'user9')).toBe(false);
    });

    it('preserves rail order for lists shorter than the cap', () => {
        const items = cards(4);
        expect(rankStories24RailItems(items).map((r) => r.item.handle)).toEqual([
            'user0',
            'user1',
            'user2',
            'user3',
        ]);
        expect(rankStories24RailItems(items).map((r) => r.index)).toEqual([0, 1, 2, 3]);
    });

    it('handles empty input and an Add-yours-only rail', () => {
        expect(rankStories24RailItems([])).toEqual([]);
        expect(rankStories24RailItems([card(STORIES24_ADD_YOURS_HANDLE)])).toEqual([
            { item: card(STORIES24_ADD_YOURS_HANDLE), index: null },
        ]);
    });
});

describe('orderStories24RailItems', () => {
    it('keeps your story first, then unwatched, then watched', () => {
        const items = [
            card('me'),
            { ...card('ann'), hasViewed: true },
            card('ben'),
            { ...card('cara'), hasViewed: true },
            card('dan'),
        ];
        expect(orderStories24RailItems(items, 'me').map((item) => item.handle)).toEqual([
            'me',
            'ben',
            'dan',
            'ann',
            'cara',
        ]);
    });

    it('keeps your own story first after you have watched it', () => {
        const items = [
            { ...card('me'), hasViewed: true },
            card('ben'),
            { ...card('ann'), hasViewed: true },
        ];
        expect(orderStories24RailItems(items, '@Me').map((item) => item.handle)).toEqual([
            'me',
            'ben',
            'ann',
        ]);
    });

    it('moves a story to the back once its ring is seen, without reshuffling the others', () => {
        resetStoryViewedStore();
        markStoryAsViewed('story-ben', 'ben');
        const items = [card('ann'), card('ben'), card('cara')];
        expect(orderStories24RailItems(items).map((item) => item.handle)).toEqual([
            'ann',
            'cara',
            'ben',
        ]);
        resetStoryViewedStore();
    });

    it('pulls an account forward when they post a story you have not watched', () => {
        resetStoryViewedStore();
        markStoryAsViewed('ben-old', 'ben');
        const items = [
            { ...card('ann'), hasViewed: true, storyId: 'ann-1', storyIds: ['ann-1'] },
            { ...card('ben'), hasViewed: false, storyId: 'ben-new', storyIds: ['ben-old', 'ben-new'] },
            card('cara'),
        ];
        expect(orderStories24RailItems(items).map((item) => item.handle)).toEqual([
            'ben',
            'cara',
            'ann',
        ]);
        resetStoryViewedStore();
    });

    it('leaves Add yours ahead of the story line', () => {
        const items = [
            card('ann'),
            card(STORIES24_ADD_YOURS_HANDLE),
            { ...card('ben'), hasViewed: true },
        ];
        expect(orderStories24RailItems(items, 'me').map((item) => item.handle)).toEqual([
            STORIES24_ADD_YOURS_HANDLE,
            'ann',
            'ben',
        ]);
    });
});

describe('orderStoryGroupsLikeRail', () => {
    const group = (userHandle: string, viewed: boolean) => ({
        userHandle,
        stories: [{ id: `${userHandle}-1`, hasViewed: viewed }],
    });

    it('orders inbox authors the same way as the feed rail', () => {
        const groups = [
            group('ann', true),
            group('me', true),
            group('ben', false),
            group('cara', true),
        ];
        expect(orderStoryGroupsLikeRail(groups, 'me').map((row) => row.userHandle)).toEqual([
            'me',
            'ben',
            'ann',
            'cara',
        ]);
    });
});
