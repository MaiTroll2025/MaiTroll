import React, { useState, useEffect, useCallback } from 'react'
import { Bell, MessageCircle, User, ChevronDown, X } from 'lucide-react'
import GlobalTicker from '@/components/header/GlobalTicker'
import PhoneDrawer from './PhoneDrawer'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface PhoneHeaderProps {
  title?: string
  showActions?: boolean
  showTickerLinks?: boolean
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  created_at: string
  is_read: boolean
  metadata?: Record<string, any>
}

export default function PhoneHeader({
  title = 'MAiTROLL.com',
  showActions = true,
  showTickerLinks = true,
}: PhoneHeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const { profile } = useAuthStore()

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    try {
      const { data: unreadTotal, error: countError } = await supabase.rpc(
        'get_unread_notification_count',
        { p_user_id: profile.id },
      )
      if (!countError && typeof unreadTotal === 'number') {
        setUnreadCount(unreadTotal)
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, message, created_at, is_read, metadata')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const notifs = data || []
      setNotifications(notifs)
      if (countError || typeof unreadTotal !== 'number') {
        setUnreadCount(notifs.filter(n => !n.is_read).length)
      }
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    fetchNotifications()

    if (!profile?.id) return

    const channel = supabase
      .channel(`phone-notifications:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => fetchNotifications()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => fetchNotifications()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jail_notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => fetchNotifications()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id, fetchNotifications])

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id)
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
      } catch (error) {
        console.error('Failed to mark as read:', error)
      }
    }

    const metadata = notification.metadata || {}
    let route = '/notifications'

    // Determine route based on notification type
    if (notification.type === 'stream_live' || notification.type === 'broadcast_live' || 
        notification.type === 'user_live' || notification.type === 'followed_user_live') {
      const streamId = metadata.stream_id || metadata.broadcast_id
      if (streamId) route = `/watch/${streamId}`
    } else if (notification.type === 'new_follower' || notification.type === 'someone_followed') {
      const username = metadata.follower_username || metadata.username
      if (username) route = `/profile/${encodeURIComponent(username)}`
    } else if (notification.type === 'message' || notification.type === 'message_received' || 
               notification.type === 'tromail_message') {
      route = '/utromail'
    } else if (notification.type === 'gift_received' || notification.type === 'coin_received') {
      route = '/wallet'
    } else if (metadata.route) {
      route = metadata.route
    }

    setNotificationsOpen(false)
    window.location.assign(route)
  }

  return (
    <>
      <PhoneDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <header className="sticky top-0 z-50 border-b border-[#00BFFF]/20 bg-[#03030a]/90 backdrop-blur-2xl">
        <div className="flex items-center justify-between px-4 py-3">

          {/* Menu */}
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white transition active:scale-95"
          >
            <span className="text-xl leading-none">☰</span>
          </button>

          {/* Brand */}
          <div className="min-w-0 flex-1 px-3 text-center">
            <h1 className="truncate bg-gradient-to-r from-[#00BFFF] via-white to-[#BF00FF] bg-clip-text text-lg font-black tracking-tight text-transparent">
              {title}
            </h1>

            <div className="mt-0.5 flex items-center justify-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00BFFF] shadow-[0_0_8px_#00BFFF]" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Live Network
              </span>
            </div>
          </div>

          {/* Actions */}
          {showActions ? (
            <div className="flex shrink-0 items-center gap-2">

              {/* Notifications */}
              <div className="relative">
                <button
                  type="button"
                  aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-white transition active:scale-90"
                >
                  <Bell size={28} strokeWidth={2.5} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                </button>

                {/* Notifications Dropdown */}
                {notificationsOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[320px] max-h-[500px] overflow-y-auto rounded-2xl border border-white/10 bg-[#050715]/95 backdrop-blur-2xl shadow-2xl z-50 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                      <h3 className="font-bold text-white">Notifications</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={async () => {
                            try {
                              await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile?.id)
                              setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
                              setUnreadCount(0)
                            } catch (e) { console.error(e) }
                          }}
                          className="text-xs text-cyan-400 font-medium"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    {loading ? (
                      <div className="flex items-center justify-center py-8 text-slate-500">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-slate-500">
                        <Bell className="h-10 w-10 mx-auto mb-2 text-slate-600" />
                        <p>No notifications yet</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {notifications.map(notification => (
                          <button
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={cn(
                              'w-full px-4 py-3 text-left transition',
                              !notification.is_read
                                ? 'bg-cyan-400/5 hover:bg-cyan-400/10'
                                : 'hover:bg-white/5'
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                                !notification.is_read
                                  ? 'bg-cyan-400/15 border border-cyan-400/20'
                                  : 'bg-white/5 border border-white/10'
                              )}>
                                <Bell className={cn('h-4 w-4', !notification.is_read ? 'text-cyan-300' : 'text-slate-500')} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn('font-medium truncate', !notification.is_read ? 'text-white' : 'text-slate-300')}>
                                  {notification.title}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                                  {notification.message}
                                </p>
                                <p className="mt-1 text-[10px] text-slate-600">
                                  {new Date(notification.created_at).toLocaleString()}
                                </p>
                              </div>
                              {!notification.is_read && (
                                <div className="h-2 w-2 rounded-full bg-cyan-400 shrink-0 mt-2" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="px-4 py-2 border-t border-white/10">
                      <button
                        onClick={() => { setNotificationsOpen(false); window.location.assign('/notifications') }}
                        className="w-full text-center text-sm text-cyan-400 font-medium"
                      >
                        View all notifications
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile */}
              <div className="relative">
                <button
                  type="button"
                  aria-label="Profile"
                  onClick={() => window.location.assign('/profile')}
className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-white transition active:scale-90"
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.username}
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                    ) : (
                      <User size={28} strokeWidth={2.5} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                  )}
                </button>
              </div>

            </div>
          ) : (
            <div className="h-10 w-10" />
          )}
        </div>

        {/* Global activity ticker */}
        <div className="border-t border-white/5 px-3 py-1.5">
          <GlobalTicker showSeoLinks={showTickerLinks} />
        </div>
      </header>
    </>
  )
}