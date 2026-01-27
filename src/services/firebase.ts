// Firebase types (will be any if package not installed)
type FirebaseApp = any;
type Messaging = any;

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// VAPID key for web push
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let firebaseAppModule: any = null;
let firebaseMessagingModule: any = null;

// Lazy load Firebase modules to handle missing package gracefully
async function loadFirebaseModules() {
  if (firebaseAppModule && firebaseMessagingModule) {
    return { firebaseAppModule, firebaseMessagingModule };
  }

  try {
    firebaseAppModule = await import('firebase/app');
    firebaseMessagingModule = await import('firebase/messaging');
    return { firebaseAppModule, firebaseMessagingModule };
  } catch (error) {
    console.warn('Firebase package not installed. Run "npm install" to enable push notifications.');
    return { firebaseAppModule: null, firebaseMessagingModule: null };
  }
}

// Initialize Firebase
export async function initializeFirebase(): Promise<FirebaseApp | null> {
  const { firebaseAppModule } = await loadFirebaseModules();
  if (!firebaseAppModule) {
    return null;
  }

  const { initializeApp, getApps } = firebaseAppModule;

  // Check if Firebase is already initialized
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
    return app;
  }

  // Check if all required config values are present
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('Firebase configuration is incomplete. Push notifications will not work.');
    return null;
  }

  try {
    app = initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
    return app;
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    return null;
  }
}

// Initialize Firebase Messaging
export async function initializeMessaging(): Promise<Messaging | null> {
  const { firebaseMessagingModule } = await loadFirebaseModules();
  if (!firebaseMessagingModule) {
    return null;
  }

  const { getMessaging, isSupported } = firebaseMessagingModule;

  // Check if messaging is supported
  const supported = await isSupported();
  if (!supported) {
    console.warn('Firebase Messaging is not supported in this browser');
    return null;
  }

  // Initialize Firebase app first
  if (!app) {
    await initializeFirebase();
  }

  if (!app) {
    return null;
  }

  try {
    messaging = getMessaging(app);
    console.log('Firebase Messaging initialized successfully');
    return messaging;
  } catch (error) {
    console.error('Error initializing Firebase Messaging:', error);
    return null;
  }
}

// Get FCM token
export async function getFCMToken(): Promise<string | null> {
  const { firebaseMessagingModule } = await loadFirebaseModules();
  if (!firebaseMessagingModule) {
    return null;
  }

  const { getToken } = firebaseMessagingModule;

  if (!messaging) {
    await initializeMessaging();
  }

  if (!messaging || !vapidKey) {
    console.warn('Firebase Messaging not initialized or VAPID key missing');
    return null;
  }

  try {
    const token = await getToken(messaging, { vapidKey });
    if (token) {
      console.log('FCM token generated:', token.substring(0, 20) + '...');
      return token;
    } else {
      console.warn('No FCM token available');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

// Listen for foreground messages (when app is open)
export async function onForegroundMessage(
  callback: (payload: { notification?: { title?: string; body?: string; icon?: string }; data?: any }) => void
): Promise<(() => void) | null> {
  const { firebaseMessagingModule } = await loadFirebaseModules();
  if (!firebaseMessagingModule) {
    return null;
  }

  const { onMessage } = firebaseMessagingModule;

  if (!messaging) {
    console.warn('Firebase Messaging not initialized');
    return null;
  }

  try {
    const unsubscribe = onMessage(messaging, (payload: any) => {
      console.log('Foreground message received:', payload);
      callback(payload);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up foreground message listener:', error);
    return null;
  }
}

// Get Firebase app instance
export function getFirebaseApp(): FirebaseApp | null {
  return app;
}

// Get messaging instance
export function getMessagingInstance(): Messaging | null {
  return messaging;
}
