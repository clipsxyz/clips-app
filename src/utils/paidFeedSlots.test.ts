import { describe, expect, it } from 'vitest';
import type { Post } from '../types';
import type { FeedStreamRow } from './feedStreamInjection';
import { blendPaidFeedRows, placeSponsoredStory } from './paidFeedSlots';
import type { Stories24RailItem } from './stories24Rail';

function post(id: string): Post {
    return {
        id,
        userId: id,
        userHandle: `${id}@town`,
        createdAt: 1,
        stats: { likes: 0, views: 0, comments: 0, shares: 0, reclips: 0 },
        isBookmarked: false,
        isFollowing: false,
        userLiked: false,
    } as Post;
}

function rows(ids: string[]): FeedStreamRow[] {
    return ids.map((id) => ({ type: 'post' as const, item: post(id), createdAt: 1 }));
}

function ids(list: FeedStreamRow[]): string[] {
    return list.filter((row) => row.type === 'post').map((row) => String(row.item.id));
}

describe('blendPaidFeedRows', () => {
    it('puts a paid post third on a location feed and again after four organic posts', () => {
        const organic = rows(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
        const paid = [post('p1'), post('p2')];
        expect(ids(blendPaidFeedRows(organic, paid, 'location'))).toEqual([
            'a', 'b', 'p1', 'c', 'd', 'e', 'f', 'p2', 'g', 'h',
        ]);
    });

    it('waits for four organic posts on Following, then six between paid posts', () => {
        const organic = rows(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']);
        const paid = [post('p1'), post('p2')];
        expect(ids(blendPaidFeedRows(organic, paid, 'following'))).toEqual([
            'a', 'b', 'c', 'd', 'p1', 'e', 'f', 'g', 'h', 'i', 'j', 'p2', 'k',
        ]);
    });

    it('shows a boosted post once, in the paid slot', () => {
        const organic = rows(['a', 'b', 'p1', 'c']);
        const paid = [{ ...post('p1'), isBoosted: true }];
        expect(ids(blendPaidFeedRows(organic, paid, 'location'))).toEqual(['a', 'b', 'p1', 'c']);
    });

    it('leaves the organic list alone when nothing is eligible', () => {
        const organic = rows(['a', 'b', 'c']);
        expect(blendPaidFeedRows(organic, [], 'location')).toBe(organic);
    });
});

describe('placeSponsoredStory', () => {
    it('sits after your story and one other, labeled Sponsored', () => {
        const items: Stories24RailItem[] = [
            { handle: '__add_yours__', title: 'Add yours' },
            { handle: 'me', title: 'Mine' },
            { handle: 'friend', title: 'Friend' },
            { handle: 'cafe', title: 'Cafe', storyId: 'story-1' },
        ];
        const next = placeSponsoredStory(items, {
            handle: 'cafe',
            title: 'Cafe',
            storyId: 'story-1',
            boostId: 9,
        });
        expect(next.map((item) => item.handle)).toEqual(['__add_yours__', 'me', 'friend', 'cafe']);
        expect(next[3].subtitle).toBe('Sponsored');
        expect(next[3].sponsored).toBe(true);
        expect(next[3].boostId).toBe(9);
    });
});
