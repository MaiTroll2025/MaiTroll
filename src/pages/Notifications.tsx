import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Virtuoso } from 'react-virtuoso'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Bell,
  Briefcase,
  Car,
  Check,
  CheckCircle,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Dot,
  ExternalLink,
  FileText,
  Gift,
  Gavel,
  Megaphone,
  MessageCircle,
  Radio,
  Shield,
  ShoppingBag,
  Siren,
  Trash2,
  User,
  Users,
  Video,
  X,
} from 'lucide-react'

import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { getGlowingTextStyle } from '@/lib/perkEffects'
import { cn } from '../lib/utils'

type NotificationPriority = 'low' | 'normal' | 'high' | 'critical'
type NotificationSource = 'notifications' | 'jail_notifications'

type NotificationCategory =
  | 'all'
  | 'admin'
  | 'moderation'
  | 'jail'
  | 'finance'
  | 'applications'
  | 'support'
  | 'broadcast'
  | 'social'
  | 'system'

interface Notification {
  id: string
  source: NotificationSource
  user_id?: string
  type: string
  title: string
  message: string
  created_at: string
  is_read: boolean
  is_dismissed?: boolean
  metadata?: Record<string, any>
  priority: NotificationPriority
  admin_copy: boolean
  category: NotificationCategory
}

interface NotificationDestination {
  route: string | null
  label: string
  external?: boolean
  openInPanel?: boolean
}

interface UserNotificationGroup {
  userId: string | null
  username: string | null
  avatarUrl: string | null
  notifications: Notification[]
  unreadCount: number
  latestAt: string
  categories: Set<NotificationCategory>
}

const MAX_NOTIFICATIONS = 150
const REGULAR_NOTIFICATION_LIMIT = 120
const JAIL_NOTIFICATION_LIMIT = 40

const ADMIN_ROLES = new Set([
  'admin',
  'ceo',
  'owner',
  'super_admin',
  'superadmin',
  'staff',
  'moderator',
  'officer',
  'broadofficer',
  'lead_troll_officer',
  'hr',
  'support',
])

const DEFAULT_NOTIFICATION_DETAIL_ROUTE = '/notifications'

function normalizeType(type?: string) {
  return String(type || 'system').trim()
}

function normalizeRole(value?: string) {
  return String(value || '').trim().toLowerCase()
}

function isAdminProfile(profile: any): boolean {
  const role = normalizeRole(profile?.role || profile?.account_type)
  return ADMIN_ROLES.has(role) || profile?.is_admin === true || profile?.is_staff === true
}

function asString(value: any): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function firstString(...values: any[]): string | null {
  for (const value of values) {
    const result = asString(value)
    if (result) return result
  }
  return null
}

function isExternalUrl(route: string) {
  return /^https?:\/\//i.test(route)
}

function toInternalRoute(route?: string | null) {
  const value = asString(route)
  if (!value) return null

  if (isExternalUrl(value)) return value

  if (value.startsWith('/')) return value

  return `/${value.replace(/^\/+/, '')}`
}

function withQuery(baseRoute: string, params: Record<string, any>) {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      search.set(key, String(value))
    }
  })

  const query = search.toString()
  return query ? `${baseRoute}?${query}` : baseRoute
}

function isAdminCopy(metadata: any): boolean {
  return Boolean(
    metadata?.admin_copy ||
      metadata?.staff_copy ||
      metadata?.moderator_copy ||
      metadata?.officer_copy ||
      metadata?.audience === 'admin' ||
      metadata?.audience === 'staff'
  )
}

function getNotificationPriority(type: string, metadata?: any): NotificationPriority {
  const explicitPriority = normalizeRole(metadata?.priority)

  if (['low', 'normal', 'high', 'critical'].includes(explicitPriority)) {
    return explicitPriority as NotificationPriority
  }

  const criticalTypes = new Set([
    'security.alert',
    'security_alert',
    'moderation_alert',
    'report',
    'ban',
    'kick',
    'stream.ban',
    'stream.kick',
    'arrest',
    'sentencing',
    'jail_sentence',
    'support_ticket',
    'payout_request',
    'manual_coin_order',
    'coins.manual_purchase',
    'system.warning',
    'system_warning',
  ])

  const highTypes = new Set([
    'application_submitted',
    'officer_clock_in',
    'officer_clock_out',
    'bond_request',
    'appeal_submitted',
    'court_summon',
    'marketplace_order_fulfillment_required',
    'team_meeting_scheduled',
    'team_meeting_started',
    'survey',
    'contract_assigned',
    'contract_signature_required',
  ])

  if (criticalTypes.has(type)) return 'critical'
  if (highTypes.has(type)) return 'high'
  return 'normal'
}

