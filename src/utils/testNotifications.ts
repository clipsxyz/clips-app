// Test utility for notifications (mock testing without Firebase)
// Note: Browser popups use the native Notification API; Inbox uses createNotification().

/**
 * Test browser notification (works without Firebase)
 * This is a mock test that doesn't require Firebase setup
 */
export function testBrowserNotification(): void {
  if (!('Notification' in window)) {
    alert('This browser does not support notifications');
    return;
  }

  if (Notification.permission === 'denied') {
    alert('Notification permission is denied. Please enable it in browser settings.');
    return;
  }

  if (Notification.permission === 'default') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        showTestNotification();
      } else {
        alert('Notification permission was denied.');
      }
    });
  } else {
    showTestNotification();
  }
}

function showTestNotification(): void {
  // Check if notifications are supported
  if (!('Notification' in window)) {
    alert('This browser does not support notifications');
    return;
  }

  // Check permission
  if (Notification.permission !== 'granted') {
    alert('Notification permission is not granted. Please enable notifications first.');
    return;
  }

  const notification = new Notification('Test Notification 🧪', {
    body: 'This is a test notification from Gazetteer. If you see this, browser notifications are working!',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'test-notification',
    requireInteraction: false,
    silent: false,
    data: {
      type: 'test',
      timestamp: Date.now(),
    },
  });

  // Close notification after 5 seconds
  setTimeout(() => {
    notification.close();
  }, 5000);

  // Handle click
  notification.onclick = () => {
    console.log('Test notification clicked!');
    notification.close();
    window.focus();
  };
}

/**
 * Test different notification types (simulating Firebase payloads)
 */
export function testNotificationTypes(): void {
  const types = [
    {
      title: 'New Direct Message 💬',
      body: 'Bob@Dublin sent you a message',
      data: { type: 'dm', conversationId: 'bob@dublin', url: '/messages/bob@dublin' },
    },
    {
      title: 'New Like ❤️',
      body: 'Alice@Cork liked your post',
      data: { type: 'like', postId: '123', url: '/clip/123' },
    },
    {
      title: 'New Comment 💭',
      body: 'Charlie@Galway commented on your post',
      data: { type: 'comment', postId: '123', url: '/clip/123' },
    },
    {
      title: 'New Follower 👤',
      body: 'Diana@Limerick started following you',
      data: { type: 'follow', userHandle: 'diana@limerick', url: '/user/diana@limerick' },
    },
  ];

  let index = 0;
  const showNext = () => {
    if (index >= types.length) {
      console.log('All test notifications shown!');
      return;
    }

    const notif = types[index];
    const notification = new Notification(notif.title, {
      body: notif.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: `test-${notif.data.type}-${index}`,
      data: notif.data,
    });

    notification.onclick = () => {
      console.log('Notification clicked:', notif.data);
      notification.close();
      if (notif.data.url) {
        window.location.href = notif.data.url;
      }
    };

    // Show next notification after 3 seconds
    setTimeout(() => {
      notification.close();
      index++;
      if (index < types.length) {
        setTimeout(showNext, 1000);
      }
    }, 3000);
  };

  showNext();
}

/**
 * Test notification with image
 */
export function testImageNotification(): void {
  // Check if notifications are supported
  if (!('Notification' in window)) {
    alert('This browser does not support notifications');
    return;
  }

  // Check permission
  if (Notification.permission !== 'granted') {
    alert('Notification permission is not granted. Please enable notifications first.');
    return;
  }

  const notification = new Notification('New Story 📸', {
    body: 'Bob@Dublin posted a new story',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'test-story',
    data: {
      type: 'story',
      userHandle: 'bob@dublin',
      url: '/stories',
    },
  });

  notification.onclick = () => {
    console.log('Story notification clicked!');
    notification.close();
    window.location.href = '/stories';
  };

  setTimeout(() => notification.close(), 5000);
}

/** Run full Firebase FCM check; saves token to backend when successful. */
export async function testFirebasePushConnection(): Promise<{
  ok: boolean;
  message: string;
  steps: { label: string; pass: boolean; detail?: string }[];
}> {
  const { verifyFirebasePushSetup } = await import('../services/firebase');
  const diag = await verifyFirebasePushSetup();

  if (diag.ok && diag.tokenPreview) {
    try {
      const { getFCMToken } = await import('../services/notifications');
      await getFCMToken();
    } catch {
      /* token already obtained in verify */
    }
    return {
      ok: true,
      message: `Firebase push is working. Token: ${diag.tokenPreview}`,
      steps: diag.steps,
    };
  }

  const failed = diag.steps.find((s) => !s.pass);
  return {
    ok: false,
    message: diag.error || failed?.detail || failed?.label || 'Firebase push setup incomplete',
    steps: diag.steps,
  };
}

/** Add sample rows to Inbox → Notifications (and optional desktop popups). */
export async function seedInboxTestNotifications(): Promise<number> {
  let toHandle = '';
  try {
    const userStr =
      typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
    if (userStr) {
      const user = JSON.parse(userStr);
      toHandle = String(user?.handle || '');
    }
  } catch {
    // fall through
  }
  if (!toHandle) {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        toHandle = String(user?.handle || '');
      }
    } catch {
      // ignore
    }
  }
  if (!toHandle) {
    throw new Error('Sign in first.');
  }

  // Master toggle must be on or createNotification marks items read / filters them out.
  const { saveNotificationPreferences, getNotificationPreferences } = await import(
    '../services/notifications'
  );
  const prefs = getNotificationPreferences();
  if (!prefs.enabled) {
    saveNotificationPreferences({ ...prefs, enabled: true });
  }

  const { createNotification } = await import('../api/notifications');
  const samples: Array<{
    type: 'like' | 'comment' | 'follow' | 'dm';
    fromHandle: string;
    message?: string;
    postId?: string;
  }> = [
    { type: 'like', fromHandle: 'Alice@Cork', message: 'liked your post', postId: 'test-post-1' },
    { type: 'comment', fromHandle: 'Charlie@Galway', message: 'Nice shot!', postId: 'test-post-1' },
    { type: 'follow', fromHandle: 'Diana@Limerick', message: 'started following you' },
    { type: 'dm', fromHandle: 'Bob@Dublin', message: 'Hey, saw your post!' },
  ];

  let created = 0;
  for (const sample of samples) {
    await createNotification({
      type: sample.type,
      fromHandle: sample.fromHandle,
      toHandle,
      message: sample.message,
      postId: sample.postId,
    });
    created += 1;
  }

  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Inbox test ready', {
        body: `${created} notifications added. Open Inbox → Notifications.`,
        icon: '/icon-192x192.png',
      });
    }
  } catch {
    // RN / unsupported
  }

  return created;
}

/**
 * Test notification preferences
 */
export function testNotificationPreferences(): void {
  const prefs = {
    enabled: true,
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

  console.log('Current notification preferences:', prefs);
  alert(`Notification Preferences:\n\n${JSON.stringify(prefs, null, 2)}`);
}
