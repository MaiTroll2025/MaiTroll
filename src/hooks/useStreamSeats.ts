import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { useStreamRealtime } from './useStreamRealtime'
import { sendStreamBroadcast } from '../lib/realtime/streamRealtimeManager'

export interface SeatSession {
  id: string
  stream_id?: string
  seat_index: number
  user_id?: string | null
  guest_id?: string | null
  status?: string
  created_at?: string | null
  updated_at?: string | null
  joined_at?: string | null
  left_at?: string | null
  livekit_participant_identity?: string | null
  livekit_identity?: string | null
  participant_identity?: string | null
  seat_price_paid?: number
  price_paid?: number
  user_profile?: {
    id?: string
    username?: string | null
    display_name?: string | null
    avatar_url?: string | null
    is_gold?: boolean | null
    rgb_username_expires_at?: string | null
    glowing_username_color?: string | null
    role?: string | null
    troll_role?: string | null
    created_at?: string | null
    troll_coins?: number | null
    trollmonds_balance?: number | null
  } | null
  profile?: {
    id?: string
    username?: string | null
    display_name?: string | null
    avatar_url?: string | null
    is_gold?: boolean | null
    rgb_username_expires_at?: string | null
    glowing_username_color?: string | null
    role?: string | null
    troll_role?: string | null
    created_at?: string | null
    troll_coins?: number | null
    trollmonds_balance?: number | null
  } | null
}

type SeatEventName = 'seat_joined' | 'seat_live' | 'seat_left' | 'seat_refreshed'

const SUBSCRIBER_DISCOUNT_PERCENT = 0.10

const ACTIVE_SEAT_STATUSES = new Set(['reserved', 'camera_starting', 'active', 'live'])

function normalizeSeatStatus(status?: string | null) {
  return String(status || '').trim().toLowerCase()
}

function isActiveSeatStatus(status?: string | null) {
  return ACTIVE_SEAT_STATUSES.has(normalizeSeatStatus(status))
}

function safeNumber(value: any, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function isValidSeatSessionId(id: string | null | undefined): boolean {
  if (!id) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

async function checkIsSubscribedToBroadcaster(userId: string, broadcasterId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('subscriber_id', userId)
      .eq('broadcaster_id', broadcasterId)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.warn('[useStreamSeats] subscription check error:', error)
      return false
    }

    return !!data
  } catch (err) {
    console.warn('[useStreamSeats] subscription check failed:', err)
    return false
  }
}

function buildSeatProfile(raw: any) {
  if (!raw) return null

  if (raw.user_profile || raw.profile) {
    return raw.user_profile || raw.profile
  }

  if (raw.username || raw.display_name || raw.avatar_url || raw.user_id) {
    return {
      id: raw.user_id || undefined,
      username: raw.username || null,
      display_name: raw.display_name || raw.username || null,
      avatar_url: raw.avatar_url || null,
    }
  }

  return null
}

function normalizeSeatSession(raw: any): SeatSession | null {
  if (!raw) return null

  const seatIndex = Number(raw.seat_index)
  if (!Number.isFinite(seatIndex)) return null

  return {
    id: String(raw.id),
    stream_id: raw.stream_id || undefined,
    seat_index: seatIndex,
    user_id: raw.user_id || null,
    guest_id: raw.guest_id || null,
    status: raw.status || null,
    created_at: raw.created_at || null,
    updated_at: raw.updated_at || null,
    joined_at: raw.joined_at || null,
    left_at: raw.left_at || null,
    livekit_participant_identity:
      raw.livekit_participant_identity ||
      raw.participant_identity ||
      raw.livekit_identity ||
      raw.user_id ||
      null,
    livekit_identity:
      raw.livekit_identity ||
      raw.livekit_participant_identity ||
      raw.participant_identity ||
      raw.user_id ||
      null,
    participant_identity:
      raw.participant_identity ||
      raw.livekit_participant_identity ||
      raw.livekit_identity ||
      raw.user_id ||
      null,
    seat_price_paid: raw.seat_price_paid ?? raw.price_paid ?? undefined,
    price_paid: raw.price_paid ?? raw.seat_price_paid ?? undefined,
    user_profile: buildSeatProfile(raw),
    profile: raw.profile || raw.user_profile || buildSeatProfile(raw),
  }
}

