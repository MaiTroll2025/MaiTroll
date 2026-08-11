import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { reportSupabaseError } from '../lib/bugReporter'
import { usePageVisibilityContext } from '../contexts/PageVisibilityContext'

// Types for finance data
export interface FinanceSummary {
  users: {
    totalUsers: number
    adminsCount: number
    pendingApps: number
    pendingPayouts: number
    trollOfficers: number
    aiFlags: number
  }
  economy: {
    coinSalesRevenue: number
    totalPayouts: number
    feesCollected: number
    platformProfit: number
    purchasedCoins: number
    earnedCoins: number
    freeCoins: number
    totalCoinsInCirculation: number
    totalValue: number
    giftCoins: number
    appSponsoredGifts: number
    savPromoCount: number
  }
  financial: {
    total_liability_coins: number
    total_platform_profit_usd: number
    kick_ban_revenue: number
  }
  lastUpdated: string
}

export interface Transaction {
  id: string
  user_id: string
  transaction_type: string
  amount: number
  description: string
  payment_method?: string
  external_transaction_id?: string
  metadata?: any
  created_at: string
}

export interface CoinTransaction {
  id: string
  user_id: string
  type: string
  amount: number
  description: string
  platform_profit_usd?: number
  metadata?: any
  created_at: string
}

export interface PayoutRequest {
  id: string
  user_id: string
  amount: number
  status: string
  created_at: string
}

export interface Cashout {
  id: string
  user_id: string
  amount?: number
  requested_coins?: number
  coin_amount?: number
  requested_amount?: number
  status: string
  created_at: string
}

