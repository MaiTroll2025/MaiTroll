import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'

export type GamingBattlePhase = 'idle' | 'searching' | 'countdown' | 'active' | 'ended'

export interface GamingBattleState {
  phase: GamingBattlePhase
  battleId: string | null
  opponentId: string | null
  opponentUsername: string | null
  opponentAvatarUrl: string | null
  myScore: number
  opponentScore: number
  timeRemaining: number
  startedAt: Date | null
  endsAt: Date | null
}

const GAMING_BATTLE_DURATION = 300

interface UseGamingBattleOptions {
  streamId: string | null
  userId: string | null
}

export function useGamingBattle({ streamId, userId }: UseGamingBattleOptions) {
  const { profile: _profile } = useAuthStore()

  const [state, setState] = useState<GamingBattleState>({
    phase: 'idle',
    battleId: null,
    opponentId: null,
    opponentUsername: null,
    opponentAvatarUrl: null,
    myScore: 0,
    opponentScore: 0,
    timeRemaining: GAMING_BATTLE_DURATION,
    startedAt: null,
    endsAt: null,
  })

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const startTimer = useCallback((duration: number) => {
    if (timerRef.current) clearInterval(timerRef.current)

    setState((prev) => ({ ...prev, timeRemaining: duration }))

    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.timeRemaining <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return { ...prev, timeRemaining: 0, phase: 'ended' }
        }
        return { ...prev, timeRemaining: prev.timeRemaining - 1 }
      })
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const searchForOpponent = useCallback(async () => {
    if (!streamId || !userId) return

    setState((prev) => ({ ...prev, phase: 'searching' }))

    try {
      const { data, error } = await supabase
        .from('streams')
        .select('id, user_id, broadcaster:user_profiles!streams_broadcaster_id_fkey(username, avatar_url)')
        .eq('category', 'gaming')
        .eq('is_live', true)
        .neq('user_id', userId)
        .limit(10)

      if (error) throw error

      if (data && data.length > 0) {
        const opponent = data[Math.floor(Math.random() * data.length)]
        const opponentProfile = opponent.broadcaster as any

        setState((prev) => ({
          ...prev,
          phase: 'countdown',
          opponentId: opponent.user_id,
          opponentUsername: opponentProfile?.username || 'Opponent',
          opponentAvatarUrl: opponentProfile?.avatar_url || null,
        }))

        setTimeout(() => {
          const battleId = `gaming_battle_${Date.now()}`
          const now = new Date()
          const endsAt = new Date(now.getTime() + GAMING_BATTLE_DURATION * 1000)

          setState((prev) => ({
            ...prev,
            phase: 'active',
            battleId,
            myScore: 0,
            opponentScore: 0,
            startedAt: now,
            endsAt,
          }))

          startTimer(GAMING_BATTLE_DURATION)
        }, 3000)
      } else {
        toast.info('No opponents found. Try again later.')
        setState((prev) => ({ ...prev, phase: 'idle' }))
      }
    } catch (err: any) {
      console.error('[useGamingBattle] Search failed:', err)
      toast.error('Failed to find opponent')
      setState((prev) => ({ ...prev, phase: 'idle' }))
    }
  }, [streamId, userId, startTimer])

  const addGiftScore = useCallback((side: 'me' | 'opponent', coinValue: number) => {
    setState((prev) => {
      if (prev.phase !== 'active') return prev
      return side === 'me'
        ? { ...prev, myScore: prev.myScore + coinValue }
        : { ...prev, opponentScore: prev.opponentScore + coinValue }
    })
  }, [])

  const endBattle = useCallback(async () => {
    stopTimer()

    if (state.battleId && streamId) {
      try {
        await supabase
          .from('streams')
          .update({
            is_battle: false,
            battle_id: null,
            battle_status: 'ended',
          })
          .eq('id', streamId)
      } catch {}
    }

    setState((prev) => ({ ...prev, phase: 'ended' }))
  }, [state.battleId, streamId, stopTimer])

  const resetBattle = useCallback(() => {
    stopTimer()
    setState({
      phase: 'idle',
      battleId: null,
      opponentId: null,
      opponentUsername: null,
      opponentAvatarUrl: null,
      myScore: 0,
      opponentScore: 0,
      timeRemaining: GAMING_BATTLE_DURATION,
      startedAt: null,
      endsAt: null,
    })
  }, [stopTimer])

  useEffect(() => {
    if (state.phase === 'active' && state.timeRemaining === 0) {
      endBattle()
    }
  }, [state.phase, state.timeRemaining, endBattle])

  useEffect(() => {
    const channel = channelRef.current
    return () => {
      stopTimer()
      if (channel) {
        void supabase.removeChannel(channel)
      }
    }
  }, [stopTimer])

  return {
    ...state,
    searchForOpponent,
    addGiftScore,
    endBattle,
    resetBattle,
  }
}
