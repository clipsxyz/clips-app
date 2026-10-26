import { describe, expect, it } from 'vitest';
import {
    effectiveThreadUnread,
    inboxBadgeFromEventPayload,
    inboxBadgeTotal,
    isThreadActivityNotificationType,
} from './inboxUnread';

describe('effectiveThreadUnread', () => {
    it('zeros leftover unread when the latest message is from the viewer', () => {
        expect(
            effectiveThreadUnread({
                unread: 3,
                lastSenderHandle: 'Barry@Dublin',
                viewerHandle: 'Barry@Dublin',
            }),
        ).toBe(0);
    });

    it('keeps inbound unread', () => {
        expect(
            effectiveThreadUnread({
                unread: 3,
                lastSenderHandle: 'Gazetteer@Dublin',
                viewerHandle: 'Barry@Dublin',
            }),
        ).toBe(3);
    });

    it('honors explicit mark-unread even when last message is from the viewer', () => {
        expect(
            effectiveThreadUnread({
                unread: 1,
                lastSenderHandle: 'Barry@Dublin',
                viewerHandle: 'Barry@Dublin',
                markedUnread: true,
            }),
        ).toBe(1);
    });

    it('does not count hidden message requests', () => {
        expect(
            effectiveThreadUnread({
                unread: 2,
                lastSenderHandle: 'Ava@galway',
                viewerHandle: 'Barry@Dublin',
                isRequest: true,
            }),
        ).toBe(0);
    });
});

describe('inbox badge aggregation', () => {
    it('sums messages + groups + notifications without double-counting', () => {
        expect(inboxBadgeTotal({ messages: 3, groups: 0, notifications: 0 })).toBe(3);
        expect(inboxBadgeTotal({ messages: 0, groups: 1, notifications: 2 })).toBe(3);
    });

    it('reads a full inboxUnreadChanged payload immediately', () => {
        expect(
            inboxBadgeFromEventPayload({
                handle: 'Barry@Dublin',
                messages: 0,
                groups: 0,
                notifications: 2,
                unread: 99,
            }),
        ).toBe(2);
    });

    it('ignores message-only unread events so the tab can refetch', () => {
        expect(inboxBadgeFromEventPayload({ handle: 'Barry@Dublin', unread: 7 })).toBeNull();
    });

    it('treats dm/sticker/reply notifications as thread activity', () => {
        expect(isThreadActivityNotificationType('dm')).toBe(true);
        expect(isThreadActivityNotificationType('like')).toBe(false);
    });
});
