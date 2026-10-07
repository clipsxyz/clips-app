import { describe, expect, it } from 'vitest';
import {
    STORIES24_ADD_YOURS_HANDLE,
    STORIES24_RAIL_MAX_CARDS,
    rankStories24RailItems,
    type Stories24RailItem,
} from './stories24Rail';

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
