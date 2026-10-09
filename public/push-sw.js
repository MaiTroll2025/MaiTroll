/* global clients */
// Push Notification Handler
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'Mai Troll Notification';
  const options = {
    body: data.body || 'New update from Mai Troll!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    data: data.url || '/',
    vibrate: [200, 100, 200],
    sound: '/sounds/click.mp3',
    requireInteraction: true,
    tag: data.tag || 'default',
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
  
  // Play sound in service worker context
  if (data.playSound !== false) {
    try {
      const audio = new Audio('/sounds/click.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {}); // Ignore autoplay restrictions
    } catch (_e) {
      // Audio not supported in this context
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data || '/');
      }
    })
  );
});

// Handle notification actions
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});
