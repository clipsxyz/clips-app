import { dispatchBrowserEvent } from './dispatchBrowserEvent';

/** Notification types that duplicate a DM/group thread — they must not also inflate the Inbox tab. */
export const THREAD_ACTIVITY_NOTIFICATION_TYPES = new Set(['dm', 'sticker', 'reply']);

export type InboxUnreadParts = {
    messages: number;
    groups: number;
    notifications: number;
};

function sameHandle(a?: string | null, b?: string | null): boolean {
    return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

export function isThreadActivityNotificationType(type?: string | null): boolean {
    return THREAD_ACTIVITY_NOTIFICATION_TYPES.has(String(type || '').trim());
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
