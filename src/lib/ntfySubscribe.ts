// Simple ntfy subscribe logic for browser
// Call this on user login or app load to subscribe to global topic

export async function subscribeToNtfyGlobal() {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.active) {
        registration.showNotification('🔔 Notifications enabled!', {
          body: 'You will receive Mai Troll updates.',
          icon: '/img/logo.png',
        });
        return;
      }
    }

    // Fallback for non-SW environments
    new Notification('🔔 Notifications enabled!', {
      body: 'You will receive Mai Troll updates.',
      icon: '/img/logo.png',
    });
  } catch (err) {
    // Ignore errors on mobile/Android where new Notification() is illegal
    console.debug('Failed to show welcome notification:', err);
  }
}
