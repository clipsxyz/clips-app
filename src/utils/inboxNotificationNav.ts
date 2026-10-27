import {
    inferNotificationKindFromText,
    resolveNotificationKind,
    type NotificationKindInput,
} from './notificationKind';

export type InboxNotificationNavInput = NotificationKindInput & {
    id?: string | null;
    fromHandle?: string | null;
    commentId?: string | null;
    data?: unknown;
    payload?: unknown;
    targetId?: string | null;
    target_id?: string | null;
    post_id?: string | null;
    actorId?: string | null;
    actor_id?: string | null;
    userId?: string | null;
    user_id?: string | null;
    senderId?: string | null;
    sender_id?: string | null;
    from_handle?: string | null;
};

export type InboxNotificationRoute =
    | { dest: 'post'; postId: string; openComments?: boolean; focusCommentId?: string }
    | { dest: 'profile'; handle: string; sourcePostId?: string }
    | { dest: 'story'; handle: string; storyId: string }
    | { dest: 'messages'; handle?: string; chatGroupId?: string }
    | { dest: 'none' };

function asRecord(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        // Legacy rows may store a non-JSON blob in `data`.
    }
    return null;
}

function pickString(obj: Record<string, unknown> | null | undefined, keys: string[]): string | undefined {
    if (!obj) return undefined;
    for (const key of keys) {
        const raw = obj[key];
        if (raw == null) continue;
        const value = String(raw).trim();
        if (value) return value;
    }
    return undefined;
}

function payloadBags(item: InboxNotificationNavInput): Record<string, unknown>[] {
    const bags: Record<string, unknown>[] = [item as Record<string, unknown>];
    const nested = [item.data, item.payload, (item as Record<string, unknown>).meta];
    for (const extra of nested) {
        const rec = asRecord(extra);
        if (rec) bags.push(rec);
        const inner = rec ? asRecord(rec.data) : null;
        if (inner) bags.push(inner);
    }
    return bags;
}

const POST_ID_KEYS = ['postId', 'post_id', 'targetId', 'target_id', 'sourcePostId', 'source_post_id'];

const ACTOR_KEYS = [
    'fromHandle',
    'from_handle',
    'actorHandle',
    'actor_handle',
    'handle',
    'userHandle',
    'user_handle',
    'senderHandle',
    'sender_handle',
    'actorId',
    'actor_id',
    'userId',
    'user_id',
    'senderId',
    'sender_id',
];

export function extractNotificationPostId(item: InboxNotificationNavInput | null | undefined): string | undefined {
    if (!item) return undefined;
    for (const bag of payloadBags(item)) {
        const id = pickString(bag, POST_ID_KEYS);
        if (id) return id;
    }
    return undefined;
}

export function extractNotificationActorHandle(item: InboxNotificationNavInput | null | undefined): string | undefined {
    if (!item) return undefined;
    for (const bag of payloadBags(item)) {
        const handle = pickString(bag, ACTOR_KEYS);
        if (handle) return handle.replace(/^@/, '');
    }
    return undefined;
}

function bodyText(item: InboxNotificationNavInput): string {
    return `${item.message || ''} ${item.body || ''}`.trim().toLowerCase();
}

export function isPostRelatedInboxNotification(item: InboxNotificationNavInput): boolean {
    const kind = resolveNotificationKind(item);
    if (kind === 'like' || kind === 'comment' || kind === 'reclip' || kind === 'share') return true;
    if (kind === 'reply' && extractNotificationPostId(item) && !item.storyId) return true;
    const hay = bodyText(item);
    if (!hay) return false;
    if (hay.includes('liked') || hay.includes('reclipped') || hay.includes('shared') || hay.includes('commented')) {
        return true;
    }
    return inferNotificationKindFromText(hay) === 'like'
        || inferNotificationKindFromText(hay) === 'reclip'
        || inferNotificationKindFromText(hay) === 'share'
        || inferNotificationKindFromText(hay) === 'comment';
}

export function isFollowInboxNotification(item: InboxNotificationNavInput): boolean {
    const kind = resolveNotificationKind(item);
    if (kind === 'follow' || kind === 'follow_request') return true;
    return bodyText(item).includes('started following');
}

export function resolveInboxNotificationRoute(item: InboxNotificationNavInput): InboxNotificationRoute {
    const kind = resolveNotificationKind(item);
    const postId = extractNotificationPostId(item);
    const handle = extractNotificationActorHandle(item);
    const hay = bodyText(item);
    const openComments = kind === 'comment' || kind === 'reply' || hay.includes('commented');

    if (kind === 'group_invite') {
        return { dest: 'none' };
    }

    if (isPostRelatedInboxNotification(item) && !item.storyId) {
        if (postId) {
            return {
                dest: 'post',
                postId,
                openComments,
                focusCommentId: item.commentId || undefined,
            };
        }
        console.warn(
            '[inbox] notification missing postId/post_id/target_id',
            item.id || '(no id)',
            { type: item.type, message: item.message },
        );
        if (handle) return { dest: 'profile', handle };
        return { dest: 'none' };
    }

    if (isFollowInboxNotification(item)) {
        if (handle) return { dest: 'profile', handle };
        console.warn('[inbox] follow notification missing actor handle', item.id || '(no id)');
        return { dest: 'none' };
    }

    if (item.chatGroupId) {
        return { dest: 'messages', chatGroupId: item.chatGroupId, handle };
    }

    if (item.storyId && handle) {
        return { dest: 'story', handle, storyId: item.storyId };
    }

    if (kind === 'new_post' && handle) {
        return { dest: 'profile', handle, sourcePostId: postId };
    }

    if (kind === 'sticker' || kind === 'reply' || kind === 'dm' || kind === 'unknown') {
        return { dest: 'messages', handle };
    }

    return { dest: 'none' };
}
