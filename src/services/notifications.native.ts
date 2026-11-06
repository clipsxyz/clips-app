import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { apiRequest } from '../api/client';
import { extractPushPayload } from '../utils/pushPayload';
import { handleBackgroundPush } from './pushPayloadNative';
import { handleNotificationRouting } from '../utils/navigationService';
import { clearCachedFcmToken, getLastSyncedFcmToken, subscribeFcmTokenRefresh, syncFCMToken } from './fcmService';
import { hasNotificationPermission } from '../utils/permissions';

export { syncFCMToken, clearCachedFcmToken } from './fcmService';
export { hasNotificationPermission, isPushNotificationAuthorized, requestNotificationPermission } from '../utils/permissions';

const NOTIFICATION_PREFS_KEY = 'notification_preferences';

export interface NotificationPreferences {
  enabled: boolean;
  directMessages: boolean;
  groupChats: boolean;
  likes: boolean;
  comments: boolean;
  replies: boolean;
  follows: boolean;
  followRequests: boolean;
  storyInsights: boolean;
  shares: boolean;
  reclips: boolean;
}

export type NotificationPreferenceChannel =
  | 'dm'
  | 'group_chat'
  | 'sticker'
  | 'reply'
  | 'like'
  | 'comment'
  | 'follow'
  | 'follow_request'
  | 'story_insight'
  | 'share'
  | 'reclip';

type NotificationPayload = { data?: Record<string, any>; notification?: { title?: string; body?: string } };
type NotificationInitOptions = {
  onNotificationPress?: (data: Record<string, any>) => void;
};

const defaultPreferences: NotificationPreferences = {
  enabled: false,
  directMessages: true,
  groupChats: true,
  likes: true,
  comments: true,
  replies: true,
  follows: true,
  followRequests: true,
  storyInsights: true,
  shares: true,
  reclips: true,
};

let inMemoryNotificationPrefs: NotificationPreferences = { ...defaultPreferences };
let hydrated = false;
let unsubscribeForeground: (() => void) | null = null;
let unsubscribeOpened: (() => void) | null = null;
let unsubscribeTokenRefresh: (() => void) | null = null;

function getMessagingInstance(): any | null {
  try {
    return typeof messaging === 'function' ? messaging() : messaging;
  } catch (error) {
    console.warn('[FCM] messaging() unavailable:', error);
    return null;
  }
}

async function getCurrentUserIdentity(): Promise<{ id?: string; handle?: string } | null> {
  try {
    let userStr = await AsyncStorage.getItem('user');
    if (!userStr) {
      try {
        userStr = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
      } catch {
        userStr = null;
      }
    }
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

/** Call after login / hydrate so the device token is tied to the Sanctum user. */
export async function registerFcmTokenForCurrentUser(): Promise<string | null> {
  await hydratePreferencesOnce();
  const allowed = await hasNotificationPermission();
  if (!allowed) return null;
  try {
    return await syncFCMToken();
  } catch (error) {
    console.warn('[FCM] register after auth failed:', error);
    return null;
  }
}

async function removeTokenFromBackend(token: string): Promise<void> {
  try {
    const user = await getCurrentUserIdentity();
    await apiRequest('/notifications/fcm-token', {
      method: 'POST',
      body: JSON.stringify({
        token,
        userId: user?.id || user?.handle || 'unknown',
        userHandle: user?.handle || '',
        remove: true,
      }),
    });
    console.log('[FCM] token removed for', user?.handle || user?.id || 'user');
  } catch (error) {
    console.warn('Failed to remove FCM token from backend:', error);
  }
}

async function hydratePreferencesOnce(): Promise<void> {
  if (hydrated) return;
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      delete parsed.questions;
      inMemoryNotificationPrefs = { ...defaultPreferences, ...parsed };
    }
  } catch (error) {
    console.error('Error hydrating notification preferences:', error);
  } finally {
    hydrated = true;
  }
}

void hydratePreferencesOnce();

/** Await AsyncStorage hydrate so Settings toggles match last session (mock + production). */
export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  await hydratePreferencesOnce();
  return getNotificationPreferences();
}

export function getNotificationPreferences(): NotificationPreferences {
  return { ...defaultPreferences, ...inMemoryNotificationPrefs };
}

export function isNotificationTypeEnabled(
  prefs: NotificationPreferences,
  channel: NotificationPreferenceChannel
): boolean {
  if (!prefs.enabled) return false;

  switch (channel) {
    case 'dm':
    case 'sticker':
      return !!prefs.directMessages;
    case 'reply':
      return !!prefs.replies;
    case 'group_chat':
      return !!prefs.groupChats;
    case 'like':
      return !!prefs.likes;
    case 'comment':
      return !!prefs.comments;
    case 'follow':
      return !!prefs.follows;
    case 'follow_request':
      return !!prefs.followRequests;
    case 'story_insight':
      return !!prefs.storyInsights;
    case 'share':
      return !!prefs.shares;
    case 'reclip':
      return !!prefs.reclips;
    default:
      return true;
  }
}

export function saveNotificationPreferences(prefs: NotificationPreferences): void {
  inMemoryNotificationPrefs = { ...defaultPreferences, ...prefs };
  void AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(inMemoryNotificationPrefs)).catch((error) => {
    console.error('Error saving notification preferences:', error);
  });
}

/** Awaitable save for Settings UI (ensures toggle state is on disk before next cold start). */
export async function saveNotificationPreferencesAsync(
  prefs: NotificationPreferences,
): Promise<NotificationPreferences> {
  inMemoryNotificationPrefs = { ...defaultPreferences, ...prefs };
  try {
    await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(inMemoryNotificationPrefs));
  } catch (error) {
    console.error('Error saving notification preferences:', error);
  }
  return getNotificationPreferences();
}

