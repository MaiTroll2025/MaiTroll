import { Capacitor, registerPlugin } from '@capacitor/core'
import {
  PushNotifications,
  type Token,
} from '@capacitor/push-notifications'
import { supabase } from './supabase'
import { openNotificationDestination } from './notificationDestination'

let listenersRegistered = false
let registrationInFlight: Promise<void> | null = null

type FirebaseAvailabilityPlugin = {
  isInitialized(): Promise<{ initialized: boolean }>
}

const FirebaseAvailability =
  registerPlugin<FirebaseAvailabilityPlugin>('FirebaseAvailability')

const nativePlatform = () => {
  try {
    const currentPlatform = Capacitor.getPlatform()
    return currentPlatform === 'android' || currentPlatform === 'ios'
  } catch {
    return false
  }
}

const saveToken = async (userId: string, token: string) => {
  try {
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
  } catch (err) {
    console.error('[NativePush] saveToken threw:', err)
  }
}

export async function registerNativePush(userId: string) {
  if (!nativePlatform()) return
  if (registrationInFlight) return registrationInFlight

  const registration = registerNativePushForUser(userId)
  registrationInFlight = registration
  try {
    await registration
  } finally {
    if (registrationInFlight === registration) {
      registrationInFlight = null
    }
  }
}

async function registerNativePushForUser(_userId: string) {
  try {
    if (!nativePlatform()) return

    if (Capacitor.getPlatform() === 'android') {
      try {
        const { initialized } = await FirebaseAvailability.isInitialized()
        if (!initialized) {
          console.error(
            '[NativePush] Firebase is not initialized. Add android/app/google-services.json to enable Android push notifications.',
          )
          return
        }
      } catch (firebaseCheckError) {
        console.error('[NativePush] Could not verify Firebase initialization:', firebaseCheckError)
        return
      }
    }

    if (!listenersRegistered) {
      try {
        await PushNotifications.addListener('registration', (token: Token) => {
          void supabase.auth.getUser().then(({ data }) => {
            const id = data?.user?.id
            if (id && token.value) {
              void saveToken(id, token.value)
            }
          }).catch((err) => {
            console.error('[NativePush] registration listener getUser threw:', err)
          })
        })
      } catch (listenerErr) {
        console.error('[NativePush] addListener registration threw:', listenerErr)
      }

      try {
        await PushNotifications.addListener('registrationError', (error) => {
          console.error('[NativePush] Registration failed:', error)
        })
      } catch (listenerErr) {
        console.error('[NativePush] addListener registrationError threw:', listenerErr)
      }

      try {
        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          try {
            void openNotificationDestination(
              action.notification.data?.route || action.notification.data?.url,
            )
          } catch (navErr) {
            console.error('[NativePush] pushNotificationActionPerformed threw:', navErr)
          }
        })
      } catch (listenerErr) {
        console.error('[NativePush] addListener pushNotificationActionPerformed threw:', listenerErr)
      }

      listenersRegistered = true
    }

    let permission
    try {
      permission = await PushNotifications.checkPermissions()
    } catch (permErr) {
      console.error('[NativePush] checkPermissions threw:', permErr)
      return
    }

    const result = permission.receive === 'prompt'
      ? (await PushNotifications.requestPermissions().catch((reqErr) => {
          console.error('[NativePush] requestPermissions threw:', reqErr)
          return { receive: 'denied' as const }
        }))
      : permission

    if (result.receive !== 'granted') {
      console.warn('[NativePush] Notification permission was not granted')
      return
    }

    await PushNotifications.register().catch((regErr) => {
      console.error('[NativePush] register threw:', regErr)
    })
  } catch (err) {
    console.error('[NativePush] registerNativePush threw:', err)
  }
}
