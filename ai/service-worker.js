const CACHE_NAME = 'xozen-ai-v1';
const STATIC_ASSETS = [
  '/ai/index.html',
  '/site.css',
  '/glass.css',
  '/gradient-ascii.js',
  '/reveal.js',
  '/glass.js',
  '/light-pillar.js',
  '/ai/manifest.json'
];

// Install event: cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some assets failed to cache:', err);
        // Lanjut meski beberapa asset gagal
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // API calls: network-first dengan timeout
  if (url.pathname.includes('/api/') || url.hostname !== 'localhost') {
    event.respondWith(
      fetch(event.request, { timeout: 8000 })
        .then((response) => {
          // Cache successful responses
          if (response && response.status === 200 && response.type !== 'error') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fall back to cache
          return caches.match(event.request).then((cached) => {
            if (cached) {
              console.log('[SW] Serving from cache:', event.request.url);
              return cached;
            }
            // Return offline page atau empty response
            return new Response('Offline - Unable to fetch', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
        })
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(() => {
        return caches.match('/ai/index.html');
      });
    })
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Jawaban AI siap',
    icon: 'https://i.ibb.co.com/8gqQS0t0/xozen.png',
    badge: 'https://i.ibb.co.com/8gqQS0t0/xozen.png',
    tag: 'xozen-ai-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Buka'
      },
      {
        action: 'close',
        title: 'Tutup'
      }
    ],
    data: {
      url: data.url || '/ai/index.html',
      timestamp: Date.now()
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Xozen AI', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data.url || '/ai/index.html';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Cek jika window sudah terbuka
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Buka window baru jika belum ada
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background Sync: sync ketika online kembali
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncPendingMessages());
  }
});

async function syncPendingMessages() {
  try {
    const db = await openIndexedDB();
    const pending = await getPendingMessages(db);
    
    for (const message of pending) {
      try {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        });
        
        if (response.ok) {
          await removePendingMessage(db, message.id);
        }
      } catch (err) {
        console.warn('[SW] Failed to sync message:', err);
      }
    }
  } catch (err) {
    console.warn('[SW] Sync failed:', err);
  }
}

// IndexedDB helpers (simplified)
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('XozenAI', 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pending')) {
        db.createObjectStore('pending', { keyPath: 'id' });
      }
    };
  });
}

function getPendingMessages(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending', 'readonly');
    const req = tx.objectStore('pending').getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

function removePendingMessage(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending', 'readwrite');
    const req = tx.objectStore('pending').delete(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

// Periodic background sync (jika didukung)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkNewNotifications());
  }
});

async function checkNewNotifications() {
  try {
    const response = await fetch('/api/notifications');
    if (response.ok) {
      const data = await response.json();
      if (data.hasNew) {
        await self.registration.showNotification('Ada notifikasi baru', {
          body: data.message,
          icon: 'https://i.ibb.co.com/8gqQS0t0/xozen.png',
          tag: 'xozen-periodic-check'
        });
      }
    }
  } catch (err) {
    console.warn('[SW] Periodic check failed:', err);
  }
}
