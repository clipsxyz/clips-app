import { getNotificationPreferences, isInAppNotificationChannelEnabled, isNotificationTypeEnabled } from '../services/notifications';
import { dispatchBrowserEvent } from '../utils/dispatchBrowserEvent';

export type NotificationType =
    | 'sticker'
    | 'reply'
    | 'dm'
    | 'like'
    | 'comment'
    | 'follow'
    | 'follow_request'
    | 'group_invite'
    | 'new_post';

export interface Notification {
    id: string;
    type: NotificationType;
    fromHandle: string;
    toHandle: string;
    message?: string;
    postId?: string;
    commentId?: string;
    storyId?: string;
    imageUrl?: string;
    storyContextText?: string;
    storyContextOwner?: string;
    chatGroupId?: string;
    groupName?: string;
    chatGroupInviteId?: string;
    timestamp: number;
    read: boolean;
}

const notifications = new Map<string, Notification[]>(); // key: user handle, value: notifications array

// Check if a message is a sticker (emoji only)
export function isStickerMessage(text: string): boolean {
    if (!text) return false;
    // Remove whitespace and check if it's only emoji
    const trimmed = text.trim();
    // Check if it's a single emoji or multiple emojis (no letters/numbers)
    const emojiRegex = /^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Emoji_Modifier}\p{Emoji_Component}]+$/u;
    return emojiRegex.test(trimmed) && trimmed.length <= 10; // Max 10 emojis for sticker
}

// Check if a message is a reply to a post (contains "Replying to:")
export function isReplyToPost(text: string): boolean {
    if (!text) return false;
    return text.trim().toLowerCase().startsWith('replying to:');
}

