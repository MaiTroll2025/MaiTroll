import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'

export interface BlockedUsers {
  blockedIds: Set<string>
  blockedUsernames: Set<string>
}

/**
 * Blocked users (both directions):
 * - users the current user has blocked
 * - users who have blocked the current user
 *
 * Blocked users must not see each other's chats, so callers filter
 * messages by id (web stream_messages) or by username (phone floating chat).
 */
export function useBlockedUsers(): BlockedUsers {
  const { user } = useAuthStore()
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const [blockedUsernames, setBlockedUsernames] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user?.id) {
      setBlockedIds(new Set())
      setBlockedUsernames(new Set())
      return
    }

    let mounted = true
    ;(async () => {
      try {
        const { data: myBlocks } = await supabase
          .from('user_blocks')
          .select('blocked_id')
          .eq('blocker_id', user.id)

        const { data: blockedMe } = await supabase
          .from('user_blocks')
          .select('blocker_id')
          .eq('blocked_id', user.id)

        const ids = new Set<string>()
        myBlocks?.forEach((b: any) => b.blocked_id && ids.add(b.blocked_id))
        blockedMe?.forEach((b: any) => b.blocker_id && ids.add(b.blocker_id))

        if (!mounted) return
        setBlockedIds(ids)

        if (ids.size === 0) {
          setBlockedUsernames(new Set())
          return
        }

        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username')
          .in('id', Array.from(ids))

        if (!mounted) return
        const names = new Set<string>()
        profiles?.forEach((p: any) => p.username && names.add(String(p.username).toLowerCase()))
        setBlockedUsernames(names)
      } catch (err) {
        console.warn('[useBlockedUsers] Failed to load blocks:', err)
      }
    })()

    return () => {
      mounted = false
    }
  }, [user?.id])

  return { blockedIds, blockedUsernames }
}
