import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Virtuoso } from 'react-virtuoso'
import { toast } from 'sonner'
import { AlertTriangle, Bell, Briefcase, Check, CheckCircle, CircleDollarSign, Clock, Gift, Gavel, Home, Megaphone, MessageCircle, Radio, Shield, ShieldOff, Siren, Sword, Trash2, Trophy, User, Video, X, Zap } from 'lucide-react';

import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { Notification } from '../types/notifications';
import { useAdminVoiceNotifications } from '../hooks/useAdminVoiceNotifications'

const MAX_NOTIFICATIONS = 150

type FilterKey =
  | 'all'
  | 'unread'
  | 'admin'
  | 'jail'
  | 'moderation'
  | 'finance'
  | 'applications'
  | 'support'
  | 'broadcast'
  | 'social'
  | 'system'

type Priority = 'low' | 'normal' | 'high' | 'critical'

type EnhancedNotification = Notification & {
  priority?: Priority
  category?: FilterKey
  admin_copy?: boolean
}

const ADMIN_ROLES = new Set([
  'admin',
  'ceo',
  'owner',
  'super_admin',
  'moderator',
  'officer',
  'lead_troll_officer',
  'hr',
  'support',
])

function isAdminProfile(profile: any) {
  const role = String(profile?.role || profile?.account_type || '').toLowerCase()
  return profile?.is_admin === true || profile?.is_staff === true || ADMIN_ROLES.has(role)
}

function isAdminCopy(metadata: any) {
  return Boolean(
    metadata?.admin_copy ||
      metadata?.staff_copy ||
      metadata?.moderator_copy ||
      metadata?.officer_copy ||
      metadata?.audience === 'admin' ||
      metadata?.audience === 'staff'
  )
}

function getPriority(type: string, metadata?: any): Priority {
  if (metadata?.priority) return metadata.priority

  if (
    [
      'security.alert',
      'moderation_alert',
      'moderation_action',
      'report',
      'report_filed',
      'ban',
      'kick',
      'stream.ban',
      'stream.kick',
      'jail_sentence',
      'sentencing',
      'arrest',
      'support_ticket',
      'payout_request',
      'manual_coin_order',
      'coins.manual_purchase',
      'system.warning',
    ].includes(type)
  ) {
    return 'critical'
  }

  if (
    [
      'application_submitted',
      'officer_update',
      'officer_clock_in',
      'officer_clock_out',
      'bond_request',
      'appeal_submitted',
      'court_summon',
      'marketplace_order_fulfillment_required',
    ].includes(type)
  ) {
    return 'high'
  }

  return 'normal'
}

function getCategory(type: string, metadata?: any): FilterKey {
  if (isAdminCopy(metadata)) return 'admin'

  if (
    [
      'moderation_alert',
      'moderation_action',
      'kick',
      'ban',
      'mute',
      'report',
      'report_filed',
      'stream.kick',
      'stream.ban',
      'security.alert',
    ].includes(type)
  ) {
    return 'moderation'
  }

  if (
    [
      'jail_sentence',
      'arrest',
      'sentencing',
      'release',
      'bond_request',
      'bond_posted',
      'court_summon',
      'attorney_hired',
      'court_date',
      'appeal_result',
      'appeal_submitted',
      'appeal_decision',
    ].includes(type)
  ) {
    return 'jail'
  }

  if (
    [
      'payout_status',
      'payout_request',
      'payout_update',
      'coins.fast_spend',
      'coins.manual_purchase',
      'manual_coin_order',
      'coin_received',
      'coin_gifted',
      'gift_received',
      'troll_post_gift',
    ].includes(type)
  ) {
    return 'finance'
  }

  if (['application_submitted', 'application_result', 'trollg_application'].includes(type)) {
    return 'applications'
  }

  if (['support_ticket', 'support_reply'].includes(type)) return 'support'

  if (
    [
      'stream_live',
      'pod_live',
      'broadcast_live',
      'user_live',
      'followed_user_live',
      'join_approved',
      'battle_result',
    ].includes(type)
  ) {
    return 'broadcast'
  }

  if (['new_follower', 'message', 'message_received'].includes(type)) return 'social'

  return 'system'
}

