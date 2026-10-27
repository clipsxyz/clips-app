import { getNotificationPreferences, isNotificationTypeEnabled } from '../services/notifications';
import { dispatchBrowserEvent } from '../utils/dispatchBrowserEvent';
import { countsTowardInboxNotificationBadge } from '../utils/inboxUnread';
import { extractNotificationPostId } from '../utils/inboxNotificationNav';

export type NotificationType =
    | 'sticker'
    | 'reply'
    | 'dm'
    | 'like'
    | 'comment'
    | 'follow'
    | 'follow_request'
    | 'new_post'
    | 'group_invite'
    | 'share'
    | 'reclip';

export interface Notification {
    id: string;
    type: NotificationType;
    fromHandle: string;
    toHandle: string;
    message?: string;
    body?: string;
    data?: unknown;
    postId?: string;
    commentId?: string;
    storyId?: string;
    imageUrl?: string;
    storyContextText?: string;
    storyContextOwner?: string;
    chatGroupId?: string;
    chatGroupInviteId?: string;
    groupName?: string;
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
        case 'new_post':
            return 'follow' as const;
        case 'group_invite':
            return 'group_chat' as const;
        case 'share':
            return 'share' as const;
        case 'reclip':
            return 'reclip' as const;
        default:
            return 'dm' as const;
    }
}

function nestedInvitePayload(n: Record<string, any>) {
    return n.chat_group_invite || n.chatGroupInvite || null;
}

function nestedGroupPayload(n: Record<string, any>) {
    const invite = nestedInvitePayload(n);
    return n.chat_group || n.chatGroup || invite?.chat_group || invite?.chatGroup || null;
}

export function normalizeLaravelNotification(n: Record<string, any>, forHandle: string): Notification {
    const invite = nestedInvitePayload(n);
    const group = nestedGroupPayload(n);
    const chatGroupInviteId =
        n.chat_group_invite_id || n.chatGroupInviteId || invite?.id || undefined;
    const chatGroupId =
        n.chat_group_id ||
        n.chatGroupId ||
        invite?.chat_group_id ||
        invite?.chatGroupId ||
        group?.id ||
        undefined;
    const groupName = n.group_name || n.groupName || group?.name || undefined;
    return {
        id: n.id,
        type: (n.type || 'dm') as NotificationType,
        fromHandle: n.from_handle || n.fromHandle || '',
        toHandle: n.to_handle || n.toHandle || forHandle,
        message: n.message || n.body || undefined,
        body: n.body || undefined,
        data: n.data,
        postId: extractNotificationPostId(n) || n.post_id || n.postId || undefined,
        commentId: n.comment_id || n.commentId || undefined,
        storyId: n.story_id || n.storyId || undefined,
        imageUrl: n.image_url || n.imageUrl || undefined,
        storyContextText: n.story_context_text || n.storyContextText || undefined,
        storyContextOwner: n.story_context_owner || n.storyContextOwner || undefined,
        chatGroupId: chatGroupId || undefined,
        chatGroupInviteId: chatGroupInviteId || undefined,
        groupName: groupName || undefined,
        timestamp: n.created_at ? new Date(n.created_at).getTime() : n.timestamp || Date.now(),
        read: !!n.read,
    };
}

function filterNotificationsByPreferences(forHandle: string, items: Notification[]): Notification[] {
    try {
        const userStr = localStorage.getItem('user');
        const current = userStr ? JSON.parse(userStr) : null;
        const currentHandle = (current?.handle || '').toLowerCase();
        if (!currentHandle || currentHandle !== String(forHandle || '').toLowerCase()) return items;
        const prefs = getNotificationPreferences();
        // Push master toggle must not hide in-app Inbox rows; channel toggles still apply.
        const inboxPrefs = { ...prefs, enabled: true };
        return items.filter((n) => isNotificationTypeEnabled(inboxPrefs, normalizeNotificationChannel(n)));
    } catch {
        return items;
    }
}

export async function getNotifications(forHandle: string): Promise<Notification[]> {
    const { isLaravelApiEnabled } = await import('../config/runtimeEnv');
    if (isLaravelApiEnabled()) {
        const apiClient = await import('./client');
        const response = await apiClient.fetchNotifications(0, 100);
        const items = Array.isArray(response?.items) ? response.items : [];
        const normalized = items.map((n: any) => normalizeLaravelNotification(n, forHandle));
        const byId = new Map<string, Notification>();
        for (const n of normalized) byId.set(n.id, n);
        return filterNotificationsByPreferences(forHandle, Array.from(byId.values()));
    }
    return filterNotificationsByPreferences(forHandle, notifications.get(forHandle) || []);
}

function markLocalNotificationRead(notificationId: string, forHandle: string): void {
    const userNotifications = notifications.get(forHandle) || [];
    const notif = userNotifications.find((n) => n.id === notificationId);
    if (notif) notif.read = true;
}

function markLocalAllNotificationsRead(forHandle: string): void {
    const userNotifications = notifications.get(forHandle) || [];
    userNotifications.forEach((n) => {
        n.read = true;
    });
}

function countUnreadInboxNotifications(items: Notification[]): number {
    return items.filter((n) => !n.read && countsTowardInboxNotificationBadge(n.type)).length;
}

export async function markNotificationRead(notificationId: string, forHandle: string): Promise<void> {
    markLocalNotificationRead(notificationId, forHandle);
    const { isLaravelApiEnabled } = await import('../config/runtimeEnv');
    if (isLaravelApiEnabled()) {
        try {
            const apiClient = await import('./client');
            await apiClient.markNotificationReadApi(notificationId);
        } catch (error) {
            console.warn('Failed to mark notification read via API, falling back to local store:', error);
        }
    }
    dispatchBrowserEvent('notificationsUpdated', { handle: forHandle });
}

export async function markAllNotificationsRead(forHandle: string): Promise<void> {
    markLocalAllNotificationsRead(forHandle);
    const { isLaravelApiEnabled } = await import('../config/runtimeEnv');
    if (isLaravelApiEnabled()) {
        try {
            const apiClient = await import('./client');
            await apiClient.markAllNotificationsReadApi();
        } catch (error) {
            console.warn('Failed to mark all notifications read via API, falling back to local store:', error);
        }
    }
    dispatchBrowserEvent('notificationsUpdated', { handle: forHandle });
}

export async function getUnreadNotificationCount(forHandle: string): Promise<number> {
    const items = await getNotifications(forHandle);
    return countUnreadInboxNotifications(items);
}

export async function deleteNotification(notificationId: string, forHandle: string): Promise<void> {
    const { isLaravelApiEnabled } = await import('../config/runtimeEnv');
    if (isLaravelApiEnabled()) {
        const apiClient = await import('./client');
        try {
            await apiClient.deleteNotificationApi(notificationId);
        } catch (error: any) {
            if (Number(error?.status) !== 404) throw error;
        }
    }
    const userNotifications = notifications.get(forHandle) || [];
    const filtered = userNotifications.filter(n => n.id !== notificationId);
    notifications.set(forHandle, filtered);
    dispatchBrowserEvent('notificationsUpdated', { handle: forHandle });
}


