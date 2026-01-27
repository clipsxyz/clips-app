// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration - will be replaced at build time or use environment variables
// For now, using placeholder values that should be replaced
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: payload.data?.id || 'notification',
    data: payload.data || {},
    requireInteraction: false,
    silent: false,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  
  event.notification.close();

  // Handle different notification types
  const data = event.notification.data;
  if (data && data.url) {
    event.waitUntil(
      clients.openWindow(data.url)
    );
  } else if (data && data.type) {
    // Handle different notification types
    let url = '/';
    switch (data.type) {
      case 'dm':
        url = data.conversationId ? `/messages/${data.conversationId}` : '/inbox';
        break;
      case 'like':
      case 'comment':
      case 'reply':
        url = data.postId ? `/post/${data.postId}` : '/';
        break;
      case 'follow':
        url = data.userHandle ? `/user/${data.userHandle}` : '/';
        break;
      default:
        url = '/';
    }
    event.waitUntil(
      clients.openWindow(url)
    );
  }
});
