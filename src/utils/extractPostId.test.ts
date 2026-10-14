import { describe, expect, it } from 'vitest';
import { extractPostId, extractSharedPostRef, sharedPostRefKey } from './extractPostId';

describe('extractPostId', () => {
    it('extracts a uuid from a /post/<id> url', () => {
        expect(extractPostId('https://clips.app/post/2f1c9b7a-1a2b-4c3d-8e4f-5a6b7c8d9e0f')).toBe(
            '2f1c9b7a-1a2b-4c3d-8e4f-5a6b7c8d9e0f',
        );
    });

    it('returns null when no post id is present', () => {
        expect(extractPostId('hey there')).toBeNull();
    });
});

describe('extractSharedPostRef', () => {
    it('prefers a /p/<token> public link', () => {
        expect(extractSharedPostRef('https://clips.app/p/AbC123xyZ')).toEqual({
            token: 'AbC123xyZ',
        });
    });

    it('falls back to a /post/<id> link', () => {
        expect(
            extractSharedPostRef(
                'https://clips.app/post/2f1c9b7a-1a2b-4c3d-8e4f-5a6b7c8d9e0f',
            ),
        ).toEqual({ postId: '2f1c9b7a-1a2b-4c3d-8e4f-5a6b7c8d9e0f' });
    });

    it('parses a token link embedded in surrounding text', () => {
        expect(extractSharedPostRef('check this out https://clips.app/p/tok_123-abc now')).toEqual(
            { token: 'tok_123-abc' },
        );
    });

    it('returns null for plain text', () => {
        expect(extractSharedPostRef('just a message')).toBeNull();
    });
});

describe('sharedPostRefKey', () => {
    it('namespaces token and post id keys', () => {
        expect(sharedPostRefKey({ token: 'abc' })).toBe('token:abc');
        expect(sharedPostRefKey({ postId: 'abc' })).toBe('post:abc');
    });
});
