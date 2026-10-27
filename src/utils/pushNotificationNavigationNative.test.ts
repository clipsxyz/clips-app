import { describe, expect, it, vi } from 'vitest';
import {
    navigateFromPushNotificationData,
    peerHandleFromConversationId,
} from './pushNotificationNavigationNative';

describe('peerHandleFromConversationId', () => {
    it('picks the other handle from Laravel conversation_id', () => {
        expect(peerHandleFromConversationId('Alice@Cork|Bob@Dublin', 'Bob@Dublin')).toBe(
            'Alice@Cork',
        );
        expect(peerHandleFromConversationId('Alice@Cork|Bob@Dublin', 'Alice@Cork')).toBe(
            'Bob@Dublin',
        );
    });
});

describe('navigateFromPushNotificationData dm', () => {
    it('opens Messages with conversation_id and sender handle', () => {
        const navigate = vi.fn();
        const ok = navigateFromPushNotificationData(
            { isReady: () => true, navigate },
            {
                type: 'dm',
                conversation_id: 'Alice@Cork|Bob@Dublin',
                sender_id: 'sender-uuid',
                fromHandle: 'Alice@Cork',
            },
        );
        expect(ok).toBe(true);
        expect(navigate).toHaveBeenCalledWith('Messages', {
            handle: 'Alice@Cork',
            conversation_id: 'Alice@Cork|Bob@Dublin',
            conversationId: 'Alice@Cork|Bob@Dublin',
            sender_id: 'sender-uuid',
        });
    });

    it('opens Messages from conversation_id when fromHandle is missing', () => {
        const navigate = vi.fn();
        navigateFromPushNotificationData(
            { isReady: () => true, navigate },
            { type: 'dm', conversation_id: 'Alice@Cork|Bob@Dublin' },
        );
        expect(navigate).toHaveBeenCalledWith(
            'Messages',
            expect.objectContaining({
                handle: 'Alice@Cork',
                conversation_id: 'Alice@Cork|Bob@Dublin',
            }),
        );
    });
});

describe('navigateFromPushNotificationData group', () => {
    it('opens the group thread for group_chat', () => {
        const navigate = vi.fn();
        const ok = navigateFromPushNotificationData(
            { isReady: () => true, navigate },
            { type: 'group_chat', group_id: 'group-uuid-1' },
        );
        expect(ok).toBe(true);
        expect(navigate).toHaveBeenCalledWith('Messages', {
            chatGroupId: 'group-uuid-1',
            kind: 'group',
            groupName: undefined,
        });
    });

    it('opens Inbox notifications for group_invite instead of the group thread', () => {
        const navigate = vi.fn();
        const ok = navigateFromPushNotificationData(
            { isReady: () => true, navigate },
            { type: 'group_invite', group_id: 'group-uuid-1', invite_id: 'invite-1' },
        );
        expect(ok).toBe(true);
        expect(navigate).toHaveBeenCalledWith('MainTabs', {
            screen: 'Inbox',
            params: {
                initialTab: 'notifications',
                group_id: 'group-uuid-1',
                chatGroupId: 'group-uuid-1',
                inviteId: 'invite-1',
            },
        });
    });
});

