export function getVapidPublicKey(): string | null {
  try {
    const envKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (typeof envKey === 'string' && envKey.trim()) {
      return envKey.trim();
    }
  } catch {
    // ignore
  }

  try {
    const globalKey = (window as any).__VAPID_PUBLIC_KEY__;
    if (typeof globalKey === 'string' && globalKey.trim()) {
      return globalKey.trim();
    }
  } catch {
    // ignore
  }

  return null;
}
