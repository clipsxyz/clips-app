import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProfilePostNotifyLevel } from './profilePostNotifyPrefs';
import { normalizeProfileNotifyHandle } from './profilePostNotifyPrefs';

const enabledKey = (viewerId: string) => `clips:rn:profilePostNotify:${String(viewerId ?? '').trim()}`;
const reverseKey = (creatorKey: string) => `clips:rn:profilePostNotifySubs:${creatorKey}`;

async function readHandleSet(storageKey: string): Promise<Set<string>> {
    try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!raw) return new Set();
        const arr = JSON.parse(raw) as unknown;
        if (!Array.isArray(arr)) return new Set();
        return new Set(arr.filter((x): x is string => typeof x === 'string'));
    } catch {
        return new Set();
    }
}

async function writeHandleSet(storageKey: string, set: Set<string>): Promise<void> {
    await AsyncStorage.setItem(storageKey, JSON.stringify([...set]));
}

export async function getProfilePostNotifyLevelMobile(
    viewerId: string,
    creatorHandle: string,
): Promise<ProfilePostNotifyLevel> {
    const creatorKey = normalizeProfileNotifyHandle(creatorHandle);
    const enabled = await readHandleSet(enabledKey(viewerId));
    return enabled.has(creatorKey) ? 'all' : 'off';
}

export async function setProfilePostNotifyLevelMobile(
    viewerId: string,
    viewerHandle: string,
    creatorHandle: string,
    level: ProfilePostNotifyLevel,
): Promise<void> {
    const creatorKey = normalizeProfileNotifyHandle(creatorHandle);
    const subscriberHandle = String(viewerHandle || '').trim();
    const enabled = await readHandleSet(enabledKey(viewerId));
    const reverse = await readHandleSet(reverseKey(creatorKey));

    if (level === 'all') {
        enabled.add(creatorKey);
        if (subscriberHandle) reverse.add(subscriberHandle);
    } else {
        enabled.delete(creatorKey);
        if (subscriberHandle) reverse.delete(subscriberHandle);
    }

    await writeHandleSet(enabledKey(viewerId), enabled);
    await writeHandleSet(reverseKey(creatorKey), reverse);
}

export async function clearProfilePostNotifyForCreatorMobile(
    viewerId: string,
    viewerHandle: string,
    creatorHandle: string,
): Promise<void> {
    await setProfilePostNotifyLevelMobile(viewerId, viewerHandle, creatorHandle, 'off');
}
