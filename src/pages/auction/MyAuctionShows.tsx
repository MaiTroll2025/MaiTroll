import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  CheckCircle,
  Clock3,
  DollarSign,
  Eye,
  Gavel,
  Layers,
  List,
  Play,
  Plus,
  RefreshCw,
  Tag,
  Users,
  XCircle,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'

interface AuctionShow {
  id: string
  title: string
  description: string
  category: string
  thumbnail_url: string
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'
  scheduled_for: string
  live_started_at: string
  ended_at: string
  livekit_room_name: string
  created_at: string
  lot_count?: number
  total_bids?: number
  total_sales?: number
  auctioneer?: {
    user_id: string
    display_name?: string
  }
}

export default function MyAuctionShows() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [shows, setShows] = useState<AuctionShow[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuctioneer, setIsAuctioneer] = useState(false)

  const stats = useMemo(() => {
    return {
      total: shows.length,
      live: shows.filter((show) => show.status === 'live').length,
      scheduled: shows.filter((show) => show.status === 'scheduled').length,
      sales: shows.reduce((sum, show) => sum + Number(show.total_sales || 0), 0),
    }
  }, [shows])

  const fetchShows = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const { data: auctioneerData } = await supabase
        .from('auctioneer_profiles')
        .select('id, user_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      setIsAuctioneer(Boolean(auctioneerData))

      let query = supabase
        .from('auction_shows')
        .select('*')
        .order('created_at', { ascending: false })

      if (auctioneerData?.id) {
        query = query.eq('auctioneer_id', auctioneerData.id)
      } else {
        query = query.limit(20)
      }

      const { data, error } = await query
      if (error) throw error

      const showsWithStats = await Promise.all(
        (data || []).map(async (show) => {
          const [lotCount, bidCount, salesResult] = await Promise.all([
            supabase
              .from('auction_lots')
              .select('*', { count: 'exact', head: true })
              .eq('auction_show_id', show.id),
            supabase
              .from('auction_bids')
              .select('*', { count: 'exact', head: true })
              .eq('auction_show_id', show.id),
            supabase
              .from('auction_wins')
              .select('final_bid')
              .eq('auction_show_id', show.id),
          ])

          const totalSales =
            salesResult.data?.reduce((sum, win) => sum + Number(win.final_bid || 0), 0) || 0

          return {
            ...show,
            lot_count: lotCount.count || 0,
            total_bids: bidCount.count || 0,
            total_sales: totalSales,
          }
        })
      )

      setShows(showsWithStats)
    } catch (error) {
      console.error('Error fetching auction shows:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchShows()
  }, [fetchShows])

  return (
    <main className="min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(168,85,247,0.13),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(236,72,153,0.08),transparent_36%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.035)_1px,transparent_1px)] bg-[size:52px_52px]" />
      </div>

      <section className="relative z-10 mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8">
        <header className="rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.12)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                <Gavel className="h-4 w-4" />
                Mai Troll Auction Network
              </div>

              <h1 className="text-4xl font-black tracking-tight md:text-6xl">
                My Auction
                <span className="block bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                  Shows
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
                {isAuctioneer
                  ? 'Manage your auction shows, lots, bids, sales, and live auction events.'
                  : 'Browse live, scheduled, and completed Mai Troll auction shows.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon={List} label="Shows" value={stats.total} />
              <StatCard icon={Play} label="Live" value={stats.live} danger />
              <StatCard icon={Calendar} label="Upcoming" value={stats.scheduled} />
              <StatCard icon={DollarSign} label="Sales" value={`${stats.sales.toLocaleString()} TC`} accent="green" />
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 p-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm font-bold text-slate-400">
              {isAuctioneer ? 'Auctioneer mode enabled' : 'Viewer browse mode'}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={fetchShows}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              {isAuctioneer && (
                <button
                  type="button"
                  onClick={() => navigate('/auctions/studio')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.24)] transition hover:bg-cyan-300"
                >
                  <Plus className="h-4 w-4" />
                  Auction Studio
                </button>
              )}
            </div>
          </div>
        </section>

        {loading ? (
          <LoadingState />
        ) : shows.length === 0 ? (
          <EmptyState isAuctioneer={isAuctioneer} onCreate={() => navigate('/auctions/studio')} />
        ) : (
          <section className="space-y-4">
            {shows.map((show) => (
              <AuctionShowRow
                key={show.id}
                show={show}
                onOpen={() => navigate(`/auctions/${show.id}`)}
              />
            ))}
          </section>
        )}
      </section>
    </main>
  )
}

