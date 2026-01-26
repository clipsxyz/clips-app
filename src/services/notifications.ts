// Notification service (Firebase removed - using browser notifications only)
// Note: Push notifications via Firebase have been removed to fix server startup issues
import { apiClient } from '../api/client';

// Notification preferences storage key
const NOTIFICATION_PREFS_KEY = 'notification_preferences';

export interface NotificationPreferences {
  enabled: boolean; // Master toggle
  directMessages: boolean;
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

// Default notification preferences
const defaultPreferences: NotificationPreferences = {
  enabled: false,
  directMessages: true,
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

// Get notification preferences from localStorage
export function getNotificationPreferences(): NotificationPreferences {
  try {
    const stored = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (stored) {
      return { ...defaultPreferences, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error reading notification preferences:', error);
  }
  return { ...defaultPreferences };
}

// Save notification preferences to localStorage
export function saveNotificationPreferences(prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
    // Also sync to backend if user is logged in
    syncPreferencesToBackend(prefs);
  } catch (error) {
    console.error('Error saving notification preferences:', error);
  }
}

// Sync preferences to backend
async function syncPreferencesToBackend(prefs: NotificationPreferences): Promise<void> {
  try {
    // TODO: Implement API endpoint to save notification preferences
    // await apiClient.updateNotificationPreferences(prefs);
  } catch (error) {
    console.error('Error syncing preferences to backend:', error);
  }
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  // Request permission
  const permission = await Notification.requestPermission();
  return permission;
}

// Get FCM token for this device (disabled - Firebase removed)
export async function getFCMToken(): Promise<string | null> {
  console.warn('Firebase Cloud Messaging has been removed. Push notifications are not available.');
  return null;
}

// Save FCM token to backend
async function saveTokenToBackend(token: string): Promise<void> {
  try {
    // TODO: Implement API endpoint to save FCM token
    // await apiClient.saveFCMToken(token);
    console.log('FCM token saved to backend:', token.substring(0, 20) + '...');
  } catch (error) {
    console.error('Error saving FCM token to backend:', error);
  }
}

// Listen for foreground messages (when app is open) - disabled (Firebase removed)
export function onForegroundMessage(
  callback: (payload: any) => void
): (() => void) | null {
  console.warn('Firebase Cloud Messaging has been removed. Foreground message listening is not available.');
  return null;
}

// Show browser notification (using native browser API only)
function showBrowserNotification(title: string, options?: NotificationOptions): void {
  const prefs = getNotificationPreferences();
  if (!prefs.enabled) {
    return;
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      ...options,
    });
  }
}

// Initialize notifications (call this on app startup) - Browser notifications only
export async function initializeNotifications(): Promise<void> {
  try {
    const prefs = getNotificationPreferences();
    if (!prefs.enabled) {
      console.log('Notifications disabled in preferences');
      return;
    }

    // Request permission for browser notifications
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    console.log('Browser notifications initialized successfully (Firebase push notifications removed)');
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
}
