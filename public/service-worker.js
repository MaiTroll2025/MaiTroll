// Service Worker for MaiTroll — production-ready stub
// Registers successfully without external dependencies that could fail evaluation.

self.addEventListener('install', (event) => {
  console.log('[SW] Installing');
  if (self.skipWaiting) {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating');
  event.waitUntil(
    (async () => {
      try {
        if (self.clients && self.clients.claim) {
          await self.clients.claim();
        }
      } catch {
        // ignore
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  // No-op fetch handler — allows the browser to handle all network requests directly.
  // This SW exists to provide a valid registration target without external imports.
});

self.addEventListener('push', (event) => {
  let pushData = {};
  try {
    pushData = event.data ? event.data.json() : {};
  } catch {
    pushData = { body: event.data ? event.data.text() : '' };
  }

  const data = pushData.data && typeof pushData.data === 'object' ? pushData.data : {};
  const url = data.url || data.route || pushData.url || '/';
  const payload = {
    ...pushData,
    url,
    data,
  };
  const notificationId = data.notification_id || pushData.notification_id;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visibleWindow = windows.find((client) => client.visibilityState === 'visible');
    if (visibleWindow) {
      visibleWindow.postMessage({ type: 'PUSH_RECEIVED', payload });
      return;
    }

    await self.registration.showNotification(pushData.title || 'MaiTroll', {
      body: pushData.body || 'New notification',
      icon: pushData.icon || '/icons/icon-192.png',
      badge: pushData.badge || '/icons/icon-72.png',
      image: pushData.image,
      tag: notificationId || `maitroll-${Date.now()}`,
      data: { ...data, url },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const requestedUrl = event.notification.data?.url || '/';
  const targetUrl = new URL(requestedUrl, self.location.origin);
  const url = targetUrl.origin === self.location.origin ? targetUrl.href : self.location.origin;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existingWindow = windows[0];
    if (existingWindow) {
      await existingWindow.navigate(url);
      await existingWindow.focus();
      return;
    }
    await self.clients.openWindow(url);
  })());
});

console.log('[SW] Mai Troll Service Worker loaded');