function getNotificationCategory(type: string, metadata?: any): NotificationCategory {
  if (isAdminCopy(metadata)) return 'admin'

  if (
    [
      'moderation_alert',
      'moderation_action',
      'kick',
      'ban',
      'mute',
      'report',
      'stream.kick',
      'stream.ban',
      'security.alert',
      'security_alert',
    ].includes(type)
  ) {
    return 'moderation'
  }

  if (
    [
      'arrest',
      'sentencing',
      'release',
      'jail_sentence',
      'bond_request',
      'bond_posted',
      'court_summon',
      'attorney_hired',
      'court_date',
      'appeal_result',
      'appeal_submitted',
      'appeal_decision',
      'inmate_message_received',
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
      'troll_post_gift',
      'gift_received',
      'coin_received',
      'coin_gifted',
      'hype_coin_conversion',
      'cashout_window_open',
    ].includes(type)
  ) {
    return 'finance'
  }

  if (
    [
      'application_submitted',
      'application_result',
      'trollg_application',
      'agency_application_submitted',
      'career_application_submitted',
    ].includes(type)
  ) {
    return 'applications'
  }

  if (['support_ticket', 'support_reply'].includes(type)) return 'support'

  if (type === 'survey') return 'system'

  if (
    [
      'stream_live',
      'broadcast_live',
      'pod_live',
      'podcast_live',
      'user_live',
      'followed_user_live',
      'join_approved',
      'battle_result',
      'battle_started',
      'random_battle_started',
      'family_battle_started',
      'live_auction_started',
    ].includes(type)
  ) {
    return 'broadcast'
  }

  if (['new_follower', 'message', 'message_received', 'tromail_message', 'friend_live'].includes(type)) {
    return 'social'
  }

  return 'system'
}

function buildAdminSafeJailMessage(jailNotification: any, isAdmin: boolean) {
  const metadata = jailNotification.data || jailNotification.metadata || {}
  const inmateName =
    metadata.inmate_username ||
    metadata.username ||
    metadata.target_username ||
    metadata.user_username ||
    metadata.display_name ||
    'A user'

  const rawType = normalizeType(jailNotification.notification_type || jailNotification.type)

  if (!isAdmin) {
    return {
      title: jailNotification.title || 'Jail Notification',
      message: jailNotification.message || 'You have a jail update.',
    }
  }

  if (isAdminCopy(metadata) || metadata.inmate_id || metadata.target_user_id) {
    if (rawType === 'jail_sentence' || rawType === 'sentencing') {
      return {
        title: 'User Sentenced',
        message: `${inmateName} was sentenced. Open the jail dashboard to review the case.`,
      }
    }

    if (rawType === 'arrest') {
      return {
        title: 'User Arrested',
        message: `${inmateName} was jailed. This is an admin alert, not a notice against your account.`,
      }
    }

    if (rawType === 'release') {
      return {
        title: 'User Released',
        message: `${inmateName} was released from jail.`,
      }
    }

    if (rawType === 'bond_request') {
      return {
        title: 'Bond Request Submitted',
        message: `${inmateName} submitted a bond request.`,
      }
    }

    if (rawType === 'appeal_submitted') {
      return {
        title: 'Jail Appeal Submitted',
        message: `${inmateName} submitted an appeal for review.`,
      }
    }

    return {
      title: jailNotification.title?.replace(/^You\b/i, inmateName) || 'Jail Admin Alert',
      message:
        jailNotification.message
          ?.replace(/\bYou have been jailed\b/i, `${inmateName} has been jailed`)
          ?.replace(/\bYou were jailed\b/i, `${inmateName} was jailed`)
          ?.replace(/\byour account\b/i, `${inmateName}'s account`) ||
        `${inmateName} has a jail update that needs review.`,
    }
  }

  return {
    title: jailNotification.title || 'Jail Notification',
    message: jailNotification.message || 'Jail notification received.',
  }
}

function normalizeRegularNotification(row: any): Notification {
  const type = normalizeType(row.type)
  const metadata = row.metadata || row.data || {}

  return {
    id: row.id,
    source: 'notifications',
    user_id: row.user_id,
    type,
    title: row.title || 'Notification',
    message: row.message || '',
    created_at: row.created_at,
    is_read: Boolean(row.is_read),
    is_dismissed: Boolean(row.is_dismissed),
    metadata,
    priority: getNotificationPriority(type, metadata),
    admin_copy: isAdminCopy(metadata),
    category: getNotificationCategory(type, metadata),
  }
}

function normalizeJailNotification(row: any, isAdmin: boolean): Notification {
  const metadata = row.data || row.metadata || {}
  const type = normalizeType(row.notification_type || row.type || 'jail_sentence')
  const safeCopy = buildAdminSafeJailMessage(row, isAdmin)
  const adminCopy = isAdminCopy(metadata) || Boolean(metadata.inmate_id || metadata.target_user_id)

  return {
    id: row.id,
    source: 'jail_notifications',
    user_id: row.user_id,
    type,
    title: safeCopy.title,
    message: safeCopy.message,
    created_at: row.created_at,
    is_read: Boolean(row.is_read),
    is_dismissed: false,
    metadata,
    priority: getNotificationPriority(type, metadata),
    admin_copy: adminCopy,
    category: adminCopy && isAdmin ? 'admin' : getNotificationCategory(type, metadata),
  }
}

// ── User-based notification grouping ────────────────────────────────
// Extracts the "actor" user from a notification's metadata so we can
// group notifications by user instead of showing one long flat list.

function extractNotificationUser(notification: Notification): { userId: string | null; username: string | null; avatarUrl: string | null } {
  const m = notification.metadata || {}

  // The actor is whoever triggered the notification (sender, reporter, etc.)
  const userId = firstString(
    m.actor_id,
    m.sender_id,
    m.target_user_id,
    m.user_id,
    m.profile_user_id,
    m.inmate_id,
    m.follower_id,
    m.from_user_id,
    m.reported_by,
    m.submitted_by,
  )

  const username = firstString(
    m.actor_username,
    m.sender_username,
    m.username,
    m.target_username,
    m.follower_username,
    m.user_username,
    m.display_name,
    m.inmate_username,
    m.reported_by_username,
  )

  const avatarUrl = firstString(
    m.actor_avatar_url,
    m.sender_avatar_url,
    m.avatar_url,
    m.target_avatar_url,
    m.user_avatar_url,
  )

  return { userId, username, avatarUrl }
}

