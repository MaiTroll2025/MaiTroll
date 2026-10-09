import { useState, useEffect, useCallback } from 'react';
import { supabase, ensureSupabaseSession } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { awardWatchHypeReward } from '@/lib/hypeRewards'

interface HypeCoinWatchResponse {
  success: boolean
  hype_coins: number
  earned_amount: number
  daily_earned: number
  daily_cap: number
  weekly_earned: number
  weekly_cap: number
  message: string
}

interface ConvertResponse {
  success: boolean
  hype_coins_after: number
  troll_coins_after: number
  converted_amount: number
  message: string
}

interface CapInfo {
  dailyEarned: number
  dailyCap: number
  weeklyEarned: number
  weeklyCap: number
}

/**
 * Hook for managing Hype Coins earning and conversion
 * 
 * Provides:
 * - Real-time Hype Coin balance tracking
 * - Watch reward earning via RPC
 * - Conversion to Troll Coins
 * - Cap tracking
 */
export function useHypeCoins() {
  const { user, profile } = useAuthStore()
  const [hypeCoins, setHypeCoins] = useState<number>(profile?.hype_coins ?? 0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capInfo, setCapInfo] = useState<CapInfo>({
    dailyEarned: 0,
    dailyCap: 25,
    weeklyEarned: 0,
    weeklyCap: 175,
  })

  // Sync balances with profile from AuthStore
  useEffect(() => {
    if (profile?.hype_coins !== undefined) {
      setHypeCoins(profile.hype_coins)
    }
  }, [profile?.hype_coins])

  /**
   * Refresh Hype Coin balance from database
   */
  const refreshHypeCoins = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    setError(null)

    try {
      await ensureSupabaseSession(supabase)

      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('hype_coins')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('[useHypeCoins] Error loading balance:', profileError)
        return
      }

      if (profileData) {
        setHypeCoins(profileData.hype_coins ?? 0)
        
        // Update auth store
        const currentProfile = useAuthStore.getState().profile
        if (currentProfile && currentProfile.hype_coins !== profileData.hype_coins) {
          useAuthStore.getState().setProfile({
            ...currentProfile,
            hype_coins: profileData.hype_coins ?? 0,
          })
        }
      }
    } catch (err: any) {
      console.error('[useHypeCoins] Error refreshing:', err)
      setError(err.message || 'Failed to refresh Hype Coins')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  /**
   * Earn Hype Coin from watching live stream
   * Called every 5 minutes of verified watching
   * 
   * @param streamId - ID of the stream being watched
   * @returns Promise with earning result
   */
  const earnHypeCoinFromWatch = useCallback(
    async (streamId: string): Promise<HypeCoinWatchResponse | null> => {
      if (!user?.id) {
        console.warn('[useHypeCoins] Not authenticated')
        return null
      }

      if (!streamId) {
        console.warn('[useHypeCoins] No stream ID provided')
        return null
      }

      setLoading(true)
      setError(null)

      try {
        const response = await awardWatchHypeReward(streamId)

        // Update local state if successful
        if (response.success) {
          setHypeCoins(response.hype_coins)
          setCapInfo({
            dailyEarned: response.daily_earned,
            dailyCap: response.daily_cap,
            weeklyEarned: response.weekly_earned,
            weeklyCap: response.weekly_cap,
          })

          // Update auth store profile
          const currentProfile = useAuthStore.getState().profile
          if (currentProfile) {
            useAuthStore.getState().setProfile({
              ...currentProfile,
              hype_coins: response.hype_coins,
            })
          }
        } else {
          setError(response.message)
        }

        return response
      } catch (err: any) {
        console.error('[useHypeCoins] Unexpected error:', err)
        const errorMsg = err.message || 'Failed to earn Hype Coin'
        setError(errorMsg)
        return null
      } finally {
        setLoading(false)
      }
    },
    [user?.id]
  )

  /**
   * Convert Hype Coins to Troll Coins (1:1 rate)
   * 
   * @param amount - Number of Hype Coins to convert
   * @returns Promise with conversion result
   */
  const convertToTrollCoins = useCallback(
    async (amount: number): Promise<ConvertResponse | null> => {
      if (!user?.id) {
        console.warn('[useHypeCoins] Not authenticated')
        toast.error('You must be logged in')
        return null
      }

      if (amount <= 0) {
        toast.error('Please enter a valid amount')
        return null
      }

      if (amount > hypeCoins) {
        toast.error('You do not have enough Hype Coins')
        return null
      }

      setLoading(true)
      setError(null)

      try {
        await ensureSupabaseSession(supabase)

        const { data, error: rpcError } = await supabase.rpc(
          'convert_hype_coins_to_troll_coins',
          {
            p_amount: amount,
          }
        )

        if (rpcError) {
          console.error('[useHypeCoins] Conversion RPC error:', rpcError)
          const errorMsg = rpcError.message || 'Failed to convert Hype Coins'
          setError(errorMsg)
          toast.error(errorMsg)
          return null
        }

        if (!data) {
          console.warn('[useHypeCoins] No response from conversion RPC')
          return null
        }

        // Supabase returns TABLE results as an array
        const response = (Array.isArray(data) && data.length > 0) ? data[0] : null

        if (!response) {
          console.warn('[useHypeCoins] Empty conversion response')
          return null
        }

        // Update local state if successful
        if (response.success) {
          setHypeCoins(response.hype_coins_after)

          // Update auth store profile
          const currentProfile = useAuthStore.getState().profile
          if (currentProfile) {
            useAuthStore.getState().setProfile({
              ...currentProfile,
              hype_coins: response.hype_coins_after,
              troll_coins: response.troll_coins_after,
            })
          }

          // Toast is shown by ConvertHypeCoinsModal with more detail
        } else {
          setError(response.message)
          toast.error(response.message)
        }

        return response
      } catch (err: any) {
        console.error('[useHypeCoins] Unexpected error during conversion:', err)
        const errorMsg = err.message || 'Failed to convert Hype Coins'
        setError(errorMsg)
        toast.error(errorMsg)
        return null
      } finally {
        setLoading(false)
      }
    },
    [user?.id, hypeCoins]
  )

  return {
    hypeCoins,
    loading,
    error,
    capInfo,
    refreshHypeCoins,
    earnHypeCoinFromWatch,
    convertToTrollCoins,
  }
}