export async function createNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<Notification> {
    try {
        const userStr = localStorage.getItem('user');
        const current = userStr ? JSON.parse(userStr) : null;
        const currentHandle = String(current?.handle || '').toLowerCase();
        const targetHandle = String(notification.toHandle || '').toLowerCase();

        // Enforce preferences at creation time for the signed-in recipient.
        // (For other recipients in mock mode, we may not have their local prefs.)
        if (currentHandle && targetHandle && currentHandle === targetHandle) {
            const prefs = getNotificationPreferences();
            const channel = normalizeNotificationChannel(notification as Pick<Notification, 'type' | 'chatGroupId'>);
            if (!isNotificationTypeEnabled(prefs, channel)) {
                return {
                    id: `notif-skipped-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    ...notification,
                    timestamp: Date.now(),
                    read: true,
                };
            }
        }
    } catch {
        // If preference resolution fails, fall through and create notification.
    }

    const notif: Notification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...notification,
        timestamp: Date.now(),
        read: false
    };

    const userNotifications = notifications.get(notification.toHandle) || [];
    userNotifications.unshift(notif); // Add to beginning (newest first)
    notifications.set(notification.toHandle, userNotifications);

    dispatchBrowserEvent('notificationCreated', notif as unknown as Record<string, unknown>);
    dispatchBrowserEvent('notificationsUpdated', { handle: notification.toHandle });

    return notif;
}

function normalizeNotificationChannel(notification: Pick<Notification, 'type' | 'chatGroupId'>) {
    if (notification.chatGroupId) return 'group_chat' as const;
    switch (notification.type) {
        case 'dm':
            return 'dm' as const;
        case 'sticker':
            return 'sticker' as const;
        case 'reply':
            return 'reply' as const;
        case 'like':
            return 'like' as const;
        case 'comment':
            return 'comment' as const;
        case 'follow':
            return 'follow' as const;
        case 'follow_request':
            return 'follow_request' as const;
        case 'group_invite':
            return 'group_chat' as const;
        case 'new_post':
            return 'follow' as const;
        default:
            return 'dm' as const;
    }
}

function isActionableInboxNotification(n: Pick<Notification, 'type'>): boolean {
    return n.type === 'group_invite' || n.type === 'follow_request';
}

function filterNotificationsByPreferences(forHandle: string, items: Notification[]): Notification[] {
    try {
        const userStr = localStorage.getItem('user');
        const current = userStr ? JSON.parse(userStr) : null;
        const currentHandle = (current?.handle || '').toLowerCase();
        if (!currentHandle || currentHandle !== String(forHandle || '').toLowerCase()) return items;
        const prefs = getNotificationPreferences();
        return items.filter((n) =>
            isActionableInboxNotification(n)
                ? true
                : isInAppNotificationChannelEnabled(prefs, normalizeNotificationChannel(n))
        );
    } catch {
        return items;
    }
}

export async function getNotifications(forHandle: string): Promise<Notification[]> {
    const { isLaravelApiEnabled } = await import('../config/runtimeEnv');
    if (isLaravelApiEnabled()) {
        try {
            const apiClient = await import('./client');
            const response = await apiClient.fetchNotifications(0, 100);
            const items = Array.isArray(response?.items) ? response.items : [];
            const normalized = items.map((n: any) => ({
                id: n.id,
                type: n.type,
                fromHandle: n.from_handle || '',
                toHandle: n.to_handle || forHandle,
                message: n.message || undefined,
                postId: n.post_id || undefined,
                commentId: n.comment_id || undefined,
                storyId: n.story_id || undefined,
                imageUrl: n.image_url || undefined,
                storyContextText: n.story_context_text || undefined,
                storyContextOwner: n.story_context_owner || undefined,
                chatGroupId: n.chat_group_id || undefined,
                groupName: n.group_name || undefined,
                chatGroupInviteId: n.chat_group_invite_id || undefined,
                timestamp: n.created_at ? new Date(n.created_at).getTime() : Date.now(),
                read: !!n.read,
            }));
            const local = notifications.get(forHandle) || [];
            const merged = [...local, ...normalized].sort((a, b) => b.timestamp - a.timestamp);
            const byId = new Map<string, Notification>();
            for (const n of merged) byId.set(n.id, n);
            try {
                const { fetchPendingGroupInvites } = await import('./chatGroups');
                const pending = await fetchPendingGroupInvites();
                for (const invite of pending) {
                    const fromHandle = invite.inviter?.handle || '';
                    const groupName = invite.chat_group?.name || 'a community';
                    const mapped: Notification = {
                        id: `group-invite-${invite.id}`,
                        type: 'group_invite',
                        fromHandle,
                        toHandle: forHandle,
                        message: `${fromHandle} invited you to join ${groupName}`,
                        chatGroupId: invite.chat_group_id,
                        groupName,
                        chatGroupInviteId: invite.id,
                        timestamp: invite.created_at ? new Date(invite.created_at).getTime() : Date.now(),
                        read: false,
                    };
                    const existing = Array.from(byId.values()).find(
                        (n) => n.chatGroupInviteId === invite.id || n.id === mapped.id
                    );
                    if (existing) {
                        byId.set(existing.id, {
                            ...existing,
                            type: 'group_invite',
                            chatGroupId: existing.chatGroupId || mapped.chatGroupId,
                            groupName: existing.groupName || mapped.groupName,
                            chatGroupInviteId: invite.id,
                            message: existing.message || mapped.message,
                        });
                    } else {
                        byId.set(mapped.id, mapped);
                    }
                }
            } catch (pendingError) {
                console.warn('Failed to fetch pending community invites:', pendingError);
            }
            return filterNotificationsByPreferences(
                forHandle,
                Array.from(byId.values()).sort((a, b) => b.timestamp - a.timestamp)
            );
        } catch (error) {
            console.warn('Failed to fetch notifications from API, falling back to local store:', error);
        }
        try {
            const { fetchPendingGroupInvites } = await import('./chatGroups');
            const pending = await fetchPendingGroupInvites();
            const fallback: Notification[] = pending.map((invite) => {
                const fromHandle = invite.inviter?.handle || '';
                const groupName = invite.chat_group?.name || 'a community';
                return {
                    id: `group-invite-${invite.id}`,
                    type: 'group_invite' as const,
                    fromHandle,
                    toHandle: forHandle,
                    message: `${fromHandle} invited you to join ${groupName}`,
                    chatGroupId: invite.chat_group_id,
                    groupName,
                    chatGroupInviteId: invite.id,
                    timestamp: invite.created_at ? new Date(invite.created_at).getTime() : Date.now(),
                    read: false,
                };
            });
            return filterNotificationsByPreferences(forHandle, [
                ...(notifications.get(forHandle) || []),
                ...fallback,
            ]);
        } catch (pendingError) {
            console.warn('Failed to fetch pending community invites:', pendingError);
        }
    }
    return filterNotificationsByPreferences(forHandle, notifications.get(forHandle) || []);
}

export async function markNotificationRead(notificationId: string, forHandle: string): Promise<void> {
    const { isLaravelApiEnabled } = await import('../config/runtimeEnv');
    if (isLaravelApiEnabled()) {
        try {
            const apiClient = await import('./client');
            await apiClient.markNotificationReadApi(notificationId);
            dispatchBrowserEvent('notificationsUpdated', { handle: forHandle });
            return;
        } catch (error) {
            console.warn('Failed to mark notification read via API, falling back to local store:', error);
        }
    }

    const userNotifications = notifications.get(forHandle) || [];
    const notif = userNotifications.find(n => n.id === notificationId);
    if (notif) {
        notif.read = true;
        dispatchBrowserEvent('notificationsUpdated', { handle: forHandle });
    }
}

export async function markAllNotificationsRead(forHandle: string): Promise<void> {
    const { isLaravelApiEnabled } = await import('../config/runtimeEnv');
    if (isLaravelApiEnabled()) {
        try {
            const apiClient = await import('./client');
            await apiClient.markAllNotificationsReadApi();
            dispatchBrowserEvent('notificationsUpdated', { handle: forHandle });
            return;
        } catch (error) {
            console.warn('Failed to mark all notifications read via API, falling back to local store:', error);
        }
    }

    const userNotifications = notifications.get(forHandle) || [];
    userNotifications.forEach(n => n.read = true);
    dispatchBrowserEvent('notificationsUpdated', { handle: forHandle });
}

export async function getUnreadNotificationCount(forHandle: string): Promise<number> {
    const items = await getNotifications(forHandle);
    return items.filter(n => !n.read).length;
}

export async function deleteNotification(notificationId: string, forHandle: string): Promise<void> {
    const userNotifications = notifications.get(forHandle) || [];
    const filtered = userNotifications.filter(n => n.id !== notificationId);
    notifications.set(forHandle, filtered);
    dispatchBrowserEvent('notificationsUpdated', { handle: forHandle });
}


