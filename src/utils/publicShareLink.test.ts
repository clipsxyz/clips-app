import { describe, expect, it } from 'vitest';
import { parsePublicShareLink } from './publicShareLink';

describe('parsePublicShareLink', () => {
    it('parses a public post token URL', () => {
        expect(parsePublicShareLink('https://clips.app/p/AbC123xyZ')).toEqual({
            kind: 'post',
            token: 'AbC123xyZ',
        });
    });

    it('parses a /post/:id fallback URL', () => {
        expect(parsePublicShareLink('/post/post-uuid-1')).toEqual({
            kind: 'post',
            postId: 'post-uuid-1',
        });
    });

    it('parses a story share query used by WhatsApp links', () => {
        expect(parsePublicShareLink('https://clips.app/stories?user=John%40Dublin&story=story-1')).toEqual({
            kind: 'story',
            handle: 'John@Dublin',
            storyId: 'story-1',
        });
    });

    it('parses a React Navigation path + search separately', () => {
        expect(parsePublicShareLink('stories', '?user=Ava@galway&story=abc')).toEqual({
            kind: 'story',
            handle: 'Ava@galway',
            storyId: 'abc',
        });
    });

    it('returns null for feed and other app paths', () => {
        expect(parsePublicShareLink('/feed')).toBeNull();
        expect(parsePublicShareLink('/stories')).toBeNull();
        expect(parsePublicShareLink('https://clips.app/profile')).toBeNull();
    });
});
