import { describe, expect, it } from 'vitest';
import {
    notificationKindIonicon,
    notificationKindLabel,
    resolveNotificationKind,
} from './notificationKind';

describe('legacy DM body fallback', () => {
    it('maps liked your post to Like + heart', () => {
        const item = { type: 'dm', message: 'Sarah@Artane liked your post' };
        expect(resolveNotificationKind(item)).toBe('like');
        expect(notificationKindLabel(item)).toBe('Like');
        expect(notificationKindIonicon(item)).toBe('heart');
    });

    it('maps reclipped your post to Reclip + repeat', () => {
        const item = { type: 'dm', body: 'Gazetteer@Cork reclipped your post' };
        expect(resolveNotificationKind(item)).toBe('reclip');
        expect(notificationKindLabel(item)).toBe('Reclip');
        expect(notificationKindIonicon(item)).toBe('repeat');
    });

    it('maps shared your post to Share', () => {
        const item = { type: 'dm', message: 'Barry@Dublin shared your post' };
        expect(resolveNotificationKind(item)).toBe('share');
        expect(notificationKindLabel(item)).toBe('Share');
        expect(notificationKindIonicon(item)).toBe('share-outline');
    });

    it('maps commented text to Comment', () => {
        const item = { type: 'dm', message: 'Nice clip — commented on your post' };
        expect(resolveNotificationKind(item)).toBe('comment');
        expect(notificationKindLabel(item)).toBe('Comment');
        expect(notificationKindIonicon(item)).toBe('chatbubble-ellipses');
    });

    it('keeps real DMs as DM', () => {
        const item = { type: 'dm', message: 'Hey, are you around?' };
        expect(resolveNotificationKind(item)).toBe('dm');
        expect(notificationKindLabel(item)).toBe('DM');
        expect(notificationKindIonicon(item)).toBe('chatbubble');
    });
});
