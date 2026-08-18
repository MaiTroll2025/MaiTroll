import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, ExternalLink } from 'lucide-react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { TIERS } from '../config/coinConfig'

interface MAIPayCardProps {
  className?: string
  disableContinue?: boolean
}

// Map the central config tiers to the format expected by this component
const CASHOUT_TIERS = TIERS.map(tier => ({
  coins: tier.coins,
  usd: tier.usd,
}))

function getCashoutEstimate(availableCoins: number) {
  const safeCoins = Math.max(0, Number(availableCoins || 0))

  const eligibleTier =
    [...CASHOUT_TIERS].reverse().find((tier) => safeCoins >= tier.coins) || null

  const nextTier = CASHOUT_TIERS.find((tier) => safeCoins < tier.coins) || null

  return {
    availableCoins: safeCoins,
    estimatedUsd: eligibleTier?.usd || 0,
    eligibleTier,
    nextTier,
    coinsNeededForNextTier: nextTier ? Math.max(0, nextTier.coins - safeCoins) : 0,
    isEligible: Boolean(eligibleTier),
    isMaxTierReached: !nextTier,
  }
}

export default function MAIPayCard({ className, disableContinue = false }: MAIPayCardProps) {
  const { user, profile } = useAuthStore() as any
  const [dbCoins, setDbCoins] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      if (!user?.id) return
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('troll_coins')
          .eq('id', user.id)
          .single()
        setDbCoins(Number(data?.troll_coins ?? 0))
      } catch (err) {
        console.error('[MAIPayCard] Failed to load balances:', err)
      }
    }
    load()
  }, [user?.id])

  const rawCoins = dbCoins ?? Number(profile?.troll_coins || 0)
  const availableCoins = Math.max(0, rawCoins)

  const cashoutEstimate = useMemo(() => {
    return getCashoutEstimate(availableCoins)
  }, [availableCoins])

  const handleContinueToMAIPay = () => {
    if (!user?.id) return

    const maiPayUrl = new URL('https://maicorp.online/mai-pay')
    maiPayUrl.searchParams.set('platform', 'MaiTroll')
    maiPayUrl.searchParams.set('user_id', user.id)
    maiPayUrl.searchParams.set('available_balance', availableCoins.toString())
    maiPayUrl.searchParams.set('estimated_cashout_usd', cashoutEstimate.estimatedUsd.toString())

    if (cashoutEstimate.eligibleTier) {
      maiPayUrl.searchParams.set('eligible_tier_coins', cashoutEstimate.eligibleTier.coins.toString())
      maiPayUrl.searchParams.set('eligible_tier_usd', cashoutEstimate.eligibleTier.usd.toString())
    }

    window.open(maiPayUrl.toString(), '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-cyan-300/15 bg-slate-950/70 p-6 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl',
        className
      )}
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/10">
          <DollarSign className="h-5 w-5 text-cyan-300" />
        </div>
        <div>
          <h3 className="text-lg font-black text-white">MAI Pay</h3>
          <p className="text-xs text-slate-400">Powered by PayPal</p>
        </div>
      </div>

       <div className="mb-6 space-y-3">
         <div className="flex items-center justify-between gap-3">
           <span className="text-sm text-slate-400">Available Payout Coins</span>
           <span className="text-lg font-bold text-cyan-200">
             {availableCoins.toLocaleString()}
           </span>
         </div>

         <div className="flex items-center justify-between gap-3">
           <span className="text-sm text-slate-400">Estimated Cashout</span>
           <span className="text-lg font-bold text-green-400">
             ${cashoutEstimate.estimatedUsd.toLocaleString()}
           </span>
         </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-400">Eligible Tier</span>
          <span className="text-right text-sm font-bold text-cyan-100">
            {cashoutEstimate.eligibleTier
              ? `${cashoutEstimate.eligibleTier.coins.toLocaleString()} coins → $${cashoutEstimate.eligibleTier.usd.toLocaleString()}`
              : 'Not eligible yet'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-400">Next Tier</span>
          <span className="text-right text-sm font-bold text-cyan-100">
            {cashoutEstimate.nextTier
              ? `${cashoutEstimate.nextTier.coins.toLocaleString()} coins → $${cashoutEstimate.nextTier.usd.toLocaleString()}`
              : 'Max tier reached'}
          </span>
        </div>

        {cashoutEstimate.nextTier && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-400">Coins Needed</span>
            <span className="text-right text-sm font-bold text-amber-300">
              {cashoutEstimate.coinsNeededForNextTier.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-950/30 p-3">
        <p className="text-center text-xs text-cyan-200/80">
          Payouts processed on request • Estimated value is based on Mai Troll cashout tiers
        </p>
      </div>

      <button
        onClick={handleContinueToMAIPay}
        disabled={disableContinue || !cashoutEstimate.isEligible}
        className={cn(
          'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-45',
          (disableContinue || !cashoutEstimate.isEligible) && 'cursor-not-allowed opacity-50'
        )}
      >
        Continue to MAI Pay
        <ExternalLink className="h-4 w-4" />
      </button>
    </div>
  )
}