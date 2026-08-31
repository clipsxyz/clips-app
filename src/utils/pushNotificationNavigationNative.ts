import { navigateMainTab } from '../navigation/mainTabs';

export type PushNotificationData = Record<string, unknown>;

type NavLike = {
    isReady: () => boolean;
    navigate: (name: string, params?: object) => void;
};

function pickString(data: PushNotificationData, ...keys: string[]): string | undefined {
    for (const key of keys) {
        const raw = data[key];
        if (raw == null) continue;
        const s = String(raw).trim();
        if (s) return s;
    }
    return undefined;
}

/**
 * Map FCM / mock `remoteMessage.data` → React Navigation routes.
 * Supports payloads like `{ type: 'dm', userId, postId, fromHandle, storyId, chatGroupId }`.
 */
export function navigateFromPushNotificationData(nav: NavLike, data: PushNotificationData): boolean {
    if (!nav?.isReady?.()) return false;

    const type = String(pickString(data, 'type', 'notificationType', 'kind') || '')
        .trim()
        .toLowerCase();
    const chatGroupId = pickString(data, 'chatGroupId', 'chat_group_id', 'groupId', 'group_id');
    const fromHandle = pickString(
        data,
        'fromHandle',
        'from_handle',
        'senderHandle',
        'sender_handle',
        'userHandle',
        'user_handle',
        'handle',
    );
    const userId = pickString(data, 'userId', 'user_id', 'fromUserId', 'from_user_id');
    const storyId = pickString(data, 'storyId', 'story_id');
    const postId = pickString(data, 'postId', 'post_id');
    const commentId = pickString(data, 'commentId', 'comment_id');

    if (type === 'group_chat' || chatGroupId) {
        if (chatGroupId) {
            nav.navigate('Messages', { chatGroupId, kind: 'group' });
            return true;
        }
    }

    if (type === 'story' || type === 'story_insight' || (fromHandle && storyId)) {
        if (fromHandle || userId) {
            nav.navigate('Stories', {
                openUserHandle: fromHandle || userId,
                openStoryId: storyId,
            });
            return true;
        }
    }

    if (
        type === 'dm' ||
        type === 'message' ||
        type === 'sticker' ||
        type === 'reply_message'
    ) {
        const handle = fromHandle || userId;
        if (handle) {
            nav.navigate('Messages', { handle });
            return true;
        }
    }

    if (
        type === 'comment' ||
        type === 'reply' ||
        type === 'like' ||
        type === 'reclip' ||
        type === 'share'
    ) {
        if (postId) {
            nav.navigate('PostDetail', {
                postId,
                openComments: type === 'comment' || type === 'reply',
                focusCommentId: commentId,
            });
            return true;
        }
    }

    if (type === 'follow' || type === 'follow_request' || type === 'new_post' || type === 'profile') {
        const handle = fromHandle || userId;
        if (handle) {
            nav.navigate('ViewProfile', {
                handle,
                sourcePostId: postId,
            });
            return true;
        }
    }

    if (fromHandle && storyId) {
        nav.navigate('Stories', { openUserHandle: fromHandle, openStoryId: storyId });
        return true;
    }

    if (fromHandle || userId) {
        // Default unknown typed payloads with an actor → DM thread (common push shape).
        if (!type || type === 'dm') {
            nav.navigate('Messages', { handle: fromHandle || userId });
            return true;
        }
        nav.navigate('ViewProfile', { handle: fromHandle || userId, sourcePostId: postId });
        return true;
    }

    if (postId) {
        nav.navigate('PostDetail', { postId, openComments: Boolean(commentId), focusCommentId: commentId });
        return true;
    }

    navigateMainTab(nav, 'Inbox', { initialTab: 'notifications' });
    return true;
}

/** Retry until the root navigator is ready (cold-start notification taps). */
export function schedulePushNotificationNavigation(
    getNav: () => NavLike | null | undefined,
    data: PushNotificationData,
    opts?: { attempts?: number; intervalMs?: number },
): void {
    const attempts = opts?.attempts ?? 40;
    const intervalMs = opts?.intervalMs ?? 250;
    let tries = 0;

    const tick = () => {
        const nav = getNav();
        if (nav && navigateFromPushNotificationData(nav, data)) return;
        tries += 1;
        if (tries >= attempts) {
            console.warn('[push] navigation not ready; dropped notification open payload', data);
            return;
        }
        setTimeout(tick, intervalMs);
    };

    tick();
}
