import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

export interface Squad {
  id: string
  slug: string
  name: string
  tag: string
  description: string | null
  rules: string | null
  logo_url: string | null
  cover_url: string | null
  block_name: string | null
  leader_id: string
  status: string
  member_count?: number
  flame_score?: number
  created_at: string
  updated_at: string
}

export interface SquadMembership {
  id: string
  squad_id: string
  user_id: string
  role: 'leader' | 'member'
  joined_at: string
  left_at: string | null
  join_fee_paid: boolean
}

export interface SquadCashBalance {
  visible: boolean
  amount_cents: number
  usd: number
  reason: string
}

export interface BankCashValue {
  visible: boolean
  coins: number
  usd: number
  next_tier_coins: number
  tier_usd: number
  reason: string
}

/**
 * Squads core: creation, joining, leaving, kicking, roster, discovery.
 */
export function useSquads() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createSquad = useCallback(async (payload: {
    name: string; tag: string; description?: string; rules?: string;
    logo_url?: string; cover_url?: string; block_name?: string;
  }) => {
    if (!user) { toast.error('You must be logged in'); return { success: false } }
    setLoading(true); setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('create_squad', {
        p_name: payload.name,
        p_tag: payload.tag,
        p_description: payload.description ?? null,
        p_rules: payload.rules ?? null,
        p_logo_url: payload.logo_url ?? null,
        p_cover_url: payload.cover_url ?? null,
        p_block_name: payload.block_name ?? null,
      })
      if (rpcError) throw rpcError
      if (data && !data.success) {
        toast.error(data.error || 'Failed to create Squad')
        return { success: false, error: data.error }
      }
      toast.success('Squad created!')
      return { success: true, squad: data }
    } catch (err: any) {
      const msg = err.message || 'Failed to create Squad'
      setError(msg); toast.error(msg)
      return { success: false, error: msg }
    } finally { setLoading(false) }
  }, [user])

  const joinSquad = useCallback(async (squadId: string) => {
    if (!user) { toast.error('You must be logged in'); return { success: false } }
    setLoading(true); setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('join_squad', { p_squad_id: squadId })
      if (rpcError) throw rpcError
      if (data && !data.success) {
        toast.error(data.error || 'Failed to join Squad')
        return { success: false, error: data.error }
      }
      toast.success('Joined Squad!')
      return { success: true, squadId, data }
    } catch (err: any) {
      const msg = err.message || 'Failed to join Squad'
      setError(msg); toast.error(msg)
      return { success: false, error: msg }
    } finally { setLoading(false) }
  }, [user])

  const leaveSquad = useCallback(async (squadId: string) => {
    if (!user) { toast.error('You must be logged in'); return { success: false } }
    setLoading(true); setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('leave_squad', { p_squad_id: squadId })
      if (rpcError) throw rpcError
      if (data && !data.success) {
        toast.error(data.error || 'Failed to leave Squad')
        return { success: false, error: data.error }
      }
      toast.success('Left Squad')
      return { success: true }
    } catch (err: any) {
      const msg = err.message || 'Failed to leave Squad'
      setError(msg); toast.error(msg)
      return { success: false, error: msg }
    } finally { setLoading(false) }
  }, [user])

  const kickSquadMember = useCallback(async (squadId: string, targetUserId: string, reason: string) => {
    if (!user) { toast.error('You must be logged in'); return { success: false } }
    setLoading(true); setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('kick_squad_member', {
        p_squad_id: squadId, p_target_user_id: targetUserId, p_reason: reason
      })
      if (rpcError) throw rpcError
      if (data && !data.success) {
        toast.error(data.error || 'Failed to kick member')
        return { success: false, error: data.error }
      }
      toast.success('Member kicked')
      return { success: true }
    } catch (err: any) {
      const msg = err.message || 'Failed to kick member'
      setError(msg); toast.error(msg)
      return { success: false, error: msg }
    } finally { setLoading(false) }
  }, [user])

  const fetchSquads = useCallback(async (): Promise<Squad[]> => {
    const { data, error } = await supabase
      .from('squads')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return (data || []) as Squad[]
  }, [])

  const fetchSquadBySlug = useCallback(async (slug: string): Promise<Squad | null> => {
    const { data, error } = await supabase
      .from('squads')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    if (error) throw error
    return (data || null) as Squad | null
  }, [])

  const fetchMyMembership = useCallback(async (): Promise<SquadMembership | null> => {
    if (!user) return null
    const { data, error } = await supabase
      .from('squad_memberships')
      .select('*, squads(*)')
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle()
    if (error) throw error
    return (data || null) as any
  }, [user])

  const fetchSquadMembers = useCallback(async (squadId: string) => {
    const { data, error } = await supabase
      .from('squad_memberships')
      .select('*, user_profiles(username, display_name, avatar_url)')
      .eq('squad_id', squadId)
      .is('left_at', null)
      .order('role', { ascending: true })
    if (error) throw error
    return (data || [])
  }, [])

  return {
    loading, error,
    createSquad, joinSquad, leaveSquad, kickSquadMember,
    fetchSquads, fetchSquadBySlug, fetchMyMembership, fetchSquadMembers,
  }
}

/**
 * Squad Cash (weekly) and Bank (daily) balances with server-enforced privacy.
 * Never calculated from client-side events. All values come from authoritative
 * server-side RPCs.
 */
export function useSquadCash() {
  const { user } = useAuthStore()
  const [squadCash, setSquadCash] = useState<SquadCashBalance | null>(null)
  const [bankCash, setBankCash] = useState<BankCashValue | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async (targetUserId?: string) => {
    const id = targetUserId || user?.id
    if (!id) return
    setLoading(true)
    try {
      const [scRes, bcRes] = await Promise.all([
        supabase.rpc('get_squad_cash_balance', { p_target_user_id: id, p_viewer_id: user?.id ?? null }),
        supabase.rpc('get_bank_cash_value', { p_target_user_id: id, p_viewer_id: user?.id ?? null }),
      ])
      if (scRes.error) throw scRes.error
      if (bcRes.error) throw bcRes.error
      setSquadCash(scRes.data as SquadCashBalance)
      setBankCash(bcRes.data as BankCashValue)
    } catch (err: any) {
      console.error('[useSquadCash] Failed to load balances:', err)
    } finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { void refresh() }, [refresh])

  return { squadCash, bankCash, loading, refresh }
}
