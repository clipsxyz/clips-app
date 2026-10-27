/** Inbox notification chips and avatar action glyphs. */

export type NotificationKindInput = {
    type?: string | null;
    chatGroupId?: string | null;
    postId?: string | null;
    storyId?: string | null;
};

export function notificationKindLabel(item: NotificationKindInput): string {
    const type = String(item.type || '').trim().toLowerCase();
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
export function notificationKindIonicon(type?: string | null): string {
    switch (String(type || '').trim().toLowerCase()) {
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