function AuctionShowRow({
  show,
  onOpen,
}: {
  show: AuctionShow
  onOpen: () => void
}) {
  const live = show.status === 'live'

  return (
    <article
      onClick={onOpen}
      className={`group cursor-pointer overflow-hidden rounded-[2rem] border bg-slate-950/75 p-4 shadow-[0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-300/40 hover:shadow-[0_0_60px_rgba(34,211,238,0.15)] ${
        live ? 'border-red-400/30' : 'border-cyan-400/15'
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative h-40 overflow-hidden rounded-[1.5rem] border border-cyan-400/15 bg-black/40 md:h-28 md:w-40 md:shrink-0">
          {show.thumbnail_url ? (
            <img
              src={show.thumbnail_url}
              alt={show.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Gavel className="h-10 w-10 text-slate-600" />
            </div>
          )}

          {live && (
            <div className="absolute left-3 top-3 rounded-full border border-red-400/25 bg-red-500/15 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-red-200">
              Live
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="truncate text-2xl font-black text-white">{show.title}</h2>
            <StatusBadge status={show.status} />
          </div>

          {show.description && (
            <p className="mb-4 line-clamp-2 text-sm leading-6 text-slate-400">
              {show.description}
            </p>
          )}

          <div className="flex flex-wrap gap-3 text-sm text-slate-400">
            <Meta icon={Layers} label={`${show.lot_count || 0} lots`} />
            <Meta icon={Users} label={`${show.total_bids || 0} bids`} />
            {show.category && <Meta icon={Tag} label={show.category} />}
            {show.scheduled_for && (
              <Meta icon={Calendar} label={new Date(show.scheduled_for).toLocaleString()} />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/10 px-4 py-3 text-right">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
              Sales
            </p>
            <p className="text-lg font-black text-white">
              {(show.total_sales || 0).toLocaleString()} TC
            </p>
          </div>

          <button
            onClick={(event) => {
              event.stopPropagation()
              onOpen()
            }}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition ${
              live
                ? 'border border-red-300/20 bg-red-500 text-white shadow-[0_0_28px_rgba(239,68,68,0.2)] hover:bg-red-400'
                : 'border border-cyan-300/20 bg-cyan-400 text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.2)] hover:bg-cyan-300'
            }`}
          >
            {live ? <Play className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {live ? 'Join Live' : 'View Show'}
          </button>
        </div>
      </div>
    </article>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  danger,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  danger?: boolean
  accent?: 'green'
}) {
  const style = danger
    ? 'border-red-400/20 bg-red-500/5 text-red-300'
    : accent === 'green'
      ? 'border-emerald-400/20 bg-emerald-500/5 text-emerald-300'
      : 'border-cyan-400/20 bg-cyan-500/5 text-cyan-300'

  return (
    <div className={`rounded-3xl border p-4 ${style}`}>
      <Icon className="mb-3 h-5 w-5" />
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: AuctionShow['status'] }) {
  const config = {
    draft: {
      icon: Clock3,
      className: 'border-slate-400/20 bg-slate-500/10 text-slate-300',
    },
    scheduled: {
      icon: Calendar,
      className: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200',
    },
    live: {
      icon: Play,
      className: 'border-red-400/20 bg-red-500/10 text-red-200',
    },
    ended: {
      icon: CheckCircle,
      className: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    },
    cancelled: {
      icon: XCircle,
      className: 'border-red-900/30 bg-red-950/40 text-red-400',
    },
  }

  const Icon = config[status]?.icon || Clock3

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${config[status]?.className}`}
    >
      <Icon className="h-3 w-3" />
      {status}
    </span>
  )
}

function Meta({
  icon: Icon,
  label,
}: {
  icon: React.ElementType
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/10 bg-black/25 px-3 py-1">
      <Icon className="h-4 w-4 text-cyan-300" />
      {label}
    </span>
  )
}

function LoadingState() {
  return (
    <section className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[2rem] border border-cyan-400/10 bg-slate-950/75 p-4"
        >
          <div className="flex gap-4">
            <div className="h-28 w-40 animate-pulse rounded-[1.5rem] bg-cyan-400/10" />
            <div className="flex-1 space-y-3 py-2">
              <div className="h-5 w-1/2 animate-pulse rounded bg-cyan-400/10" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-cyan-400/10" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-cyan-400/10" />
            </div>
          </div>
        </div>
      ))}
    </section>
  )
}

function EmptyState({
  isAuctioneer,
  onCreate,
}: {
  isAuctioneer: boolean
  onCreate: () => void
}) {
  return (
    <section className="flex min-h-[420px] flex-col items-center justify-center rounded-[2rem] border border-cyan-400/10 bg-slate-950/60 px-6 text-center">
      <List className="mb-5 h-16 w-16 text-slate-600" />

      <h2 className="text-2xl font-black text-white">No Auction Shows Found</h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
        {isAuctioneer
          ? 'Create your first show in Auction Studio and start adding lots.'
          : 'No public auction shows are available right now. Check back soon.'}
      </p>

      {isAuctioneer && (
        <button
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
        >
          <Plus className="h-4 w-4" />
          Go to Auction Studio
        </button>
      )}
    </section>
  )
}