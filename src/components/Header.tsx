import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellRing, LogOut, UserCircle, Zap } from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '../lib/store'
import { doesUserProfileExist, supabase } from '../lib/supabase'
import { getVapidPublicKey } from '../lib/vapid';
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'

import ProfileDropdown from './ui/ProfileDropdown'
import PresidentialToolsModal from './PresidentialToolsModal'
import { TMButton } from './trollmatch/TMButton'
import MaiNetworkSwitcher from './mai-network/MaiNetworkSwitcher'
import RGBSearchBar from './header/RGBSearchBar'
import GlobalTicker from './header/GlobalTicker'

const Header = () => {
  const { user, profile } = useAuthStore()
  const headerFrame = useUserFrame(user?.id)
  const navigate = useNavigate()

  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [isMaiSwitcherOpen, setIsMaiSwitcherOpen] = useState(false)
  const [hasDeviceSubscription, setHasDeviceSubscription] = useState(false)

  const canDebugPush =
    !!user &&
    ((profile as any)?.role === 'admin' ||
      (profile as any)?.role === 'ceo' ||
      (profile as any)?.is_admin)

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; i += 1) {
      outputArray[i] = rawData.charCodeAt(i)
    }

    return outputArray
  }

  const enablePushNotifications = async () => {
    if (!user?.id) {
      toast.error('You must be logged in to enable push notifications')
      return
    }

    if (!(await doesUserProfileExist(user.id))) {
      toast.error('Your account is still being initialized. Please refresh the page and try again.')
      return
    }

    if (!('Notification' in window)) {
      toast.error('Push notifications are not supported in this browser')
      return
    }

    if (!('serviceWorker' in navigator)) {
      toast.error('Service workers are not supported in this browser')
      return
    }

    if (!('PushManager' in window)) {
      toast.error('Push notifications are not supported in this browser')
      return
    }

    try {
      console.log('[PushDebug] Notification.permission:', Notification.permission)

      const permission =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission()

      console.log('[PushDebug] Notification.permission after request:', permission)

      if (permission !== 'granted') {
        toast.error('Push notification permission was not granted')
        return
      }

      const vapidPublicKey = getVapidPublicKey();

      if (!vapidPublicKey) {
        console.error('[PushDebug] Missing VITE_VAPID_PUBLIC_KEY')
        toast.error('VAPID public key is missing')
        return
      }

      let registration: ServiceWorkerRegistration

      try {
        const swReadyPromise = navigator.serviceWorker.ready
        const timeoutPromise = new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('Service worker ready timeout')), 8000)
        })

        registration = (await Promise.race([
          swReadyPromise,
          timeoutPromise,
        ])) as ServiceWorkerRegistration
      } catch (swError: any) {
        console.error('[PushDebug] Service worker not ready:', swError)
        toast.error('Push notifications require the service worker. Reload the app and try again.')
        return
      }

      console.log('[PushDebug] service worker ready:', {
        scope: registration.scope,
        active: !!registration.active,
      })

      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        console.log('[PushDebug] No existing subscription. Creating new subscription.')

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
      } else {
        console.log('[PushDebug] Existing subscription found.')
      }

      const subJson = subscription.toJSON() as any
      const endpoint = subscription.endpoint || subJson.endpoint
      const p256dh = subJson.keys?.p256dh
      const auth = subJson.keys?.auth

      const expirationTime = (subscription as any).expirationTime
        ? new Date((subscription as any).expirationTime).toISOString()
        : null

      if (!endpoint || !p256dh || !auth) {
        console.error('[PushDebug] Invalid subscription payload:', subJson)
        toast.error('Push subscription is missing browser keys')
        return
      }

      const payload = {
        user_id: user.id,
        endpoint,
        keys: {
          p256dh,
          auth,
        },
        p256dh_key: p256dh,
        auth_key: auth,
        expiration_time: expirationTime,
        user_agent: navigator.userAgent,
        is_active: true,
        updated_at: new Date().toISOString(),
      }

      console.log('[PushDebug] saving subscription payload:', {
        user_id: payload.user_id,
        endpoint_preview: payload.endpoint.slice(0, 80),
        has_keys: !!payload.keys,
        has_p256dh: !!payload.p256dh_key,
        has_auth: !!payload.auth_key,
        is_active: payload.is_active,
      })

      const { error } = await supabase
        .from('web_push_subscriptions')
        .upsert(payload, { onConflict: 'endpoint' })

      if (error) {
        console.error('[PushDebug] Supabase save error:', error)
        toast.error(error.message || 'Could not save push subscription')
        return
      }

      console.log('[PushDebug] Supabase save success')
      toast.success('Push notifications enabled')
    } catch (error: any) {
      console.error('[PushDebug] setup failed:', error)
      toast.error(error?.message || 'Push notification setup failed')
    }
  }

  useEffect(() => {
    if (!user?.id) return

    const fetchNotifications = async () => {
      try {
        const { data: count, error } = await supabase.rpc('get_unread_notification_count', {
          p_user_id: user.id,
        })

        if (!error && typeof count === 'number') {
          setUnreadNotifications(count)
          return
        }

        const { count: fallbackCount, error: fallbackError } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false)
          .or('is_dismissed.is.null,is_dismissed.eq.false')

        if (!fallbackError && fallbackCount !== null) {
          setUnreadNotifications(fallbackCount)
        }
      } catch (err) {
        console.error('Error fetching notification count:', err)
      }
    }

    void fetchNotifications()

    const channel = supabase
      .channel(`header-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchNotifications(),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchNotifications(),
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [user?.id])

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    let cancelled = false
    ;(async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (!cancelled) setHasDeviceSubscription(!!subscription)
      } catch {
        if (!cancelled) setHasDeviceSubscription(false)
      }
    })()
    return () => { cancelled = true }
  }, [user?.id])

  const handleLogout = async () => {
    try {
      sessionStorage.setItem('logout_requested', 'true')

      try {
        const { error } = await supabase.auth.signOut()
        if (error) console.warn('supabase.signOut returned error:', error)
      } catch (innerErr: any) {
        console.warn('Error signing out session ignored:', innerErr?.message || innerErr)
      }

      await useAuthStore.getState().logout()

      try {
        localStorage.clear()

        const introSeen = sessionStorage.getItem('trollIntroSeen')
        sessionStorage.clear()

        if (introSeen) {
          sessionStorage.setItem('trollIntroSeen', introSeen)
        }

        if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
          const dbs = await window.indexedDB.databases()

          dbs.forEach((db: any) => {
            if (db.name) {
              window.indexedDB.deleteDatabase(db.name)
            }
          })
        }
      } catch (storageError) {
        console.error('Error clearing storage:', storageError)
      }

      toast.success('Logged out successfully')

      window.setTimeout(() => {
        navigate('/exit', { replace: true })
      }, 100)
    } catch (error: any) {
      console.error('Logout error:', error)
      toast.error(error?.message || 'Error logging out')
      navigate('/exit', { replace: true })
    }
  }

  const handleProfileClick = () => {
    if (profile?.username) {
      navigate(`/profile/${profile.username}`)
    } else {
      navigate('/profile/setup')
    }
  }

  return (
    <>
      <header className="h-[72px] bg-slate-950/95 backdrop-blur-2xl border-b border-cyan-400/20 text-white flex items-center justify-between px-4 md:px-8 sticky top-0 z-40">
        <div className="flex-none z-10 w-32 md:w-auto">
          <RGBSearchBar />
        </div>

        <div className="flex-1 min-w-0 mx-1 md:mx-6 z-10 overflow-hidden">
          <GlobalTicker />
        </div>

        <div className="flex-none relative z-10 flex items-center space-x-3 md:space-x-5">
          {user && <PresidentialToolsModal />}

          {user && (
            <button
              onClick={() => setIsMaiSwitcherOpen(true)}
              className="relative p-2.5 text-slate-400 hover:text-purple-300 transition-all duration-200 hover:bg-white/[0.04] rounded-xl"
              title="MAI Network"
              type="button"
            >
              <Zap className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            </button>
          )}

          {user && <TMButton />}

           {canDebugPush && !hasDeviceSubscription && (
             <button
               onClick={() => {
                 void enablePushNotifications()
               }}
               className="hidden sm:flex items-center gap-2 px-3 py-2 text-xs font-semibold text-cyan-100 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-300/20 rounded-xl transition-all duration-200"
               title="Enable Push Notifications"
               type="button"
             >
               <BellRing className="w-4 h-4" />
               <span className="hidden lg:inline">Enable Push Notifications</span>
             </button>
           )}

          {user && (
            <button
              onClick={async () => {
                if (user?.id && unreadNotifications > 0) {
                  setUnreadNotifications(0)

                  try {
                    await supabase.rpc('mark_all_notifications_read', {
                      p_user_id: user.id,
                    })
                  } catch (err) {
                    console.error('Error marking notifications as read:', err)
                  }
                }

                navigate('/trollifications')
              }}
              className="relative p-2.5 text-slate-400 hover:text-purple-300 transition-all duration-200 hover:bg-white/[0.04] rounded-xl"
              title="Notifications"
              type="button"
            >
              <Bell className="w-5 h-5" />

              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center bg-red-500 text-white font-bold shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </button>
          )}

          {user && (
            <>
              <div className="hidden md:block">
                <ProfileDropdown />
              </div>

              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={handleLogout}
                  className="p-2.5 text-red-400/70 hover:text-red-300 transition-all duration-200 hover:bg-red-500/[0.06] rounded-xl"
                  title="Logout"
                  type="button"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={handleProfileClick}
                className="md:hidden flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-troll-neon-gold to-troll-neon-orange text-troll-dark-bg border-2 border-troll-neon-gold/50 shadow-lg shadow-troll-neon-gold/20 active:scale-95 transition-all duration-300"
                aria-label="Open profile"
                type="button"
                style={{ overflow: 'visible' }}
              >
                <ProfileFrame
                  frame={headerFrame}
                  avatarUrl={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.username || 'user'}`}
                  size="md"
                  username={profile?.username || ''}
                />
              </button>
            </>
          )}
        </div>
      </header>

      <MaiNetworkSwitcher
        isOpen={isMaiSwitcherOpen}
        onClose={() => setIsMaiSwitcherOpen(false)}
        platformTheme="troll-city"
      />
    </>
  )
}

export default React.memo(Header)