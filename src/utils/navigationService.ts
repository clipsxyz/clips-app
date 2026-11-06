import { rootNavigationRef } from '../navigation/rootNavigationRef';
import {
    schedulePushNotificationNavigation,
    type PushNotificationData,
} from './pushNotificationNavigationNative';

export { rootNavigationRef };

function payloadData(remoteMessage: unknown): PushNotificationData | null {
    if (!remoteMessage || typeof remoteMessage !== 'object') return null;
    const record = remoteMessage as Record<string, unknown>;
    const nested = record.data;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        return nested as PushNotificationData;
    }
    return record as PushNotificationData;
}

/**
 * Open the screen described by an FCM message.
 * Accepts a remote message (`remoteMessage.data`) or a plain data object.
 * Cold-start taps wait until the root navigation container is ready.
 */
export function handleNotificationRouting(remoteMessage: unknown): void {
    const data = payloadData(remoteMessage);
    if (!data) return;

    const route = String(data.route ?? '').trim().toLowerCase();
    const postId = String(data.post_id ?? data.postId ?? '').trim();
    const storyId = String(data.story_id ?? data.storyId ?? '').trim();

    if (route === 'post' && postId) {
        schedulePushNotificationNavigation(() => rootNavigationRef, {
            ...data,
            route: 'post',
            post_id: postId,
            postId,
        });
        return;
    }

    if (route === 'story' && storyId) {
        schedulePushNotificationNavigation(() => rootNavigationRef, {
            ...data,
            route: 'story',
            story_id: storyId,
            storyId,
        });
        return;
    }

    if (route === 'feed' || route === 'post' || route === 'story') {
        schedulePushNotificationNavigation(() => rootNavigationRef, { ...data, route: 'feed' });
        return;
    }

    schedulePushNotificationNavigation(() => rootNavigationRef, data);
}
