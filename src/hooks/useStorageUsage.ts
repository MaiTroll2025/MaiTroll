import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

export interface StorageBreakdown {
  category: string
  bytes: number
  label: string
}

export interface StoragePlan {
  tierIndex: number
  tierLabel: string
  monthlyFee: number
  bytesGranted: number | null
  isActive: boolean
  nextBillingAt: string
  lastPaymentAt: string | null
}

export interface StorageUsage {
  totalBytes: number
  totalGB: number
  breakdown: StorageBreakdown[]
  tierStart: number
  tierEnd: number
  tierStartGB: number
  tierEndGB: number
  monthlyFee: number
  percentage: number
  storage_percentage?: number
  status: 'normal' | 'warning' | 'exceeded'
  plan: StoragePlan | null
  hasPlan: boolean
  totalLimitBytes: number
  totalAvailableBytes: number
  topUpBytes: number
  creditBytes: number
  replayBalance: number
  replayMinutesToday: number
  replayMinutesMonth: number
  replayCoinsToday: number
  replayCoinsMonth: number
  replayStatus: string
  replayCostPerMinute: number
  renewalDate: string | null
}

const STORAGE_TIERS = [
  { start: 0, end: 5 * 1024 * 1024 * 1024, fee: 0, label: '5 GB' },
  { start: 5 * 1024 * 1024 * 1024, end: 25 * 1024 * 1024 * 1024, fee: 900, label: '25 GB' },
  { start: 25 * 1024 * 1024 * 1024, end: 50 * 1024 * 1024 * 1024, fee: 1500, label: '50 GB' },
  { start: 50 * 1024 * 1024 * 1024, end: 100 * 1024 * 1024 * 1024, fee: 3000, label: '100 GB' },
  { start: 100 * 1024 * 1024 * 1024, end: 200 * 1024 * 1024 * 1024, fee: 6500, label: '200 GB' },
  { start: 200 * 1024 * 1024 * 1024, end: 500 * 1024 * 1024 * 1024, fee: 9000, label: '500 GB' },
  { start: 500 * 1024 * 1024 * 1024, end: null, fee: 18000, label: '1 TB' },
]

function getTierInfo(totalBytes: number) {
  for (const tier of STORAGE_TIERS) {
    if (tier.end === null || totalBytes < tier.end) return tier
  }
  return STORAGE_TIERS[STORAGE_TIERS.length - 1]
}

function formatStorageUsage(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  return `${gb.toFixed(1)} GB`
}

export async function showStorageStartWarning(userId?: string | null, context = 'stream') {
  if (!userId) return

  try {
    const { data, error } = await supabase.rpc('get_user_storage_replay_status', { p_user_id: userId })
    if (error) throw error

    const percentage = Number(data?.storage_percentage || 0)
    const usedGB = Number(data?.total_used_bytes || 0)
    const limitGB = Number(data?.total_limit_bytes || 0)
    const usedLabel = limitGB > 0
      ? `${formatStorageUsage(usedGB)} / ${formatStorageUsage(limitGB)} Used`
      : `${formatStorageUsage(usedGB)} Used`

    if (percentage >= 100) {
      toast.error(`Storage Limit Reached\nUpgrade Storage Plan\nPurchase Storage Top-Up`, {
        duration: 10000,
        description: usedLabel,
      })
      return
    }

    if (percentage >= 90) {
      toast.warning(`⚠ Upgrade Recommended`, {
        duration: 9000,
        description: usedLabel,
      })
      return
    }

    if (percentage >= 80) {
      toast.warning(`⚠ Storage Almost Full`, {
        duration: 8000,
        description: `${usedLabel} • ${context}`,
      })
    }
  } catch (err) {
    console.warn('[showStorageStartWarning] Failed:', err)
  }
}

export function useStorageUsage(userId?: string | null) {
  const [storage, setStorage] = useState<StorageUsage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStorageUsage = useCallback(async () => {
    if (!userId) { setStorage(null); return }
    setLoading(true)
    setError(null)
    try {
      const [statusRes, breakdownRes] = await Promise.all([
        supabase.rpc('get_user_storage_replay_status', { p_user_id: userId }),
        supabase.rpc('get_user_storage_breakdown', { p_user_id: userId }),
      ])
      if (statusRes.error) throw statusRes.error
      const data = statusRes.data
      const breakdown = (breakdownRes.data || []).map((row: any) => ({
        category: row.category, bytes: row.bytes || 0, label: row.category,
      }))
      const tier = getTierInfo(data.total_used_bytes || 0)
      setStorage({
        totalBytes: data.total_used_bytes || 0,
        totalGB: (data.total_used_bytes || 0) / (1024 * 1024 * 1024),
        breakdown,
        tierStart: tier.start,
        tierEnd: tier.end || Infinity,
        tierStartGB: tier.start / (1024 * 1024 * 1024),
        tierEndGB: tier.end ? tier.end / (1024 * 1024 * 1024) : Infinity,
        monthlyFee: data.monthly_fee || tier.fee,
        percentage: data.storage_percentage || 0,
        status: data.storage_percentage >= 80 ? 'warning' : 'normal',
        plan: data.has_plan ? {
          tierIndex: 0, tierLabel: data.plan_label, monthlyFee: data.monthly_fee,
          bytesGranted: data.plan_storage_bytes, isActive: true,
          nextBillingAt: data.renewal_date, lastPaymentAt: null,
        } : null,
        hasPlan: data.has_plan,
        totalLimitBytes: data.total_limit_bytes || 0,
        totalAvailableBytes: data.total_available_bytes || 0,
        topUpBytes: data.top_up_bytes || 0,
        creditBytes: data.credit_bytes || 0,
        replayBalance: data.replay_balance || 0,
        replayMinutesToday: data.replay_minutes_today || 0,
        replayMinutesMonth: data.replay_minutes_month || 0,
        replayCoinsToday: data.replay_coins_today || 0,
        replayCoinsMonth: data.replay_coins_month || 0,
        replayStatus: data.replay_status || 'active',
        replayCostPerMinute: data.replay_cost_per_minute || 5,
        renewalDate: data.renewal_date || null,
      })
    } catch (err: any) {
      console.error('[useStorageUsage] Failed:', err)
      setError(err?.message || 'Failed to load storage data')
    } finally {
      setLoading(false)
    }
  }, [userId])

   useEffect(() => {
    fetchStorageUsage()
    if (!userId) return
    const channel = supabase.channel(`user-storage-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_storage_usage', filter: `user_id=eq.${userId}` }, fetchStorageUsage)
      .subscribe()
    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    };
  }, [userId, fetchStorageUsage])

  return { storage, loading, error, refresh: fetchStorageUsage }
}

export function useReplayBalance(userId?: string | null) {
  const [balance, setBalance] = useState<number | null>(null)
  const [status, setStatus] = useState<string>('active')
  const [loading, setLoading] = useState(false)

  const fetchBalance = useCallback(async () => {
    if (!userId) { setBalance(null); return }
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_user_storage_replay_status', { p_user_id: userId })
      if (error) throw error
      setBalance(data?.replay_balance || 0)
      setStatus(data?.replay_status || 'active')
    } catch (err) {
      console.error('[useReplayBalance] Failed:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchBalance()
    const interval = setInterval(fetchBalance, 30000)
    return () => clearInterval(interval)
  }, [fetchBalance])

  return { balance, status, loading, refresh: fetchBalance }
}