// Hook for admin finance realtime data
export function useAdminFinanceRealtime() {
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  // Main finance summary query from view
  const {
    data: financeSummary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary
  } = useQuery({
    queryKey: ['admin-finance-summary'],
    queryFn: async (): Promise<FinanceSummary> => {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_admin_finance_summary_live')

      if (!rpcError && rpcData?.success) {
        const data = rpcData
        return {
          users: {
            totalUsers: data.total_users || 0,
            adminsCount: data.admin_count || 0,
            pendingApps: data.pending_applications || 0,
            pendingPayouts: data.pending_payouts || 0,
            trollOfficers: data.troll_officer_count || 0,
            aiFlags: data.ai_flag_count || 0,
          },
          economy: {
            coinSalesRevenue: Number(data.coin_sales_revenue || 0),
            totalPayouts: Number(data.total_payouts || 0),
            feesCollected: Number(data.fees_collected || 0),
            platformProfit: Number(data.platform_profit || 0),
            purchasedCoins: Number(data.purchased_coins || 0),
            earnedCoins: Number(data.earned_coins || 0),
            totalCoinsInCirculation: Number(data.total_troll_coins || 0),
            totalValue: Number(data.total_troll_coins || 0) / 100,
             giftCoins: Number(data.gift_coins || 0),
             appSponsoredGifts: Number(data.app_sponsored_gifts || 0),
             freeCoins: Number((data as any).free_coins || 0),
             savPromoCount: 0,
          },
          financial: {
            total_liability_coins: Number(data.total_liability_coins || 0),
            total_platform_profit_usd: Number(data.platform_profit || 0),
            kick_ban_revenue: Number(data.kick_ban_revenue || 0),
          },
          lastUpdated: data.last_updated || new Date().toISOString(),
        }
      }

      if (rpcError) {
        reportSupabaseError(rpcError, { action: 'rpc', functionName: 'get_admin_finance_summary_live', source: 'admin' })
      }

      const { data, error } = await supabase
        .from('admin_finance_summary')
        .select('*')
        .single()
      if (error) {
        reportSupabaseError(error, { table: 'admin_finance_summary', action: 'select', source: 'admin' })
        throw error
      }

      // Transform view data to FinanceSummary interface
      return {
        users: {
          totalUsers: data.total_users || 0,
          adminsCount: data.admin_count || 0,
          pendingApps: data.pending_applications || 0,
          pendingPayouts: data.pending_payouts || 0,
          trollOfficers: data.troll_officer_count || 0,
          aiFlags: data.ai_flag_count || 0,
        },
        economy: {
          coinSalesRevenue: data.coin_sales_revenue || 0,
          totalPayouts: data.total_payouts || 0,
          feesCollected: data.fees_collected || 0,
          platformProfit: data.platform_profit || 0,
          purchasedCoins: data.purchased_coins || 0,
          earnedCoins: data.earned_coins || 0,
          freeCoins: data.free_coins || 0,
          totalCoinsInCirculation: data.total_troll_coins || 0, // Using troll_coins as circulation
          totalValue: (data.total_troll_coins || 0) / 100, // Assuming $1 = 100 coins
          giftCoins: data.gift_coins || 0,
          appSponsoredGifts: data.app_sponsored_gifts || 0,
          savPromoCount: 0, // Not in view, can add later if needed
        },
        financial: {
          total_liability_coins: data.total_liability_coins || 0,
          total_platform_profit_usd: data.platform_profit || 0,
          kick_ban_revenue: 0, // Not in view, can add later if needed
        },
        lastUpdated: data.last_updated || new Date().toISOString(),
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // 30 seconds
  })

  // Finance feed query from view
  const {
    data: financeFeed,
    isLoading: feedLoading,
    refetch: refetchFeed
  } = useQuery({
    queryKey: ['admin-finance-feed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_finance_feed')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        reportSupabaseError(error, { table: 'admin_finance_feed', action: 'select', source: 'admin' })
        throw error
      }
      return data || []
    },
    staleTime: 1 * 60 * 1000,
  })

  // Separate queries for detailed data if needed
  const transactions = financeFeed?.filter(item => item.record_type === 'transaction') || []
  const coinTransactions = financeFeed?.filter(item => item.record_type === 'coin_transaction') || []

  // Payout requests query
  const {
    data: payoutRequests,
    isLoading: payoutRequestsLoading,
    refetch: refetchPayoutRequests
  } = useQuery({
    queryKey: ['admin-payout-requests'],
    queryFn: async (): Promise<PayoutRequest[]> => {
      const { data, error } = await supabase
        .from('payout_requests')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        reportSupabaseError(error, { table: 'payout_requests', action: 'select', source: 'admin' })
        throw error
      }
      return data || []
    },
    staleTime: 1 * 60 * 1000,
  })

  // Cashouts query. Uses the unified payout_requests table (Fast Pay / MAI Pay).
  const {
    data: cashouts,
    isLoading: cashoutsLoading,
    refetch: refetchCashouts
  } = useQuery({
    queryKey: ['admin-cashouts'],
    queryFn: async (): Promise<Cashout[]> => {
      const { data, error } = await supabase
        .from('payout_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) {
        reportSupabaseError(error, { table: 'payout_requests', action: 'select', source: 'admin' })
        throw error
      }
      return data || []
    },
    staleTime: 1 * 60 * 1000,
  })

  const { isVisible } = usePageVisibilityContext()

  // Admin finance is not a hot-path realtime surface. Poll instead of opening
  // broad listeners on transaction, cashout, and profile tables.
  useEffect(() => {
    setIsConnected(isVisible)
    if (!isVisible) {
      return () => {
        setIsConnected(false)
      }
    }

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['admin-finance-summary'] })
      queryClient.invalidateQueries({ queryKey: ['admin-finance-feed'] })
      queryClient.invalidateQueries({ queryKey: ['admin-payout-requests'] })
      queryClient.invalidateQueries({ queryKey: ['admin-cashouts'] })
      setLastSync(new Date())
    }
    // SAFETY: reduced from 60s to 5min — admin finance is not a hot-path surface
    const interval = window.setInterval(refresh, 5 * 60 * 1000)

    return () => {
      window.clearInterval(interval)
      setIsConnected(false)
    }
  }, [queryClient, isVisible])

  // Manual refresh function
  const refreshFinance = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-finance-summary'] })
    queryClient.invalidateQueries({ queryKey: ['admin-finance-feed'] })
    queryClient.invalidateQueries({ queryKey: ['admin-payout-requests'] })
    queryClient.invalidateQueries({ queryKey: ['admin-cashouts'] })
    setLastSync(new Date())
  }

  // Reconciliation check
  const checkReconciliation = () => {
    if (!financeSummary || !coinTransactions || !payoutRequests) return null
    if (coinTransactions.length === 0 && payoutRequests.length === 0) return null

    // Check if coin_transactions totals match summary
    const getCoinType = (tx: any) => tx.type || tx.transaction_type || tx.record_subtype || ''
    const ledgerPurchases = coinTransactions
      .filter(tx => ['purchase', 'store_purchase', 'paypal_purchase', 'coin_purchase'].includes(getCoinType(tx)))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0)

    const summaryPurchasedCoins = financeSummary.economy.purchasedCoins
    const purchasesMatch = ledgerPurchases === 0 || summaryPurchasedCoins === 0 || Math.abs(ledgerPurchases - summaryPurchasedCoins) < Math.max(1, summaryPurchasedCoins * 0.05)

    // Check payouts
    const actualPayouts = payoutRequests
      .filter(p => ['paid', 'approved', 'completed'].includes(p.status))
      .reduce((sum, p) => sum + (p.amount || 0), 0)

    const summaryPayouts = financeSummary.economy.totalPayouts
    const payoutsMatch = actualPayouts === 0 || summaryPayouts === 0 || Math.abs(actualPayouts - summaryPayouts) < Math.max(1, summaryPayouts * 0.05)

    // The finance feed can be a filtered/recent ledger, so only compare balances
    // when it clearly contains a whole-ledger snapshot.
    const ledgerBalance = coinTransactions
      .reduce((sum, tx) => {
        const txType = getCoinType(tx)
        if (['purchase', 'store_purchase', 'earning', 'free', 'gift', 'gift_received', 'reward', 'bonus', 'daily_login', 'admin_grant'].includes(txType)) {
          return sum + (tx.amount || 0)
        } else if (['cashout', 'payout', 'withdrawal'].includes(txType)) {
          return sum - (tx.amount || 0)
        }
        return sum
      }, 0)

    const profileBalance = financeSummary.financial.total_liability_coins
    const hasFullLedgerSnapshot = coinTransactions.length >= 500 || Math.abs(ledgerBalance) >= profileBalance * 0.75
    const balancesMatch = !hasFullLedgerSnapshot || profileBalance === 0 || Math.abs(ledgerBalance - profileBalance) < Math.max(1, profileBalance * 0.10)

    return {
      purchasesMatch,
      payoutsMatch,
      balancesMatch,
      discrepancies: {
        purchases: ledgerPurchases - summaryPurchasedCoins,
        payouts: actualPayouts - summaryPayouts,
        balances: ledgerBalance - profileBalance,
      }
    }
  }

  const reconciliation = checkReconciliation()

  return {
    // Data
    financeSummary,
    financeFeed,
    transactions,
    coinTransactions,
    payoutRequests,
    cashouts,

    // Loading states
    isLoading: summaryLoading || feedLoading || payoutRequestsLoading || cashoutsLoading,
    summaryLoading,
    feedLoading,
    payoutRequestsLoading,
    cashoutsLoading,

    // Errors
    summaryError,

    // Realtime status
    isConnected,
    lastSync,

    // Actions
    refreshFinance,
    refetchSummary,
    refetchFeed,
    refetchPayoutRequests,
    refetchCashouts,

    // Reconciliation
    reconciliation,
  }
}
