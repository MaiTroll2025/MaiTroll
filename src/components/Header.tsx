import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bell, BellRing, Home, LogOut, Zap, Monitor, Download, Smartphone, Plus, ChevronRight, Maximize2, Minimize2, ChevronDown, ArrowRight } from 'lucide-react';
import { toast } from 'sonner'

import { useAuthStore } from '../lib/store'
import { doesUserProfileExist, supabase } from '../lib/supabase'
import { getVapidPublicKey } from '../lib/vapid';
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'

import ProfileDropdown from './ui/ProfileDropdown'
import PresidentialToolsModal from './PresidentialToolsModal'
import MaiNetworkSwitcher from './mai-network/MaiNetworkSwitcher'
import RGBSearchBar from './header/RGBSearchBar'
import GlobalTicker from './header/GlobalTicker'
import { isDesktopPlatform, getDesktopDownloadUrl } from '../utils/desktopDownload'
import { useAutoUpdate } from '../hooks/useAutoUpdate'
import { useIsPhone } from '../phone/useIsPhone'

const Header = () => {
  const { user, profile } = useAuthStore()
  const headerFrame = useUserFrame(user?.id)
  const navigate = useNavigate()
  const location = useLocation()
  const isPhone = useIsPhone()

  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = () => {
    const element = document.documentElement

    if (!document.fullscreenElement) {
      if (element.requestFullscreen) {
        element.requestFullscreen()
        setIsFullscreen(true)
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
        setIsFullscreen(false)
      }
    }
  }

  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; type: string; is_read: boolean; created_at: string; username?: string; avatar_url?: string; metadata?: any }[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  const [isMaiSwitcherOpen, setIsMaiSwitcherOpen] = useState(false)
  const [hasDeviceSubscription, setHasDeviceSubscription] = useState(false)
  const [showDesktopDownload, setShowDesktopDownload] = useState(false)

  useEffect(() => {
    setShowDesktopDownload(isDesktopPlatform())
  }, [])

  const { isElectron, updateStatus, checkForUpdate: _checkForUpdate, downloadUpdate, installUpdate, dismissUpdate: _dismissUpdate } = useAutoUpdate()
  const showMobileButtons = !isElectron && isPhone

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
      setNotificationsLoading(true)
      try {
        const { data: count, error } = await supabase.rpc('get_unread_notification_count', {
          p_user_id: user.id,
        })

        if (!error && typeof count === 'number') {
          setUnreadNotifications(count)
        }

        const { data: rows, error: rowsError } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_dismissed', false)
          .order('created_at', { ascending: false })
          .limit(20)

        if (!rowsError && rows) {
          setNotifications((rows as any[]).map((row) => ({
            id: row.id,
            title: row.title,
            message: row.message,
            type: row.type,
            is_read: row.is_read,
            created_at: row.created_at,
            username: row.username,
            avatar_url: row.avatar_url,
            metadata: row.metadata,
          })))
        }
      } catch (err) {
        console.error('Error fetching notifications:', err)
      } finally {
        setNotificationsLoading(false)
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

  const handleDesktopDownload = () => {
    const url = getDesktopDownloadUrl()
    window.open(url, '_blank', 'noopener,noreferrer')
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
          {location.pathname !== '/' && (
            <button
              onClick={() => navigate('/')}
              className="p-2.5 text-slate-400 hover:text-white transition-all duration-200 hover:bg-white/[0.04] rounded-xl"
              title="Home"
              type="button"
            >
              <Home size={20} />
            </button>
          )}
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

          {user && (
              <button
                onClick={toggleFullscreen}
                className="hidden md:flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-100 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-300/20 rounded-xl transition-all duration-200"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                type="button"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
                <span className="hidden lg:inline">{isFullscreen ? 'Exit Full' : 'Full'}</span>
              </button>
            )}

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

            {showMobileButtons && !isElectron && (
              <>
                <a
                  href="https://play.google.com/store/apps/details?id=com.maitroll.app&pli=1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-xs font-semibold text-cyan-100 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-300/20 rounded-xl transition-all duration-200"
                  title="Get MaiTroll on Google Play"
                >
                  <Smartphone className="w-4 h-4" />
                  <span className="hidden lg:inline">Google Play</span>
                  <ChevronRight className="w-3 h-3 text-cyan-400/50 transition-transform group-hover:translate-x-0.5" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
                    const message = isIOS
                      ? 'To add MaiTroll to your Home Screen:\n1. Tap the Share button (square with arrow up)\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" in the top right'
                      : 'To add MaiTroll to your Home Screen on iOS:\n1. Open this page in Safari on your iPhone/iPad\n2. Tap the Share button (square with arrow up)\n3. Scroll down and tap "Add to Home Screen"\n4. Tap "Add" in the top right'
                    alert(message)
                  }}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-xs font-semibold text-purple-100 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-300/20 rounded-xl transition-all duration-200"
                  title="Add to Home Screen on iOS"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden lg:inline">Add to Home</span>
                  <ChevronRight className="w-3 h-3 text-purple-400/50 transition-transform group-hover:translate-x-0.5" />
                </button>
              </>
            )}

            {showDesktopDownload && !isElectron && !user && (
              <button
                onClick={handleDesktopDownload}
                className="hidden sm:flex items-center gap-2 px-3 py-2 text-xs font-semibold text-purple-100 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-300/20 rounded-xl transition-all duration-200"
                title="Download MaiTroll for Windows"
                type="button"
              >
                <Monitor className="w-4 h-4" />
                <span className="hidden lg:inline">Download for Windows</span>
              </button>
            )}

             {isElectron && updateStatus.status === 'available' && (
               <button
                 onClick={async () => {
                   await downloadUpdate()
                 }}
                 className="hidden sm:flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-100 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-300/20 rounded-xl transition-all duration-200"
                 title={`Update available: ${updateStatus.version}`}
                 type="button"
               >
                 <Download className="w-4 h-4" />
                 <span className="hidden lg:inline">Update {updateStatus.version}</span>
               </button>
             )}

             {isElectron && updateStatus.status === 'downloaded' && (
               <button
                 onClick={async () => {
                   await installUpdate()
                 }}
                 className="hidden sm:flex items-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-100 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-300/20 rounded-xl transition-all duration-200"
                 title="Restart and install update"
                 type="button"
               >
                 <Download className="w-4 h-4" />
                 <span className="hidden lg:inline">Install Update</span>
               </button>
             )}

          {user && (
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => {
                  if (user?.id && unreadNotifications > 0) {
                    setUnreadNotifications(0)
                    try {
                      void supabase.rpc('mark_all_notifications_read', {
                        p_user_id: user.id,
                      })
                    } catch (err) {
                      console.error('Error marking notifications as read:', err)
                    }
                  }
                  setNotificationDropdownOpen((prev) => !prev)
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
                {notificationDropdownOpen && <ChevronDown className="w-4 h-4 text-purple-300 ml-1" />}
              </button>

              {notificationDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-white/10 bg-slate-950/90 backdrop-blur-2xl shadow-[0_0_32px_rgba(0,0,0,0.6)] z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <h3 className="text-xs font-black text-white">Notifications</h3>
                    <button
                      onClick={() => {
                        setNotificationDropdownOpen(false)
                        navigate('/trollifications')
                      }}
                      className="text-xs font-bold text-cyan-300 hover:text-cyan-200"
                    >
                      Open full page <ArrowRight className="w-3 h-3 ml-0.5" />
                    </button>
                  </div>

                  {notificationsLoading ? (
                    <div className="p-4 text-center text-xs text-slate-400">Loading…</div>
                  ) : notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">No new notifications</div>
                  ) : (
                    <div className="max-h-[60vh] overflow-y-auto py-1">
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            setNotificationDropdownOpen(false)
                            try {
                              void supabase
                                .from('notifications')
                                .update({ is_read: true })
                                .eq('id', n.id)
                            } catch {}
                          }}
                          className={`w-full px-4 py-3 text-left border-b border-white/5 last:border-0 hover:bg-white/5 flex items-center gap-3 ${
                            !n.is_read ? 'bg-white/5' : ''
                          }`}
                        >
                          {n.avatar_url ? (
                            <img src={n.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center text-xs font-bold text-white">
                              {(n.username || '?')[0]?.toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white truncate">{n.title}</p>
                            <p className="text-[10px] text-slate-400 truncate">{n.message}</p>
                            <p className="text-[9px] text-slate-600 mt-0.5">
                              {new Date(n.created_at).toLocaleString()}
                            </p>
                          </div>
                          {!n.is_read && (
                            <div className="h-2 w-2 rounded-full bg-cyan-400 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
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