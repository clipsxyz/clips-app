import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { apiRequest } from '../api/client';
import { hasNotificationPermission } from '../utils/permissions';

export const FCM_TOKEN_STORAGE_KEY = '@gazetteer_fcm_token';
const LEGACY_FCM_TOKEN_KEY = 'fcm_device_token';

let lastSyncedToken: string | null = null;

function messagingInstance(): any | null {
  try {
    return typeof messaging === 'function' ? messaging() : messaging;
  } catch (error) {
    console.warn('[FCM] messaging() unavailable:', error);
    return null;
  }
}

async function getCurrentUserIdentity(): Promise<{ id?: string; handle?: string } | null> {
  try {
    const userStr = await AsyncStorage.getItem('user');
    if (!userStr) return null;
    const userData = JSON.parse(userStr);
    return {
      id: userData?.id ? String(userData.id) : undefined,
      handle: userData?.handle ? String(userData.handle) : undefined,
    };
  } catch {
    return null;
  }
}

function parseCachedToken(raw: string | null): { token: string; userId: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token?: unknown; fcm_token?: unknown; userId?: unknown };
    const token = typeof parsed?.token === 'string'
      ? parsed.token
      : typeof parsed?.fcm_token === 'string'
        ? parsed.fcm_token
        : '';
    if (!token) return null;
    return { token, userId: typeof parsed?.userId === 'string' ? parsed.userId : '' };
  } catch {
    return { token: raw, userId: '' };
  }
}

async function readCachedFcmToken(): Promise<{ token: string; userId: string } | null> {
  const current = parseCachedToken(await AsyncStorage.getItem(FCM_TOKEN_STORAGE_KEY));
  if (current) return current;
  return parseCachedToken(await AsyncStorage.getItem(LEGACY_FCM_TOKEN_KEY));
}

/**
 * Register the device token when it changed. A matching `@gazetteer_fcm_token` skips the POST.
 */
export async function syncFCMToken(refreshedToken?: string): Promise<string | null> {
  const instance = messagingInstance();
  let token = String(refreshedToken || '').trim();
  if (!token) {
    if (!instance || typeof instance.getToken !== 'function') {
      console.warn('[FCM] messaging module unavailable');
      return null;
    }
    try {
      token = String((await instance.getToken()) || '').trim();
    } catch (error) {
      console.warn('Failed to get FCM token:', error);
      return null;
    }
  }
  if (!token) {
    console.warn('[FCM] getToken returned empty');
    return null;
  }

  console.log('[FCM] device token:', token);
  lastSyncedToken = token;

  const user = await getCurrentUserIdentity();
  const userId = user?.id && user.id !== 'unknown' ? user.id : '';
  if (!userId) {
    console.log('[FCM] skip token save until user is signed in');
    return token;
  }

  const cached = await readCachedFcmToken();
  if (cached?.token === token && cached.userId === userId) {
    console.log('[FCM] token unchanged; skipping registration');
    return token;
  }

  try {
    await apiRequest('/fcm-token', {
      method: 'POST',
      body: JSON.stringify({ fcm_token: token, token }),
    });
  } catch (error) {
    console.warn('Failed to save FCM token to backend:', error);
    return token;
  }

  try {
    await AsyncStorage.setItem(FCM_TOKEN_STORAGE_KEY, JSON.stringify({ token, userId }));
    await AsyncStorage.removeItem(LEGACY_FCM_TOKEN_KEY);
  } catch (error) {
    console.warn('[FCM] failed to cache token:', error);
  }
  return token;
}

export function getLastSyncedFcmToken(): string | null {
  return lastSyncedToken;
}

export async function clearCachedFcmToken(): Promise<void> {
  lastSyncedToken = null;
  await AsyncStorage.multiRemove([FCM_TOKEN_STORAGE_KEY, LEGACY_FCM_TOKEN_KEY]);
}

/** Keep a rotated device token in sync with the API and AsyncStorage. */
export function subscribeFcmTokenRefresh(): () => void {
  const instance = messagingInstance();
  if (!instance || typeof instance.onTokenRefresh !== 'function') return () => {};
  return instance.onTokenRefresh((newToken: string) => {
    console.log('[FCM] device token (refresh):', newToken);
    void (async () => {
      const allowed = await hasNotificationPermission();
      if (!allowed) return;
      await syncFCMToken(newToken);
    })();
  });
}
