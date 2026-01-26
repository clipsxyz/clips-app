# Firebase Cloud Messaging (FCM) Setup Guide

This guide will help you set up Firebase Cloud Messaging for push notifications in your app.

## Prerequisites

1. A Firebase account (create one at https://firebase.google.com)
2. A Firebase project created

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard

## Step 2: Add Web App to Firebase

1. In Firebase Console, click the web icon (`</>`) to add a web app
2. Register your app with a nickname (e.g., "Gazetteer Web")
3. Copy the Firebase configuration object

## Step 3: Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. Find your web app and copy the config values:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`
   - `measurementId` (optional)

## Step 4: Generate VAPID Key

1. In Firebase Console, go to **Project Settings** > **Cloud Messaging** tab
2. Scroll to **Web Push certificates** section
3. If no key exists, click **Generate key pair**
4. Copy the **Key pair** (this is your VAPID key)

## Step 5: Configure Environment Variables

1. Copy `env.example` to `.env` (if it doesn't exist)
2. Add your Firebase configuration:

```env
## Firebase Configuration (for Push Notifications)
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_FIREBASE_VAPID_KEY=your-vapid-key-here
```

## Step 6: Install Firebase Package

```bash
npm install firebase
```

## Step 7: Create Service Worker (Optional but Recommended)

For background notifications, create a service worker file:

**`public/firebase-messaging-sw.js`:**

```javascript
// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp({
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
});

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: payload.data?.id || 'notification',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

## Step 8: Register Service Worker

The service worker will be automatically registered when you initialize notifications in the app.

## Step 9: Test Notifications

1. Start your app: `npm run dev`
2. Go to Profile Page > Settings
3. Enable "Push Notifications"
4. Grant browser permission when prompted
5. Test by sending a notification from Firebase Console:
   - Go to **Cloud Messaging** in Firebase Console
   - Click **Send test message**
   - Enter your FCM token (check browser console)
   - Send the message

## iOS Setup (Additional Steps)

For iOS, you need to:

1. Add your Apple Developer account to Firebase
2. Upload your APNs certificate or key
3. Configure iOS app in Firebase Console

## Android Setup (Additional Steps)

For Android, you need to:

1. Add your Android app to Firebase
2. Download `google-services.json`
3. Add it to your Android project

## Backend Integration

To send notifications from your Laravel backend:

1. Install Firebase Admin SDK:
   ```bash
   composer require kreait/firebase-php
   ```

2. Create a service to send notifications:
   ```php
   use Kreait\Firebase\Factory;
   use Kreait\Firebase\Messaging\CloudMessage;
   use Kreait\Firebase\Messaging\Notification;

   $factory = (new Factory)->withServiceAccount('path/to/service-account.json');
   $messaging = $factory->createMessaging();

   $message = CloudMessage::withTarget('token', $fcmToken)
       ->withNotification(Notification::create('Title', 'Body'))
       ->withData(['type' => 'dm', 'id' => '123']);

   $messaging->send($message);
   ```

## Troubleshooting

### Notifications not working?

1. Check browser console for errors
2. Verify all environment variables are set correctly
3. Check that notification permission is granted
4. Verify FCM token is being generated (check console logs)
5. Make sure service worker is registered

### Permission denied?

- User must grant notification permission
- Some browsers require HTTPS for notifications
- Check browser settings for notification permissions

### Token not generated?

- Check Firebase configuration is correct
- Verify VAPID key is correct
- Check browser console for errors
- Ensure notification permission is granted

## Notification Types

The app supports these notification types:
- `directMessages` - Direct messages
- `likes` - Post likes
- `comments` - Post comments
- `replies` - Comment replies
- `follows` - New followers
- `followRequests` - Follow requests
- `storyInsights` - Story insights
- `questions` - Question answers
- `shares` - Post shares
- `reclips` - Post reclips

Each type can be toggled on/off in Profile > Settings > Push Notifications.
