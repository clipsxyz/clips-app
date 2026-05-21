import { describe, expect, it } from 'vitest';
import type { Post } from '../types';
import { filterPostsByContentPrefs, shouldFilterFeedPost } from './feedContentPrefsCore';

const basePost = (id: string, handle: string): Post =>
    ({
        id,
        userHandle: handle,
        text: '',
        stats: { likes: 0, comments: 0, shares: 0, views: 0, reclips: 0 },
    }) as Post;

describe('feedContentPrefsMobile', () => {
    it('filters muted authors', () => {
        const prefs = {
            mutedHandles: new Set(['alice']),
            blockedHandles: new Set<string>(),
            hiddenPostIds: new Set<string>(),
            notInterestedPostIds: new Set<string>(),
        };
        expect(shouldFilterFeedPost(basePost('1', '@alice'), prefs)).toBe(true);
        expect(shouldFilterFeedPost(basePost('2', '@bob'), prefs)).toBe(false);
    });

    it('filters hidden and not-interested posts', () => {
        const prefs = {
            mutedHandles: new Set<string>(),
            blockedHandles: new Set<string>(),
            hiddenPostIds: new Set(['p1']),
            notInterestedPostIds: new Set(['p2']),
        };
        const list = [
            basePost('p1', '@a'),
            basePost('p2', '@b'),
            basePost('p3', '@c'),
        ];
        expect(filterPostsByContentPrefs(list, prefs).map((p) => p.id)).toEqual(['p3']);
    });
});