function rewriteAdminJailCopy(notification: EnhancedNotification, isAdmin: boolean): EnhancedNotification {
  const metadata = notification.metadata || {}
  const type = String(notification.type)
  const adminCopy = isAdminCopy(metadata)
  const isJailType = ['jail_sentence', 'arrest', 'sentencing', 'release', 'bond_request'].includes(type)

  if (!isAdmin || !isJailType) return notification

  const inmateName =
    metadata.inmate_username ||
    metadata.target_username ||
    metadata.username ||
    metadata.user_username ||
    'A user'

  if (type === 'jail_sentence' || type === 'sentencing') {
    return {
      ...notification,
      admin_copy: true,
      category: 'admin',
      title: 'User Sentenced',
      message: `${inmateName} was sentenced. This is an admin alert, not a punishment notice for your account.`,
    }
  }

  if (type === 'arrest') {
    return {
      ...notification,
      admin_copy: true,
      category: 'admin',
      title: 'User Jailed',
      message: `${inmateName} was jailed. This is an admin alert, not a notice against your account.`,
    }
  }

  if (type === 'release') {
    return {
      ...notification,
      admin_copy: true,
      category: 'admin',
      title: 'User Released',
      message: `${inmateName} was released from jail.`,
    }
  }

  if (type === 'bond_request') {
    return {
      ...notification,
      admin_copy: true,
      category: 'admin',
      title: 'Bond Request Submitted',
      message: `${inmateName} submitted a bond request for review.`,
    }
  }

  if (adminCopy) {
    return {
      ...notification,
      admin_copy: true,
      category: 'admin',
      title: notification.title?.replace(/^You\b/i, inmateName) || 'Jail Admin Alert',
      message:
        notification.message
          ?.replace(/\bYou have been jailed\b/i, `${inmateName} has been jailed`)
          ?.replace(/\bYou were jailed\b/i, `${inmateName} was jailed`)
          ?.replace(/\byour account\b/i, `${inmateName}'s account`) ||
        `${inmateName} has a jail update.`,
    }
  }

  return notification
}

function enhanceNotification(row: Notification, isAdmin: boolean): EnhancedNotification {
  const metadata = row.metadata || {}
  const enhanced: EnhancedNotification = {
    ...row,
    priority: getPriority(row.type, metadata),
    category: getCategory(row.type, metadata),
    admin_copy: isAdminCopy(metadata),
  }

  return rewriteAdminJailCopy(enhanced, isAdmin)
}

