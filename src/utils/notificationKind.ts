/** Inbox notification chips and avatar action glyphs. */

export type NotificationKindInput = {
    type?: string | null;
    chatGroupId?: string | null;
    postId?: string | null;
    storyId?: string | null;
    message?: string | null;
    body?: string | null;
};

export type ResolvedNotificationKind =
    | 'like'
    | 'comment'
    | 'reply'
    | 'reclip'
    | 'share'
    | 'follow'
    | 'follow_request'
    | 'new_post'
    | 'group_invite'
    | 'dm'
    | 'sticker'
    | 'unknown';

function notificationBodyText(item: NotificationKindInput): string {
    return `${item.message || ''} ${item.body || ''}`.trim().toLowerCase();
}

/** Legacy Laravel rows were stored as `type: dm` with an action phrase in the message. */
export function inferNotificationKindFromText(text: string): ResolvedNotificationKind | null {
    const hay = String(text || '').toLowerCase();
    if (!hay) return null;
    if (hay.includes('liked your post')) return 'like';
    if (hay.includes('reclipped your post')) return 'reclip';
    if (hay.includes('shared your post')) return 'share';
    if (hay.includes('commented')) return 'comment';
    return null;
}

export function resolveNotificationKind(item: NotificationKindInput): ResolvedNotificationKind {
    const type = String(item.type || '').trim().toLowerCase();
    const known: ResolvedNotificationKind[] = [
        'like',
        'comment',
        'reply',
        'reclip',
        'share',
        'follow',
        'follow_request',
        'new_post',
        'group_invite',
        'dm',
        'sticker',
    ];
    const typed = known.includes(type as ResolvedNotificationKind)
        ? (type as ResolvedNotificationKind)
        : 'unknown';

    if (typed === 'dm' || typed === 'unknown') {
        const inferred = inferNotificationKindFromText(notificationBodyText(item));
        if (inferred) return inferred;
    }

    return typed;
}

export function notificationKindLabel(item: NotificationKindInput): string {
    const type = resolveNotificationKind(item);
    switch (type) {
        case 'like':
            return 'Like';
        case 'comment':
            return 'Comment';
        case 'reply':
            return item.postId && !item.storyId ? 'Comment' : 'Reply';
        case 'reclip':
            return 'Reclip';
        case 'share':
            return 'Share';
        case 'follow':
        case 'follow_request':
        case 'new_post':
            return 'Follow';
        case 'group_invite':
            return 'Invite';
        case 'dm':
            return item.chatGroupId ? 'Group' : 'DM';
        case 'sticker':
            return 'DM';
        default:
            if (item.chatGroupId) return 'Group';
            return 'DM';
    }
}

/** Ionicons name for the avatar corner badge on native Inbox. */
export function notificationKindIonicon(item: NotificationKindInput | string | null | undefined): string {
    const type =
        typeof item === 'string' || item == null
            ? String(item || '').trim().toLowerCase()
            : resolveNotificationKind(item);
    switch (type) {
        case 'like':
            return 'heart';
        case 'comment':
            return 'chatbubble-ellipses';
        case 'reply':
            return 'arrow-undo';
        case 'reclip':
            return 'repeat';
        case 'share':
            return 'share-outline';
        case 'follow':
        case 'follow_request':
            return 'person-add';
        case 'new_post':
            return 'person';
        case 'group_invite':
            return 'people';
        case 'sticker':
            return 'happy';
        case 'dm':
            return 'chatbubble';
        default:
            return 'notifications';
    }
}
