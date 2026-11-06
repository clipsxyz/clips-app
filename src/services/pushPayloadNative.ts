import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { extractPushPayload, type PushPayload } from '../utils/pushPayload';

export const PUSH_BADGE_KEY = 'gazetteer_push_badge';

/** Persist the icon/inbox hint from a background or quit-state message. */
export async function rememberPushBadge(payload: PushPayload): Promise<number> {
    let next = payload.badge;
    if (next == null) {
        const raw = await AsyncStorage.getItem(PUSH_BADGE_KEY);
        const prev = Number(raw || 0);
        next = (Number.isFinite(prev) ? prev : 0) + 1;
    }
    const count = Math.max(0, Math.floor(next));
    await AsyncStorage.setItem(PUSH_BADGE_KEY, String(count));
    return count;
}

/**
 * Headless entry for messaging().setBackgroundMessageHandler.
 * Notification payloads are shown by the OS. This records badge metadata for the next resume.
 */
export async function handleBackgroundPush(message: any): Promise<void> {
    const payload = extractPushPayload(message);
    const badge = await rememberPushBadge(payload);
    DeviceEventEmitter.emit('pushBadgeUpdated', { badge, data: payload.data });
    DeviceEventEmitter.emit('inboxUnreadChanged', {});
}
