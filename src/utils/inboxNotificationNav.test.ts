import { describe, expect, it, vi } from 'vitest';
import {
    extractNotificationActorHandle,
    extractNotificationPostId,
    resolveInboxNotificationRoute,
} from './inboxNotificationNav';

describe('inbox notification tap routing', () => {
    it('opens PostDetail for legacy dm likes using nested post_id JSON', () => {
        const route = resolveInboxNotificationRoute({
            type: 'dm',
            message: 'Sarah@Artane liked your post',
            fromHandle: 'Sarah@Artane',
            data: JSON.stringify({ post_id: 'post-123', target_id: 'ignored' }),
        });
        expect(extractNotificationPostId({
            type: 'dm',
            data: '{"post_id":"post-123"}',
        })).toBe('post-123');
        expect(route).toEqual({
            dest: 'post',
            postId: 'post-123',
            openComments: false,
            focusCommentId: undefined,
        });
    });

    it('opens PostDetail comments for commented body', () => {
        const route = resolveInboxNotificationRoute({
            type: 'dm',
            message: 'Barry@Dublin commented on your post',
            postId: 'clip-9',
            commentId: 'c-1',
            fromHandle: 'Barry@Dublin',
        });
        expect(route).toEqual({
            dest: 'post',
            postId: 'clip-9',
            openComments: true,
            focusCommentId: 'c-1',
        });
    });

    it('opens ViewProfile for follow copy', () => {
        expect(extractNotificationActorHandle({
            type: 'dm',
            message: 'Alex@Cork started following you',
            data: { sender_id: 'Alex@Cork' },
        })).toBe('Alex@Cork');
        expect(resolveInboxNotificationRoute({
            type: 'dm',
            message: 'Alex@Cork started following you',
            fromHandle: 'Alex@Cork',
        })).toEqual({ dest: 'profile', handle: 'Alex@Cork' });
    });

    it('warns and falls back to profile when like has no post id', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const route = resolveInboxNotificationRoute({
            id: 'n1',
            type: 'like',
            message: 'liked your post',
            fromHandle: 'Gazetteer@Dublin',
        });
        expect(route).toEqual({ dest: 'profile', handle: 'Gazetteer@Dublin' });
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
