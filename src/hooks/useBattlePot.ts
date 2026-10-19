import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStreamRealtime } from '@/hooks/useStreamRealtime'

export interface BattlePotRound {
  id: string
  broadcaster_id: string
  stream_id: string | null
  round_type: 'initial_unlock' | 'subsequent_battle'
  target_coins: number
  collected_coins: number
  status: 'open' | 'reached' | 'battle_started' | 'failed' | 'closed'
  battle_id: string | null
  idempotency_key: string | null
  reached_at: string | null
  created_at: string
  updated_at: string
}

export interface BattlePotState {
  unlocked: boolean
  round_id: string | null
  round_type: 'initial_unlock' | 'subsequent_battle' | null
  target_coins: number
  collected_coins: number
  remaining: number
  status: string
}

interface UseBattlePotOptions {
  broadcasterId: string
  streamId?: string | null
  onRoundReached?: () => void
  onBattleStarted?: () => void
}

export function useBattlePot({
  broadcasterId,
  streamId,
  onRoundReached,
  onBattleStarted,
}: UseBattlePotOptions) {
  const [state, setState] = useState<BattlePotState | null>(null)
  const [round, setRound] = useState<BattlePotRound | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatingRound, setCreatingRound] = useState(false)

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const mountedRef = useRef(true)
  const seenGiftEventIdsRef = useRef<Map<string, number>>(new Map())
  const onRoundReachedRef = useRef(onRoundReached)
  const onBattleStartedRef = useRef(onBattleStarted)

  useEffect(() => {
    onRoundReachedRef.current = onRoundReached
    onBattleStartedRef.current = onBattleStarted
  }, [onRoundReached, onBattleStarted])

  const fetchState = useCallback(async () => {
    if (!broadcasterId) return

    try {
      const { data, error: rpcError } = await supabase.rpc('get_battle_pot_state', {
        p_broadcaster_id: broadcasterId,
      })

      if (rpcError) {
        setError(rpcError.message)
        return
      }

      const next = data as BattlePotState
      if (next.unlocked && !next.round_id) {
        const { data: reachedRound, error: reachedRoundError } = await supabase
          .from('battle_pot_rounds')
          .select('*')
          .eq('broadcaster_id', broadcasterId)
          .eq('round_type', 'subsequent_battle')
          .eq('status', 'reached')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (reachedRoundError) {
          setError(reachedRoundError.message)
          return
        }
        if (reachedRound) {
          const roundState = reachedRound as BattlePotRound
          setRound(roundState)
          setState({
            unlocked: true,
            round_id: roundState.id,
            round_type: roundState.round_type,
            target_coins: roundState.target_coins,
            collected_coins: roundState.collected_coins,
            remaining: Math.max(0, roundState.target_coins - roundState.collected_coins),
            status: roundState.status,
          })
          return
        }
      }

      setState(next)

      // Fetch full round details if we have a round_id
      if (next.round_id) {
        const { data: roundData, error: roundError } = await supabase
          .from('battle_pot_rounds')
          .select('*')
          .eq('id', next.round_id)
          .maybeSingle()

        if (!roundError && roundData) {
          setRound(roundData as BattlePotRound)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch battle pot state')
    } finally {
      setLoading(false)
    }
  }, [broadcasterId])

  useEffect(() => {
    void fetchState()
  }, [fetchState])

  useStreamRealtime(streamId, {
    onGift: (event) => {
      const gift = event.new as Record<string, unknown> | null
      if (!gift) return

      const giftStreamId = String(gift.stream_id || gift.streamId || '')
      const recipientId = String(gift.receiver_id || gift.recipient_id || '')
      const giftCurrency = String(gift.currency_used || 'coins').toLowerCase()
      const giftCoins = Number(gift.coins_spent ?? gift.amount ?? gift.coins_amount ?? 0)
      if (
        (streamId && giftStreamId !== streamId) ||
        recipientId !== broadcasterId ||
        giftCurrency !== 'coins' ||
        !Number.isFinite(giftCoins) ||
        giftCoins <= 0
      ) {
        return
      }

      const giftId = String(gift.stream_gift_id || gift.transaction_id || gift.id || '')
      const now = Date.now()
      for (const [id, seenAt] of seenGiftEventIdsRef.current) {
        if (now - seenAt > 30_000) seenGiftEventIdsRef.current.delete(id)
      }
      if (giftId && seenGiftEventIdsRef.current.has(giftId)) return
      if (giftId) seenGiftEventIdsRef.current.set(giftId, now)

      void fetchState()
    },
  })

  const createNextRound = useCallback(async () => {
    if (!broadcasterId) return { success: false, error: 'No broadcaster' }

    setCreatingRound(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('create_next_battle_round', {
        p_broadcaster_id: broadcasterId,
        p_stream_id: streamId || null,
      })

      if (rpcError) {
        setError(rpcError.message)
        return { success: false, error: rpcError.message }
      }

      await fetchState()
      return { success: true, data }
    } catch (err: any) {
      const msg = err.message || 'Failed to create next round'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setCreatingRound(false)
    }
  }, [broadcasterId, streamId, fetchState])

  // Realtime subscriptions for battle pot updates
  useEffect(() => {
    if (!broadcasterId) return
    mountedRef.current = true

    const channel = supabase.channel(`battle-pot:${broadcasterId}`)

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'battle_pot_rounds',
          filter: `broadcaster_id=eq.${broadcasterId}`,
        },
        (payload) => {
          if (!mountedRef.current) return

          const newRound = payload.new as any
          const oldRound = payload.old as any

          if (!newRound) return

          setRound(newRound as BattlePotRound)

          setState((prev) => ({
            unlocked: Boolean(
              prev?.unlocked ||
              newRound.round_type === 'subsequent_battle' ||
              (newRound.round_type === 'initial_unlock' && newRound.status === 'reached')
            ),
            round_id: newRound.id,
            round_type: newRound.round_type,
            target_coins: newRound.target_coins,
            collected_coins: newRound.collected_coins,
            remaining: Math.max(0, newRound.target_coins - newRound.collected_coins),
            status: newRound.status,
          }))

          if (payload.eventType === 'UPDATE' && oldRound && oldRound.status !== newRound.status) {
            if (newRound.status === 'reached') {
              onRoundReachedRef.current?.()
            }
            if (newRound.status === 'battle_started') {
              onBattleStartedRef.current?.()
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && mountedRef.current) {
          setLoading(false)
        }
      })

    channelRef.current = channel

    return () => {
      mountedRef.current = false
      if (channelRef.current === channel) {
        void supabase.removeChannel(channel)
        channelRef.current = null
      }
    }
  }, [broadcasterId])

  return {
    state,
    round,
    loading,
    error,
    creatingRound,
    createNextRound,
    refetch: fetchState,
  }
}
