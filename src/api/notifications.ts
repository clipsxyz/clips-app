import { getNotificationPreferences, isNotificationTypeEnabled } from '../services/notifications';

export type NotificationType = 'sticker' | 'reply' | 'dm' | 'like' | 'comment' | 'follow' | 'follow_request';

export interface Notification {
    id: string;
    type: NotificationType;
    fromHandle: string;
    toHandle: string;
    message?: string;
    postId?: string;
    commentId?: string;
    chatGroupId?: string;
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

    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('notificationCreated', { detail: notif }));
    window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: { handle: notification.toHandle } }));

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
        default:
            return 'dm' as const;
    }
}

function filterNotificationsByPreferences(forHandle: string, items: Notification[]): Notification[] {
    try {
        const userStr = localStorage.getItem('user');
        const current = userStr ? JSON.parse(userStr) : null;
        const currentHandle = (current?.handle || '').toLowerCase();
        if (!currentHandle || currentHandle !== String(forHandle || '').toLowerCase()) return items;
        const prefs = getNotificationPreferences();
        return items.filter((n) => isNotificationTypeEnabled(prefs, normalizeNotificationChannel(n)));
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
                chatGroupId: n.chat_group_id || undefined,
                groupName: n.group_name || undefined,
                timestamp: n.created_at ? new Date(n.created_at).getTime() : Date.now(),
                read: !!n.read,
            }));
            return filterNotificationsByPreferences(forHandle, normalized);
        } catch (error) {
            console.warn('Failed to fetch notifications from API, falling back to local store:', error);
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
            window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: { handle: forHandle } }));
            return;
        } catch (error) {
            console.warn('Failed to mark notification read via API, falling back to local store:', error);
        }
    }

    const userNotifications = notifications.get(forHandle) || [];
    const notif = userNotifications.find(n => n.id === notificationId);
    if (notif) {
        notif.read = true;
        window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: { handle: forHandle } }));
    }
}

export async function markAllNotificationsRead(forHandle: string): Promise<void> {
    const { isLaravelApiEnabled } = await import('../config/runtimeEnv');
    if (isLaravelApiEnabled()) {
        try {
            const apiClient = await import('./client');
            await apiClient.markAllNotificationsReadApi();
            window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: { handle: forHandle } }));
            return;
        } catch (error) {
            console.warn('Failed to mark all notifications read via API, falling back to local store:', error);
        }
    }

    const userNotifications = notifications.get(forHandle) || [];
    userNotifications.forEach(n => n.read = true);
    window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: { handle: forHandle } }));
}

export async function getUnreadNotificationCount(forHandle: string): Promise<number> {
    const items = await getNotifications(forHandle);
    return items.filter(n => !n.read).length;
}

export async function deleteNotification(notificationId: string, forHandle: string): Promise<void> {
    const userNotifications = notifications.get(forHandle) || [];
    const filtered = userNotifications.filter(n => n.id !== notificationId);
    notifications.set(forHandle, filtered);
    window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: { handle: forHandle } }));
}


