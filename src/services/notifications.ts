// Notification service with Firebase Cloud Messaging support
// Firebase imports are loaded dynamically to avoid errors if package not installed

// Notification preferences storage key
const NOTIFICATION_PREFS_KEY = 'notification_preferences';
let inMemoryNotificationPrefs: NotificationPreferences | null = null;

function canUseLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

export interface NotificationPreferences {
  enabled: boolean; // Master toggle
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

// Default notification preferences
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

// Get notification preferences from localStorage
export function getNotificationPreferences(): NotificationPreferences {
  if (!canUseLocalStorage()) {
    return inMemoryNotificationPrefs ? { ...defaultPreferences, ...inMemoryNotificationPrefs } : { ...defaultPreferences };
  }
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

// Save notification preferences to localStorage
export function saveNotificationPreferences(prefs: NotificationPreferences): void {
  inMemoryNotificationPrefs = { ...prefs };
  try {
    if (canUseLocalStorage()) {
      localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
    }
    // Also sync to backend if user is logged in
    if (canUseLocalStorage()) {
      syncPreferencesToBackend(prefs);
    }
  } catch (error) {
    console.error('Error saving notification preferences:', error);
  }
}

export function resetNotificationPreferences(): NotificationPreferences {
  const next = { ...defaultPreferences };
  saveNotificationPreferences(next);
  return next;
}

// Sync preferences to backend
async function syncPreferencesToBackend(prefs: NotificationPreferences): Promise<void> {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      return;
    }

    const userData = JSON.parse(userStr);
    const userId = userData.id || userData.handle;

    // Call API to save preferences
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/notifications/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        userHandle: userData.handle,
        preferences: prefs,
      }),
    });

    if (response.ok) {
      console.log('Notification preferences synced to backend');
    } else {
      console.warn('Failed to sync preferences to backend:', response.statusText);
    }
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

// Get FCM token for this device
export async function getFCMToken(): Promise<string | null> {
  try {
    // Dynamically import Firebase module
    const firebaseModule = await import('./firebase').catch(() => null);
    if (!firebaseModule) {
      console.warn('Firebase module not available. Run "npm install" to install Firebase package.');
      return null;
    }

    const { initializeFirebase, initializeMessaging, getFCMToken: getFirebaseToken } = firebaseModule;

    // Initialize Firebase if not already initialized
    const firebaseApp = await initializeFirebase();
    if (!firebaseApp) {
      console.warn('Firebase not initialized. Check your Firebase configuration or run "npm install" to install Firebase package.');
      return null;
    }

    // Initialize messaging
    await initializeMessaging();

    // Get token
    const token = await getFirebaseToken();
    if (token) {
      // Save token to backend
      await saveTokenToBackend(token);
    }
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

// Save FCM token to backend
async function saveTokenToBackend(token: string): Promise<void> {
  try {
    // Get current user from localStorage since we can't import useAuth hook here
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      console.warn('No user found. Cannot save FCM token.');
      return;
    }

    const userData = JSON.parse(userStr);
    const userId = userData.id || userData.handle;

    // Call API to save token
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/notifications/fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        userId,
        userHandle: userData.handle,
      }),
    });

    if (response.ok) {
      console.log('FCM token saved to backend successfully');
    } else {
      console.warn('Failed to save FCM token to backend:', response.statusText);
    }
  } catch (error) {
    console.error('Error saving FCM token to backend:', error);
  }
}

// Listen for foreground messages (when app is open)
export async function onForegroundMessage(
  callback: (payload: any) => void
): Promise<(() => void) | null> {
  try {
    // Dynamically import Firebase module
    const firebaseModule = await import('./firebase').catch(() => null);
    if (!firebaseModule) {
      console.warn('Firebase module not available. Foreground message listening not available.');
      return null;
    }

    const { initializeFirebase, onForegroundMessage: onFirebaseForegroundMessage } = firebaseModule;

    // Initialize Firebase if not already initialized
    const firebaseApp = await initializeFirebase();
    if (!firebaseApp) {
      console.warn('Firebase not initialized. Foreground message listening not available.');
      return null;
    }

    // Set up foreground message listener
    const unsubscribe = await onFirebaseForegroundMessage((payload: { notification?: { title?: string; body?: string; icon?: string }; data?: any }) => {
      // Show browser notification for foreground messages
      if (payload.notification) {
        showBrowserNotification(
          payload.notification.title || 'New Notification',
          {
            body: payload.notification.body,
            icon: payload.notification.icon || '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: payload.data?.id || 'notification',
            data: payload.data || {},
          }
        );
      }
      
      // Call the callback
      callback(payload);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up foreground message listener:', error);
    return null;
  }
}

// Show browser notification (using native browser API only)
export function showBrowserNotification(title: string, options?: NotificationOptions): void {
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

type NotificationInitOptions = {
  onNotificationPress?: (data: Record<string, any>) => void;
};

// Initialize notifications (call this on app startup)
export async function initializeNotifications(_options?: NotificationInitOptions): Promise<void> {
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

    // Dynamically import Firebase module
    const firebaseModule = await import('./firebase').catch(() => null);
    if (!firebaseModule) {
      console.warn('Firebase module not available. Using browser notifications only. Run "npm install" to install Firebase package.');
      return;
    }

    const { initializeFirebase, initializeMessaging } = firebaseModule;

    // Initialize Firebase
    const firebaseApp = await initializeFirebase();
    if (!firebaseApp) {
      console.warn('Firebase initialization failed. Using browser notifications only. Run "npm install" to install Firebase package.');
      return;
    }

    // Initialize Firebase Messaging
    await initializeMessaging();

    // Register service worker for background notifications
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker registered:', registration);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }

    // Get FCM token
    const token = await getFCMToken();
    if (token) {
      console.log('FCM token obtained successfully');
    } else {
      console.warn('FCM token not obtained. Push notifications may not work.');
    }

    // Set up foreground message listener
    try {
      const unsubscribe = await onForegroundMessage((payload: { notification?: { title?: string; body?: string; icon?: string }; data?: any }) => {
        console.log('Foreground notification received:', payload);
      });
      
      // Cleanup on unmount (if needed)
      if (unsubscribe) {
        // Store unsubscribe function for cleanup if needed
      }
    } catch (error) {
      console.warn('Could not set up foreground message listener:', error);
    }

    console.log('Notifications initialized successfully with Firebase Cloud Messaging');
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
}

export function teardownNotifications(): void {
  // Web implementation currently does not retain long-lived listeners here.
}