function groupNotificationsByUser(notifications: Notification[]): UserNotificationGroup[] {
  const map = new Map<string, UserNotificationGroup>()

  for (const n of notifications) {
    const { userId, username, avatarUrl } = extractNotificationUser(n)
    // Use userId as key; fall back to username; lastly "system" for none
    const key = userId || username || '__system__'

    let group = map.get(key)
    if (!group) {
      group = {
        userId,
        username,
        avatarUrl,
        notifications: [],
        unreadCount: 0,
        latestAt: n.created_at,
        categories: new Set(),
      }
      map.set(key, group)
    }

    group.notifications.push(n)
    if (!n.is_read) group.unreadCount++
    if (new Date(n.created_at) > new Date(group.latestAt)) group.latestAt = n.created_at
    group.categories.add(n.category)
  }

  // Sort groups: most recent first, then by unread count
  return Array.from(map.values()).sort((a, b) => {
    const unreadDelta = b.unreadCount - a.unreadCount
    if (unreadDelta !== 0) return unreadDelta
    return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
  })
}

function resolveNotificationDestination(
  notification: Notification,
  options: { isAdmin: boolean }
): NotificationDestination {
  const { isAdmin } = options
  const metadata = notification.metadata || {}
  const type = notification.type

  const explicitRoute = toInternalRoute(
    firstString(
      isAdmin ? metadata.admin_route : null,
      metadata.route,
      metadata.action_url,
      metadata.actionUrl,
      metadata.redirect_to,
      metadata.redirectTo,
      metadata.deep_link,
      metadata.deepLink,
      metadata.href,
      metadata.url,
      metadata.path
    )
  )

  if (explicitRoute) {
    return {
      route: explicitRoute,
      label: isExternalUrl(explicitRoute) ? 'Open external link' : 'Open linked page',
      external: isExternalUrl(explicitRoute),
    }
  }

  const streamId = firstString(
    metadata.stream_id,
    metadata.broadcast_id,
    metadata.live_stream_id,
    metadata.room_id,
    metadata.streamId
  )

  const battleId = firstString(metadata.battle_id, metadata.random_battle_id, metadata.family_battle_id)
  const podcastId = firstString(metadata.podcast_id, metadata.episode_id, metadata.pod_id)
  const auctionId = firstString(metadata.auction_id, metadata.live_auction_id, metadata.marketplace_auction_id)
  const orderId = firstString(metadata.order_id, metadata.marketplace_order_id)
  const payoutId = firstString(metadata.payout_id, metadata.cashout_id)
  const ticketId = firstString(metadata.ticket_id, metadata.support_ticket_id)
  const applicationId = firstString(metadata.application_id, metadata.career_application_id, metadata.agency_application_id)
  const caseId = firstString(metadata.case_id, metadata.moderation_case_id, metadata.court_case_id)
  const inmateId = firstString(metadata.inmate_id, metadata.jail_id)
  const targetUserId = firstString(metadata.target_user_id, metadata.user_id, metadata.profile_user_id)
  const username = firstString(metadata.username, metadata.follower_username, metadata.sender_username, metadata.target_username)
  const messageId = firstString(metadata.message_id, metadata.tromail_message_id)
  const meetingId = firstString(metadata.meeting_id, metadata.team_meeting_id)
  const contractId = firstString(metadata.contract_id, metadata.document_id)

  switch (type) {
    case 'new_follower':
      return {
        route: username ? `/profile/${encodeURIComponent(username)}` : DEFAULT_NOTIFICATION_DETAIL_ROUTE,
        label: 'Follow notification',
        openInPanel: true,
      }

    case 'message':
    case 'message_received':
      return {
        route: messageId ? withQuery('/messages', { message: messageId }) : '/messages',
        label: 'Open messages',
      }

    case 'tromail_message':
    case 'tromail_admin_email':
    case 'admin_email':
      return {
        route: messageId ? withQuery('/tromail', { message: messageId }) : '/tromail',
        label: 'Open Tromail',
      }

    case 'team_meeting_scheduled':
     case 'team_meeting_updated':
     case 'meeting_invite':
       return {
         route: meetingId ? withQuery('/tromail', { tab: 'meetings', meeting: meetingId }) : '/tromail?tab=meetings',
         label: 'Open team meeting',
       }

     case 'team_meeting_started':
       return {
         route: meetingId ? `/meeting/${meetingId}` : '/admin/meetings',
         label: 'Join meeting',
       }

    case 'survey':
      return {
        route: metadata.survey_id ? `/survey/${metadata.survey_id}` : '/notifications',
        label: 'Take survey',
      }

    case 'contract_assigned':
    case 'contract_signature_required':
    case 'contract_completed':
      return {
        route: contractId ? withQuery('/contracts', { contract: contractId }) : '/contracts',
        label: 'Open contract',
      }

    case 'gift_received':
    case 'coin_received':
    case 'coin_gifted':
    case 'hype_coin_conversion':
    case 'cashout_window_open':
      return { route: '/wallet', label: 'Open wallet' }

    case 'troll_post_gift':
      return { route: metadata.post_id ? withQuery('/troll-wall', { post: metadata.post_id }) : '/troll-wall', label: 'Open Troll Wall' }

    case 'stream_live':
    case 'broadcast_live':
    case 'user_live':
    case 'followed_user_live':
    case 'friend_live':
    case 'join_approved':
      return {
        route: streamId ? `/watch/${streamId}` : '/broadcasts',
        label: streamId ? 'Open broadcast' : 'Open broadcasts',
      }

    case 'pod_live':
    case 'podcast_live':
      return {
        route: podcastId ? withQuery('/podcast-central', { podcast: podcastId }) : '/podcast-central',
        label: 'Open podcast',
      }

    case 'battle_started':
    case 'random_battle_started':
    case 'family_battle_started':
      return {
        route: battleId
          ? withQuery('/battle', { battle: battleId, stream: streamId })
          : streamId
            ? `/watch/${streamId}`
            : '/broadcasts',
        label: 'Open battle',
      }

    case 'battle_result':
    case 'badge_unlocked':
      return { route: '/profile', label: 'Open profile' }

    case 'live_auction_started':
    case 'vehicle_auction':
      return {
        route: auctionId ? withQuery('/auctions', { auction: auctionId }) : '/auctions',
        label: 'Open auction',
      }

    case 'property_purchased':
      return { route: '/profile?tab=properties', label: 'Open properties' }

    case 'item_purchased':
    case 'marketplace_order_created':
    case 'marketplace_order_shipped':
    case 'marketplace_order_delivered':
    case 'marketplace_order_updated':
      return {
        route: orderId ? withQuery('/my-orders', { order: orderId }) : '/my-orders',
        label: 'Open order',
      }

    case 'marketplace_sale':
    case 'marketplace_order_fulfillment_required':
      return {
        route: orderId ? withQuery('/marketplace/sales', { order: orderId }) : '/marketplace/sales',
        label: 'Open sales',
      }

    case 'kick':
    case 'ban':
    case 'mute':
    case 'report':
    case 'moderation_alert':
    case 'moderation_action':
    case 'stream.kick':
    case 'stream.ban':
    case 'security.alert':
    case 'security_alert':
      return {
        route: caseId
          ? withQuery('/admin/moderation', { case: caseId })
          : targetUserId
            ? withQuery('/admin/users', { id: targetUserId })
            : '/admin/moderation',
        label: 'Open moderation',
      }

    case 'arrest':
    case 'sentencing':
    case 'jail_sentence':
    case 'bond_request':
    case 'bond_posted':
    case 'release':
      return {
        route: inmateId ? withQuery('/inmates', { inmate: inmateId }) : '/inmates',
        label: 'Open jail case',
      }

    case 'court_summon':
    case 'attorney_hired':
    case 'court_date':
    case 'appeal_result':
    case 'appeal_submitted':
    case 'appeal_decision':
      return {
        route: caseId ? withQuery('/attorney', { case: caseId }) : '/attorney',
        label: 'Open court case',
      }

    case 'inmate_message_received':
      return {
        route: '/jail',
        label: 'Open jail messages',
      }

    case 'officer_update':
    case 'officer_clock_in':
    case 'officer_clock_out':
      return { route: '/admin/officers', label: 'Open officer dashboard' }

    case 'payout_status':
      return {
        route: payoutId ? withQuery('/wallet', { payout: payoutId }) : '/wallet',
        label: 'Open payout',
      }

    case 'payout_request':
    case 'payout_update':
      return {
        route: payoutId ? `/admin/finance?tab=payouts&id=${encodeURIComponent(payoutId)}` : '/admin/finance?tab=payouts',
        label: 'Open payout request',
      }

    case 'coins.fast_spend':
    case 'coins.manual_purchase':
    case 'manual_coin_order':
      return {
        route: orderId ? `/admin/finance?tab=orders&id=${encodeURIComponent(orderId)}` : '/admin/finance?tab=orders',
        label: 'Open coin order',
      }

    case 'support_ticket':
    case 'support_reply':
      return {
        route: ticketId ? withQuery('/admin/support', { id: ticketId }) : '/admin/support',
        label: 'Open support ticket',
      }

    case 'application_submitted':
    case 'career_application_submitted':
      return {
        route: applicationId ? withQuery('/admin/applications', { id: applicationId }) : '/admin/applications',
        label: 'Open application',
      }

    case 'agency_application_submitted':
      return {
        route: applicationId ? withQuery('/agency-hr', { application: applicationId }) : '/agency-hr',
        label: 'Open agency application',
      }

    case 'application_result':
    case 'trollg_application':
      return {
        route: applicationId ? withQuery('/jobs/status', { application: applicationId }) : '/jobs/status',
        label: 'Open application status',
      }

    case 'seller_tier_upgraded':
    case 'seller_tier_downgraded':
    case 'new_review_received':
      return { route: '/marketplace', label: 'Open marketplace' }

    case 'announcement':
    case 'system_announcement':
      return { route: '/announcements', label: 'Open announcements' }

    case 'system.warning':
    case 'system_warning':
      return { route: '/admin/system', label: 'Open system alerts' }

    case 'profile_update':
      return {
        route: username ? `/profile/${encodeURIComponent(username)}` : targetUserId ? withQuery('/admin/users', { id: targetUserId }) : '/profile',
        label: 'Open profile',
      }

    default:
      return {
        route: null,
        label: 'Open notification',
        openInPanel: true,
      }
  }
}

