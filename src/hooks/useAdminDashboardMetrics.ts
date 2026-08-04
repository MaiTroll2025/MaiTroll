import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Uses RPC get_admin_dashboard_metrics_v1 for production metrics.
// Still runs narrow count queries as supplementary data sources.
// Fallback: use the finance summary view if RPC not available.

interface DashboardMetrics {
  coinRevenue: number
  coinsSold: number
  totalUsers: number
  activeStreams: number
  pendingApplications: number
  trollOfficers: number
  platformProfit: number
  coinsInCirculation: number
}

export function useAdminDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    coinRevenue: 0,
    coinsSold: 0,
    totalUsers: 0,
    activeStreams: 0,
    pendingApplications: 0,
    trollOfficers: 0,
    platformProfit: 0,
    coinsInCirculation: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Guard: skip all queries if user is not authenticated
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const results = await Promise.allSettled([
        loadCoinPurchaseMetrics(),
        loadUserMetrics(),
        loadStreamMetrics(),
        loadCoinsInCirculation(),
      ])

      const metricsData = results.reduce((acc, result, index) => {
        if (result.status === 'fulfilled') {
          Object.assign(acc, result.value)
        } else {
          console.warn(`[AdminDashboardMetrics] Failed to load metric set ${index}:`, result.reason)
        }
        return acc
      }, {} as Partial<DashboardMetrics>)

      setMetrics((prev) => ({ ...prev, ...metricsData }))
    } catch (err) {
      console.error('[AdminDashboardMetrics] Error loading metrics:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  async function loadCoinPurchaseMetrics(): Promise<Partial<DashboardMetrics>> {
    try {
      // Track processed paypal_order_ids to avoid double counting
      const processedOrderIds = new Set<string>()

      // Primary source: public.transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select('amount, coins_used, description, metadata, paypal_order_id')
        .or([
          'transaction_type.eq.purchase',
          'description.ilike.%PayPal purchase%',
          'description.ilike.%coin%',
          'metadata->>paypal_capture_id.not.is.null',
          'metadata->>paypal_order_id.not.is.null',
          'metadata->>package_id.not.is.null',
        ].join(','))

      // Secondary source: paypal_transactions (authoritative PayPal data)
      const { data: paypalTxData } = await supabase
        .from('paypal_transactions')
        .select('amount, coins, status, paypal_order_id')
        .in('status', ['completed', 'credited'])

      let totalRevenue = 0
      let totalCoins = 0

      // Process public.transactions
      for (const tx of txData || []) {
        const amount = Number(tx.amount || 0)
        totalRevenue += amount

        const meta = tx.metadata || {}
        const metadataCoins =
          Number(meta.coins_awarded || 0) ||
          Number(meta.coin_amount || 0) ||
          Number(meta.coins || 0)

        if (metadataCoins > 0) {
          totalCoins += metadataCoins
        } else {
          const coinsUsed = Number(tx.coins_used || 0)
          if (coinsUsed > 0) {
            totalCoins += coinsUsed
          } else {
            const match = String(tx.description || '').match(/(\d[\d,]*)\s*coins?/i)
            if (match) {
              totalCoins += Number(match[1].replace(/,/g, ''))
            } else {
              totalCoins += Math.round(amount * 100)
            }
          }
        }

        // Track PayPal orders to avoid duplicate counting
        if (tx.paypal_order_id) {
          processedOrderIds.add(tx.paypal_order_id)
        }
      }

      // Process paypal_transactions (only if not already in transactions)
      for (const p of paypalTxData || []) {
        if (p.paypal_order_id && processedOrderIds.has(p.paypal_order_id)) {
          continue // Skip duplicates
        }

        const amount = Number(p.amount || 0)
        const coins = Number(p.coins || 0)

        totalRevenue += amount
        if (coins > 0) {
          totalCoins += coins
        } else {
          totalCoins += Math.round(amount * 100)
        }

        if (p.paypal_order_id) {
          processedOrderIds.add(p.paypal_order_id)
        }
      }

      if (import.meta.env.DEV) {
        console.log('[AdminDashboardMetrics] Coin purchase metrics:', { totalRevenue, totalCoins, txCount: txData?.length, ppCount: paypalTxData?.length })
      }

      return {
        coinRevenue: totalRevenue,
        coinsSold: totalCoins,
        platformProfit: totalRevenue,
      }
    } catch (err) {
      console.error('[AdminDashboardMetrics] Failed to load coin purchase metrics:', err)
      return {}
    }
  }

  async function loadUserMetrics(): Promise<Partial<DashboardMetrics>> {
    try {
      const [usersResult, officersResult] = await Promise.allSettled([
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase
          .from('user_profiles')
          .select('id', { count: 'exact', head: true })
          .in('role', ['troll_officer', 'lead_troll_officer', 'officer', 'lead_officer']),
      ])

      let totalUsers = 0
      let trollOfficers = 0

      if (usersResult.status === 'fulfilled') {
        totalUsers = usersResult.value.count || 0
      }

      if (officersResult.status === 'fulfilled') {
        trollOfficers = officersResult.value.count || 0
      }

      return { totalUsers, trollOfficers, pendingApplications: 0 }
    } catch (err) {
      console.error('[AdminDashboardMetrics] Failed to load user metrics:', err)
      return {}
    }
  }

  async function loadStreamMetrics(): Promise<Partial<DashboardMetrics>> {
    try {
      const { count, error } = await supabase
        .from('streams')
        .select('id', { count: 'exact', head: true })
        .or('is_live.eq.true,status.eq.live')

      if (error) throw error

      return { activeStreams: count || 0 }
    } catch (err) {
      console.error('[AdminDashboardMetrics] Failed to load stream metrics:', err)
      return {}
    }
  }

  async function loadCoinsInCirculation(): Promise<Partial<DashboardMetrics>> {
    try {
      const { data, error } = await supabase.rpc('get_admin_dashboard_metrics_v1')
      if (!error && data && typeof data === 'object') {
        return {
          coinsInCirculation: Number(data.coins_in_circulation || 0),
          coinRevenue: Number(data.coin_revenue || 0),
          coinsSold: Number(data.coins_sold || 0),
          platformProfit: Number(data.platform_profit || 0),
          totalUsers: Number(data.total_users || 0),
          trollOfficers: Number(data.troll_officer_count || 0),
        }
      }
      // Fallback: use the finance summary view if RPC not yet deployed
      try {
        const { data: viewData } = await supabase
          .from('admin_finance_summary')
          .select('total_troll_coins')
          .maybeSingle()
        if (viewData?.total_troll_coins != null) {
          return { coinsInCirculation: Number(viewData.total_troll_coins) }
        }
      } catch { /* view may not exist */ }
      // Last resort: sum from user_profiles (limited)
      const { data: profData } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .limit(1000)
      if (profData) {
        const total = profData.reduce((s: number, r: any) => s + (r.troll_coins || 0), 0)
        return { coinsInCirculation: total }
      }
      return {}
    } catch (err) {
      console.error('[AdminDashboardMetrics] Failed to load coins in circulation:', err)
      return {}
    }
  }

  useEffect(() => {
    loadMetrics()

    // SAFETY: reduced from 60s to 5min to avoid repeated heavy queries
    const interval = setInterval(loadMetrics, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [loadMetrics])

  return { metrics, loading, error, refreshMetrics: loadMetrics }
}