import { describe, expect, it } from 'vitest';
import {
    countsTowardInboxNotificationBadge,
    effectiveThreadUnread,
    inboxBadgeFromEventPayload,
    inboxBadgeTotal,
    inboxUnreadPartsFromLists,
    isThreadActivityNotificationType,
    unreadAfterOpeningThread,
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

    it('zeros leftover unread after the thread was opened', () => {
        expect(
            unreadAfterOpeningThread({
                unread: 3,
                lastMessageTimestamp: 100,
                lastReadAt: 150,
            }),
        ).toBe(0);
        expect(
            unreadAfterOpeningThread({
                unread: 3,
                lastMessageTimestamp: 200,
                lastReadAt: 150,
            }),
        ).toBe(3);
        expect(unreadAfterOpeningThread({ unread: 3, override: 0 })).toBe(0);
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
        expect(countsTowardInboxNotificationBadge('like')).toBe(true);
        expect(countsTowardInboxNotificationBadge('dm')).toBe(false);
        expect(countsTowardInboxNotificationBadge('inactive_digest')).toBe(false);
    });

    it('matches Messages / Groups / Notifs pills and ignores hidden rows', () => {
        expect(
            inboxUnreadPartsFromLists(
                [
                    { kind: 'dm', unread: 2, isRequest: false },
                    { kind: 'dm', unread: 4, isRequest: true },
                    { kind: 'group', unread: 1 },
                    { kind: 'dm', unread: 0 },
                ],
                [
                    { read: false, type: 'like' },
                    { read: false, type: 'dm' },
                    { read: true, type: 'follow' },
                    { read: false, type: 'inactive_digest' },
                ],
                { pendingInviteCount: 2 },
            ),
        ).toEqual({ messages: 2, groups: 3, notifications: 1 });
    });
});
