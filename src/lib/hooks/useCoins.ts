import { useState, useEffect, useCallback } from 'react'
import { supabase, ensureSupabaseSession, UserProfile } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

interface Trollcoins {
  troll_coins: number
  hype_coins: number
  total_earned_coins: number
  total_spent_coins: number
  battle_crowns: number
}

interface SpendCoinsParams {
  senderId: string
  receiverId?: string // Optional - if not provided, coins are just deducted (e.g., wheel, effects)
  amount: number
  source: 'gift' | 'wheel' | 'badge' | 'entrance_effect' | 'boost' | 'purchase' | 'bonus' | 'payroll' | 'mai_talent_vote' | 'church_gift'
  item?: string // Optional item name (e.g., 'TrollRose', 'Wheel Spin', 'VIP Badge')
  idempotencyKey?: string // Optional idempotency key for preventing double-spending on retries
}

/**
 * Unified coin management hook
 * 
 * Provides:
 * - Real-time coin balance fetching
 * - Secure coin spending via RPC
 * - Balance refresh after operations
 * - Error handling
 */
export function useCoins() {
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [balances, setBalances] = useState<Trollcoins>({
    troll_coins: profile?.troll_coins ?? 0,
    hype_coins: profile?.hype_coins ?? 0,
    total_earned_coins: profile?.total_earned_coins || 0,
    total_spent_coins: profile?.total_spent_coins || 0,
    battle_crowns: profile?.battle_crowns ?? 0,
  })
  const [optimisticUntil, setOptimisticUntil] = useState<number | null>(null)
  const [optimisticTroll, setOptimisticTroll] = useState<number | null>(null)

  // Sync balances with profile from AuthStore to ensure UI stays in sync across components
  useEffect(() => {
    if (profile) {
      setBalances({
        troll_coins: profile.troll_coins ?? 0,
        hype_coins: profile.hype_coins ?? 0,
        total_earned_coins: profile.total_earned_coins || 0,
        total_spent_coins: profile.total_spent_coins || 0,
        battle_crowns: profile.battle_crowns ?? 0,
      })
    }
  }, [profile, profile?.troll_coins, profile?.hype_coins, profile?.total_earned_coins, profile?.total_spent_coins, profile?.battle_crowns])

   /**
    * Refresh coin balances from database
    * Call this after any coin operation to ensure UI is in sync
    */
   const refreshCoins = useCallback(async () => {
     if (!user?.id) return

     setLoading(true)
     setError(null)

     try {
       const {
         data: { session },
         error: sessionError,
       } = await supabase.auth.getSession()

       if (sessionError) {
         console.warn('[useCoins] Session check failed:', sessionError)
         return
       }

       if (!session?.user?.id) {
         console.debug('[useCoins] Skipping coin refresh: no session yet')
         return
       }

       await ensureSupabaseSession(supabase)

         const { data: profileData, error: profileError } = await supabase
           .from('user_profiles')
           .select('troll_coins, hype_coins, total_earned_coins, total_spent_coins, battle_crowns')
           .eq('id', user.id)
           .maybeSingle()

       if (profileError) {
         console.error('Error loading profile balances:', profileError)
       }

       const currentProfile = useAuthStore.getState().profile
       // Get balance from database first, fall back to local store
        const dbBalance = Number(profileData?.troll_coins ?? 0)
        const localBalance = Number(currentProfile?.troll_coins ?? 0)

        const mergedPaid =
          optimisticUntil && Date.now() < optimisticUntil && (optimisticTroll ?? 0) > 0 && (optimisticTroll ?? 0) <= (profileData?.troll_coins ?? currentProfile?.troll_coins ?? 0)
            ? (optimisticTroll as number)
            : profileData?.troll_coins ?? currentProfile?.troll_coins ?? 0
       
        if (import.meta.env.DEV) {
          console.debug('[refreshCoins] Balance sync:', { dbBalance, localBalance, mergedPaid })
        }

        const nextTotals = {
          total_earned_coins:
            profileData?.total_earned_coins ??
            currentProfile?.total_earned_coins ??
            0,
          total_spent_coins:
            profileData?.total_spent_coins ??
            currentProfile?.total_spent_coins ??
            0,
        }

          const nextBalances = {
           troll_coins: mergedPaid,
           hype_coins: profileData?.hype_coins ?? currentProfile?.hype_coins ?? 0,
           total_earned_coins: nextTotals.total_earned_coins,
           total_spent_coins: nextTotals.total_spent_coins,
           battle_crowns: profileData?.battle_crowns ?? currentProfile?.battle_crowns ?? 0,
         }

         const balancesChanged =
           balances.troll_coins !== nextBalances.troll_coins ||
           balances.hype_coins !== nextBalances.hype_coins ||
           balances.total_earned_coins !== nextBalances.total_earned_coins ||
           balances.total_spent_coins !== nextBalances.total_spent_coins ||
           balances.battle_crowns !== nextBalances.battle_crowns

       if (balancesChanged) {
          setBalances(nextBalances)
        }

       if (currentProfile) {
          const profileNeedsUpdate =
            currentProfile.troll_coins !== mergedPaid ||
            currentProfile.hype_coins !== nextBalances.hype_coins

          const sameCoins =
            dbBalance === localBalance &&
            !balancesChanged

          if (!profileNeedsUpdate || sameCoins) {
            if (import.meta.env.DEV) {
              console.debug('[refreshCoins] No coin state change, skipping auth update')
            }
          } else {
              const updatedProfile: UserProfile = {
                ...currentProfile,
                troll_coins: mergedPaid as number,
                hype_coins: nextBalances.hype_coins,
                total_earned_coins: nextTotals.total_earned_coins,
                total_spent_coins: nextTotals.total_spent_coins,
                battle_crowns: nextBalances.battle_crowns,
              }

            useAuthStore.getState().setProfile(updatedProfile)
          }
        }
       if (optimisticUntil && Date.now() < optimisticUntil && (mergedPaid as number) >= (optimisticTroll ?? 0)) {
         setOptimisticUntil(null)
         setOptimisticTroll(null)
       }
     } catch (err: any) {
       console.error('[useCoins] Unexpected error refreshing coins:', err)
       setError(err.message || 'Failed to refresh coins')
     } finally {
       setLoading(false)
     }
   }, [user?.id, optimisticUntil, optimisticTroll])

  /**
   * Spend coins via secure RPC
   * 
   * This is the ONLY way coins should be deducted in the frontend.
   * All coin spending (gifts, wheel, badges, effects) must go through this.
   * 
   * @param params - Spending parameters
   * @returns Promise<boolean> - true if successful, false otherwise
   */
  const spendCoins = useCallback(async (params: SpendCoinsParams): Promise<boolean> => {
    if (!user?.id) {
      toast.error('You must be logged in to spend coins')
      return false
    }

    // Calculate available coins
    const availableForSpend = balances.troll_coins

    // Validate balance
    if (availableForSpend < params.amount) {
      toast.error('Not enough coins!')
      return false
    }

    setLoading(true)
    setError(null)

    try {
      // Call spend_coins RPC
      // If receiverId is not provided, the RPC will only deduct from sender
      // (useful for wheel spins, badges, effects where coins are consumed)
      const { data, error: rpcError } = await supabase.rpc('spend_coins', {
        p_sender_id: params.senderId,
        p_receiver_id: params.receiverId,
        p_coin_amount: params.amount,
        p_source: params.source,
        p_item: params.item || params.source,
        p_idempotency_key: params.idempotencyKey || null,
      })

      if (rpcError) {
        console.error('Error spending coins:', rpcError)
        
        // Check if it's a "not enough coins" error
        if (rpcError.message?.includes('Not enough coins') || rpcError.message?.includes('insufficient')) {
          toast.error('Not enough coins!')
        } else {
          toast.error(rpcError.message || 'Failed to spend coins')
        }
        
        setError(rpcError.message || 'Failed to spend coins')
        return false
      }

      // Check if RPC returned an error in the response
      if (data && typeof data === 'object' && 'success' in data && !data.success) {
        const errorMsg = (data as any).error || 'Failed to spend coins'
        
        if (errorMsg.includes('Not enough coins')) {
          toast.error('Not enough coins!')
        } else {
          toast.error(errorMsg)
        }
        
        setError(errorMsg)
        return false
      }

      // Refresh balances after successful spend
      await refreshCoins()

      return true
    } catch (err: any) {
      console.error('Unexpected error spending coins:', err)
      const errorMsg = err.message || 'Failed to spend coins'
      toast.error(errorMsg)
      setError(errorMsg)
      return false
    } finally {
      setLoading(false)
    }
  }, [user?.id, balances.troll_coins, balances.hype_coins, refreshCoins])

  // Set up real-time subscription for coin balance updates
  useEffect(() => {
    if (!user?.id) return

    refreshCoins()

    const coinChannelName = `coin-balance-updates:${user.id}`
    const profileChannelName = `profile-balance-updates:${user.id}`

    const coinChannel = supabase.channel(coinChannelName)
    const profileChannel = supabase.channel(profileChannelName)

    // When multiple components use useCoins(), supabase.channel() returns the
    // same RealtimeChannel instance. If it's already subscribed, calling .on()
    // throws "cannot add postgres_changes callbacks after subscribe()".
    const coinAlreadyActive = coinChannel.state === 'joined' || coinChannel.state === 'joining'
    const profileAlreadyActive = profileChannel.state === 'joined' || profileChannel.state === 'joining'

    if (!coinAlreadyActive) {
      coinChannel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'coin_transactions',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            refreshCoins()
          }
        )
        .subscribe()
    }

    if (!profileAlreadyActive) {
      profileChannel
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const newProfileData = payload.new as any
            const currentProfile = useAuthStore.getState().profile
            if (currentProfile) {
              const candidate =
                typeof newProfileData.troll_coins === 'number'
                  ? newProfileData.troll_coins
                  : currentProfile.troll_coins
              const shouldKeepOptimistic =
                optimisticUntil &&
                Date.now() < optimisticUntil &&
                (optimisticTroll ?? balances.troll_coins) > candidate
              const nextEarned =
                typeof newProfileData.total_earned_coins === 'number'
                  ? newProfileData.total_earned_coins
                  : currentProfile.total_earned_coins
              const nextSpent =
                typeof newProfileData.total_spent_coins === 'number'
                  ? newProfileData.total_spent_coins
                  : currentProfile.total_spent_coins
              const nextCrowns =
                typeof newProfileData.battle_crowns === 'number'
                  ? newProfileData.battle_crowns
                  : currentProfile.battle_crowns
               const nextHype =
                 typeof newProfileData.hype_coins === 'number'
                   ? newProfileData.hype_coins
                   : currentProfile.hype_coins
               const updatedProfile: UserProfile = {
                 ...currentProfile,
                 troll_coins: shouldKeepOptimistic
                   ? (optimisticTroll ?? balances.troll_coins)
                   : Number(candidate ?? currentProfile.troll_coins),
                 total_earned_coins: nextEarned,
                 total_spent_coins: nextSpent,
                 battle_crowns: nextCrowns,
                 hype_coins: nextHype,
               }
               useAuthStore.getState().setProfile(updatedProfile)
               setBalances((prev) => ({
                 troll_coins: shouldKeepOptimistic
                   ? (optimisticTroll ?? prev.troll_coins)
                   : (typeof updatedProfile.troll_coins === 'number'
                       ? updatedProfile.troll_coins
                       : prev.troll_coins),
                 total_earned_coins:
                   typeof updatedProfile.total_earned_coins === 'number'
                     ? updatedProfile.total_earned_coins
                     : prev.total_earned_coins,
                 total_spent_coins:
                   typeof updatedProfile.total_spent_coins === 'number'
                     ? updatedProfile.total_spent_coins
                     : prev.total_spent_coins,
                 battle_crowns:
                   typeof updatedProfile.battle_crowns === 'number'
                     ? updatedProfile.battle_crowns
                     : prev.battle_crowns,
                 hype_coins:
                   typeof updatedProfile.hype_coins === 'number'
                     ? updatedProfile.hype_coins
                     : prev.hype_coins,
               }))
              if (!shouldKeepOptimistic && optimisticUntil) {
                setOptimisticUntil(null)
                setOptimisticTroll(null)
              }
            }
          }
        )
        .subscribe()
    }

    return () => {
      if (!coinAlreadyActive) {
        supabase.removeChannel(coinChannel)
      }
      if (!profileAlreadyActive) {
        supabase.removeChannel(profileChannel)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const optimisticCredit = useCallback((delta: number) => {
    if (!user?.id) return
    if (!Number.isFinite(delta) || delta <= 0) return
    const currentProfile = useAuthStore.getState().profile
    const base = currentProfile?.troll_coins ?? balances.troll_coins
    const next = base + delta
    setBalances((prev) => ({ ...prev, troll_coins: next }))
    if (currentProfile) {
      const updatedProfile: UserProfile = {
        ...currentProfile,
        troll_coins: next,
      }
      useAuthStore.getState().setProfile(updatedProfile)
    }
    setOptimisticTroll(next)
    setOptimisticUntil(Date.now() + 8000)
  }, [user?.id, balances.troll_coins])

  const optimisticDebit = useCallback((delta: number) => {
    if (!user?.id) return
    if (!Number.isFinite(delta) || delta <= 0) return
    const currentProfile = useAuthStore.getState().profile
    const base = currentProfile?.troll_coins ?? balances.troll_coins
    const next = base - delta
    setBalances((prev) => ({ ...prev, troll_coins: next }))
    if (currentProfile) {
      const updatedProfile: UserProfile = {
        ...currentProfile,
        troll_coins: next,
      }
      useAuthStore.getState().setProfile(updatedProfile)
    }
    setOptimisticTroll(next)
    setOptimisticUntil(Date.now() + 8000)
  }, [user?.id, balances.troll_coins])

  const depositToCashout = useCallback(async (amount: number): Promise<{ success: boolean; error?: string }> => {
    // All troll coins are now cashout-eligible. The deposit step is no longer needed.
    toast.info('All troll coins are cashout-eligible. No deposit step needed.')
    return { success: true }
  }, [])

  return {
    balances,
    loading,
    error,
    refreshCoins,
    spendCoins,
    optimisticCredit,
    optimisticDebit,
    depositToCashout,
    // Convenience getters
    troll_coins: balances.troll_coins,
    paidBalance: balances.troll_coins,
    totalEarned: balances.total_earned_coins,
    totalSpent: balances.total_spent_coins,
    crowns: balances.battle_crowns,
    hype_coins: balances.hype_coins,
  }
}
