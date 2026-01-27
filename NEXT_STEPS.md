# Firebase Setup - Next Steps Checklist ✅

## Step 1: Install Firebase Package ⬜
```bash
npm install
```
This will install the `firebase` package (v10.7.1) that's already in your `package.json`.

---

## Step 2: Set Up Firebase Project ⬜

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Sign in with your Google account

2. **Create or Select Project**
   - Click "Add project" or select existing
   - Enter project name (e.g., "Gazetteer")
   - Follow the setup wizard

3. **Add Web App**
   - Click the `</>` (web) icon
   - Register app name (e.g., "Gazetteer Web")
   - **Copy the Firebase configuration object** (you'll need these values)

---

## Step 3: Get VAPID Key ⬜

1. In Firebase Console, go to: **Project Settings** (gear icon) > **Cloud Messaging** tab
2. Scroll down to **Web Push certificates** section
3. Click **Generate key pair** (if you don't have one)
4. **Copy the Key pair** - this is your VAPID key

---

## Step 4: Get Server Key (for Laravel Backend) ⬜

**Option A: Legacy Server Key (Easier)**
1. In Firebase Console: **Project Settings** > **Cloud Messaging** tab
2. Scroll to **Cloud Messaging API (Legacy)**
3. Copy the **Server key**

**Option B: Service Account (More Secure)**
1. **Project Settings** > **Service Accounts** tab
2. Click **Generate new private key**
3. Download the JSON file
4. The server key is in the JSON (or use the legacy key from Option A)

---

## Step 5: Add Environment Variables ⬜

### Frontend `.env` file:
Add these to your root `.env` file:

```env
## Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_FIREBASE_VAPID_KEY=your-vapid-key-here
```

**Where to find these values:**
- All values come from the Firebase config object you copied in Step 2
- `VITE_FIREBASE_VAPID_KEY` comes from Step 3

### Laravel Backend `.env` file:
Add to `laravel-backend/.env`:

```env
## Firebase Configuration (for sending notifications)
FIREBASE_SERVER_KEY=your-server-key-here
FIREBASE_PROJECT_ID=your-project-id
```

**Where to find:**
- `FIREBASE_SERVER_KEY` from Step 4
- `FIREBASE_PROJECT_ID` from Step 2 (same as frontend)

---

## Step 6: Run Database Migrations ⬜

```bash
cd laravel-backend
php artisan migrate
```

This creates:
- `fcm_tokens` table (stores user FCM tokens)
- `notification_preferences` table (stores user notification settings)

---

## Step 7: Test the Setup ⬜

1. **Start your development servers:**
   ```bash
   # Terminal 1: Frontend
   npm run dev
   
   # Terminal 2: Backend (if not already running)
   cd laravel-backend
   php artisan serve
   ```

2. **Open your app in browser:**
   - Go to `http://localhost:5173`
   - Log in to your account

3. **Enable notifications:**
   - Go to **Profile** > **Settings** > **Push Notifications**
   - Toggle notifications ON
   - Grant browser permission when prompted

4. **Check browser console:**
   - Open DevTools (F12)
   - Look for: `"Firebase initialized successfully"`
   - Look for: `"FCM token generated: ..."`
   - Look for: `"FCM token saved to backend successfully"`

5. **Test from Firebase Console:**
   - Go to Firebase Console > **Cloud Messaging** > **Send test message**
   - Copy your FCM token from browser console
   - Paste it in the test message form
   - Send a test notification
   - You should receive it in your browser!

---

## Quick Reference

### Firebase Console Links:
- **Main Console**: https://console.firebase.google.com/
- **Project Settings**: https://console.firebase.google.com/project/_/settings/general
- **Cloud Messaging**: https://console.firebase.google.com/project/_/settings/cloudmessaging

### Files Created:
- ✅ `src/services/firebase.ts` - Firebase initialization
- ✅ `src/services/notifications.ts` - Notification service (updated)
- ✅ `public/firebase-messaging-sw.js` - Service worker
- ✅ `laravel-backend/app/Services/FirebaseNotificationService.php` - Backend service
- ✅ `laravel-backend/app/Http/Controllers/Api/NotificationController.php` - API endpoints
- ✅ Database migrations for FCM tokens and preferences

### API Endpoints Created:
- `POST /api/notifications/fcm-token` - Save FCM token
- `POST /api/notifications/preferences` - Save notification preferences
- `GET /api/notifications/preferences/{userHandle}` - Get preferences

---

## Troubleshooting

**"Firebase configuration is incomplete"**
→ Check all environment variables are set correctly

**"FCM token not obtained"**
→ Check VAPID key is correct, notification permission granted

**"Service Worker registration failed"**
→ Make sure `firebase-messaging-sw.js` is in `public/` folder
→ Check browser console for specific errors

**"Failed to save FCM token to backend"**
→ Check Laravel backend is running
→ Check API endpoint is accessible
→ Check database migrations ran successfully

---

## 🎉 Once Complete

After completing all steps:
- ✅ Push notifications will work in foreground (app open)
- ✅ Push notifications will work in background (app closed)
- ✅ Backend can send notifications via `FirebaseNotificationService`
- ✅ Users can manage notification preferences
- ✅ FCM tokens are stored and synced with backend

**Ready to go!** 🚀
