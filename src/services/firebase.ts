import { getRuntimeEnv } from '../config/runtimeEnv';

// Firebase types (will be any if package not installed)
type FirebaseApp = any;
type Messaging = any;

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: getRuntimeEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getRuntimeEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getRuntimeEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getRuntimeEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getRuntimeEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getRuntimeEnv('VITE_FIREBASE_APP_ID'),
  measurementId: getRuntimeEnv('VITE_FIREBASE_MEASUREMENT_ID'),
};

// VAPID key for web push
const vapidKey = getRuntimeEnv('VITE_FIREBASE_VAPID_KEY');

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

// Initialize Firebase Messaging (must use the same service worker registration as getToken)
export async function initializeMessaging(
  serviceWorkerRegistration?: ServiceWorkerRegistration | null
): Promise<Messaging | null> {
  const { firebaseMessagingModule } = await loadFirebaseModules();
  if (!firebaseMessagingModule) {
    return null;
  }

  const { getMessaging, isSupported } = firebaseMessagingModule;

  const supported = await isSupported();
  if (!supported) {
    console.warn('Firebase Messaging is not supported in this browser');
    return null;
  }

  if (!app) {
    await initializeFirebase();
  }

  if (!app) {
    return null;
  }

  const swReg =
    serviceWorkerRegistration ?? (await getMessagingServiceWorkerRegistration());
  if (!swReg) {
    console.warn('Service worker required before Firebase Messaging can start');
    return null;
  }

  try {
    messaging = getMessaging(app, swReg);
    console.log('Firebase Messaging initialized successfully');
    return messaging;
  } catch (error) {
    console.error('Error initializing Firebase Messaging:', error);
    return null;
  }
}

async function getMessagingServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    let registration =
      (await navigator.serviceWorker.getRegistration()) ??
      (await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' }));
    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

export type FirebasePushDiagnostics = {
  ok: boolean;
  steps: { label: string; pass: boolean; detail?: string }[];
  tokenPreview?: string;
  error?: string;
};

export async function verifyFirebasePushSetup(): Promise<FirebasePushDiagnostics> {
  const steps: FirebasePushDiagnostics['steps'] = [];

  const hasApiKey = Boolean(firebaseConfig.apiKey?.trim());
  const hasProject = Boolean(firebaseConfig.projectId?.trim());
  const hasAppId = Boolean(firebaseConfig.appId?.trim());
  const hasVapid = Boolean(vapidKey?.trim());

  steps.push({
    label: 'Firebase API key',
    pass: hasApiKey,
    detail: hasApiKey ? 'Set in .env' : 'Add VITE_FIREBASE_API_KEY',
  });
  steps.push({
    label: 'Firebase project & app id',
    pass: hasProject && hasAppId,
    detail: hasProject && hasAppId ? firebaseConfig.projectId : 'Add VITE_FIREBASE_PROJECT_ID and VITE_FIREBASE_APP_ID',
  });
  steps.push({
    label: 'Web Push VAPID key',
    pass: hasVapid,
    detail: hasVapid
      ? 'Set in .env'
      : 'Firebase Console → Cloud Messaging → Web Push → add to firebase-web.local.json → npm run sync:env',
  });

  if (!('Notification' in window)) {
    steps.push({ label: 'Browser notifications', pass: false, detail: 'Not supported' });
    return { ok: false, steps, error: 'Browser does not support notifications' };
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : Notification.permission === 'denied'
        ? 'denied'
        : await Notification.requestPermission();

  steps.push({
    label: 'Notification permission',
    pass: permission === 'granted',
    detail: permission,
  });

  if (permission !== 'granted') {
    return { ok: false, steps, error: 'Allow notifications in the browser' };
  }

  const { firebaseMessagingModule } = await loadFirebaseModules();
  if (!firebaseMessagingModule) {
    steps.push({ label: 'Firebase SDK', pass: false, detail: 'Run npm install' });
    return { ok: false, steps, error: 'Firebase package not loaded' };
  }

  const { isSupported } = firebaseMessagingModule;
  const supported = await isSupported();
  steps.push({
    label: 'FCM supported in this browser',
    pass: supported,
    detail: supported ? 'Yes' : 'Try Chrome or Edge on desktop',
  });

  if (!supported) {
    return { ok: false, steps, error: 'Firebase Messaging not supported here' };
  }

  const swReg = await getMessagingServiceWorkerRegistration();
  steps.push({
    label: 'Service worker',
    pass: !!swReg,
    detail: swReg ? '/firebase-messaging-sw.js' : 'Registration failed',
  });

  if (!hasVapid) {
    return {
      ok: false,
      steps,
      error: 'VAPID key not loaded — restart npm run dev after editing .env',
    };
  }
  if (!swReg) {
    return {
      ok: false,
      steps,
      error: 'Service worker failed — hard refresh (Ctrl+Shift+R) or clear site data for localhost',
    };
  }

  const appInstance = await initializeFirebase();
  if (!appInstance) {
    steps.push({ label: 'Firebase app init', pass: false });
    return { ok: false, steps, error: 'Firebase failed to initialize' };
  }

  let token: string | null = null;
  let tokenError = '';
  try {
    token = await getFCMToken();
  } catch (err) {
    tokenError = err instanceof Error ? err.message : String(err);
  }
  steps.push({
    label: 'FCM device token',
    pass: !!token,
    detail: token
      ? `${token.slice(0, 12)}…`
      : tokenError || 'Could not get token — see browser Console (F12)',
  });

  return {
    ok: !!token,
    steps,
    tokenPreview: token ? `${token.slice(0, 16)}…` : undefined,
    error: token ? undefined : tokenError || 'No FCM token',
  };
}

// Get FCM token
export async function getFCMToken(): Promise<string | null> {
  const { firebaseMessagingModule } = await loadFirebaseModules();
  if (!firebaseMessagingModule) {
    return null;
  }

  const { getToken } = firebaseMessagingModule;

  if (!vapidKey) {
    console.warn('VAPID key missing — add VITE_FIREBASE_VAPID_KEY to .env and restart npm run dev');
    return null;
  }

  const serviceWorkerRegistration = await getMessagingServiceWorkerRegistration();
  if (!serviceWorkerRegistration) {
    console.warn('No service worker registration for FCM');
    return null;
  }

  if (!messaging) {
    await initializeMessaging(serviceWorkerRegistration);
  }

  if (!messaging) {
    return null;
  }

  try {
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    });
    if (token) {
      console.log('FCM token generated:', token.substring(0, 20) + '...');
      return token;
    }
    console.warn('No FCM token available');
    return null;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    throw error;
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
