import { Capacitor } from '@capacitor/core'
import {
  PushNotifications,
  type Token,
} from '@capacitor/push-notifications'
import { supabase } from './supabase'
import { openNotificationDestination } from './notificationDestination'

let listenersRegistered = false

const nativePlatform = () => {
  const currentPlatform = Capacitor.getPlatform()
  return currentPlatform === 'android' || currentPlatform === 'ios'
}

const saveToken = async (userId: string, token: string) => {
  const platform = Capacitor.getPlatform()
  if (platform !== 'android' && platform !== 'ios') return

  const { error } = await supabase.from('native_push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform,
      user_agent: navigator.userAgent,
      is_active: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  )

  if (error) {
    console.error('[NativePush] Failed to save token:', error)
  }
}

export async function registerNativePush(_userId: string) {
  if (!nativePlatform()) return

  if (!listenersRegistered) {
    await PushNotifications.addListener('registration', (token: Token) => {
      const currentUserId = supabase.auth.getUser().then(({ data }) => data.user?.id)
      void currentUserId.then((id) => {
        if (id && token.value) void saveToken(id, token.value)
      })
    })

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[NativePush] Registration failed:', error)
    })

    // Action performed when user taps notification
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      void openNotificationDestination(
        action.notification.data?.route || action.notification.data?.url,
      )
    })

    listenersRegistered = true
  }

  const permission = await PushNotifications.checkPermissions()
  const result = permission.receive === 'prompt'
    ? await PushNotifications.requestPermissions()
    : permission

  if (result.receive !== 'granted') {
    console.warn('[NativePush] Notification permission was not granted')
    return
  }

  await PushNotifications.register()
}