export default function Trollifications() {
  const { user, profile } = useAuthStore()

  const [notifications, setNotifications] = useState<EnhancedNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [latestNotification, setLatestNotification] = useState<EnhancedNotification | null>(null)
  const [selectedNotification, setSelectedNotification] = useState<EnhancedNotification | null>(null)

  const latestAnnouncedIdRef = useRef<string | null>(null)
  const { announceNotification, enabled } = useAdminVoiceNotifications()

  const isAdmin = useMemo(() => isAdminProfile(profile), [profile])

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(MAX_NOTIFICATIONS)

      if (error) throw error

      const enhanced = (data || []).map((row) => enhanceNotification(row as Notification, isAdmin))

      setNotifications(enhanced)

      const newest = enhanced[0] || null
      if (newest?.id && newest.id !== latestAnnouncedIdRef.current) {
        latestAnnouncedIdRef.current = newest.id
        setLatestNotification(newest)
      }
    } catch (err) {
      console.error('Error loading notifications:', err)
      toast.error('Failed to load notifications')
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [user?.id, isAdmin])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    if (!user?.id) return

    const interval = window.setInterval(() => {
      void loadNotifications()
    }, 30_000)

    return () => window.clearInterval(interval)
  }, [user?.id, loadNotifications])

  useEffect(() => {
    if (!latestNotification || !isAdmin || !enabled) return

    const priorityTypes = [
      'moderation_alert',
      'moderation_action',
      'officer_update',
      'support_ticket',
      'report_filed',
      'payout_request',
      'system_announcement',
      'system.warning',
      'pod_live',
      'stream_live',
      'jail_sentence',
      'arrest',
    ]

    if (priorityTypes.includes(latestNotification.type) || latestNotification.priority === 'critical') {
      announceNotification({
        id: latestNotification.id || Date.now().toString(),
        message: `${latestNotification.title}: ${latestNotification.message}`,
        type: 'alert',
        timestamp: new Date(),
      })
    }
  }, [latestNotification, isAdmin, enabled, announceNotification])

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  )

  const criticalCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read && notification.priority === 'critical').length,
    [notifications]
  )

  const counts = useMemo(() => {
    const next: Record<FilterKey, number> = {
      all: notifications.length,
      unread: unreadCount,
      admin: 0,
      jail: 0,
      moderation: 0,
      finance: 0,
      applications: 0,
      support: 0,
      broadcast: 0,
      social: 0,
      system: 0,
    }

    for (const notification of notifications) {
      const category = notification.category || 'system'
      if (category in next) next[category] += 1
    }

    return next
  }, [notifications, unreadCount])

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications
    if (filter === 'unread') return notifications.filter((notification) => !notification.is_read)
    return notifications.filter((notification) => notification.category === filter)
  }, [notifications, filter])

  const markAsRead = async (id: string) => {
    try {
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === id ? { ...notification, is_read: true } : notification
        )
      )

      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
      if (error) throw error
    } catch (err) {
      console.error('Error marking notification as read:', err)
      toast.error('Failed to mark notification as read')
      void loadNotifications()
    }
  }

  const markAllAsRead = async () => {
    if (!user?.id) return

    try {
      const { error } = await supabase.rpc('mark_all_notifications_read', { p_user_id: user.id })
      if (error) throw error

      setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })))
      toast.success('All notifications marked as read')
    } catch (err) {
      console.error('Error marking all as read:', err)
      toast.error('Failed to mark all as read')
      void loadNotifications()
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      setNotifications((prev) => prev.filter((notification) => notification.id !== id))

      const { error } = await supabase.from('notifications').delete().eq('id', id)
      if (error) throw error

      toast.success('Notification deleted')
    } catch (err) {
      console.error('Error deleting notification:', err)
      toast.error('Failed to delete notification')
      void loadNotifications()
    }
  }

  const getIcon = (notification: EnhancedNotification) => {
    const type = String(notification.type)

    if (notification.priority === 'critical') return <Siren className="h-5 w-5 text-red-300" />
    if (notification.category === 'admin') return <Shield className="h-5 w-5 text-cyan-300" />

    switch (type) {
      case 'gift_received':
        return <Gift className="h-5 w-5 text-pink-300" />
      case 'badge_unlocked':
        return <Trophy className="h-5 w-5 text-yellow-300" />
      case 'payout_status':
      case 'coin_received':
      case 'coin_gifted':
        return <CircleDollarSign className="h-5 w-5 text-green-300" />
      case 'moderation_action':
        return <AlertTriangle className="h-5 w-5 text-red-300" />
      case 'battle_result':
        return <Sword className="h-5 w-5 text-purple-300" />
      case 'officer_update':
        return <Shield className="h-5 w-5 text-cyan-300" />
      case 'system_announcement':
        return <Zap className="h-5 w-5 text-cyan-300" />
      case 'property_purchased':
        return <Home className="h-5 w-5 text-blue-300" />
      case 'jail_sentence':
        return <ShieldOff className="h-5 w-5 text-red-300" />
      default:
        if (notification.category === 'broadcast') return <Video className="h-5 w-5 text-pink-300" />
        if (notification.category === 'applications') return <Briefcase className="h-5 w-5 text-emerald-300" />
        if (notification.category === 'finance') return <CircleDollarSign className="h-5 w-5 text-green-300" />
        if (notification.category === 'jail') return <Gavel className="h-5 w-5 text-amber-300" />
        if (notification.category === 'support') return <MessageCircle className="h-5 w-5 text-cyan-300" />
        if (notification.category === 'social') return <User className="h-5 w-5 text-blue-300" />
        return <Bell className="h-5 w-5 text-purple-300" />
    }
  }

  const _getRoute = (notification: EnhancedNotification) => {
    const metadata = notification.metadata || {}
    const type = String(notification.type)

    if (metadata.route) return metadata.route
    if (metadata.action_url) return metadata.action_url
    if (metadata.stream_id) return `/stream/${metadata.stream_id}`
    if (metadata.sender_id) return `/utromail?recipientId=${metadata.sender_id}`
    if (metadata.payout_id) return isAdmin ? `/admin/finance?tab=payouts&id=${metadata.payout_id}` : '/my-earnings'
    if (metadata.battle_id) return '/battles'
    if (metadata.ticket_id) return `/admin/support?id=${metadata.ticket_id}`
    if (metadata.application_id) return `/admin/applications?id=${metadata.application_id}`
    if (metadata.inmate_id) return `/inmates?inmate=${metadata.inmate_id}`

    if (type === 'new_follower') return null

    switch (notification.category) {
      case 'admin':
        return '/admin'
      case 'moderation':
        return '/admin/moderation'
      case 'jail':
        return isAdmin ? '/inmates' : '/jail'
      case 'finance':
        return isAdmin ? '/admin/finance' : '/wallet'
      case 'applications':
        return '/admin/applications'
      case 'support':
        return '/admin/support'
      case 'broadcast':
        return '/broadcasts'
      case 'social':
        return '/utromail'
      default:
        return '/'
    }
  }

  const handleNotificationClick = (notification: EnhancedNotification) => {
    if (!notification.is_read) void markAsRead(notification.id)
    setSelectedNotification(notification)
  }

  const filterTabs: Array<{ key: FilterKey; label: string; icon: React.ReactNode }> = [
    { key: 'all', label: 'All', icon: <Bell className="h-4 w-4" /> },
    { key: 'unread', label: 'Unread', icon: <CheckCircle className="h-4 w-4" /> },
    { key: 'admin', label: 'Admin', icon: <Shield className="h-4 w-4" /> },
    { key: 'jail', label: 'Jail', icon: <Gavel className="h-4 w-4" /> },
    { key: 'moderation', label: 'Moderation', icon: <AlertTriangle className="h-4 w-4" /> },
    { key: 'finance', label: 'Finance', icon: <CircleDollarSign className="h-4 w-4" /> },
    { key: 'applications', label: 'Applications', icon: <Briefcase className="h-4 w-4" /> },
    { key: 'support', label: 'Support', icon: <MessageCircle className="h-4 w-4" /> },
    { key: 'broadcast', label: 'Broadcast', icon: <Radio className="h-4 w-4" /> },
    { key: 'social', label: 'Social', icon: <User className="h-4 w-4" /> },
    { key: 'system', label: 'System', icon: <Megaphone className="h-4 w-4" /> },
  ]

  const renderNotification = (_index: number, notification: EnhancedNotification) => {
    const isCritical = notification.priority === 'critical'
    const isHigh = notification.priority === 'high'
    const isAdminAlert = notification.category === 'admin'

    return (
      <div className="px-2 pb-3">
        <article
          onClick={() => handleNotificationClick(notification)}
          className={cn(
            'group relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl',
            isCritical
              ? 'border-red-400/45 bg-red-950/35 shadow-[0_0_30px_rgba(239,68,68,0.16)]'
              : isHigh
                ? 'border-amber-400/35 bg-amber-950/20 shadow-[0_0_24px_rgba(251,191,36,0.1)]'
                : isAdminAlert
                  ? 'border-cyan-300/35 bg-cyan-950/20 shadow-[0_0_28px_rgba(34,211,238,0.12)]'
                  : notification.is_read
                    ? 'border-white/10 bg-slate-950/55 hover:border-white/20'
                    : 'border-cyan-300/25 bg-slate-900/75 shadow-[0_0_24px_rgba(34,211,238,0.08)]'
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.08),transparent_34%)]" />

          {!notification.is_read && (
            <div className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-cyan-300" />
          )}

          <div className="relative flex items-start gap-4">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border backdrop-blur-xl',
                isCritical
                  ? 'border-red-300/40 bg-red-500/15'
                  : isHigh
                    ? 'border-amber-300/35 bg-amber-500/15'
                    : isAdminAlert
                      ? 'border-cyan-300/35 bg-cyan-400/15'
                      : 'border-white/10 bg-white/5'
              )}
            >
              {getIcon(notification)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className={cn('font-bold', notification.is_read ? 'text-slate-300' : 'text-white')}>
                  {notification.title}
                </h3>

                {notification.admin_copy && (
                  <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">
                    Admin Alert
                  </span>
                )}

                {isCritical && (
                  <span className="rounded-full border border-red-300/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-red-200">
                    Critical
                  </span>
                )}

                {isHigh && !isCritical && (
                  <span className="rounded-full border border-amber-300/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">
                    High
                  </span>
                )}
              </div>

              <p className={cn('line-clamp-2 text-sm leading-relaxed', notification.is_read ? 'text-slate-500' : 'text-slate-300')}>
                {notification.message}
              </p>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-cyan-300/85">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {new Date(notification.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>Click to open</span>
                </div>

                <div
                  className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(event) => event.stopPropagation()}
                >
                  {!notification.is_read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-emerald-300/35 hover:bg-emerald-400/10 hover:text-emerald-200"
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    onClick={() => deleteNotification(notification.id)}
                    className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-red-300/35 hover:bg-red-400/10 hover:text-red-200"
                    title="Delete"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#050714] px-4 pb-8 pt-24 text-white md:px-8">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.14),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-15" />

      <div className="relative z-10 mx-auto flex h-[calc(100vh-120px)] max-w-6xl flex-col">
        <header className="mb-5 overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-5 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_26px_rgba(34,211,238,0.18)]">
                  <Bell className="h-6 w-6 text-cyan-200" />
                </div>

                <div>
                  <h1 className="bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-cyan-300 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
                    Trollifications
                  </h1>
                  <p className="text-sm text-slate-400">
                    Alerts, jail updates, finance events, broadcasts, messages, and system notices.
                  </p>
                </div>
              </div>

              {isAdmin && (
                <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/5 px-4 py-3 text-sm text-cyan-100/85">
                  Admin jail alerts are rewritten as staff notices, so you only see “you were jailed” if your own account was jailed.
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 lg:min-w-[360px]">
              <StatCard label="Total" value={notifications.length} />
              <StatCard label="Unread" value={unreadCount} cyan />
              <StatCard label="Critical" value={criticalCount} red />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={markAllAsRead}
              disabled={notifications.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <CheckCircle className="h-4 w-4" />
              Mark all read
            </button>

            <button
              onClick={() => {
                if (window.confirm('Clear all notifications?')) {
                  notifications.forEach((notification) => void deleteNotification(notification.id))
                }
              }}
              disabled={notifications.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-red-300/25 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Trash2 className="h-4 w-4" />
              Clear all
            </button>
          </div>
        </header>

        <nav className="mb-4 flex shrink-0 gap-2 overflow-x-auto pb-2">
          {filterTabs.map((tab) => {
            if (!isAdmin && ['admin', 'applications', 'support', 'moderation'].includes(tab.key)) {
              return null
            }

            const active = filter === tab.key

            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition',
                  active
                    ? 'border-cyan-300/40 bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)]'
                    : 'border-white/10 bg-slate-950/70 text-slate-400 hover:border-cyan-300/25 hover:text-white'
                )}
              >
                {tab.icon}
                {tab.label}
                <span className={cn('rounded-full px-2 py-0.5 text-[11px]', active ? 'bg-slate-950/15 text-slate-950' : 'bg-white/5 text-slate-500')}>
                  {counts[tab.key] || 0}
                </span>
              </button>
            )
          })}
        </nav>

        <section className="min-h-0 flex-1 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/55 p-3 shadow-2xl backdrop-blur-xl">
          {loading ? (
            <EmptyState icon={<Bell className="h-9 w-9 animate-pulse text-cyan-300/50" />} title="Loading notifications..." />
          ) : filteredNotifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-9 w-9 text-slate-600" />}
              title={filter === 'unread' ? 'No unread notifications' : 'No notifications found'}
              subtitle={filter === 'all' ? 'You are all caught up.' : `No ${filter} notifications right now.`}
            />
          ) : (
            <Virtuoso
              style={{ height: '100%' }}
              data={filteredNotifications}
              itemContent={renderNotification}
              increaseViewportBy={300}
            />
          )}
        </section>
      </div>

      {selectedNotification && createPortal(
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSelectedNotification(null)}
        >
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-cyan-300/25 bg-[#070b19]/95 shadow-[0_0_60px_rgba(34,211,238,0.12)] backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  {getIcon(selectedNotification)}
                </div>
                <span className="text-sm font-bold text-white">Notification</span>
              </div>
              <button
                onClick={() => setSelectedNotification(null)}
                className="rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4">
              <h3 className="text-lg font-black text-white">{selectedNotification.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                {selectedNotification.message}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                <span>{new Date(selectedNotification.created_at).toLocaleString()}</span>
                <span className="text-slate-700">•</span>
                <span className="capitalize">{selectedNotification.category}</span>
                {selectedNotification.priority === 'critical' && (
                  <>
                    <span className="text-slate-700">•</span>
                    <span className="text-red-300">Critical</span>
                  </>
                )}
              </div>

              {String(selectedNotification.type) === 'new_follower' && (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center text-xs text-slate-400">
                  This is a follow notification. No action needed.
                </div>
              )}
            </div>

            <div className="border-t border-white/[0.06] px-4 py-3">
              <button
                onClick={() => setSelectedNotification(null)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 transition hover:border-white/20 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  cyan,
  red,
}: {
  label: string
  value: number
  cyan?: boolean
  red?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-3 text-center',
        red
          ? 'border-red-300/20 bg-red-500/10'
          : cyan
            ? 'border-cyan-300/15 bg-cyan-400/5'
            : 'border-white/10 bg-white/5'
      )}
    >
      <p className={cn('text-2xl font-black', red ? 'text-red-200' : cyan ? 'text-cyan-200' : 'text-white')}>
        {value}
      </p>
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex h-full min-h-[360px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5">
          {icon}
        </div>
        <p className="text-lg font-bold text-slate-300">{title}</p>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
  )
}