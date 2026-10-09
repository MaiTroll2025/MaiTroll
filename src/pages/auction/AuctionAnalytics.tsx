import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Coins, Gavel, Loader2, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'

import AuctionNav from './AuctionNav'

interface ShowAnalytics {
  show_id: string
  show_title: string
  status: string
  total_lots: number
  sold_lots: number
  unsold_lots: number
  total_bids: number
  total_revenue: number
  avg_sale_price: number
  highest_sale: number
  unique_bidders: number
  started_at: string | null
  ended_at: string | null
  duration_minutes: number | null
}

const shell =
  'relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#07101f] px-3 pb-8 pt-20 text-white sm:px-4 md:px-6'
const panel =
  'rounded-[1.65rem] border border-cyan-300/15 bg-[#0b1628]/85 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'
const panelSoft =
  'rounded-[1.4rem] border border-cyan-300/12 bg-[#0d1a2f]/78 shadow-[0_0_28px_rgba(34,211,238,0.08)] backdrop-blur-xl'

function formatCoins(value: number | null | undefined) {
  return Number(value || 0).toLocaleString()
}

function formatDuration(minutes: number | null | undefined) {
  if (!minutes) return '—'
  const hrs = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins}m`
}

export default function AuctionAnalytics() {
  const { user } = useAuthStore()

  const [analytics, setAnalytics] = useState<ShowAnalytics[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAnalytics = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const { data: auctioneer } = await supabase
        .from('auctioneer_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!auctioneer?.id) {
        setLoading(false)
        return
      }

      const { data: shows } = await supabase
        .from('auction_shows')
        .select('*')
        .eq('auctioneer_id', auctioneer.id)
        .order('created_at', { ascending: false })

      if (!shows || shows.length === 0) {
        setAnalytics([])
        setLoading(false)
        return
      }

      const analyticsData: ShowAnalytics[] = await Promise.all(
        shows.map(async (show) => {
          const { data: lots } = await supabase
            .from('auction_lots')
            .select('id, status, current_highest_bid, starting_bid')
            .eq('auction_show_id', show.id)
            .neq('status', 'removed')

          const { data: bids } = await supabase
            .from('auction_bids')
            .select('id, bidder_id')
            .eq('auction_show_id', show.id)

          const allLots = lots || []
          const soldLots = allLots.filter((l) => l.status === 'sold')
          const unsoldLots = allLots.filter((l) => l.status === 'pass')
          const allBids = bids || []

          const revenue = soldLots.reduce((sum, l) => sum + (l.current_highest_bid || l.starting_bid || 0), 0)
          const highestSale = soldLots.reduce((max, l) => Math.max(max, l.current_highest_bid || l.starting_bid || 0), 0)
          const uniqueBidders = new Set(allBids.map((b) => b.bidder_id)).size

          let duration: number | null = null
          if (show.live_started_at) {
            const end = show.ended_at ? new Date(show.ended_at) : new Date()
            duration = (end.getTime() - new Date(show.live_started_at).getTime()) / 60000
          }

          return {
            show_id: show.id,
            show_title: show.title,
            status: show.status,
            total_lots: allLots.length,
            sold_lots: soldLots.length,
            unsold_lots: unsoldLots.length,
            total_bids: allBids.length,
            total_revenue: revenue,
            avg_sale_price: soldLots.length > 0 ? Math.round(revenue / soldLots.length) : 0,
            highest_sale: highestSale,
            unique_bidders: uniqueBidders,
            started_at: show.live_started_at,
            ended_at: show.ended_at,
            duration_minutes: duration,
          }
        })
      )

      setAnalytics(analyticsData)
    } catch (error: any) {
      console.error('[AuctionAnalytics] Error:', error)
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void fetchAnalytics()
  }, [fetchAnalytics])

  const totals = useMemo(() => {
    return {
      shows: analytics.length,
      totalLots: analytics.reduce((s, a) => s + a.total_lots, 0),
      soldLots: analytics.reduce((s, a) => s + a.sold_lots, 0),
      totalRevenue: analytics.reduce((s, a) => s + a.total_revenue, 0),
      totalBids: analytics.reduce((s, a) => s + a.total_bids, 0),
      uniqueBidders: analytics.reduce((s, a) => s + a.unique_bidders, 0),
      sellThroughRate: analytics.length > 0
        ? Math.round(
            (analytics.reduce((s, a) => s + a.sold_lots, 0) /
              Math.max(1, analytics.reduce((s, a) => s + a.total_lots, 0))) *
              100
          )
        : 0,
    }
  }, [analytics])

  return (
    <div className={shell}>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.15),transparent_32%),radial-gradient(circle_at_75%_20%,rgba(59,130,246,0.12),transparent_26%)]" />

      <main className="relative z-10 mx-auto max-w-[1400px] space-y-4">
        <AuctionNav active="analytics" />

        {/* Header */}
        <header className={cn(panel, 'overflow-hidden p-5')}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-black text-white md:text-4xl">Analytics</h1>
              <p className="mt-1 text-sm text-slate-400">
                Performance overview across all your auction shows.
              </p>
            </div>
          </div>
        </header>

        {/* Summary stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Gavel className="h-5 w-5" />} label="Total Shows" value={totals.shows} />
          <StatCard icon={<Coins className="h-5 w-5" />} label="Total Revenue" value={`${formatCoins(totals.totalRevenue)}`} accent="text-emerald-200" />
          <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Sell-Through Rate" value={`${totals.sellThroughRate}%`} accent="text-cyan-200" />
          <StatCard icon={<Users className="h-5 w-5" />} label="Total Bidders" value={totals.uniqueBidders} />
        </div>

        {/* Per-show breakdown */}
        <div className={cn(panel, 'p-4')}>
          <h2 className="mb-4 text-lg font-black text-white">Show Performance</h2>

          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
            </div>
          ) : analytics.length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center text-center">
              <div>
                <BarChart3 className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                <p className="font-black text-white">No data yet</p>
                <p className="mt-2 text-sm text-slate-500">Analytics will appear after your first show.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="pb-3 pr-4">Show</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4 text-right">Lots</th>
                    <th className="pb-3 pr-4 text-right">Sold</th>
                    <th className="pb-3 pr-4 text-right">Bids</th>
                    <th className="pb-3 pr-4 text-right">Revenue</th>
                    <th className="pb-3 pr-4 text-right">Avg Sale</th>
                    <th className="pb-3 pr-4 text-right">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.map((a) => (
                    <tr key={a.show_id} className="border-b border-white/5 text-sm">
                      <td className="py-3 pr-4 font-bold text-white">{a.show_title}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px] font-black uppercase',
                            a.status === 'live'
                              ? 'border-red-300/30 bg-red-500/10 text-red-100'
                              : a.status === 'ended'
                              ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
                              : 'border-slate-400/30 bg-slate-500/10 text-slate-200'
                          )}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right text-slate-300">{a.total_lots}</td>
                      <td className="py-3 pr-4 text-right font-bold text-emerald-200">
                        {a.sold_lots}/{a.total_lots}
                      </td>
                      <td className="py-3 pr-4 text-right text-slate-300">{a.total_bids}</td>
                      <td className="py-3 pr-4 text-right font-bold text-cyan-100">{formatCoins(a.total_revenue)}</td>
                      <td className="py-3 pr-4 text-right text-slate-300">{formatCoins(a.avg_sale_price)}</td>
                      <td className="py-3 pr-4 text-right text-slate-400">{formatDuration(a.duration_minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  accent = 'text-cyan-100',
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  accent?: string
}) {
  return (
    <div className={cn(panelSoft, 'p-4')}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-400/10 text-cyan-200">
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-black', accent)}>{value}</p>
    </div>
  )
}
