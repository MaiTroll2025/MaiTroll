import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'

export type PresencePageKey =
  | 'home'
  | 'wall'
  | 'live'
  | 'calendar'
  | 'universe'
  | 'leagues'
  | 'troll-wheel'
  | 'mai-business'
  | 'mai-life'
  | 'mai-sing-off'
  | 'founder'
  | 'president'

export interface PagePresenceCounts {
  users: number
  anonymous: number
}

export interface PagePresenceMap {
  [key: string]: PagePresenceCounts
}

const PAGE_KEYS: PresencePageKey[] = [
  'home',
  'wall',
  'live',
  'calendar',
  'universe',
  'leagues',
  'troll-wheel',
  'mai-business',
  'mai-life',
  'mai-sing-off',
  'founder',
  'president',
]

function pathToPageKey(pathname: string): PresencePageKey | null {
  const map: Record<string, PresencePageKey> = {
    '/': 'home',
    '/home': 'home',
    '/wall': 'wall',
    '/live': 'live',
    '/calendar': 'calendar',
    '/universe': 'universe',
    '/leagues': 'leagues',
    '/troll-wheel': 'troll-wheel',
    '/mai-business': 'mai-business',
    '/mai-life': 'mai-life',
    '/mai-sing-off': 'mai-sing-off',
    '/founder': 'founder',
    '/president': 'president',
  }
  return map[pathname] ?? null
}

function getAnonSessionId(): string {
  if (typeof localStorage === 'undefined') {
    return `anon_${Math.random().toString(36).slice(2)}`
  }
  let id = localStorage.getItem('maitroll_anon_session_id')
  if (!id) {
    id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    try {
      localStorage.setItem('maitroll_anon_session_id', id)
    } catch {
      // localStorage may be blocked; fall back to in-memory
    }
  }
  return id
}

/**
 * Every page mounts this to report its own presence via Supabase Realtime.
 * Both signed-in users and anonymous users are tracked per page key.
 * Counts are read by the admin sidebar through useAdminPagePresenceCounts.
 */
export function usePagePresenceTracker() {
  const { pathname } = useLocation()
  const { user } = useAuthStore()
  const pageKey = pathToPageKey(pathname)
  const anonSessionId = useRef(getAnonSessionId())
  const channelRef = useRef<any>(null)

  useEffect(() => {
    if (!pageKey) return

    const channelName = `page-presence:${pageKey}`
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: user?.id ?? anonSessionId.current },
      },
    })

    const trackData = {
      user_id: user?.id ?? null,
      is_anonymous: !user?.id,
      session_id: anonSessionId.current,
      page_key: pageKey,
      path: pathname,
      joined_at: new Date().toISOString(),
      user_agent:
        typeof navigator !== 'undefined' ? navigator.userAgent?.slice(0, 200) : null,
    }

    channel
      .on('presence', { event: 'sync' }, () => {
        // Presence sync handled by admin reader; tracker only reports itself.
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track(trackData)
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        void channelRef.current.untrack()
        supabase.removeChannel(channel)
      }
    }
  }, [pageKey, pathname, user?.id])
}

/**
 * Admin sidebar uses this to read real-time presence counts across all pages.
 * Subscribes to every page-presence channel and aggregates users vs anonymous.
 */
export function useAdminPagePresenceCounts() {
  const [counts, setCounts] = useState<PagePresenceMap>({})
  const [isAdmin, setIsAdmin] = useState(false)
  const channelsRef = useRef<Record<string, ReturnType<typeof supabase.channel>>>({})

  const { profile } = useAuthStore()

  useEffect(() => {
    const role = String(profile?.role || '').toLowerCase()
    const trollRole = String(profile?.troll_role || '').toLowerCase()
    const admin =
      Boolean(profile?.is_admin || profile?.is_superadmin ||
        ['admin', 'superadmin', 'owner', 'ceo'].includes(role) ||
        ['admin', 'superadmin', 'owner', 'ceo'].includes(trollRole))
    setIsAdmin(admin)
  }, [profile])

  useEffect(() => {
    if (!isAdmin) {
      // Clean up any channels if admin status is lost
      PAGE_KEYS.forEach((key) => {
        const ch = channelsRef.current[key]
        if (ch) {
          supabase.removeChannel(ch)
          delete channelsRef.current[key]
        }
      })
      setCounts({})
      return
    }

    PAGE_KEYS.forEach((key) => {
      const channelName = `page-presence:${key}`
      const channel = supabase.channel(channelName)

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          let users = 0
          let anonymous = 0
          for (const presences of Object.values(state)) {
            for (const p of presences as any[]) {
              if (p.is_anonymous) anonymous += 1
              else users += 1
            }
          }
          setCounts((prev) => ({
            ...prev,
            [key]: { users, anonymous },
          }))
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn(
              `[useAdminPagePresenceCounts] Channel error for ${channelName}`,
            )
          }
        })

      channelsRef.current[key] = channel
    })

    return () => {
      PAGE_KEYS.forEach((key) => {
        const ch = channelsRef.current[key]
        if (ch) {
          supabase.removeChannel(ch)
          delete channelsRef.current[key]
        }
      })
      channelsRef.current = {}
      setCounts({})
    }
  }, [isAdmin])

  return { counts, isAdmin }
}
