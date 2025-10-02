const CACHE_NAME = 'gossapp-mobile-v1';
const STATIC_CACHE = 'gossapp-static-mobile-v1';
const DYNAMIC_CACHE = 'gossapp-dynamic-mobile-v1';
const IMAGE_CACHE = 'gossapp-images-mobile-v1';
const API_CACHE = 'gossapp-api-mobile-v1';

// Cache size limits for mobile
const CACHE_LIMITS = {
  [DYNAMIC_CACHE]: 30,
  [IMAGE_CACHE]: 50,
  [API_CACHE]: 20
};

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html'
];

// Utility function to limit cache size
async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    const keysToDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Mobile SW: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Mobile SW: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Mobile SW: Static files cached');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Mobile SW: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheName.includes('mobile-v1')) {
              console.log('Mobile SW: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Mobile SW: Activated');
        return self.clients.claim();
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Mobile SW: Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-offline-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

// Push notification handler optimized for mobile
self.addEventListener('push', (event) => {
  console.log('Mobile SW: Push notification received');
  
  const options = {
    body: 'You have new activity on Gossapp!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    silent: false,
    requireInteraction: false,
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Open',
        icon: '/icons/action-open.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      options.body = payload.body || options.body;
      options.data = payload.data || options.data;
      options.vibrate = payload.vibrate || options.vibrate;
    } catch (e) {
      console.error('Failed to parse push payload:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification('Gossapp', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Mobile SW: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Fetch event - mobile-optimized caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external requests
  if (url.origin !== location.origin) {
    return;
  }

  // Different strategies for different content types
  if (request.destination === 'image') {
    event.respondWith(handleImageRequest(request));
  } else if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request));
  } else {
    event.respondWith(handleNavigationRequest(request));
  }
});

// Handle image requests with aggressive caching for mobile
async function handleImageRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // For mobile, we want to be more aggressive about caching
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      const cache = await caches.open(IMAGE_CACHE);
      cache.put(request, networkResponse.clone());
      await limitCacheSize(IMAGE_CACHE, CACHE_LIMITS[IMAGE_CACHE]);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Image request failed:', error);
    // Return a minimal placeholder
    return new Response('', { status: 404 });
  }
}

// Handle API requests with mobile-first strategy
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  
  // For feed requests, try cache first to improve perceived performance
  if (url.pathname.includes('/posts') || url.pathname.includes('/feed')) {
    try {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        // Return cached response immediately
        const response = cachedResponse.clone();
        
        // Update cache in background
        fetch(request).then(networkResponse => {
          if (networkResponse.status === 200) {
            caches.open(API_CACHE).then(cache => {
              cache.put(request, networkResponse.clone());
              limitCacheSize(API_CACHE, CACHE_LIMITS[API_CACHE]);
            });
          }
        }).catch(() => {
          // Ignore network errors for background updates
        });
        
        return response;
      }
    } catch (e) {
      // Continue to network request
    }
  }
  
  // Network-first for other API requests
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.status === 200) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
      await limitCacheSize(API_CACHE, CACHE_LIMITS[API_CACHE]);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('API request failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response
    return new Response(JSON.stringify({
      error: 'Offline',
      message: 'This content is not available offline'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle navigation requests
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      await limitCacheSize(DYNAMIC_CACHE, CACHE_LIMITS[DYNAMIC_CACHE]);
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.destination === 'document') {
      return caches.match('/offline.html');
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Sync offline actions when back online
async function syncOfflineActions() {
  try {
    // This would integrate with your offline action queue
    console.log('Mobile SW: Syncing offline actions...');
    
    // Notify the main app that sync is happening
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_START'
      });
    });
    
    // Simulate sync process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Notify completion
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE'
      });
    });
    
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('Mobile SW: Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then(cache => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});
