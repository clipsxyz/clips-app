// Test utility for notifications (mock testing without Firebase)
// Note: This uses the browser's native Notification API, not Firebase

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

/**
 * Test notification preferences
 */
export function testNotificationPreferences(): void {
  const prefs = {
    enabled: true,
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

  console.log('Current notification preferences:', prefs);
  alert(`Notification Preferences:\n\n${JSON.stringify(prefs, null, 2)}`);
}