export function useStreamSeats(
  _streamId?: string,
  _userId?: string,
  _broadcasterProfile?: any,
  _streamData?: any,
  _refreshStageConfig?: (() => void) | null,
) {
  const { user, profile } = useAuthStore()
  const effectiveUserId = _userId || user?.id || null
  const streamId = String(_streamId || '').trim()

  const isAdmin = Boolean(
    profile?.is_admin ||
    profile?.is_superadmin ||
    profile?.role === 'admin' ||
    profile?.role === 'superadmin' ||
    profile?.role === 'ceo'
  )

  const [seats, setSeats] = useState<Record<number, SeatSession>>({})
  const [mySeat, setMySeat] = useState<SeatSession | null>(null)
  const [joiningSeatId, setJoiningSeatId] = useState<number | null>(null)
  const [leavingSeatId, setLeavingSeatId] = useState<number | null>(null)
  const [seatVersion, setSeatVersion] = useState(0)

  const fetchSeqRef = useRef(0)
  const mountedRef = useRef(true)
  const refreshTimersRef = useRef<number[]>([])
  const seatsRef = useRef<Record<number, SeatSession>>({})
  const mySeatRef = useRef<SeatSession | null>(null)

  const safeSetSeats = useCallback((updater: React.SetStateAction<Record<number, SeatSession>>) => {
    if (!mountedRef.current) return
    setSeats(updater)
  }, [])

  const safeSetMySeat = useCallback((updater: React.SetStateAction<SeatSession | null>) => {
    if (!mountedRef.current) return
    setMySeat(updater)
  }, [])

  const safeSetJoiningSeatId = useCallback((updater: React.SetStateAction<number | null>) => {
    if (!mountedRef.current) return
    setJoiningSeatId(updater)
  }, [])

  const safeSetLeavingSeatId = useCallback((updater: React.SetStateAction<number | null>) => {
    if (!mountedRef.current) return
    setLeavingSeatId(updater)
  }, [])

  const safeSetSeatVersion = useCallback((updater: React.SetStateAction<number>) => {
    if (!mountedRef.current) return
    setSeatVersion(updater)
  }, [])

  const clearRefreshTimers = useCallback(() => {
    for (const timerId of refreshTimersRef.current) {
      window.clearTimeout(timerId)
    }
    refreshTimersRef.current = []
  }, [])

  const parseSeatArray = useCallback(
    (arr: any[]): { map: Record<number, SeatSession>; mine: SeatSession | null } => {
      const map: Record<number, SeatSession> = {}
      let mine: SeatSession | null = null

      if (!Array.isArray(arr)) return { map, mine }

      for (const raw of arr) {
        const session = normalizeSeatSession(raw)
        if (!session) continue

        if (!isActiveSeatStatus(session.status)) continue

        map[session.seat_index] = session

        if (
          effectiveUserId &&
          (session.user_id === effectiveUserId || session.guest_id === effectiveUserId)
        ) {
          mine = session
        }
      }

      return { map, mine }
    },
    [effectiveUserId],
  )

  const getSeatsSignature = useCallback((map: Record<number, SeatSession>, mine: SeatSession | null) => {
    const keys = Object.keys(map).sort()
    const seatSig = keys
      .map((k) => {
        const s = map[Number(k)]
        return `${k}:${s.user_id || s.guest_id || ''}:${s.status || ''}:${s.id}:${s.updated_at || ''}:${s.joined_at || ''}`
      })
      .join('|')
    const mineSig = mine ? `${mine.seat_index}:${mine.id}:${mine.status}` : 'none'
    return `${seatSig}||${mineSig}`
  }, [])

  const applySeatRows = useCallback(
    (rows: any[]) => {
      const { map, mine } = parseSeatArray(rows)

      const sig = getSeatsSignature(map, mine)
      const prevSig = getSeatsSignature(seatsRef.current, mySeatRef.current)

      if (sig === prevSig) {
        return { map: seatsRef.current, mine: mySeatRef.current }
      }

      seatsRef.current = map
      mySeatRef.current = mine

      setSeats(() => ({ ...map }))
      setMySeat(mine)
      setSeatVersion((v) => v + 1)

      return { map, mine }
    },
    [parseSeatArray, getSeatsSignature],
  )

  const fetchSeats = useCallback(
    async (reason = 'manual') => {
      if (!streamId) return { map: {}, mine: null }

      const seq = ++fetchSeqRef.current

      try {
        const { data, error } = await supabase
          .from('stream_seat_sessions')
          .select('*')
          .eq('stream_id', streamId)
          .in('status', ['active', 'live', 'reserved', 'camera_starting'])

        if (error) {
          console.warn('[useStreamSeats] fetchSeats error:', { reason, error })
          return { map: seatsRef.current, mine: mySeatRef.current }
        }

        if (!mountedRef.current || seq !== fetchSeqRef.current) {
          return { map: seatsRef.current, mine: mySeatRef.current }
        }

        const rows = Array.isArray(data) ? data : []
        const result = applySeatRows(rows)

        if (process.env.NODE_ENV !== 'production') {
          const seatDetails = Object.values(result.map).map((s) => ({
            seatIndex: s.seat_index,
            livekit_participant_identity: s.livekit_participant_identity || null,
            status: s.status || null,
            user_id: s.user_id || null,
            guest_id: s.guest_id || null,
          }))
          console.log('[useStreamSeats] fetched seats:', {
            reason,
            streamId,
            count: seatDetails.length,
            seats: seatDetails,
            rawRows: rows.map((r: any) => ({
              id: r.id,
              seat_index: r.seat_index,
              status: r.status,
              user_id: r.user_id,
              guest_id: r.guest_id,
              livekit_identity: r.livekit_participant_identity || r.livekit_identity || r.participant_identity,
            })),
          })
        }

        return result
      } catch (err) {
        console.warn('[useStreamSeats] fetchSeats failed:', { reason, err })
        return { map: seatsRef.current, mine: mySeatRef.current }
      }
    },
    [streamId, applySeatRows],
  )

  const lastRefreshAtRef = useRef(0)
  const pendingRefreshTimerRef = useRef<number | null>(null)

  const scheduleRefresh = useCallback(
    (reason: string, delay = 400) => {
      if (!streamId) return

      const now = Date.now()
      if (now - lastRefreshAtRef.current < 300) {
        if (pendingRefreshTimerRef.current !== null) {
          window.clearTimeout(pendingRefreshTimerRef.current)
        }
        pendingRefreshTimerRef.current = window.setTimeout(() => {
          pendingRefreshTimerRef.current = null
          lastRefreshAtRef.current = Date.now()
          void fetchSeats(reason)
        }, delay)
        return
      }

      lastRefreshAtRef.current = now
      void fetchSeats(reason)
    },
    [streamId, fetchSeats],
  )

  const sendSeatEvent = useCallback(
    async (event: SeatEventName, payload: Record<string, any>) => {
      if (!streamId) return
      await sendStreamBroadcast(streamId, event, {
        stream_id: streamId,
        ...payload,
        sent_at: new Date().toISOString(),
      })
    },
    [streamId],
  )

  const joinSeat = useCallback(
    async (seatIndex: number, price: number, livekitIdentity?: string) => {
      if (!effectiveUserId || !streamId) {
        toast.error('Login to join a stage seat')
        return false
      }

      // Celeb streams do not support seat joining — viewers participate via chat only
      if (_streamData?.stream_type === 'celeb_stream') {
        toast.error('Seats are not available in Celeb Streams')
        return false
      }

      const existing = mySeatRef.current
      if (
        existing &&
        isActiveSeatStatus(existing.status) &&
        existing.seat_index !== seatIndex &&
        (existing.user_id === effectiveUserId || existing.guest_id === effectiveUserId)
      ) {
        toast.error('Leave your current seat before joining another one')
        return false
      }

      if (!isAdmin) {
        const myActiveSeats = Object.values(seatsRef.current).filter((s) =>
          isActiveSeatStatus(s.status) &&
          (s.user_id === effectiveUserId || s.guest_id === effectiveUserId)
        )
        if (myActiveSeats.length >= 3) {
          toast.error('You have reached the maximum of 3 seats per broadcast')
          return false
        }
      }

      safeSetJoiningSeatId(seatIndex)

      const broadcasterId = _streamData?.user_id || _broadcasterProfile?.id || _broadcasterProfile?.user_id
      let finalPrice = safeNumber(price, 0)
      let discountApplied = false

      // Check subscription discount in parallel with optimistic UI — don't block the visual feedback
      const discountPromise = (async () => {
        if (broadcasterId && effectiveUserId !== broadcasterId) {
          const isSubscribed = await checkIsSubscribedToBroadcaster(effectiveUserId, broadcasterId)
          if (isSubscribed && finalPrice > 0) {
            const discountedPrice = Math.max(
              0,
              Math.floor(finalPrice * (1 - SUBSCRIBER_DISCOUNT_PERCENT)),
            )
            if (discountedPrice !== finalPrice) {
              discountApplied = true
              finalPrice = discountedPrice
            }
          }
        }
      })()

      const optimisticSeat: SeatSession = {
        id: `optimistic-${Date.now()}`,
        stream_id: streamId,
        seat_index: seatIndex,
        user_id: effectiveUserId,
        guest_id: null,
        status: 'reserved',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        joined_at: new Date().toISOString(),
        left_at: null,
        livekit_participant_identity: livekitIdentity || effectiveUserId,
        livekit_identity: livekitIdentity || effectiveUserId,
        participant_identity: livekitIdentity || effectiveUserId,
        seat_price_paid: finalPrice,
        price_paid: finalPrice,
        user_profile: {
          id: effectiveUserId,
          username: user?.user_metadata?.username || null,
          display_name: user?.user_metadata?.display_name || null,
          avatar_url: null,
        },
        profile: {
          id: effectiveUserId,
          username: user?.user_metadata?.username || null,
          display_name: user?.user_metadata?.display_name || null,
          avatar_url: null,
        },
      }

      safeSetSeats(prev => ({ ...prev, [seatIndex]: optimisticSeat }))
      safeSetMySeat(optimisticSeat)
      seatsRef.current = { ...seatsRef.current, [seatIndex]: optimisticSeat }
      mySeatRef.current = optimisticSeat
      safeSetSeatVersion(v => v + 1)

      try {
        // Wait for discount check to complete before RPC so we send the correct price
        await discountPromise

        const tRpc = Date.now()
        const { data, error } = await supabase.rpc('join_seat_atomic', {
          p_stream_id: streamId,
          p_seat_index: seatIndex,
          p_price: finalPrice,
          p_user_id: effectiveUserId,
        })
        console.log(`[useStreamSeats] join_seat_atomic RPC completed in ${Date.now() - tRpc}ms`)

        if (error) {
          console.warn('[useStreamSeats] joinSeat rpc error:', error)
          safeSetSeats(prev => { const n = { ...prev }; delete n[seatIndex]; return n })
          safeSetMySeat(null)
          seatsRef.current = { ...seatsRef.current }; delete seatsRef.current[seatIndex]
          mySeatRef.current = null
          safeSetSeatVersion(v => v + 1)
          toast.error(error.message || 'Failed to join seat')
          return false
        }

        const payload = data as any

        if (!payload?.success) {
          safeSetSeats(prev => { const n = { ...prev }; delete n[seatIndex]; return n })
          safeSetMySeat(null)
          seatsRef.current = { ...seatsRef.current }; delete seatsRef.current[seatIndex]
          mySeatRef.current = null
          safeSetSeatVersion(v => v + 1)
          toast.error(payload?.message || 'Failed to join seat')
          return false
        }

        const realSeat = normalizeSeatSession(payload?.seat || payload)
        if (realSeat) {
          safeSetSeats(prev => ({ ...prev, [seatIndex]: realSeat }))
          safeSetMySeat(realSeat)
          seatsRef.current = { ...seatsRef.current, [seatIndex]: realSeat }
          mySeatRef.current = realSeat
          safeSetSeatVersion(v => v + 1)
        }

        await sendSeatEvent('seat_joined', {
          seat_index: seatIndex,
          user_id: effectiveUserId,
          price_paid: finalPrice,
        })

        scheduleRefresh('joinSeat:post-event')

        return true
      } catch (err) {
        console.warn('[useStreamSeats] joinSeat failed:', err)
        setSeats(prev => { const n = { ...prev }; delete n[seatIndex]; return n })
        setMySeat(null)
        seatsRef.current = { ...seatsRef.current }; delete seatsRef.current[seatIndex]
        mySeatRef.current = null
        setSeatVersion(v => v + 1)
        toast.error('Failed to join seat')
        return false
      } finally {
        safeSetJoiningSeatId(null)
      }
    },
    [
      effectiveUserId,
      streamId,
      _streamData,
      _broadcasterProfile,
      fetchSeats,
      sendSeatEvent,
      scheduleRefresh,
    ],
  )

  const leaveSeat = useCallback(async () => {
    const currentSeat = mySeatRef.current
    if (!currentSeat || !streamId) return

    const seatIndex = currentSeat.seat_index
    const userId = currentSeat.user_id || currentSeat.guest_id || effectiveUserId || null

    if (!isValidSeatSessionId(currentSeat.id)) {
      safeSetSeats(prev => { const n = { ...prev }; delete n[seatIndex]; return n })
      safeSetMySeat(null)
      seatsRef.current = { ...seatsRef.current }; delete seatsRef.current[seatIndex]
      mySeatRef.current = null
      safeSetSeatVersion(v => v + 1)
      return
    }

     safeSetLeavingSeatId(seatIndex)
     const t0 = Date.now()

     const previousSeat = { ...seatsRef.current }
     const previousMySeat = mySeatRef.current

     safeSetSeats(prev => { const n = { ...prev }; delete n[seatIndex]; return n })
     if (mySeatRef.current?.seat_index === seatIndex) {
       safeSetMySeat(null)
       mySeatRef.current = null
     }
     seatsRef.current = { ...seatsRef.current }
     delete seatsRef.current[seatIndex]
     safeSetSeatVersion(v => v + 1)

     try {
       const tRpc = Date.now()
       const { data, error } = await supabase.rpc('leave_seat_atomic', {
         p_session_id: currentSeat.id,
       })
       console.log(`[useStreamSeats] leave_seat_atomic RPC completed in ${Date.now() - tRpc}ms`)

      if (error) {
        console.warn('[useStreamSeats] leaveSeat rpc error:', error)
        safeSetSeats(previousSeat)
        safeSetMySeat(previousMySeat)
        seatsRef.current = previousSeat
        mySeatRef.current = previousMySeat
        safeSetSeatVersion(v => v + 1)
        toast.error(error.message || 'Failed to leave seat')
        return
      }

      if (data && (data as any).success === false) {
        safeSetSeats(previousSeat)
        safeSetMySeat(previousMySeat)
        seatsRef.current = previousSeat
        mySeatRef.current = previousMySeat
        safeSetSeatVersion(v => v + 1)
        toast.error((data as any).message || 'Failed to leave seat')
        return
      }

      await sendSeatEvent('seat_left', {
        seat_index: seatIndex,
        user_id: userId,
        session_id: currentSeat.id,
      })
    } catch (err) {
      console.warn('[useStreamSeats] leaveSeat failed:', err)
      safeSetSeats(previousSeat)
      safeSetMySeat(previousMySeat)
      seatsRef.current = previousSeat
      mySeatRef.current = previousMySeat
      safeSetSeatVersion(v => v + 1)
      toast.error('Failed to leave seat')
    } finally {
      safeSetLeavingSeatId(null)
    }
  }, [streamId, effectiveUserId, fetchSeats, sendSeatEvent, scheduleRefresh])

  const markSeatLive = useCallback(
    async (seatIndex: number, livekitParticipantIdentity?: string | null) => {
      if (!streamId) return

      const currentStatus = normalizeSeatStatus(mySeatRef.current?.status)

      if (currentStatus === 'active' || currentStatus === 'live') {
        await sendSeatEvent('seat_live', {
          seat_index: seatIndex,
          user_id: effectiveUserId,
          livekit_participant_identity: livekitParticipantIdentity || effectiveUserId,
        })
        scheduleRefresh('markSeatLive:already-live')
        return
      }

      try {
        const rpcPayload: Record<string, any> = {
          p_stream_id: streamId,
          p_seat_index: seatIndex,
        }

        if (livekitParticipantIdentity) {
          rpcPayload.p_livekit_participant_identity = livekitParticipantIdentity
        }

        const { error } = await supabase.rpc('mark_stream_seat_live', rpcPayload)

        if (error) {
          console.warn('[useStreamSeats] markSeatLive error:', error)
          await fetchSeats('markSeatLive:error-refetch')
          return
        }

        await fetchSeats('markSeatLive:success')

        await sendSeatEvent('seat_live', {
          seat_index: seatIndex,
          user_id: effectiveUserId,
          livekit_participant_identity: livekitParticipantIdentity || effectiveUserId,
        })

        scheduleRefresh('markSeatLive:post-event')
      } catch (err) {
        console.warn('[useStreamSeats] markSeatLive failed:', err)
        await fetchSeats('markSeatLive:catch-refetch')

        const refreshedStatus = normalizeSeatStatus(mySeatRef.current?.status)
        if (refreshedStatus !== 'active' && refreshedStatus !== 'live') {
          toast.error('Failed to go live')
        }
      }
    },
    [
      streamId,
      effectiveUserId,
      fetchSeats,
      sendSeatEvent,
      scheduleRefresh,
    ],
  )

  const refreshSeats = useCallback(async () => {
    await fetchSeats('refreshSeats')
  }, [fetchSeats])

  const removeSeat = useCallback((seatIndex: number) => {
    const idx = Number(seatIndex)
    if (!Number.isFinite(idx)) return

    setSeats((prev) => {
      if (!prev[idx]) return prev
      const next = { ...prev }
      delete next[idx]
      return next
    })

    setMySeat((prev) => {
      if (!prev) return prev
      return prev.seat_index === idx ? null : prev
    })

    seatsRef.current = { ...seatsRef.current }
    delete seatsRef.current[idx]
    if (mySeatRef.current?.seat_index === idx) {
      mySeatRef.current = null
    }
    setSeatVersion((v) => v + 1)
  }, [])

  const removeSeatByUserId = useCallback((userId: string) => {
    const matched = Object.values(seatsRef.current).filter(
      (seat) => seat.user_id === userId || seat.guest_id === userId,
    )
    if (matched.length === 0) return

    setSeats((prev) => {
      let changed = false
      const next = { ...prev }
      for (const seat of matched) {
        delete next[seat.seat_index]
        changed = true
      }
      return changed ? next : prev
    })

    setMySeat((prev) => {
      if (!prev) return prev
      const isMine = matched.some((seat) => seat.seat_index === prev.seat_index)
      return isMine ? null : prev
    })

    seatsRef.current = { ...seatsRef.current }
    for (const seat of matched) {
      delete seatsRef.current[seat.seat_index]
      if (mySeatRef.current?.seat_index === seat.seat_index) {
        mySeatRef.current = null
      }
    }
    setSeatVersion((v) => v + 1)
  }, [])

  const handleParticipantDisconnected = useCallback(
    (identity: string) => {
      if (!identity) return

      const matchedSeat = Object.values(seatsRef.current).find((seat) => {
        const candidates = [
          seat.user_id,
          seat.guest_id,
          seat.livekit_participant_identity,
          seat.livekit_identity,
          seat.participant_identity,
        ]
          .filter(Boolean)
          .map((value) => String(value))

        return candidates.some(
          (candidate) => identity === candidate || identity.endsWith(`-${candidate}`),
        )
      })

      if (matchedSeat) {
        scheduleRefresh('participant-disconnected', 500)
      }
    },
    [scheduleRefresh],
  )

  const approveSeatRequest = useCallback(
    async (_id: string) => {
      try {
        const { data, error } = await supabase.rpc('approve_seat_request', {
          p_request_id: _id,
        })

        if (error) throw error

        await fetchSeats('approveSeatRequest')
        scheduleRefresh('approveSeatRequest:delayed', 800)

        return data || null
      } catch (err) {
        console.warn('[useStreamSeats] approveSeatRequest failed:', err)
        return null
      }
    },
    [fetchSeats, scheduleRefresh],
  )

  const denySeatRequest = useCallback(
    async (_id: string, _reason?: string) => {
      try {
        const { error } = await supabase.rpc('deny_seat_request', {
          p_request_id: _id,
          p_reason: _reason || '',
        })

        if (error) throw error

        await fetchSeats('denySeatRequest')
        return true
      } catch (err) {
        console.warn('[useStreamSeats] denySeatRequest failed:', err)
        return false
      }
    },
    [fetchSeats],
  )

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      clearRefreshTimers()
    }
  }, [clearRefreshTimers])

  useEffect(() => {
    if (!streamId) {
      setSeats({})
      setMySeat(null)
      seatsRef.current = {}
      mySeatRef.current = null
      setSeatVersion((v) => v + 1)
      return
    }

    void fetchSeats('mount')
  }, [streamId])

  const handleSeatSession = useCallback((event: any) => {
    if (event.eventType === 'DELETE') {
      const oldRow = event.old
      const seatIndex = Number(oldRow?.seat_index)
      if (Number.isFinite(seatIndex)) {
        setSeats(prev => { const n = { ...prev }; delete n[seatIndex]; return n })
        setMySeat(prev => prev?.seat_index === seatIndex ? null : prev)
        seatsRef.current = { ...seatsRef.current }; delete seatsRef.current[seatIndex]
        if (mySeatRef.current?.seat_index === seatIndex) mySeatRef.current = null
        setSeatVersion(v => v + 1)
      }
      scheduleRefresh('seat-session-delete', 300)
      return
    }

    if (event.eventType === 'INSERT') {
      const newRow = event.new
      const session = normalizeSeatSession(newRow)
      if (session && isActiveSeatStatus(session.status)) {
        setSeats(prev => ({ ...prev, [session.seat_index]: session }))
        seatsRef.current = { ...seatsRef.current, [session.seat_index]: session }
        if (effectiveUserId && (session.user_id === effectiveUserId || session.guest_id === effectiveUserId)) {
          setMySeat(session)
          mySeatRef.current = session
        }
        setSeatVersion(v => v + 1)
      }
      scheduleRefresh('seat-session-insert', 300)
      return
    }

    if (event.eventType === 'UPDATE') {
      const newRow = event.new
      const oldRow = event.old
      const newStatus = newRow?.status

      if (newStatus === 'left' || newStatus === 'kicked') {
        const seatIndex = Number(oldRow?.seat_index ?? newRow?.seat_index)
        if (Number.isFinite(seatIndex)) {
          setSeats(prev => { const n = { ...prev }; delete n[seatIndex]; return n })
          setMySeat(prev => prev?.seat_index === seatIndex ? null : prev)
          seatsRef.current = { ...seatsRef.current }; delete seatsRef.current[seatIndex]
          if (mySeatRef.current?.seat_index === seatIndex) mySeatRef.current = null
          setSeatVersion(v => v + 1)
        }
      } else {
        const existing = seatsRef.current[Number(newRow?.seat_index)]
        const session = normalizeSeatSession(newRow)
        if (session) {
          if (existing && (!session.user_profile?.username || !session.user_profile?.avatar_url)) {
            session.user_profile = {
              ...existing.user_profile,
              ...session.user_profile,
            }
            session.profile = {
              ...existing.profile,
              ...session.profile,
            }
          }
          setSeats(prev => ({ ...prev, [session.seat_index]: session }))
          seatsRef.current = { ...seatsRef.current, [session.seat_index]: session }
          if (effectiveUserId && (session.user_id === effectiveUserId || session.guest_id === effectiveUserId)) {
            setMySeat(session)
            mySeatRef.current = session
          }
          setSeatVersion(v => v + 1)
          scheduleRefresh('seat-update-reconcile', 200)
        }
      }
    }
  }, [effectiveUserId])

  const handleSeatEvent = useCallback(() => {
    scheduleRefresh('broadcast-seat-event')
  }, [scheduleRefresh])

  useStreamRealtime(streamId, {
    onSeatSession: handleSeatSession,
    onSeatEvent: handleSeatEvent,
  })

  const prevStreamDataRef = useRef<any | null>(null)

  useEffect(() => {
    const prev = prevStreamDataRef.current
    const curr = _streamData
    if (!curr) {
      prevStreamDataRef.current = curr
      return
    }

    const changed: string[] = []
    if (prev?.box_count !== curr?.box_count) changed.push('box_count')
    if (prev?.seat_count !== curr?.seat_count) changed.push('seat_count')
    if (JSON.stringify(prev?.seat_prices) !== JSON.stringify(curr?.seat_prices)) changed.push('seat_prices')
    if (prev?.are_seats_locked !== curr?.are_seats_locked) changed.push('are_seats_locked')

    prevStreamDataRef.current = curr

    if (changed.length > 0) {
      scheduleRefresh(`stream-prop-update:${changed.join(',')}`, 0)
    }
  }, [_streamData, scheduleRefresh])

  useEffect(() => {
    if (!streamId) return
    const channel = supabase
      .channel(`stream-seats-config:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`,
        },
        (payload) => {
          const newRow = (payload as any).new
          if (!newRow) return
          const changed: string[] = []
          if (newRow.seat_count !== undefined) changed.push('seat_count')
          if (newRow.box_count !== undefined) changed.push('box_count')
          if (newRow.seat_prices !== undefined) changed.push('seat_prices')
          if (newRow.are_seats_locked !== undefined) changed.push('are_seats_locked')
          if (changed.length === 0) return
          scheduleRefresh(`stream-config-update:${changed.join(',')}`, 400)
          if (typeof _refreshStageConfig === 'function') {
            _refreshStageConfig()
          }
        }
      )
      .subscribe()
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [streamId, scheduleRefresh])

  useEffect(() => {
    if (!streamId) return
    const channel = supabase
      .channel(`stream-seat-sessions:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stream_seat_sessions',
          filter: `stream_id=eq.${streamId}`,
        },
        () => {
          scheduleRefresh('seat-session-change', 0)
        }
      )
      .subscribe()
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [streamId, scheduleRefresh])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      clearRefreshTimers()
    }
  }, [clearRefreshTimers])

  useEffect(() => {
    if (!streamId) {
      setSeats({})
      setMySeat(null)
      seatsRef.current = {}
      mySeatRef.current = null
      setSeatVersion((v) => v + 1)
      return
    }

    void fetchSeats('mount')
  }, [streamId])

  const pendingSeatRequests: any[] = []
  const loadingSeatRequests = false

  const refreshSeatRequests = useCallback(() => {
    void fetchSeats('refreshSeatRequests')
  }, [fetchSeats])

  const capacity = {
    capacity: 0,
    isInQueue: false,
    canJoinInteractively: !!effectiveUserId,
    joinQueue: async () => false,
    leaveQueue: async () => false,
  }

  const myRequest = null

  const stagePasses = Object.values(seats)
    .sort((a, b) => (a.seat_index || 0) - (b.seat_index || 0))
    .map((s) => ({
      id: s.id,
      stream_id: streamId || null,
      broadcaster_id:
        (_broadcasterProfile && (_broadcasterProfile.id || _broadcasterProfile.user_id)) ||
        _streamData?.user_id ||
        null,
      user_id: s.user_id || null,
      status: (s.status as any) || 'live',
      stage_index: s.seat_index,
      price_coins: (_streamData?.seat_prices?.[s.seat_index] ?? _streamData?.seat_price) || 0,
      paid_amount: s.price_paid || s.seat_price_paid || 0,
      requested_at: s.joined_at || null,
      approved_at: s.joined_at || null,
      went_live_at: s.joined_at || null,
      denied_at: null,
      removed_at: null,
      expired_at: null,
      created_at: s.joined_at || s.created_at || new Date().toISOString(),
      updated_at: s.updated_at || new Date().toISOString(),
      user_profile: s.user_profile || null,
    }))

  return {
    seats,
    mySeat,
    joiningSeatId,
    leavingSeatId,
    seatVersion,
    joinSeat,
    leaveSeat,
    markSeatLive,
    refreshSeats,
    removeSeat,
    removeSeatByUserId,
    seatJoinTransition: null,
    handleParticipantDisconnected,
    pendingSeatRequests,
    loadingSeatRequests,
    approveSeatRequest,
    denySeatRequest,
    refreshSeatRequests,
    capacity,
    isInQueue: false,
    canJoinInteractively: capacity.canJoinInteractively,
    joinQueue: capacity.joinQueue,
    leaveQueue: capacity.leaveQueue,
    myRequest,
    stagePasses,
  }
}
