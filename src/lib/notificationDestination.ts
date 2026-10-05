import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

const GOOGLE_PLAY_LISTING =
  'https://play.google.com/store/apps/details?id=com.maitroll.app'

export function getNotificationDestination(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (value.startsWith('/') && !value.startsWith('//')) return value

  try {
    const destination = new URL(value)
    const expected = new URL(GOOGLE_PLAY_LISTING)
    if (
      destination.origin === expected.origin
      && destination.pathname === expected.pathname
      && destination.searchParams.get('id') === 'com.maitroll.app'
    ) {
      return GOOGLE_PLAY_LISTING
    }
  } catch {
    return null
  }

  return null
}

export async function openNotificationDestination(value: unknown): Promise<void> {
  const destination = getNotificationDestination(value)
  if (!destination) return

  if (Capacitor.isNativePlatform() && destination.startsWith('https://')) {
    try {
      await Browser.open({ url: destination })
    } catch (error) {
      console.error('[Notification] Could not open external destination:', error)
      window.location.assign(destination)
    }
    return
  }

  window.location.assign(destination)
}
