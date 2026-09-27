import { describe, expect, it } from 'vitest';
import type { Post } from '../types';
import {
    resolveViewerStartIndex,
    resolveViewerStartPost,
    shouldDeferViewabilityActivation,
} from './profilePostsViewerIndex';

function post(id: string, kind: 'video' | 'photo' | 'text'): Post {
    return {
        id,
        mediaUrl: kind === 'text' ? null : `https://cdn.test/${id}.${kind === 'video' ? 'mp4' : 'jpg'}`,
        text: kind === 'text' ? 'hello' : '',
    } as unknown as Post;
}

const hasVideo = (p: Post) => Boolean(p.mediaUrl && p.mediaUrl.endsWith('.mp4'));

describe('resolveViewerStartIndex', () => {
    it('finds the tapped post inside the list the viewer renders', () => {
        const posts = [post('1', 'video'), post('2', 'photo'), post('3', 'video')];
        expect(resolveViewerStartIndex(posts, '3')).toBe(2);
    });

    it('maps into the filtered list, not the raw parent list', () => {
        // Raw profile order interleaves media types; the grid only shows videos.
        const raw = [post('1', 'video'), post('2', 'photo'), post('3', 'video')];
        const filtered = [post('1', 'video'), post('3', 'video')];
        // Tapping the 2nd grid thumbnail is index 1 of filtered, but index 2 of raw.
        expect(resolveViewerStartIndex(filtered, '3')).toBe(1);
        expect(resolveViewerStartIndex(raw, '3')).toBe(2);
    });

    it('compares ids as strings so numeric and string ids both match', () => {
        const posts = [{ id: 42 } as unknown as Post];
        expect(resolveViewerStartIndex(posts, '42')).toBe(0);
    });

    it('returns 0 without a tapped id when the list is non-empty', () => {
        expect(resolveViewerStartIndex([post('1', 'video')], null)).toBe(0);
    });

    it('returns -1 for an empty list', () => {
        expect(resolveViewerStartIndex([], null)).toBe(-1);
    });

    it('returns -1 when the tapped id is absent so callers can fall back', () => {
        expect(resolveViewerStartIndex([post('1', 'video')], 'missing')).toBe(-1);
    });
});

describe('resolveViewerStartPost', () => {
    it('activates the tapped post', () => {
        const posts = [post('1', 'video'), post('2', 'video')];
        expect(resolveViewerStartPost(posts, '2', hasVideo)?.id).toBe('2');
    });

    it('falls through to the first video when the tapped post has no video', () => {
        const posts = [post('1', 'video'), post('2', 'photo')];
        expect(resolveViewerStartPost(posts, '2', hasVideo)?.id).toBe('1');
    });

    it('returns null when the list has no playable video', () => {
        const posts = [post('1', 'photo'), post('2', 'text')];
        expect(resolveViewerStartPost(posts, '1', hasVideo)).toBeNull();
    });

    it('returns null for an empty list', () => {
        expect(resolveViewerStartPost([], '1', hasVideo)).toBeNull();
    });
});

describe('shouldDeferViewabilityActivation', () => {
    it('defers while the first-rendered card is reported before the scroll lands', () => {
        // This is the wrong-video bug: list renders index 0 first, viewability fires.
        expect(shouldDeferViewabilityActivation('30', '1')).toBe(true);
    });

    it('releases the hold once viewability agrees with the tapped post', () => {
        expect(shouldDeferViewabilityActivation('30', '30')).toBe(false);
    });

    it('defers when nothing is viewable yet', () => {
        expect(shouldDeferViewabilityActivation('30', null)).toBe(true);
    });

    it('does not defer when there is no pending start (normal swiping)', () => {
        expect(shouldDeferViewabilityActivation(null, '1')).toBe(false);
        expect(shouldDeferViewabilityActivation(null, null)).toBe(false);
    });
});
