// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration - will be replaced at build time or use environment variables
// For now, using placeholder values that should be replaced
const firebaseConfig = {
  apiKey: "AIzaSyDwXNRlyVWVkR-wYs9015atOaaRyntypQs",
  authDomain: "gazetter26.firebaseapp.com",
  projectId: "gazetter26",
  storageBucket: "gazetter26.firebasestorage.app",
  messagingSenderId: "257169934666",
  appId: "1:257169934666:web:852776ad1c87ce4126d9b3",
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
