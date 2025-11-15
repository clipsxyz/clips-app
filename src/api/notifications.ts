export type NotificationType = 'sticker' | 'reply' | 'dm' | 'like' | 'comment' | 'follow' | 'follow_request';

export interface Notification {
    id: string;
    type: NotificationType;
    fromHandle: string;
    toHandle: string;
    message?: string;
    postId?: string;
    commentId?: string;
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

export async function getNotifications(forHandle: string): Promise<Notification[]> {
    return notifications.get(forHandle) || [];
}

export async function markNotificationRead(notificationId: string, forHandle: string): Promise<void> {
    const userNotifications = notifications.get(forHandle) || [];
    const notif = userNotifications.find(n => n.id === notificationId);
    if (notif) {
        notif.read = true;
        window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: { handle: forHandle } }));
    }
}

export async function markAllNotificationsRead(forHandle: string): Promise<void> {
    const userNotifications = notifications.get(forHandle) || [];
    userNotifications.forEach(n => n.read = true);
    window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: { handle: forHandle } }));
}

export async function getUnreadNotificationCount(forHandle: string): Promise<number> {
    const userNotifications = notifications.get(forHandle) || [];
    return userNotifications.filter(n => !n.read).length;
}

export async function deleteNotification(notificationId: string, forHandle: string): Promise<void> {
    const userNotifications = notifications.get(forHandle) || [];
    const filtered = userNotifications.filter(n => n.id !== notificationId);
    notifications.set(forHandle, filtered);
    window.dispatchEvent(new CustomEvent('notificationsUpdated', { detail: { handle: forHandle } }));
}


