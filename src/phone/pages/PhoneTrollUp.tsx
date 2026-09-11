import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Coins,
  Flame,
  Heart,
  RefreshCw,
  Shield,
  UserPlus,
  Video,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'

type PackageRow = {
  id: string
  slug: string
  name: string
  description: string
  followers_count: number
  likes_count: number
  views_count: number
  coin_price: number
  is_active: boolean
  sort_order: number
}

type CampaignRow = {
  id: string
  purchase_id: string
  owner_user_id: string
  target_user_id: string
  campaign_type: string
  total_units: number
  completed_units: number
  remaining_units: number
  reward_per_unit: number
  status: string
  broadcast_id: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

type SubscriptionRow = {
  id: string
  user_id: string
  package_id: string
  is_active: boolean
  interval: string
  last_charged_at: string | null
  next_charge_at: string
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function progressPct(done: number, total: number) {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)))
}

export default function PhoneTrollUpPage() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuthStore()
  const [packages, setPackages] = useState<PackageRow[]>([])
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([])
  const [purchasing, setPurchasing] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!user?.id) return
    try {
      const [pkgRes, campRes, subRes] = await Promise.all([
        supabase.rpc('get_troll_up_packages'),
        supabase.rpc('get_my_troll_up_campaigns', { p_user_id: user.id }),
        supabase.rpc('get_my_troll_up_subscriptions', { p_user_id: user.id }),
      ])
      if (pkgRes.data) setPackages(pkgRes.data as PackageRow[])
      if (campRes.data) setCampaigns(campRes.data as CampaignRow[])
      if (subRes.data) setSubscriptions(subRes.data as SubscriptionRow[])
    } catch (e) {
      console.error('[PhoneTrollUp] load error', e)
    }
  }, [user?.id])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handlePurchase = useCallback(async (pkg: PackageRow, withAutoPay: boolean) => {
    if (!user?.id) {
      toast.error('You must be logged in to purchase.')
      return
    }
    setPurchasing(pkg.id)
    try {
      const { data, error } = await supabase.rpc('purchase_troll_up', {
        p_package_id: pkg.id,
        p_user_id: user.id,
        p_is_subscription: withAutoPay,
        p_subscription_interval: withAutoPay ? 'week' : null,
      })
      if (error) throw error
      const result = data as any
      if (result?.success) {
        if (withAutoPay) {
          const { error: subError } = await supabase.rpc('create_troll_up_subscription', {
            p_package_id: pkg.id,
            p_user_id: user.id,
          })
          if (subError) console.error('[PhoneTrollUp] subscription error', subError)
        }
        toast.success(`Troll Up ${pkg.name} activated!`)
        await refreshProfile()
        await loadData()
      } else {
        toast.error(result?.error || 'Purchase failed')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Purchase failed')
    } finally {
      setPurchasing(null)
    }
  }, [user?.id, refreshProfile, loadData])

  const handleCancelSubscription = useCallback(async (sub: SubscriptionRow) => {
    try {
      const { error } = await supabase.rpc('cancel_troll_up_subscription', {
        p_subscription_id: sub.id,
        p_user_id: sub.user_id,
      })
      if (error) throw error
      toast.success('Subscription cancelled')
      await loadData()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to cancel subscription')
    }
  }, [loadData])

  const myCoinBalance = useMemo(() => Number(profile?.troll_coins ?? 0), [profile?.troll_coins])

  const campaignByType = useMemo(() => {
    const map: Record<string, CampaignRow> = {}
    for (const c of campaigns) {
      if (c.status === 'ACTIVE') map[c.campaign_type] = c
    }
    return map
  }, [campaigns])

  const activeSub = useMemo(() => subscriptions.find((s) => s.is_active), [subscriptions])

  return (
    <div className="min-h-dvh bg-slate-950 pb-24 text-white">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.22),transparent_42%)]" />

      <div className="relative mx-auto max-w-lg px-4 py-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white drop-shadow-[0_0_14px_rgba(45,212,191,0.45)]">
              Troll Up
            </h1>
            <p className="text-xs text-slate-400">Boost your presence. Get discovered.</p>
          </div>
        </div>

        {/* Balance */}
        <div className="mb-5 rounded-2xl border border-cyan-400/20 bg-slate-950/70 p-4 backdrop-blur-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your Troll Coins</p>
              <p className="text-xl font-black text-cyan-300">{formatCoins(myCoinBalance)}</p>
            </div>
            <Coins className="h-7 w-7 text-cyan-400" />
          </div>
        </div>

        {/* Packages */}
        <section className="mb-8">
          <h2 className="mb-3 text-base font-black uppercase tracking-tight text-white">Packages</h2>
          <div className="space-y-3">
            {packages.map((pkg) => {
              const followCamp = campaignByType['follow']
              const likeCamp = campaignByType['like']
              const viewCamp = campaignByType['view']
              const canAfford = myCoinBalance >= pkg.coin_price
              const isPurchasing = purchasing === pkg.id

              return (
                <div key={pkg.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-2xl">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-400" />
                      <h3 className="text-sm font-black uppercase text-white">{pkg.name}</h3>
                    </div>
                    <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-black text-cyan-300">
                      {formatCoins(pkg.coin_price)} coins
                    </span>
                  </div>
                  <p className="mb-3 text-[11px] text-slate-400">{pkg.description}</p>

                  <div className="mb-3 space-y-1.5 text-[11px]">
                    {pkg.followers_count > 0 && (
                      <div className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                        <span className="flex items-center gap-2 text-slate-300">
                          <UserPlus className="h-3 w-3 text-cyan-400" /> Followers
                        </span>
                        <span className="font-black text-white">
                          {followCamp ? `${followCamp.completed_units}/${followCamp.total_units}` : `0/${pkg.followers_count}`}
                        </span>
                      </div>
                    )}
                    {pkg.likes_count > 0 && (
                      <div className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                        <span className="flex items-center gap-2 text-slate-300">
                          <Heart className="h-3 w-3 text-pink-400" /> Likes
                        </span>
                        <span className="font-black text-white">
                          {likeCamp ? `${likeCamp.completed_units}/${likeCamp.total_units}` : `0/${pkg.likes_count}`}
                        </span>
                      </div>
                    )}
                    {pkg.views_count > 0 && (
                      <div className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                        <span className="flex items-center gap-2 text-slate-300">
                          <Video className="h-3 w-3 text-emerald-400" /> Views
                        </span>
                        <span className="font-black text-white">
                          {viewCamp ? `${viewCamp.completed_units}/${viewCamp.total_units}` : `0/${pkg.views_count}`}
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    disabled={!canAfford || isPurchasing}
                    onClick={() => handlePurchase(pkg, false)}
                    className={cn(
                      'w-full rounded-xl py-2.5 text-xs font-black transition-all',
                      canAfford
                        ? 'border border-cyan-400/40 bg-gradient-to-r from-purple-700 via-cyan-500 to-pink-500 text-white shadow-[0_0_18px_rgba(45,212,191,0.25)]'
                        : 'cursor-not-allowed border border-white/10 bg-white/[0.04] text-slate-500',
                    )}
                  >
                    {isPurchasing ? 'Processing...' : canAfford ? 'TROLL UP' : 'Insufficient Coins'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-8">
          <h2 className="mb-3 text-base font-black uppercase tracking-tight text-white">How It Works</h2>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-2xl">
            <div className="space-y-2.5 text-[11px] text-slate-300">
              <p>💸 <span className="font-black text-white">Spend Troll Coins</span> — Pick a package and coins get deducted instantly. No PayPal, no cash, just coins.</p>
              <p>🚀 <span className="font-black text-white">Get Real Engagement</span> — Real MaiTroll users see your campaign and complete actions: follows, likes, and views. No bots, no fake accounts.</p>
              <p>🎁 <span className="font-black text-white">Users Get Rewarded</span> — Follows = +5 coins, likes = +1 coin, views = +10 coins. They win, you win.</p>
              <p>📈 <span className="font-black text-white">Watch It Grow</span> — Track your progress in real time on this page. Server-side and legit.</p>
              <p>🔁 <span className="font-black text-white">Auto Pay (Optional)</span> — Auto-pay coins every week to keep it going. Toggle on and forget it. Cancel whenever.</p>
            </div>
          </div>
        </section>

        {/* Auto Pay */}
        <section className="mb-8">
          <h2 className="mb-3 text-base font-black uppercase tracking-tight text-white">Auto Pay</h2>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-2xl">
            <div className="mb-3 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-black uppercase text-white">Weekly Auto Pay</h3>
            </div>
            <p className="mb-3 text-[11px] text-slate-400">
              Automatically pay Troll Coins every week to keep your Troll Up active. Cancel anytime.
            </p>
            <div className="mb-3 flex items-center gap-3">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={!!activeSub}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const first = packages[0]
                      if (first) void handlePurchase(first, true)
                    } else if (activeSub) {
                      void handleCancelSubscription(activeSub)
                    }
                  }}
                  className="peer sr-only"
                />
                <div className="h-6 w-11 rounded-full border border-white/20 bg-white/10 peer-checked:border-cyan-400 peer-checked:bg-cyan-500/30 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-white/30 after:bg-white after:transition-all after:peer-checked:translate-x-full" />
              </label>
              <span className="text-xs font-bold text-slate-300">
                {activeSub ? 'Auto Pay Active' : 'Auto Pay Off'}
              </span>
            </div>
            {activeSub && (
              <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2.5 text-[11px] text-slate-400">
                Next auto charge in 7 days. Package: {packages.find((p) => p.id === activeSub.package_id)?.name || 'Unknown'}
              </div>
            )}
          </div>
        </section>

        {/* No Refunds */}
        <section className="mb-8">
          <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-4">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-4 w-4 text-red-400" />
              <div>
                <h3 className="text-xs font-black uppercase text-red-300">No Refunds</h3>
                <p className="mt-1 text-[11px] text-red-200/80">
                  All Troll Up purchases are final. Troll Coins spent are non-refundable. Review before purchasing.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* My Campaigns */}
        <section className="mb-8">
          <h2 className="mb-3 text-base font-black uppercase tracking-tight text-white">My Troll Up</h2>
          {campaigns.length === 0 ? (
            <p className="text-xs text-slate-500">No active campaigns yet.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((camp) => {
                const pct = progressPct(camp.completed_units, camp.total_units)
                const typeLabel = camp.campaign_type === 'follow' ? 'Followers' : camp.campaign_type === 'like' ? 'Likes' : 'Views'
                const TypeIcon = camp.campaign_type === 'follow' ? UserPlus : camp.campaign_type === 'like' ? Heart : Video
                return (
                  <div key={camp.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-black text-white">
                        <TypeIcon className="h-3.5 w-3.5 text-cyan-400" /> {typeLabel}
                      </span>
                      <span className="text-[10px] font-black text-slate-400">{camp.status}</span>
                    </div>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Progress</span>
                      <span className="font-black text-white">
                        {camp.completed_units.toLocaleString()} / {camp.total_units.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
