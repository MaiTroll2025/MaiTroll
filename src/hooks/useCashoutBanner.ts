import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { CASHOUT_TIERS, type CashoutTier } from '@/config/coinConfig'

export interface UseCashoutBannerOptions {
  userId: string | null | undefined
  isEligible: boolean
  streamId?: string | null
}

export interface UseCashoutBannerReturn {
  isVisible: boolean
  currentBalance: number
  nextTier: CashoutTier | null
  amountRemaining: number
  progressPercent: number
  isCashoutReady: boolean
  hideBanner: () => void
  refreshBalance: () => Promise<void>
}

const BANNER_VISIBLE_MS = 30_000

export function useCashoutBanner({
  userId,
  isEligible,
  streamId,
}: UseCashoutBannerOptions): UseCashoutBannerReturn {
  const profile = useAuthStore((s) => s.profile)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)

  const [isVisible, setIsVisible] = useState(false)
  const [currentBalance, setCurrentBalance] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const lastTriggerRef = useRef<number>(0)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const hideBanner = useCallback(() => {
    clearTimer()
    if (mountedRef.current) {
      setIsVisible(false)
    }
  }, [clearTimer])

  const resetTimer = useCallback(() => {
    clearTimer()
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    if (mountedRef.current) {
      setIsVisible(true)
    }
    timerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setIsVisible(false)
      }
      timerRef.current = null
    }, BANNER_VISIBLE_MS)
  }, [clearTimer])

  const refreshBalance = useCallback(async () => {
    if (!userId || !isEligible) return
    try {
      await refreshProfile()
      const updatedProfile = useAuthStore.getState().profile
      if (updatedProfile && updatedProfile.id === userId) {
        setCurrentBalance(Math.max(0, Number(updatedProfile.troll_coins ?? 0)))
      }
    } catch {
      // silent
    }
  }, [userId, isEligible, refreshProfile])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimer()
    }
  }, [clearTimer])

  useEffect(() => {
    if (!isEligible || !userId) {
      hideBanner()
      setCurrentBalance(0)
      return
    }

    const balanceFromProfile = Math.max(0, Number(profile?.troll_coins ?? 0))
    setCurrentBalance(balanceFromProfile)

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (!detail) return

      const receiverId = detail.receiver_id || detail.receiverId
      if (receiverId !== userId) return

      const now = Date.now()
      if (now - lastTriggerRef.current < 100) return
      lastTriggerRef.current = now

      const coins = Number(detail.amount ?? detail.coins ?? 0)
      if (coins > 0) {
        setCurrentBalance((prev) => Math.max(0, prev + coins))
        resetTimer()
      }
    }

    window.addEventListener('broadcast-balance-update', handler)

    return () => {
      window.removeEventListener('broadcast-balance-update', handler)
    }
  }, [isEligible, userId, profile?.troll_coins, resetTimer, hideBanner])

  useEffect(() => {
    if (!isEligible || !userId || !streamId) return

    const channel = supabase
      .channel(`cashout-banner:${userId}:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (!mountedRef.current) return
          const newCoins = Number((payload.new as any)?.troll_coins ?? 0)
          setCurrentBalance(Math.max(0, newCoins))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isEligible, userId, streamId])

  const nextTier = CASHOUT_TIERS.find((tier) => currentBalance < tier.coins) ?? null
  const amountRemaining = nextTier ? Math.max(0, nextTier.coins - currentBalance) : 0
  const progressPercent = nextTier ? Math.min(100, (currentBalance / nextTier.coins) * 100) : 100
  const isCashoutReady = currentBalance >= CASHOUT_TIERS[0]?.coins

  return {
    isVisible,
    currentBalance,
    nextTier,
    amountRemaining,
    progressPercent,
    isCashoutReady,
    hideBanner,
    refreshBalance,
  }
}
