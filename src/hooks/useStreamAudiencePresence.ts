import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { getProfiles } from '../lib/profileCache'

export interface StreamAudienceMember {
  id: string
  stream_id: string
  user_id: string
  username: string
  avatar_url: string | null
  joined_at: string
  left_at: string | null
  is_active: boolean
  is_present?: boolean
  gift_total: number
  gift_score?: number
  seat_id: number | null
  seat_status?: 'audience' | 'seated'
  role: 'audience' | 'seat' | 'broadcaster'
  last_seen_at: string
  is_ghost_mode?: boolean
}

function normalizeSeatStatus(value: any): 'audience' | 'seated' {
  return value === 'seated' ? 'seated' : 'audience'
}

function normalizeAudienceMember(row: any): StreamAudienceMember {
  const giftTotal = Number(row?.gift_total ?? row?.gift_score ?? row?.gift_total_coins ?? 0)
  const seatStatus = normalizeSeatStatus(row?.seat_status)

  const member = {
    id: row?.id ?? `${row?.stream_id ?? 'stream'}-${row?.user_id ?? 'viewer'}`,
    stream_id: row?.stream_id ?? '',
    user_id: row?.user_id ?? '',
    username: row?.username ?? row?.display_name ?? 'Viewer',
    avatar_url: row?.avatar_url ?? null,
    joined_at: row?.joined_at ?? new Date().toISOString(),
    left_at: row?.left_at ?? null,
    is_active: Boolean(row?.is_active ?? row?.is_present ?? true),
    is_present: row?.is_present ?? Boolean(row?.is_active ?? true),
    gift_total: giftTotal,
    gift_score: Number(row?.gift_score ?? giftTotal),
    seat_id: row?.seat_id ?? null,
    seat_status: seatStatus,
    role: row?.role === 'seat' || row?.role === 'broadcaster' ? row.role : 'audience',
    last_seen_at: row?.last_seen_at ?? row?.joined_at ?? new Date().toISOString(),
    is_ghost_mode: row?.is_ghost_mode ?? false,
  }

  if (import.meta.env.DEV) {
    const usernameChanged = row?.username !== member.username || row?.display_name !== member.username
    if (usernameChanged || !member.username || member.username === 'Viewer') {
      console.log('[normalizeAudienceMember] username resolution', {
        row_username: row?.username,
        row_display_name: row?.display_name,
        resolved_username: member.username,
        user_id: member.user_id,
        id: member.id,
      })
    }
  }

  return member
}

// Stable key for one audience member: stream_id:user_id.
function memberKey(member: { stream_id: string; user_id: string }): string {
  return `${member.stream_id}:${member.user_id}`
}

