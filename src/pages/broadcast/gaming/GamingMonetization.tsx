import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, DollarSign, Gift, TrendingUp, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useGamingStreamId } from '@/contexts/GamingStreamContext'

interface EarningsData {
  streamCoins: number
  totalEarnings: number
  payoutBalance: number
}

export default function GamingMonetization() {
  const streamId = useGamingStreamId()
  const { user } = useAuthStore()
  const [earnings, setEarnings] = useState<EarningsData>({ streamCoins: 0, totalEarnings: 0, payoutBalance: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!streamId) return

    const fetchEarnings = async () => {
      try {
        const { data: stream } = await supabase
          .from('streams')
          .select('total_gifts_coins')
          .eq('id', streamId)
          .maybeSingle()

        const streamCoins = stream?.total_gifts_coins || 0

        let payoutBalance = 0
        if (user?.id) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('coin_balance')
            .eq('id', user.id)
            .maybeSingle()
          payoutBalance = profile?.coin_balance || 0
        }

        setEarnings({
          streamCoins,
          totalEarnings: Math.floor(streamCoins * 0.5),
          payoutBalance,
        })
      } catch (err) {
        console.error('[GamingMonetization] Fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchEarnings()
  }, [streamId, user?.id])

  if (loading) {
    return (
      <div className="grid min-h-[400px] place-items-center">
        <p className="text-sm text-slate-400">Loading earnings...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#05080f] p-4 sm:p-6 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Link to={`/broadcast/setup/gaming`} className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <DollarSign className="h-5 w-5 text-emerald-300" />
          <h1 className="text-xl font-black">Monetization</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
            <Gift className="h-5 w-5 text-amber-400" />
            <p className="mt-2 text-2xl font-black text-white">{earnings.streamCoins.toLocaleString()}</p>
            <p className="text-xs text-slate-400">Coins This Stream</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <p className="mt-2 text-2xl font-black text-white">${earnings.totalEarnings.toLocaleString()}</p>
            <p className="text-xs text-slate-400">Est. Earnings</p>
          </div>
          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4">
            <Wallet className="h-5 w-5 text-cyan-400" />
            <p className="mt-2 text-2xl font-black text-white">{earnings.payoutBalance.toLocaleString()}</p>
            <p className="text-xs text-slate-400">Coin Balance</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-emerald-400/50" />
          <h3 className="mt-4 text-lg font-black text-white">Streaming Revenue</h3>
          <p className="mt-2 text-sm text-slate-400">Earn coins from gifts during your gaming stream. Coins convert to earnings based on the platform rate.</p>
          <p className="mt-4 text-xs text-slate-500">Payouts available once balance reaches minimum threshold</p>
        </div>
      </div>
    </div>
  )
}
