import { PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';

function messagingInstance(): any | null {
  try {
    return typeof messaging === 'function' ? messaging() : messaging;
  } catch (error) {
    console.warn('[FCM] messaging() unavailable:', error);
    return null;
  }
}

function authorizationStatuses(): { AUTHORIZED: number; PROVISIONAL: number; DENIED: number } {
  const statuses = (messaging as { AuthorizationStatus?: { AUTHORIZED?: number; PROVISIONAL?: number; DENIED?: number } })
    .AuthorizationStatus;
  return {
    AUTHORIZED: statuses?.AUTHORIZED ?? 1,
    PROVISIONAL: statuses?.PROVISIONAL ?? 2,
    DENIED: statuses?.DENIED ?? 0,
  };
}

function statusIsGranted(status: number): boolean {
  const { AUTHORIZED, PROVISIONAL } = authorizationStatuses();
  return status === AUTHORIZED || status === PROVISIONAL;
}

/**
 * Ask for notification permission once.
 * iOS accepts AUTHORIZED or PROVISIONAL. Android 13+ shows the runtime prompt.
 * Older Android versions are granted at install.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const instance = messagingInstance();
    if (!instance || typeof instance.requestPermission !== 'function') {
      console.warn('[FCM] iOS notification permission unavailable');
      return false;
    }
    try {
      const status = Number(await instance.requestPermission());
      return statusIsGranted(status);
    } catch (error) {
      console.warn('[FCM] iOS notification permission request failed:', error);
      return false;
    }
  }

  if (Platform.OS === 'android') {
    if (Number(Platform.Version) < 33) return true;
    try {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.warn('[FCM] Android notification permission request failed:', error);
      return false;
    }
  }

  return false;
}

/** Current permission only. Does not show the system prompt. */
export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const instance = messagingInstance();
    if (!instance || typeof instance.hasPermission !== 'function') return false;
    try {
      const status = Number(await instance.hasPermission());
      return statusIsGranted(status);
    } catch (error) {
      console.warn('[FCM] iOS notification permission check failed:', error);
      return false;
    }
  }

  if (Platform.OS === 'android') {
    if (Number(Platform.Version) < 33) return true;
    try {
      return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    } catch (error) {
      console.warn('[FCM] Android notification permission check failed:', error);
      return false;
    }
  }

  return false;
}

/** Authorized only. Provisional and denied stay off for the Settings switch. */
export async function isPushNotificationAuthorized(): Promise<boolean> {
  const instance = messagingInstance();
  if (!instance || typeof instance.hasPermission !== 'function') {
    return Platform.OS === 'android' && Number(Platform.Version) < 33;
  }
  try {
    const status = Number(await instance.hasPermission());
    const { AUTHORIZED, PROVISIONAL, DENIED } = authorizationStatuses();
    if (status === AUTHORIZED) return true;
    if (status === PROVISIONAL || status === DENIED) return false;
    return Platform.OS === 'android' && Number(Platform.Version) < 33;
  } catch (error) {
    console.warn('[FCM] push authorization check failed:', error);
    return false;
  }
}