export function useStreamAudiencePresence(
  streamId: string,
  userId: string | null
) {
  const { user, profile } = useAuthStore()
  const effectiveUserId = userId || user?.id

  // Normalized record keyed by stream_id:user_id. Rendering arrays are derived
  // from this record and only recomputed when it actually changes. Incremental
  // realtime updates patch a single entry instead of rebuilding the whole array.
  const [audienceMap, setAudienceMap] = useState<Record<string, StreamAudienceMember>>({})

  const [activeAudience, setActiveAudience] = useState<StreamAudienceMember[]>([])
  const [topAudience, setTopAudience] = useState<StreamAudienceMember[]>([])
  const [myPresence, setMyPresence] = useState<StreamAudienceMember | null>(null)

  const lastGiftUpdateRef = useRef<Record<string, number>>({})
  const channelsRef = useRef<any[]>([])
  const ghostModeFetchedRef = useRef<{ streamId: string; userIds: string } | null>(null)
  const profileRef = useRef(profile)
  const userRef = useRef(user)

  // Bounded batching queue: rapid realtime events land here and are flushed on
  // the next animation frame so a burst (e.g. many simultaneous joins/gifts)
  // triggers at most one React render per frame instead of one per event.
  const pendingMutationsRef = useRef<Map<string, StreamAudienceMember | null>>(new Map())
  const flushScheduledRef = useRef(false)

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  useEffect(() => {
    userRef.current = user
  }, [user])

  const commitAudience = useCallback(() => {
    setAudienceMap((prev) => {
      if (pendingMutationsRef.current.size === 0) return prev
      const next = { ...prev }
      pendingMutationsRef.current.forEach((value, key) => {
        if (value === null) {
          delete next[key]
        } else {
          next[key] = value
        }
      })
      pendingMutationsRef.current.clear()
      return next
    })
    flushScheduledRef.current = false
  }, [])

  const queueAudienceMutation = useCallback(
    (key: string, value: StreamAudienceMember | null) => {
      pendingMutationsRef.current.set(key, value)
      if (!flushScheduledRef.current) {
        flushScheduledRef.current = true
        if (typeof window !== 'undefined' && window.requestAnimationFrame) {
          window.requestAnimationFrame(() => commitAudience())
        } else {
          setTimeout(commitAudience, 0)
        }
      }
    },
    [commitAudience]
  )

  const cleanupChannels = useCallback(() => {
    channelsRef.current.forEach(ch => { if (ch) supabase.removeChannel(ch) })
    channelsRef.current = []
  }, [])

  // Recompute derived arrays from the normalized map. Runs only when the map
  // changes (and we control those changes), not per realtime event.
   useEffect(() => {
     const list = Object.values(audienceMap)
     setActiveAudience(list.filter((m) => m.is_active && !m.left_at))
     setTopAudience(
       [...list].sort((a, b) => {
         if (b.gift_total !== a.gift_total) return b.gift_total - a.gift_total
         return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
       })
     )
     if (effectiveUserId) {
       setMyPresence(list.find((m) => m.user_id === effectiveUserId) || null)
     }

     if (import.meta.env.DEV) {
       console.log('[useStreamAudiencePresence] audienceMap updated', {
         totalMembers: list.length,
         activeMembers: list.filter(m => m.is_active && !m.left_at).length,
         sample: list.slice(0, 5).map(m => ({
           id: m.id,
           user_id: m.user_id,
           username: m.username,
           role: m.role,
           is_active: m.is_active,
           left_at: m.left_at,
           avatar_url: m.avatar_url,
         }))
       })
     }
   }, [audienceMap, effectiveUserId])

  const fetchAudience = useCallback(async () => {
    if (!streamId) return
    try {
      const { data, error } = await supabase
        .from('stream_audience_presence')
        .select('*')
        .eq('stream_id', streamId)
        .eq('is_active', true)
        .order('gift_total', { ascending: false })
        .order('joined_at', { ascending: true })

      if (error) {
        console.warn('[useStreamAudiencePresence] fetchAudience error', error)
        return
      }

      if (import.meta.env.DEV) {
        console.log('[useStreamAudiencePresence] fetchAudience raw data', {
          count: data?.length || 0,
          sample: (data || []).slice(0, 5).map(row => ({
            id: row.id,
            stream_id: row.stream_id,
            user_id: row.user_id,
            username: row.username,
            display_name: row.display_name,
            avatar_url: row.avatar_url,
            is_active: row.is_active,
            left_at: row.left_at,
            gift_total: row.gift_total,
            role: row.role,
            is_ghost_mode: row.is_ghost_mode,
          }))
        })
      }

      // Full normalization is acceptable on initial load / explicit resync.
      const next: Record<string, StreamAudienceMember> = {}
      ;(data || []).forEach((row: any) => {
        const member = normalizeAudienceMember(row)
        next[memberKey(member)] = member
      })
      setAudienceMap(next)

      if (effectiveUserId) {
        const myMember = Object.values(next).find((m) => m.user_id === effectiveUserId)
        setMyPresence(myMember || null)
      }
    } catch (err) {
      console.warn('[useStreamAudiencePresence] fetchAudience failed', err)
    }
  }, [streamId, effectiveUserId])

  const joinAudience = useCallback(async () => {
    if (!effectiveUserId || !streamId) return

    const currentProfile = profileRef.current
    const currentUser = userRef.current

    // Don't join audience presence if user has ghost mode enabled
    if (currentProfile?.is_ghost_mode) return

    const now = new Date().toISOString()
    const username = currentProfile?.username || currentUser?.email?.split('@')?.[0] || effectiveUserId
    const avatarUrl = currentProfile?.avatar_url ?? null

    try {
      const { data: existingRow, error: lookupError } = await supabase
        .from('stream_audience_presence')
        .select('id')
        .eq('stream_id', streamId)
        .eq('user_id', effectiveUserId)
        .maybeSingle()

      if (lookupError) {
        console.warn('[useStreamAudiencePresence] joinAudience lookup error', lookupError)
        toast.error('Failed to join audience')
        return false
      }

      if (existingRow) {
        const { error: updateError } = await supabase
          .from('stream_audience_presence')
          .update({
            is_active: true,
            left_at: null,
            last_seen_at: now,
            username,
            avatar_url: avatarUrl,
            seat_id: null,
            role: 'audience',
          })
          .eq('id', existingRow.id)

        if (updateError) {
          console.warn('[useStreamAudiencePresence] joinAudience update error', updateError)
          toast.error('Failed to join audience')
          return false
        }

        const member: StreamAudienceMember = {
          id: existingRow.id,
          stream_id: streamId,
          user_id: effectiveUserId,
          username,
          avatar_url: avatarUrl,
          joined_at: new Date().toISOString(),
          left_at: null,
          is_active: true,
          is_present: true,
          gift_total: 0,
          gift_score: 0,
          seat_id: null,
          seat_status: 'audience',
          role: 'audience',
          last_seen_at: now,
          is_ghost_mode: currentProfile?.is_ghost_mode ?? false,
        }
        queueAudienceMutation(memberKey(member), member)
      } else {
        const { error: insertError } = await supabase
          .from('stream_audience_presence')
          .insert({
            stream_id: streamId,
            user_id: effectiveUserId,
            username,
            avatar_url: avatarUrl,
            joined_at: now,
            left_at: null,
            is_active: true,
            gift_total: 0,
            seat_id: null,
            role: 'audience',
            last_seen_at: now,
          })

        if (insertError) {
          console.warn('[useStreamAudiencePresence] joinAudience insert error', insertError)
          toast.error('Failed to join audience')
          return false
        }

        const member: StreamAudienceMember = {
          id: `${streamId}-${effectiveUserId}`,
          stream_id: streamId,
          user_id: effectiveUserId,
          username,
          avatar_url: avatarUrl,
          joined_at: now,
          left_at: null,
          is_active: true,
          is_present: true,
          gift_total: 0,
          gift_score: 0,
          seat_id: null,
          seat_status: 'audience',
          role: 'audience',
          last_seen_at: now,
          is_ghost_mode: currentProfile?.is_ghost_mode ?? false,
        }
        queueAudienceMutation(memberKey(member), member)
      }

      return true
    } catch (err) {
      console.warn('[useStreamAudiencePresence] joinAudience failed', err)
      toast.error('Failed to join audience')
      return false
    }
  }, [streamId, effectiveUserId, queueAudienceMutation])

  const leaveAudience = useCallback(async () => {
    if (!effectiveUserId || !streamId) return
    const now = new Date().toISOString()

    try {
      const { error } = await supabase
        .from('stream_audience_presence')
        .update({
          is_active: false,
          left_at: now,
          last_seen_at: now,
          seat_id: null,
        })
        .eq('stream_id', streamId)
        .eq('user_id', effectiveUserId)

      if (error) {
        console.warn('[useStreamAudiencePresence] leaveAudience error', error)
      }

      const key = memberKey({ stream_id: streamId, user_id: effectiveUserId })
      setAudienceMap((prev) => {
        const existing = prev[key]
        if (!existing) return prev
        return {
          ...prev,
          [key]: {
            ...existing,
            is_active: false,
            left_at: now,
            last_seen_at: now,
            seat_id: null,
          },
        }
      })
    } catch (err) {
      console.warn('[useStreamAudiencePresence] leaveAudience failed', err)
    }
  }, [streamId, effectiveUserId])

  const heartbeatAudience = useCallback(async () => {
    if (!effectiveUserId || !streamId) return
    const now = new Date().toISOString()

    try {
      const { error } = await supabase
        .from('stream_audience_presence')
        .update({
          last_seen_at: now,
        })
        .eq('stream_id', streamId)
        .eq('user_id', effectiveUserId)
        .eq('is_active', true)

      if (error) {
        console.warn('[useStreamAudiencePresence] heartbeatAudience error', error)
      }
    } catch (err) {
      console.warn('[useStreamAudiencePresence] heartbeatAudience failed', err)
    }
  }, [streamId, effectiveUserId])

  const incrementGiftTotal = useCallback(async (amount: number) => {
    if (!effectiveUserId || !streamId) return
    const now = new Date().toISOString()

    try {
      const { data: existingRow, error: lookupError } = await supabase
        .from('stream_audience_presence')
        .select('gift_total')
        .eq('stream_id', streamId)
        .eq('user_id', effectiveUserId)
        .eq('is_active', true)
        .maybeSingle()

      if (lookupError) {
        console.warn('[useStreamAudiencePresence] incrementGiftTotal lookup error', lookupError)
        return
      }

      const currentGiftTotal = Number(existingRow?.gift_total ?? 0)

      const { error: updateError } = await supabase
        .from('stream_audience_presence')
        .update({
          gift_total: currentGiftTotal + amount,
          last_seen_at: now,
        })
        .eq('stream_id', streamId)
        .eq('user_id', effectiveUserId)
        .eq('is_active', true)

      if (updateError) {
        console.warn('[useStreamAudiencePresence] incrementGiftTotal update error', updateError)
        return
      }

      // Update the local normalized record only (no full rebuild, no broadcast).
      setAudienceMap((prev) => {
        const key = `${streamId}:${effectiveUserId}`
        const existing = prev[key]
        if (!existing) return prev
        return { ...prev, [key]: { ...existing, gift_total: existing.gift_total + amount } }
      })
      lastGiftUpdateRef.current[effectiveUserId] = Date.now()
    } catch (err) {
      console.warn('[useStreamAudiencePresence] incrementGiftTotal failed', err)
    }
  }, [streamId, effectiveUserId])

  useEffect(() => {
    void fetchAudience()
  }, [fetchAudience])

  useEffect(() => {
    if (!streamId) return

    cleanupChannels()

    const audienceChannel = supabase
      .channel(`stream-audience-presence:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stream_audience_presence',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          try {
            const evt = (payload as any).eventType || '*'
            const newRow = (payload as any).new
            const oldRow = (payload as any).old

            if (import.meta.env.DEV) {
              console.log('[useStreamAudiencePresence] realtime event', {
                eventType: evt,
                newRow: newRow ? {
                  id: newRow.id,
                  stream_id: newRow.stream_id,
                  user_id: newRow.user_id,
                  username: newRow.username,
                  display_name: newRow.display_name,
                  avatar_url: newRow.avatar_url,
                  is_active: newRow.is_active,
                  left_at: newRow.left_at,
                  gift_total: newRow.gift_total,
                  role: newRow.role,
                  is_ghost_mode: newRow.is_ghost_mode,
                } : null,
                oldRow: oldRow ? {
                  id: oldRow.id,
                  user_id: oldRow.user_id,
                  username: oldRow.username,
                  is_active: oldRow.is_active,
                } : null,
              })
            }

            if (evt === 'DELETE') {
              if (oldRow?.user_id) {
                queueAudienceMutation(`${streamId}:${oldRow.user_id}`, null)
              }
              return
            }

            const row = newRow || oldRow
            if (!row?.user_id) return

            const member = normalizeAudienceMember(row)
            // Incremental: patch only this one member in the normalized record.
            queueAudienceMutation(memberKey(member), member)

            if (effectiveUserId && newRow?.user_id === effectiveUserId) {
              setMyPresence(member)
            }
          } catch (err) {
            console.warn('[useStreamAudiencePresence] realtime handler error', err)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_gifts',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          // Gifts must NOT cause a stream_audience_presence DB write or a full
          // audience-array rebuild. We only patch the sender's local gift_total
          // in the normalized record (batched), preserving score/leaderboard
          // display without write amplification. The gift ledger writes happen
          // in the dedicated gift service, not here.
          const gift = (payload as any).new
          if (!gift?.sender_id) return

          const amount = Number(gift.amount ?? 0) * Number(gift.quantity ?? 1)
          if (!amount) return

          setAudienceMap((prev) => {
            const key = `${streamId}:${gift.sender_id}`
            const existing = prev[key]
            if (!existing) return prev
            return {
              ...prev,
              [key]: {
                ...existing,
                gift_total: existing.gift_total + amount,
                gift_score: (existing.gift_score ?? existing.gift_total) + amount,
              },
            }
          })
        }
      )
      .subscribe()

    channelsRef.current = [audienceChannel]

    return () => {
      cleanupChannels()
    }
  }, [streamId, effectiveUserId, fetchAudience, cleanupChannels, queueAudienceMutation])

  // Fetch ghost mode status for audience members (realtime doesn't support joins)
  // Debounced: only fetch once per unique set of audience user IDs, max once per 30s
  const ghostModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!streamId) return

    const currentUserIds = Object.values(audienceMap)
      .map(m => m.user_id)
      .filter(Boolean)
      .sort()
      .join(',')

    const last = ghostModeFetchedRef.current
    if (last?.streamId === streamId && last.userIds === currentUserIds) {
      return
    }

    if (!currentUserIds) return

    // Debounce: wait 30s before fetching to avoid rapid re-fetches on audience changes
    if (ghostModeTimerRef.current) {
      clearTimeout(ghostModeTimerRef.current)
    }
    ghostModeTimerRef.current = setTimeout(async () => {
      const ids = currentUserIds.split(',')
      const profiles = await getProfiles(ids)

      if (profiles.length > 0) {
        ghostModeFetchedRef.current = { streamId, userIds: currentUserIds }
        const ghostModeMap = new Map(profiles.map((p: any) => [p.id, p.is_ghost_mode]))
        setAudienceMap((prev) => {
          const next = { ...prev }
          Object.keys(next).forEach((key) => {
            const member = next[key]
            next[key] = { ...member, is_ghost_mode: ghostModeMap.get(member.user_id) ?? false }
          })
          return next
        })
      }
    }, 30_000)

    return () => {
      if (ghostModeTimerRef.current) {
        clearTimeout(ghostModeTimerRef.current)
        ghostModeTimerRef.current = null
      }
    }
  }, [streamId, audienceMap])

  // Throttled heartbeat (90s) — avoids broadcasting every presence tick to all
  // clients. The realtime subscription already pushes meaningful membership
  // changes without polling.
  useEffect(() => {
    if (!effectiveUserId || !streamId) return

    const heartbeat = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void heartbeatAudience()
    }, 90_000)

    return () => clearInterval(heartbeat)
  }, [effectiveUserId, streamId, heartbeatAudience])

  useEffect(() => {
    if (!effectiveUserId || !streamId) return
    const now = Date.now()
    const lastUpdate = lastGiftUpdateRef.current[effectiveUserId] || 0
    if (now - lastUpdate < 5000) {
      void fetchAudience()
    }
  }, [effectiveUserId, streamId, fetchAudience])

  const refreshAudience = useCallback(async () => {
    await fetchAudience()
  }, [fetchAudience])

  return {
    audience: Object.values(audienceMap),
    activeAudience,
    topAudience,
    myPresence,
    joinAudience,
    leaveAudience,
    heartbeatAudience,
    incrementGiftTotal,
    refreshAudience,
  }
}
