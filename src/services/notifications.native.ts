import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import { apiRequest } from '../api/client';

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
  questions: boolean;
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
  | 'question'
  | 'share'
  | 'reclip';

type NotificationPermission = 'default' | 'granted' | 'denied';
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
  questions: true,
  shares: true,
  reclips: true,
};

let inMemoryNotificationPrefs: NotificationPreferences = { ...defaultPreferences };
let hydrated = false;
let unsubscribeForeground: (() => void) | null = null;
let unsubscribeOpened: (() => void) | null = null;
let unsubscribeTokenRefresh: (() => void) | null = null;
let currentFcmToken: string | null = null;

function getDynamicRequire(): ((name: string) => any) | null {
  try {
    // Avoid static bundler resolution when package is not installed.
    const req = Function('return typeof require !== "undefined" ? require : null')();
    return typeof req === 'function' ? req : null;
  } catch {
    return null;
  }
}

async function getMessagingInstance(): Promise<any | null> {
  const req = getDynamicRequire();
  if (!req) return null;
  try {
    const messagingModule = req('@react-native-firebase/messaging');
    const factory = messagingModule?.default ?? messagingModule;
    return typeof factory === 'function' ? factory() : null;
  } catch {
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

async function saveTokenToBackend(token: string): Promise<void> {
  try {
    const user = await getCurrentUserIdentity();
    await apiRequest('/notifications/fcm-token', {
      method: 'POST',
      body: JSON.stringify({
        token,
        userId: user?.id || user?.handle || 'unknown',
        userHandle: user?.handle || '',
      }),
    });
  } catch (error) {
    console.warn('Failed to save FCM token to backend:', error);
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
  } catch (error) {
    console.warn('Failed to remove FCM token from backend:', error);
  }
}

async function hydratePreferencesOnce(): Promise<void> {
  if (hydrated) return;
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (stored) {
      inMemoryNotificationPrefs = { ...defaultPreferences, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error hydrating notification preferences:', error);
  } finally {
    hydrated = true;
  }
}

void hydratePreferencesOnce();

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
    case 'reply':
      return !!prefs.directMessages;
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
    case 'question':
      return !!prefs.questions;
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

export function resetNotificationPreferences(): NotificationPreferences {
  const next = { ...defaultPreferences };
  saveNotificationPreferences(next);
  return next;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (Platform.OS !== 'android') {
    return 'granted';
  }

  if (Platform.Version < 33) {
    return 'granted';
  }

  try {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
}

export async function getFCMToken(): Promise<string | null> {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;
  try {
    const token = await messaging.getToken();
    if (token) {
      await saveTokenToBackend(token);
      currentFcmToken = token;
    }
    return token || null;
  } catch (error) {
    console.warn('Failed to get FCM token:', error);
    return null;
  }
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
  const prefs = getNotificationPreferences();
  if (!prefs.enabled) {
    return;
  }
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return;
  }

  const messaging = await getMessagingInstance();
  if (!messaging) {
    console.log('Native Firebase messaging not installed; notification transport unavailable.');
    return;
  }

  try {
    if (Platform.OS === 'ios' && typeof messaging.requestPermission === 'function') {
      await messaging.requestPermission();
    }
  } catch (error) {
    console.warn('Native notification permission request failed:', error);
  }

  await getFCMToken();

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

  unsubscribeForeground = await onForegroundMessage(() => {
    // Keep listener active for future in-app badges/refresh hooks.
  });

  if (typeof messaging.onNotificationOpenedApp === 'function' && options?.onNotificationPress) {
    unsubscribeOpened = messaging.onNotificationOpenedApp((remoteMessage: NotificationPayload) => {
      options.onNotificationPress?.(remoteMessage?.data || {});
    });
  }

  if (typeof messaging.getInitialNotification === 'function' && options?.onNotificationPress) {
    try {
      const initial = await messaging.getInitialNotification();
      if (initial?.data) {
        options.onNotificationPress(initial.data);
      }
    } catch (error) {
      console.warn('Failed to read initial notification:', error);
    }
  }

  if (typeof messaging.onTokenRefresh === 'function') {
    unsubscribeTokenRefresh = messaging.onTokenRefresh((token: string) => {
      currentFcmToken = token;
      void saveTokenToBackend(token);
    });
  }
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
      if (handler) {
        await handler(remoteMessage?.data || {});
      }
    });
    return true;
  } catch (error) {
    console.warn('Failed to register background message handler:', error);
    return false;
  }
}

export async function clearNotificationSession(): Promise<void> {
  const messaging = await getMessagingInstance();
  if (currentFcmToken) {
    await removeTokenFromBackend(currentFcmToken);
    currentFcmToken = null;
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