export function resetNotificationPreferences(): NotificationPreferences {
  const next = { ...defaultPreferences };
  saveNotificationPreferences(next);
  return next;
}

export async function getFCMToken(): Promise<string | null> {
  return syncFCMToken();
}

export async function onForegroundMessage(
  callback: (payload: any) => void
): Promise<(() => void) | null> {
  const messaging = await getMessagingInstance();
  if (!messaging || typeof messaging.onMessage !== 'function') return null;
  try {
    const unsubscribe = messaging.onMessage((payload: NotificationPayload) => {
      callback(payload);
    });
    return typeof unsubscribe === 'function' ? unsubscribe : null;
  } catch (error) {
    console.warn('Failed to subscribe foreground messages:', error);
    return null;
  }
}

export function showBrowserNotification(title: string, options?: any): void {
  void title;
  void options;
}

export async function initializeNotifications(options?: NotificationInitOptions): Promise<void> {
  await hydratePreferencesOnce();

  const messaging = await getMessagingInstance();
  if (!messaging) {
    console.log('Native Firebase messaging not installed; notification transport unavailable.');
    return;
  }

  // Register a token only when permission was already granted. The pre-permission
  // modal is what shows the system prompt.
  try {
    const allowed = await hasNotificationPermission();
    if (allowed) await getFCMToken();
  } catch (error) {
    console.warn('Native FCM token fetch failed:', error);
  }

  if (unsubscribeForeground) {
    unsubscribeForeground();
    unsubscribeForeground = null;
  }
  if (unsubscribeOpened) {
    unsubscribeOpened();
    unsubscribeOpened = null;
  }
  if (unsubscribeTokenRefresh) {
    unsubscribeTokenRefresh();
    unsubscribeTokenRefresh = null;
  }
  unsubscribeTokenRefresh = subscribeFcmTokenRefresh();

  // Deep-link listeners always register in mock/dev — tapping a push must navigate even if
  // the master Settings toggle is off (toggle gates delivery, not open handling).
  if (typeof messaging.onNotificationOpenedApp === 'function') {
    unsubscribeOpened = messaging.onNotificationOpenedApp((remoteMessage: NotificationPayload) => {
      handleNotificationRouting(remoteMessage);
      options?.onNotificationPress?.(extractPushPayload(remoteMessage).data);
    });
  }

  if (typeof messaging.getInitialNotification === 'function') {
    try {
      const initial = await messaging.getInitialNotification();
      if (initial) {
        const parsed = extractPushPayload(initial);
        if (Object.keys(parsed.data).length > 0) {
          handleNotificationRouting(initial);
          options?.onNotificationPress?.(parsed.data);
        }
      }
    } catch (error) {
      console.warn('Failed to read initial notification:', error);
    }
  }

  unsubscribeForeground = await onForegroundMessage((payload: NotificationPayload) => {
    const parsed = extractPushPayload(payload);
    if (parsed.title || parsed.body) {
      DeviceEventEmitter.emit('foregroundPush', parsed);
    }
    const data = parsed.data;
    const type = String(data.type || data.notificationType || '').toLowerCase();
    void import('../utils/dispatchBrowserEvent').then(({ dispatchBrowserEvent }) => {
      if (type === 'dm' || type === 'message' || type === 'group_chat' || type === 'sticker' || type === 'reply') {
        dispatchBrowserEvent('conversationUpdated', {
          conversation_id: data.conversation_id || data.conversationId,
          chat_group_id: data.group_id || data.chatGroupId || data.chat_group_id,
          sender_id: data.sender_id || data.senderId,
        });
      }
      dispatchBrowserEvent('notificationsUpdated', {});
      dispatchBrowserEvent('inboxUnreadChanged', {});
    });
  });
}

export function teardownNotifications(): void {
  if (unsubscribeForeground) {
    unsubscribeForeground();
    unsubscribeForeground = null;
  }
  if (unsubscribeOpened) {
    unsubscribeOpened();
    unsubscribeOpened = null;
  }
  if (unsubscribeTokenRefresh) {
    unsubscribeTokenRefresh();
    unsubscribeTokenRefresh = null;
  }
}

export async function registerBackgroundMessageHandler(
  handler?: (payload: Record<string, any>) => Promise<void> | void
): Promise<boolean> {
  const messaging = await getMessagingInstance();
  if (!messaging || typeof messaging.setBackgroundMessageHandler !== 'function') {
    return false;
  }
  try {
    messaging.setBackgroundMessageHandler(async (remoteMessage: NotificationPayload) => {
      await handleBackgroundPush(remoteMessage);
      if (handler) {
        const parsed = extractPushPayload(remoteMessage);
        await handler(parsed.data);
      }
    });
    return true;
  } catch (error) {
    console.warn('Failed to register background message handler:', error);
    return false;
  }
}

export async function clearNotificationSession(): Promise<void> {
  const messaging = getMessagingInstance();
  const tokens = new Set<string>();
  const remembered = getLastSyncedFcmToken();
  if (remembered) tokens.add(remembered);
  try {
    const live = await messaging?.getToken?.();
    if (typeof live === 'string' && live.trim()) tokens.add(live.trim());
  } catch (error) {
    console.warn('[FCM] getToken during logout failed:', error);
  }
  for (const token of tokens) {
    await removeTokenFromBackend(token);
  }
  try {
    await clearCachedFcmToken();
  } catch {
    /* ignore */
  }
  if (messaging && typeof messaging.deleteToken === 'function') {
    try {
      await messaging.deleteToken();
    } catch (error) {
      console.warn('Failed to delete local FCM token:', error);
    }
  }
  teardownNotifications();
}
