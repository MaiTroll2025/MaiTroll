import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { ArrowLeft, Coins, History, TrendingUp, Users, DollarSign, Crown, ShoppingCart, Car, Home, MessageSquare, Gift as GiftIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface LedgerEntry {
  id: string
  amount: number
  reason: string
  ref_user_id: string | null
  created_at: string
  source_type: string | null
  streamer_id: string | null
  username?: string
  avatar_url?: string
}

interface RevenueSource {
  label: string
  icon: React.ReactNode
  coins: number
  usd: number
  color: string
}

export default function AdminPoolPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [poolBalance, setPoolBalance] = useState<number>(0)
  const [totalLiability, setTotalLiability] = useState<number>(0)
  const [totalPaidUsd, setTotalPaidUsd] = useState<number>(0)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [revenueSources, setRevenueSources] = useState<RevenueSource[]>([])
  const [totalSubRevenue, setTotalSubRevenue] = useState<number>(0)
  const [totalChatRevenue, setTotalChatRevenue] = useState<number>(0)
  const [totalGiftRevenue, setTotalGiftRevenue] = useState<number>(0)
  const [totalPropertyRevenue, setTotalPropertyRevenue] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPoolData = async () => {
    try {
      const { data: poolRow } = await supabase
        .from('admin_pool')
        .select('trollcoins_balance, total_liability_coins, total_paid_usd')
        .maybeSingle()

      if (poolRow) {
        setPoolBalance(Number(poolRow.trollcoins_balance || 0))
        setTotalLiability(Number(poolRow.total_liability_coins || 0))
        setTotalPaidUsd(Number(poolRow.total_paid_usd || 0))
      }

      const { data: ledgerRows } = await supabase
        .from('admin_pool_ledger')
        .select('id, amount, reason, ref_user_id, created_at, source_type, streamer_id')
        .order('created_at', { ascending: false })
        .limit(100)

      if (ledgerRows && ledgerRows.length > 0) {
        const userIds = [...new Set(ledgerRows.map(r => r.ref_user_id).filter(Boolean))]
        let userMap: Record<string, { username?: string; avatar_url?: string }> = {}

        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url')
            .in('id', userIds)

          if (profiles) {
            for (const p of profiles) {
              userMap[p.id] = { username: p.username, avatar_url: p.avatar_url }
            }
          }
        }

        setLedger(ledgerRows.map(r => ({
          ...r,
          amount: Number(r.amount),
          username: userMap[r.ref_user_id || '']?.username,
          avatar_url: userMap[r.ref_user_id || '']?.avatar_url,
        })))
      } else {
        setLedger(ledgerRows?.map(r => ({ ...r, amount: Number(r.amount) })) || [])
      }

      const { data: subRevenue } = await supabase
        .from('subscription_revenue_log')
        .select('amount_coins')
        .eq('status', 'completed')

      let subTotal = 0
      if (subRevenue) {
        for (const r of subRevenue) {
          subTotal += Number(r.amount_coins || 0)
        }
      }
      setTotalSubRevenue(subTotal)

      const { data: chatRows } = await supabase
        .from('admin_pool_ledger')
        .select('amount')
        .eq('source_type', 'chat_revenue')
      let chatTotal = 0
      if (chatRows) {
        for (const r of chatRows) chatTotal += Number(r.amount || 0)
      }
      setTotalChatRevenue(chatTotal)

      const { data: giftRows } = await supabase
        .from('admin_pool_ledger')
        .select('amount')
        .ilike('reason', '%gift%')
      let giftTotal = 0
      if (giftRows) {
        for (const r of giftRows) giftTotal += Number(r.amount || 0)
      }
      setTotalGiftRevenue(giftTotal)

      const { data: propertyRows } = await supabase
        .from('admin_pool_ledger')
        .select('amount')
        .ilike('reason', '%property%')
      let propertyTotal = 0
      if (propertyRows) {
        for (const r of propertyRows) propertyTotal += Number(r.amount || 0)
      }
      setTotalPropertyRevenue(propertyTotal)

      const usdPerCoin = 25 / 12000

      setRevenueSources([
        {
          label: 'Creator Subscriptions',
          icon: <Crown className="w-4 h-4" />,
          coins: subTotal,
          usd: subTotal * usdPerCoin,
          color: 'text-cyan-400',
        },
        {
          label: 'Paid Chat Revenue',
          icon: <MessageSquare className="w-4 h-4" />,
          coins: chatTotal,
          usd: chatTotal * usdPerCoin,
          color: 'text-purple-400',
        },
        {
          label: 'Gift Fees',
          icon: <GiftIcon className="w-4 h-4" />,
          coins: giftTotal,
          usd: giftTotal * usdPerCoin,
          color: 'text-pink-400',
        },
        {
          label: 'Property Sales',
          icon: <Home className="w-4 h-4" />,
          coins: propertyTotal,
          usd: propertyTotal * usdPerCoin,
          color: 'text-amber-400',
        },
      ])
    } catch (err) {
      console.error('Error fetching admin pool:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchPoolData()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchPoolData()
  }

  const formatCoins = (n: number) => Number(n || 0).toLocaleString()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-zinc-500">Loading admin pool...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-black">Admin Pool</h1>
              <p className="text-sm text-zinc-500">Platform fee collection & management</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-sm disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-amber-500/10">
                <Coins className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-sm text-zinc-400">Pool Balance</span>
            </div>
            <p className="text-3xl font-black text-amber-300">{formatCoins(poolBalance)}</p>
            <p className="text-xs text-zinc-500 mt-1">Troll Coins</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-cyan-500/10">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-sm text-zinc-400">Total Liability</span>
            </div>
            <p className="text-3xl font-black text-cyan-300">{formatCoins(totalLiability)}</p>
            <p className="text-xs text-zinc-500 mt-1">Coins owed to users</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-green-500/10">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-sm text-zinc-400">Total Paid Out</span>
            </div>
            <p className="text-3xl font-black text-green-300">${totalPaidUsd.toFixed(2)}</p>
            <p className="text-xs text-zinc-500 mt-1">USD</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-bold">Revenue Sources</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {revenueSources.map((src) => (
              <div key={src.label} className="rounded-xl border border-white/5 bg-black/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={src.color}>{src.icon}</span>
                  <span className="text-xs text-zinc-400">{src.label}</span>
                </div>
                <p className={`text-lg font-black ${src.color}`}>{formatCoins(src.coins)}</p>
                <p className="text-xs text-zinc-500">${src.usd.toFixed(2)} USD</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <History className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-bold">Transaction History</h2>
          </div>

          {ledger.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">No transactions yet.</div>
          ) : (
            <div className="space-y-2">
              {ledger.map(entry => (
                <div key={entry.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 p-4">
                  <div className="flex items-center gap-3">
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                        <Users className="w-4 h-4 text-zinc-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-white">{entry.reason}</p>
                      <p className="text-xs text-zinc-500">
                        {entry.username ? `@${entry.username}` : entry.ref_user_id ? entry.ref_user_id.slice(0, 8) : 'System'}
                        {entry.source_type ? ` · ${entry.source_type}` : ''}
                        {' · '}{new Date(entry.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${entry.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {entry.amount >= 0 ? '+' : ''}{formatCoins(entry.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