type ViewMode = 'list' | 'byUser'

interface NotificationsProps {
  compact?: boolean
}

export default function Notifications({ compact = false }: NotificationsProps) {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<NotificationCategory>('all')
  const [loading, setLoading] = useState(true)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('byUser')
  const [selectedUserGroup, setSelectedUserGroup] = useState<UserNotificationGroup | null>(null)

  const isAdmin = useMemo(() => isAdminProfile(profile), [profile])

  const loadNotifications = useCallback(async () => {
    if (!profile?.id) {
      setNotifications([])
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', profile.id)
        .lt('created_at', thirtyDaysAgo)

      const { data: regularRows, error: regularError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(REGULAR_NOTIFICATION_LIMIT)

      if (regularError) throw regularError

      const { data: jailRows, error: jailError } = await supabase
        .from('jail_notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(JAIL_NOTIFICATION_LIMIT)

      if (jailError) {
        console.warn('Unable to load jail_notifications:', jailError)
      }

      const regularNotifications = (regularRows || []).map(normalizeRegularNotification)
      const jailNotifications = (jailRows || []).map((row) => normalizeJailNotification(row, isAdmin))

      const combined = [...regularNotifications, ...jailNotifications]
        .filter((notification) => !notification.is_dismissed)
        .sort((a, b) => {
          const priorityScore: Record<NotificationPriority, number> = {
            critical: 4,
            high: 3,
            normal: 2,
            low: 1,
          }

          const priorityDelta = priorityScore[b.priority] - priorityScore[a.priority]

          if (priorityDelta !== 0 && !a.is_read && !b.is_read) return priorityDelta

          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        .slice(0, MAX_NOTIFICATIONS)

      setNotifications(combined)
    } catch (error) {
      console.error('Failed to load notifications:', error)
      setNotifications([])
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [profile?.id, isAdmin])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    if (!profile?.id) return

    const channel = supabase
      .channel(`notifications-page:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => loadNotifications(),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => loadNotifications(),
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'jail_notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => loadNotifications(),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jail_notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => loadNotifications(),
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [profile?.id, loadNotifications])

  const counts = useMemo(() => {
    const base: Record<NotificationCategory, number> = {
      all: notifications.length,
      admin: 0,
      moderation: 0,
      jail: 0,
      finance: 0,
      applications: 0,
      support: 0,
      broadcast: 0,
      social: 0,
      system: 0,
    }

    for (const notification of notifications) {
      const category = notification.category || 'system'
      base[category] = (base[category] || 0) + 1
    }

    return base
  }, [notifications])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications])

  const criticalCount = useMemo(
    () => notifications.filter((n) => !n.is_read && n.priority === 'critical').length,
    [notifications]
  )

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications
    return notifications.filter((n) => n.category === filter)
  }, [notifications, filter])

  const userGroups = useMemo(() => groupNotificationsByUser(filteredNotifications), [filteredNotifications])

  const filteredUserGroups = useMemo(() => {
    if (filter === 'all') return userGroups
    return userGroups
      .map((g) => ({
        ...g,
        notifications: g.notifications.filter((n) => n.category === filter),
      }))
      .filter((g) => g.notifications.length > 0)
  }, [userGroups, filter])

  const markAsRead = useCallback(
    async (notification: Notification) => {
      try {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
        )

        const table = notification.source === 'jail_notifications' ? 'jail_notifications' : 'notifications'

        const { error } = await supabase.from(table).update({ is_read: true }).eq('id', notification.id)

        if (error) throw error
      } catch (error) {
        console.error('Failed to mark notification as read:', error)
        toast.error('Failed to mark as read')
        void loadNotifications()
      }
    },
    [loadNotifications]
  )

  const markAllAsRead = async () => {
    if (!profile?.id) return

    try {
      const { error: regularError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)

      if (regularError) throw regularError

      const { error: jailError } = await supabase
        .from('jail_notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)

      if (jailError) console.warn('Could not mark jail notifications read:', jailError)

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Failed to mark all as read:', error)
      toast.error('Error marking all as read')
    }
  }

  const dismissNotification = async (notification: Notification) => {
    try {
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id))

      if (notification.source === 'jail_notifications') {
        const { error } = await supabase
          .from('jail_notifications')
          .update({ is_read: true })
          .eq('id', notification.id)

        if (error) throw error

        toast.success('Jail notification dismissed')
        return
      }

      const { error } = await supabase.from('notifications').delete().eq('id', notification.id)

      if (error) throw error

      toast.success('Notification deleted')
    } catch (error) {
      console.error('Failed to dismiss notification:', error)
      toast.error('Failed to dismiss notification')
      void loadNotifications()
    }
  }

  const deleteAllNotifications = async () => {
    if (!profile?.id) return

    const confirmed = window.confirm(
      'Clear all regular notifications? Jail notifications will only be marked as read for audit safety.'
    )

    if (!confirmed) return

    try {
      const { error } = await supabase.from('notifications').delete().eq('user_id', profile.id)

      if (error) throw error

      await supabase.from('jail_notifications').update({ is_read: true }).eq('user_id', profile.id)

      setNotifications([])
      setSelectedNotification(null)
      toast.success('Notifications cleared')
    } catch (error) {
      console.error('Failed to clear notifications:', error)
      toast.error('Failed to clear notifications')
    }
  }

  const getDestination = useCallback(
    (notification: Notification) => resolveNotificationDestination(notification, { isAdmin }),
    [isAdmin]
  )

  const openNotificationPanel = useCallback(
    async (notification: Notification) => {
      setSelectedNotification(notification)

      if (!notification.is_read) {
        void markAsRead(notification)
      }
    },
    [markAsRead]
  )

  const handleNotificationClick = useCallback(
    async (notification: Notification) => {
      if (!notification.is_read) {
        void markAsRead(notification)
      }

      setSelectedNotification(notification)
    },
    [markAsRead]
  )

  const getNotificationIcon = (notification: Notification) => {
    const type = notification.type
    const category = notification.category

    if (notification.priority === 'critical') {
      return <Siren className="h-5 w-5 text-red-300" />
    }

    if (category === 'admin') return <Shield className="h-5 w-5 text-cyan-300" />

    switch (type) {
case 'stream_live':
       case 'broadcast_live':
       case 'pod_live':
       case 'podcast_live':
       case 'user_live':
       case 'followed_user_live':
       case 'battle_started':
       case 'random_battle_started':
       case 'family_battle_started':
       case 'live_auction_started':
       case 'team_meeting_started':
       case 'team_meeting_scheduled':
         return <Video className="h-5 w-5 text-pink-300" />

      case 'join_approved':
        return <CheckCircle className="h-5 w-5 text-emerald-300" />

      case 'moderation_alert':
      case 'moderation_action':
      case 'kick':
      case 'ban':
      case 'mute':
      case 'report':
      case 'stream.kick':
      case 'stream.ban':
        return <Gavel className="h-5 w-5 text-red-300" />

    case 'arrest':
    case 'sentencing':
    case 'jail_sentence':
    case 'bond_request':
    case 'bond_posted':
    case 'release':
    case 'court_summon':
    case 'attorney_hired':
    case 'court_date':
      return <Gavel className="h-5 w-5 text-amber-300" />

    case 'inmate_message_received':
      return <MessageCircle className="h-5 w-5 text-cyan-300" />

      case 'new_follower':
        return <User className="h-5 w-5 text-blue-300" />

      case 'gift_received':
      case 'troll_post_gift':
        return <Gift className="h-5 w-5 text-fuchsia-300" />

      case 'message':
      case 'message_received':
      case 'tromail_message':
      case 'support_ticket':
      case 'support_reply':
        return <MessageCircle className="h-5 w-5 text-cyan-300" />

      case 'announcement':
      case 'system_announcement':
        return <Megaphone className="h-5 w-5 text-orange-300" />

      case 'vehicle_auction':
        return <Car className="h-5 w-5 text-purple-300" />

      case 'officer_update':
      case 'officer_clock_in':
      case 'officer_clock_out':
        return <Shield className="h-5 w-5 text-cyan-300" />

      case 'application_submitted':
      case 'application_result':
      case 'trollg_application':
      case 'agency_application_submitted':
      case 'career_application_submitted':
        return <Briefcase className="h-5 w-5 text-emerald-300" />

      case 'property_purchased':
      case 'item_purchased':
      case 'marketplace_order_created':
      case 'marketplace_sale':
        return <ShoppingBag className="h-5 w-5 text-green-300" />

      case 'coins.fast_spend':
      case 'coins.manual_purchase':
      case 'manual_coin_order':
      case 'payout_status':
      case 'payout_request':
      case 'payout_update':
      case 'hype_coin_conversion':
        return <CircleDollarSign className="h-5 w-5 text-green-300" />

      case 'security.alert':
      case 'security_alert':
      case 'system.warning':
      case 'system_warning':
        return <AlertTriangle className="h-5 w-5 text-red-300" />

      default:
        return <Bell className="h-5 w-5 text-slate-300" />
    }
  }

  const renderMessage = (notification: Notification) => {
    if (notification.type === 'gift_received' && notification.metadata?.sender_username) {
      return (
        <>
          You received {Number(notification.metadata.coins_spent || 0).toLocaleString()} coins from{' '}
          <span
            style={getGlowingTextStyle(notification.metadata.sender_glowing_color)}
            className={notification.metadata.sender_glowing_color ? 'font-bold' : ''}
          >
            @{notification.metadata.sender_username}
          </span>
        </>
      )
    }

    return notification.message
  }

  const filterTabs: Array<{ key: NotificationCategory; label: string; icon: React.ReactNode }> = [
    { key: 'all', label: 'All', icon: <Bell className="h-4 w-4" /> },
    { key: 'admin', label: 'Admin', icon: <Shield className="h-4 w-4" /> },
    { key: 'moderation', label: 'Moderation', icon: <Gavel className="h-4 w-4" /> },
    { key: 'jail', label: 'Jail', icon: <FileText className="h-4 w-4" /> },
    { key: 'finance', label: 'Finance', icon: <CircleDollarSign className="h-4 w-4" /> },
    { key: 'applications', label: 'Applications', icon: <Briefcase className="h-4 w-4" /> },
    { key: 'support', label: 'Support', icon: <MessageCircle className="h-4 w-4" /> },
    { key: 'broadcast', label: 'Broadcast', icon: <Radio className="h-4 w-4" /> },
    { key: 'social', label: 'Social', icon: <User className="h-4 w-4" /> },
    { key: 'system', label: 'System', icon: <AlertTriangle className="h-4 w-4" /> },
  ]

  const renderNotification = (_index: number, notification: Notification) => {
    const isCritical = notification.priority === 'critical'
    const isHigh = notification.priority === 'high'
    const isAdminAlert = notification.category === 'admin'
    const destination = getDestination(notification)

    return (
      <div className="pb-3 pr-1">
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
              {getNotificationIcon(notification)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className={cn('truncate font-bold', notification.is_read ? 'text-slate-300' : 'text-white')}>
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
                    {renderMessage(notification)}
                  </p>
                </div>

                <time className="shrink-0 text-xs text-slate-500">
                  {new Date(notification.created_at).toLocaleDateString()}
                </time>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-xs text-cyan-300/85">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>{new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-slate-600">•</span>
                  <span className="truncate">{destination.label}</span>
                  {destination.external && <ExternalLink className="h-3.5 w-3.5 shrink-0" />}
                </div>

                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                  {!notification.is_read && (
                    <button
                      onClick={() => markAsRead(notification)}
                      className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-emerald-300/35 hover:bg-emerald-400/10 hover:text-emerald-200"
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    onClick={() => openNotificationPanel(notification)}
                    className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-cyan-200"
                    title="Open notification details"
                  >
                    <FileText className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => dismissNotification(notification)}
                    className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-red-300/35 hover:bg-red-400/10 hover:text-red-200"
                    title="Dismiss"
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

  const renderUserGroup = (_index: number, group: UserNotificationGroup) => {
    const displayName = group.username || group.userId || 'System'
    const latestNotif = group.notifications[0]
    const categoryList = Array.from(group.categories).slice(0, 3).join(', ')

    return (
      <div className="pb-3 pr-1">
        <article
          onClick={() => setSelectedUserGroup(group)}
          className={cn(
            'group relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl',
            group.unreadCount > 0
              ? 'border-cyan-300/25 bg-slate-900/75 shadow-[0_0_24px_rgba(34,211,238,0.08)]'
              : 'border-white/10 bg-slate-950/55 hover:border-white/20'
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.06),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.06),transparent_34%)]" />

          {group.unreadCount > 0 && (
            <div className="absolute right-4 top-4 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-cyan-400 px-1.5 text-[11px] font-black text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.85)]">
              {group.unreadCount}
            </div>
          )}

          <div className="relative flex items-center gap-4">
            <div className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border',
              group.unreadCount > 0
                ? 'border-cyan-300/30 bg-cyan-400/10'
                : 'border-white/10 bg-white/5'
            )}>
              {group.avatarUrl ? (
                <img src={group.avatarUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
              ) : (
                <User className={cn('h-6 w-6', group.unreadCount > 0 ? 'text-cyan-300' : 'text-slate-400')} />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className={cn('truncate font-bold', group.unreadCount > 0 ? 'text-white' : 'text-slate-300')}>
                  {displayName}
                </h3>
                <span className="text-xs text-slate-500">
                  {group.notifications.length} notification{group.notifications.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm text-slate-400">
                {latestNotif.title}
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                <Clock className="h-3 w-3" />
                <span>{new Date(group.latestAt).toLocaleString()}</span>
                <span className="text-slate-700">â€¢</span>
                <span className="truncate">{categoryList}</span>
              </div>
            </div>

            <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition group-hover:text-cyan-300" />
          </div>
        </article>
      </div>
    )
  }

  const renderUserNotificationDetail = () => {
    const group = selectedUserGroup
    if (!group) return null

    const displayName = group.username || group.userId || 'System'

    return (
      <div className="flex h-full flex-col">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => setSelectedUserGroup(null)}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-cyan-200"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
          </button>
          <div className="flex items-center gap-2">
            {group.avatarUrl ? (
              <img src={group.avatarUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                <User className="h-4 w-4 text-slate-400" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-white">{displayName}</h3>
              <p className="text-xs text-slate-500">{group.notifications.length} notifications</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {group.notifications.map((notification) => (
            <div key={notification.id} className="pb-2">
              <article
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  'group relative cursor-pointer overflow-hidden rounded-xl border p-3 transition-all duration-200 hover:shadow-lg',
                  notification.is_read
                    ? 'border-white/10 bg-slate-950/55 hover:border-white/20'
                    : 'border-cyan-300/20 bg-slate-900/60'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    {getNotificationIcon(notification)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={cn('truncate text-sm font-bold', notification.is_read ? 'text-slate-400' : 'text-white')}>
                        {notification.title}
                      </h4>
                      <time className="shrink-0 text-[11px] text-slate-500">
                        {new Date(notification.created_at).toLocaleString()}
                      </time>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                      {renderMessage(notification)}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        notification.category === 'admin' ? 'bg-cyan-400/10 text-cyan-300' :
                        notification.category === 'moderation' ? 'bg-red-400/10 text-red-300' :
                        notification.category === 'finance' ? 'bg-green-400/10 text-green-300' :
                        'bg-white/5 text-slate-500'
                      )}>
                        {notification.category}
                      </span>
                      {notification.priority === 'critical' && (
                        <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-300">Critical</span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('min-h-screen bg-[#050714] px-4 pb-8 text-white md:px-8', compact ? 'pt-4' : 'pt-24')}>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.14),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-15" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="mb-6 overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-5 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_26px_rgba(34,211,238,0.18)]">
                  <Bell className="h-6 w-6 text-cyan-200" />
                </div>

                <div>
                  <h1 className="bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-cyan-300 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
                    Trollifications
                  </h1>
                  <p className="text-sm text-slate-400">
                    Grouped by user for quick review. Click a user to see all their notifications.
                  </p>
                </div>
              </div>

              {isAdmin && (
                <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/5 px-4 py-3 text-sm text-cyan-100/85">
                  Admin jail notices are rewritten as staff alerts, so you will not see “you were jailed” unless your own account was actually jailed.
                </div>
              )}
            </div>

            <div className={cn('grid gap-2 md:min-w-[360px]', viewMode === 'byUser' ? 'grid-cols-4' : 'grid-cols-3')}>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                <p className="text-2xl font-black text-white">{notifications.length}</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Total</p>
              </div>

              {viewMode === 'byUser' && (
                <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 p-3 text-center">
                  <p className="text-2xl font-black text-purple-200">{filteredUserGroups.length}</p>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Users</p>
                </div>
              )}

              <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-3 text-center">
                <p className="text-2xl font-black text-cyan-200">{unreadCount}</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Unread</p>
              </div>

              <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-3 text-center">
                <p className="text-2xl font-black text-red-200">{criticalCount}</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Critical</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={markAllAsRead}
                disabled={notifications.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <CheckCircle className="h-4 w-4" />
                Mark all read
              </button>

              <button
                onClick={deleteAllNotifications}
                disabled={notifications.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-red-300/25 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Trash2 className="h-4 w-4" />
                Clear all
              </button>
            </div>
          </div>
        </header>

        {/* View mode toggle */}
        <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-slate-950/70 p-1">
          <button
            onClick={() => { setViewMode('byUser'); setSelectedUserGroup(null); }}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition',
              viewMode === 'byUser'
                ? 'border border-cyan-300/40 bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.22)]'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <Users className="h-4 w-4" />
            By User
          </button>
          <button
            onClick={() => { setViewMode('list'); setSelectedUserGroup(null); }}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition',
              viewMode === 'list'
                ? 'border border-cyan-300/40 bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.22)]'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <Bell className="h-4 w-4" />
            All List
          </button>
        </div>

        <nav className="mb-5 flex gap-2 overflow-x-auto pb-2">
          {filterTabs.map((tab) => {
            const active = filter === tab.key
            const count = viewMode === 'byUser'
              ? filteredUserGroups.reduce((acc, g) => acc + g.notifications.filter((n) => tab.key === 'all' || n.category === tab.key).length, 0)
              : counts[tab.key] || 0

            if (!isAdmin && ['admin', 'applications', 'support'].includes(tab.key)) return null

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
                  {count}
                </span>
              </button>
            )
          })}
        </nav>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/55 p-3 shadow-2xl backdrop-blur-xl">
          {loading ? (
            <div className="flex min-h-[380px] items-center justify-center text-slate-500">
              <div className="text-center">
                <Bell className="mx-auto mb-3 h-10 w-10 animate-pulse text-cyan-300/50" />
                Loading notifications...
              </div>
            </div>
          ) : viewMode === 'byUser' && !selectedUserGroup && filteredUserGroups.length === 0 ? (
            <div className="flex min-h-[380px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5">
                  <Bell className="h-8 w-8 text-slate-600" />
                </div>
                <p className="text-lg font-bold text-slate-300">No notifications found</p>
                <p className="mt-1 text-sm text-slate-500">
                  {filter === 'all' ? 'You are all caught up.' : `No ${filter} notifications right now.`}
                </p>
              </div>
            </div>
          ) : viewMode === 'list' && filteredNotifications.length === 0 ? (
            <div className="flex min-h-[380px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5">
                  <Bell className="h-8 w-8 text-slate-600" />
                </div>
                <p className="text-lg font-bold text-slate-300">No notifications found</p>
                <p className="mt-1 text-sm text-slate-500">
                  {filter === 'all' ? 'You are all caught up.' : `No ${filter} notifications right now.`}
                </p>
              </div>
            </div>
          ) : viewMode === 'byUser' && !selectedUserGroup ? (
            <div className="h-[calc(100vh-380px)] min-h-[420px]">
              <Virtuoso style={{ height: '100%' }} data={filteredUserGroups} itemContent={renderUserGroup} increaseViewportBy={300} />
            </div>
          ) : viewMode === 'byUser' && selectedUserGroup ? (
            <div className="h-[calc(100vh-380px)] min-h-[420px]">
              {renderUserNotificationDetail()}
            </div>
          ) : (
            <div className="h-[calc(100vh-360px)] min-h-[420px]">
              <Virtuoso style={{ height: '100%' }} data={filteredNotifications} itemContent={renderNotification} increaseViewportBy={300} />
            </div>
          )}
        </section>
      </div>

      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={() => setSelectedNotification(null)}>
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-cyan-300/30 bg-slate-950 shadow-[0_0_50px_rgba(34,211,238,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.13),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.12),transparent_36%)]" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  {getNotificationIcon(selectedNotification)}
                </div>

                <div>
                  <h2 className="text-xl font-black text-white">{selectedNotification.title}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{new Date(selectedNotification.created_at).toLocaleString()}</span>
                    <Dot className="h-4 w-4" />
                    <span className="capitalize">{selectedNotification.category}</span>
                    <Dot className="h-4 w-4" />
                    <span className="capitalize">{selectedNotification.priority}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedNotification(null)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-red-300/35 hover:bg-red-400/10 hover:text-red-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-slate-300">
              {renderMessage(selectedNotification)}
            </div>

            {selectedNotification.metadata && Object.keys(selectedNotification.metadata).length > 0 && (
              <details className="relative mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <summary className="cursor-pointer text-sm font-bold text-cyan-200">Notification metadata</summary>
                <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-400">
                  {JSON.stringify(selectedNotification.metadata, null, 2)}
                </pre>
              </details>
            )}

            <div className="relative mt-5 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setSelectedNotification(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 transition hover:border-white/20 hover:text-white"
              >
                Close
              </button>

              {(() => {
                const destination = getDestination(selectedNotification)

                if (!destination.route || destination.openInPanel) return null

                return (
                  <button
                    onClick={() => {
                      if (destination.external && destination.route) {
                        window.open(destination.route, '_blank', 'noopener,noreferrer')
                      } else if (destination.route) {
                        navigate(destination.route)
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/15"
                  >
                    {destination.label}
                    {destination.external && <ExternalLink className="h-4 w-4" />}
                  </button>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
