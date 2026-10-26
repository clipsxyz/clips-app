import { dispatchBrowserEvent } from './dispatchBrowserEvent';

/** Notification types that duplicate a DM/group thread — they must not also inflate the Inbox tab. */
export const THREAD_ACTIVITY_NOTIFICATION_TYPES = new Set(['dm', 'sticker', 'reply']);

/** Server-only / digest rows that are not shown on the in-app Notifs pill. */
const HIDDEN_INBOX_NOTIFICATION_TYPES = new Set(['inactive_digest']);

export type InboxUnreadParts = {
    messages: number;
    groups: number;
    notifications: number;
};

export type InboxUnreadConversation = {
    kind?: string | null;
    isRequest?: boolean | null;
    unread?: number | null;
};

export type InboxUnreadNotification = {
    read?: boolean | null;
    type?: string | null;
};

function sameHandle(a?: string | null, b?: string | null): boolean {
    return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

export function isThreadActivityNotificationType(type?: string | null): boolean {
    return THREAD_ACTIVITY_NOTIFICATION_TYPES.has(String(type || '').trim());
}

export function countsTowardInboxNotificationBadge(type?: string | null): boolean {
    const normalized = String(type || '').trim();
    if (!normalized) return false;
    if (isThreadActivityNotificationType(normalized)) return false;
    if (HIDDEN_INBOX_NOTIFICATION_TYPES.has(normalized)) return false;
    return true;
}

/**
 * Unread for one inbox row.
 * Last outbound message means the viewer already opened/sent in the thread, so
 * leftover server `unread_count` must not keep the pill/tab badged.
 * Explicit "mark unread" (override > 0) still wins.
 */
export function effectiveThreadUnread(input: {
    unread: number;
    lastSenderHandle?: string | null;
    viewerHandle?: string | null;
    isRequest?: boolean;
    markedUnread?: boolean;
}): number {
    const unread = Math.max(0, Math.floor(Number(input.unread) || 0));
    if (unread === 0) return 0;
    if (input.isRequest) return 0;
    if (input.markedUnread) return unread;
    if (sameHandle(input.lastSenderHandle, input.viewerHandle)) return 0;
    return unread;
}

/** After the viewer opens a thread, keep leftover server unread_count from coming back. */
export function unreadAfterOpeningThread(input: {
    unread: number;
    lastMessageTimestamp?: number | null;
    lastReadAt?: number | null;
    override?: number;
}): number {
    if (input.override !== undefined) {
        return Math.max(0, Math.floor(Number(input.override) || 0));
    }
    const lastRead = Number(input.lastReadAt) || 0;
    const lastTs = Number(input.lastMessageTimestamp) || 0;
    if (lastRead > 0 && lastTs <= lastRead) return 0;
    return Math.max(0, Math.floor(Number(input.unread) || 0));
}

/** Same formula as the Inbox Messages / Groups / Notifs pills. */
export function inboxUnreadPartsFromLists(
    conversations: InboxUnreadConversation[] | null | undefined,
    notifications: InboxUnreadNotification[] | null | undefined,
    extra?: { pendingInviteCount?: number },
): InboxUnreadParts {
    let messages = 0;
    let groups = 0;
    for (const row of conversations || []) {
        const unread = Math.max(0, Math.floor(Number(row.unread) || 0));
        if (unread === 0) continue;
        if (row.kind === 'group') {
            groups += unread;
            continue;
        }
        if (row.isRequest) continue;
        messages += unread;
    }
    const pendingInvites = Math.max(0, Math.floor(Number(extra?.pendingInviteCount) || 0));
    const notificationUnread = (notifications || []).filter(
        (n) => !n.read && countsTowardInboxNotificationBadge(n.type),
    ).length;
    return {
        messages,
        groups: groups + pendingInvites,
        notifications: notificationUnread,
    };
}

export function inboxBadgeTotal(parts: InboxUnreadParts): number {
    return Math.max(
        0,
        (Number(parts.messages) || 0) + (Number(parts.groups) || 0) + (Number(parts.notifications) || 0),
    );
}

export function publishInboxUnreadParts(
    parts: InboxUnreadParts & { handle?: string },
): void {
    dispatchBrowserEvent('inboxUnreadChanged', {
        handle: parts.handle,
        messages: Math.max(0, Number(parts.messages) || 0),
        groups: Math.max(0, Number(parts.groups) || 0),
        notifications: Math.max(0, Number(parts.notifications) || 0),
        unread: inboxBadgeTotal(parts),
    });
}

export async function loadInboxUnreadParts(handle: string): Promise<InboxUnreadParts> {
    const [{ listConversations }, { getNotifications }, chatGroups] = await Promise.all([
        import('../api/messages'),
        import('../api/notifications'),
        import('../api/chatGroups').catch(() => null),
    ]);
    const [conversations, notifications, pendingInvites] = await Promise.all([
        listConversations(handle).catch(() => []),
        getNotifications(handle).catch(() => []),
        chatGroups?.fetchPendingGroupInvites
            ? chatGroups.fetchPendingGroupInvites().catch(() => [])
            : Promise.resolve([]),
    ]);
    return inboxUnreadPartsFromLists(conversations, notifications, {
        pendingInviteCount: Array.isArray(pendingInvites) ? pendingInvites.length : 0,
    });
}

export function inboxBadgeFromEventPayload(payload?: {
    handle?: string;
    unread?: number;
    messages?: number;
    groups?: number;
    notifications?: number;
}): number | null {
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.messages === 'number' || typeof payload.notifications === 'number') {
        return inboxBadgeTotal({
            messages: Number(payload.messages) || 0,
            groups: Number(payload.groups) || 0,
            notifications: Number(payload.notifications) || 0,
        });
    }
    return null;
}
