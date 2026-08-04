import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { TroceanPrivateState, TroceanPublicState, TroceanTeam } from '@/lib/trocean'

export function useTrocean(matchId?: string, userId?: string | null) {
  const [publicState, setPublicState] = useState<TroceanPublicState | null>(null)
  const [privateState, setPrivateState] = useState<TroceanPrivateState | null>(null)
  const [loading, setLoading] = useState(Boolean(matchId))
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!matchId) return
    setLoading(true)
    setError(null)
    const [publicResult, privateResult] = await Promise.all([
      supabase.rpc('get_trocean_public_state', { p_match_id: matchId }),
      userId ? supabase.rpc('get_trocean_private_player_state', { p_match_id: matchId }) : Promise.resolve({ data: null, error: null }),
    ])
    if (publicResult.error) {
      setError(publicResult.error.message)
      setLoading(false)
      return
    }
    setPublicState(publicResult.data as TroceanPublicState)
    setPrivateState((privateResult as any).data as TroceanPrivateState | null)
    setLoading(false)
  }, [matchId, userId])

  useEffect(() => {
    void refresh()
    if (!matchId) return
    const channel = supabase
      .channel(`trocean:${matchId}`)
      .on('broadcast', { event: 'state_changed' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trocean_match_events', filter: `match_id=eq.${matchId}` }, () => void refresh())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [matchId, refresh])

  const createLobby = useCallback(async (name: string, visibility: 'public' | 'private' = 'public') => {
    const { data, error } = await supabase.rpc('create_trocean_lobby', { p_name: name, p_visibility: visibility })
    if (error) throw error
    return data as { match_id: string }
  }, [])

  const joinTeam = useCallback(async (team: TroceanTeam, slot?: number) => {
    if (!matchId) throw new Error('Missing match id')
    const { data, error } = await supabase.rpc('join_trocean_team', { p_match_id: matchId, p_team: team, p_team_slot: slot ?? null })
    if (error) throw error
    await refresh()
    return data
  }, [matchId, refresh])

  const chooseLocation = useCallback(async (tile: string) => {
    if (!matchId) throw new Error('Missing match id')
    const { data, error } = await supabase.rpc('choose_trocean_location', { p_match_id: matchId, p_selected_tile: tile })
    if (error) throw error
    await refresh()
    return data
  }, [matchId, refresh])

  const setReady = useCallback(async (ready: boolean) => {
    if (!matchId) throw new Error('Missing match id')
    const { data, error } = await supabase.rpc('set_trocean_ready', { p_match_id: matchId, p_ready: ready })
    if (error) throw error
    await refresh()
    return data
  }, [matchId, refresh])

  const submitAttack = useCallback(async (tile: string, requestId = crypto.randomUUID()) => {
    if (!matchId) throw new Error('Missing match id')
    const { data, error } = await supabase.rpc('submit_trocean_attack', { p_match_id: matchId, p_target_tile: tile, p_request_id: requestId })
    if (error) throw error
    await refresh()
    return data
  }, [matchId, refresh])

  return { publicState, privateState, loading, error, refresh, createLobby, joinTeam, chooseLocation, setReady, submitAttack }
}
