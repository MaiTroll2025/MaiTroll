import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { supabase, UserProfile } from '@/lib/supabase'
import {
  AdminNotificationRecord,
  AdminNotificationTab,
  getAdminNotificationPath,
  getAdminNotificationTab,
  getAdminNotificationTabForPath,
} from './adminNotificationConfig'

interface AdminNotificationContextValue {
  notifications: AdminNotificationRecord[]
  unreadCounts: Partial<Record<AdminNotificationTab, number>>
  unreadTotal: number
  markTabRead: (tab: AdminNotificationTab) => Promise<void>
  markNotificationRead: (notification: AdminNotificationRecord) => Promise<void>
  openNotification: (notification: AdminNotificationRecord) => Promise<void>
}

const AdminNotificationContext = createContext<AdminNotificationContextValue | null>(null)

function isStaff(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false
  const role = String(profile.role || '').toLowerCase()
  return Boolean(
    profile.is_admin ||
      profile.is_staff ||
      profile.is_lead_officer ||
      profile.is_troll_officer ||
      profile.is_secretary ||
      ['admin', 'superadmin', 'owner', 'ceo', 'moderator', 'staff', 'troll_officer', 'lead_troll_officer', 'secretary', 'executive_secretary', 'attorney', 'prosecutor'].includes(role),
  )
}

function normalize(row: Record<string, unknown>): AdminNotificationRecord {
  const metadata = row.metadata && typeof row.metadata === 'object'
    ? row.metadata as Record<string, unknown>
    : null
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    type: String(row.type || 'system'),
    title: String(row.title || 'Staff notification'),
    message: String(row.message || row.content || ''),
    metadata,
    tab_key: getAdminNotificationTab(String(row.type || 'system'), metadata),
    entity_id: typeof row.entity_id === 'string' ? row.entity_id : null,
    severity: String(row.severity || metadata?.severity || 'info'),
    priority: String(row.priority || metadata?.priority || 'normal'),
    source: String(row.source || metadata?.source || 'database'),
    is_read: Boolean(row.is_read),
    read_at: typeof row.read_at === 'string' ? row.read_at : null,
    created_at: String(row.created_at),
    link: typeof row.link === 'string' ? row.link : null,
  }
}

export function AdminNotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [notifications, setNotifications] = useState<AdminNotificationRecord[]>([])
  const load = useCallback(async () => {
    if (!user?.id || !isStaff(profile)) {
      setNotifications([])
      return
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) {
      console.error('Failed to load staff notifications:', error)
      return
    }
    const rows = (data || []).map(row => normalize(row as Record<string, unknown>))
    setNotifications(rows)
  }, [profile, user?.id])

  const markNotificationRead = useCallback(async (notification: AdminNotificationRecord) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notification.id)
      .eq('user_id', user?.id || '')
    if (error) {
      console.error('Failed to mark staff notification as read:', error)
      return
    }
    setNotifications(current => current.filter(item => item.id !== notification.id))
  }, [user?.id])

  const markTabRead = useCallback(async (tab: AdminNotificationTab) => {
    const ids = notifications.filter(item => item.tab_key === tab).map(item => item.id)
    if (!user?.id || ids.length === 0) return
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .in('id', ids)
    if (error) {
      console.error('Failed to mark staff tab notifications as read:', error)
      return
    }
    setNotifications(current => current.filter(item => !ids.includes(item.id)))
  }, [notifications, user?.id])

  const openNotification = useCallback(async (notification: AdminNotificationRecord) => {
    await markNotificationRead(notification)
    navigate(getAdminNotificationPath(notification))
  }, [markNotificationRead, navigate])

  const showNotificationToast = useCallback((notification: AdminNotificationRecord) => {
    if (notification.type === 'user_name_changed' && notification.metadata?.subject_user_id) {
      toast.custom((toastId) => {
        const performAction = async (action: 'default_name' | 'change_name' | 'restrict_name_change') => {
          let displayName: string | null = null
          if (action === 'change_name') {
            const enteredName = window.prompt('Enter the new display name:', 'MAiTroll User')
            if (enteredName === null) return
            displayName = enteredName.trim()
            if (!displayName) {
              toast.error('Enter a display name.')
              return
            }
          }

          const { error } = await supabase.rpc('moderate_user_name_change', {
            p_user_id: String(notification.metadata?.subject_user_id),
            p_action: action,
            p_display_name: displayName,
          })
          if (error) {
            console.error('Failed to apply name moderation action:', error)
            toast.error(error.message)
            return
          }

          toast.success(action === 'restrict_name_change'
            ? 'Name changes restricted for 3 days.'
            : action === 'default_name'
              ? 'Default display name applied.'
              : 'Display name updated.')
          toast.dismiss(toastId)
          await markNotificationRead(notification)
        }

        return (
          <div className="w-full max-w-md rounded-xl border border-amber-400/40 bg-slate-950 p-4 text-white shadow-xl">
            <p className="font-semibold">{notification.title}</p>
            <p className="mt-1 text-sm text-slate-300">{notification.message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void performAction('default_name')}
                className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold hover:bg-slate-600"
              >
                Default name
              </button>
              <button
                type="button"
                onClick={() => void performAction('change_name')}
                className="rounded-lg bg-purple-700 px-3 py-2 text-xs font-semibold hover:bg-purple-600"
              >
                Change name
              </button>
              <button
                type="button"
                onClick={() => void performAction('restrict_name_change')}
                className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold hover:bg-red-600"
              >
                Restrict for 3 days
              </button>
            </div>
          </div>
        )
      }, { duration: 30_000 })
      return
    }

    toast(notification.title, {
      description: notification.message,
      duration: notification.priority === 'critical' || notification.severity === 'critical' ? Infinity : 7000,
      action: { label: 'Open', onClick: () => void openNotification(notification) },
    })
  }, [markNotificationRead, openNotification])

  useEffect(() => {
    void load()
    if (!user?.id || !isStaff(profile)) return

    const channel = supabase
      .channel(`staff-notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        const notification = normalize(payload.new as Record<string, unknown>)
        if (notification.is_read) return
        setNotifications(current => [notification, ...current.filter(item => item.id !== notification.id)])
        showNotificationToast(notification)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        const notification = normalize(payload.new as Record<string, unknown>)
        setNotifications(current => notification.is_read
          ? current.filter(item => item.id !== notification.id)
          : [notification, ...current.filter(item => item.id !== notification.id)])
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load, profile, showNotificationToast, user?.id])

  const unreadCounts = useMemo(() => notifications.reduce<Partial<Record<AdminNotificationTab, number>>>((counts, item) => {
    counts[item.tab_key] = (counts[item.tab_key] || 0) + 1
    return counts
  }, {}), [notifications])

  useEffect(() => {
    if (!location.pathname.startsWith('/admin')) return
    const tab = getAdminNotificationTabForPath(location.pathname)
    if (tab) void markTabRead(tab)
  }, [location.pathname, markTabRead]) // Dashboard root intentionally does not clear anything.

  const value = useMemo(() => ({
    notifications,
    unreadCounts,
    unreadTotal: notifications.length,
    markTabRead,
    markNotificationRead,
    openNotification,
  }), [markNotificationRead, markTabRead, notifications, openNotification, unreadCounts])

  return <AdminNotificationContext.Provider value={value}>{children}</AdminNotificationContext.Provider>
}

export function useAdminNotifications() {
  const context = useContext(AdminNotificationContext)
  if (!context) throw new Error('useAdminNotifications must be used within AdminNotificationProvider')
  return context
}
