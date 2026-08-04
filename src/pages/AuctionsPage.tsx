import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Calendar,
  ChevronRight,
  Clock,
  Coins,
  Eye,
  Filter,
  Gavel,
  Loader2,
  Play,
  RefreshCw,
  Scan,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Video,
  Zap,
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import useSEO from '@/hooks/useSEO';

interface AuctionShow {
  id: string
  title: string
  description: string | null
  category: string | null
  thumbnail_url: string | null
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'
  scheduled_for: string | null
  live_started_at: string | null
  ended_at: string | null
  livekit_room_name: string | null
  is_featured: boolean
  auctioneer_id: string
  current_lot_id: string | null
  created_at: string
  current_lot?: {
    id: string
    title: string
    current_highest_bid: number
    starting_bid: number
    status: string
    countdown_end_at: string
  }
}

type TabType = 'live' | 'ended'

const BID_MINIMUM_COINS = 500

const categoryFallbacks = [
  'all',
  'Electronics',
  'Gaming',
  'Computers',
  'Cameras',
  'Collectibles',
  'Sports',
]

const shell =
  'relative min-h-screen overflow-y-auto bg-[#07091c] px-3 pb-10 pt-24 text-white sm:px-4 md:px-6'

const panel =
  'rounded-[2rem] border border-cyan-300/15 bg-[#0a1024]/82 shadow-[0_0_52px_rgba(34,211,238,0.12)] backdrop-blur-2xl'

const card =
  'rounded-[1.5rem] border border-cyan-300/14 bg-[#0c142b]/82 shadow-[0_0_30px_rgba(34,211,238,0.08)] backdrop-blur-xl'

const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-200/45 bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_0_36px_rgba(34,211,238,0.38)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50'

const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/22 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-400/18 hover:text-white active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50'

const darkButton =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-3 text-sm font-black text-slate-200 transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-100 active:translate-y-0'

const input =
  'w-full rounded-2xl border border-cyan-300/18 bg-[#070b1b]/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/15'

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString()
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not scheduled'

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return 'Not scheduled'
  }
}

function formatTime(value: string | null | undefined) {
  if (!value) return 'Live now'

  try {
    return new Date(value).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Live now'
  }
}

export default function AuctionsPage() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { isMobileWidth } = useIsMobile()

  const isAuctioneer =
    profile?.role === 'auctioneer' ||
    profile?.troll_role === 'auctioneer' ||
    !!(profile as any)?.is_auctioneer ||
    !!(profile as any)?.is_admin

  useSEO({
    title: 'Live Auctions | Mai Troll - Bid Online & Win',
    description: 'Join live auctions on Mai Troll. Bid on exclusive items, virtual goods, and unique experiences. Social auctions with real-time bidding and entertainment.',
    keywords: [
      'live auctions', 'online auctions', 'bid online', 'social auctions',
      'virtual auctions', 'auction platform', 'live bidding', 'online bidding',
      'auction entertainment', 'MaiTroll auctions'
    ]
  });

  const [auctions, setAuctions] = useState<AuctionShow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('live')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const fetchAuctions = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('auction_shows')
        .select('*')
        .not('status', 'eq', 'draft')
        .not('status', 'eq', 'cancelled')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(75)

      if (error) throw error

      setAuctions(data || [])
    } catch (error) {
      console.error('Error fetching auctions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchAuctions()

    const interval = window.setInterval(fetchAuctions, 15000)
    return () => window.clearInterval(interval)
  }, [])

  const visibleAuctions = useMemo(() => {
    return auctions.filter((auction) => {
      if (activeTab === 'live' && auction.status !== 'live') return false
      if (activeTab === 'ended' && auction.status !== 'ended') return false

      const normalizedSearch = searchQuery.trim().toLowerCase()
      if (normalizedSearch) {
        const haystack = [auction.title, auction.description, auction.category]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!haystack.includes(normalizedSearch)) return false
      }

      if (categoryFilter !== 'all' && auction.category !== categoryFilter) return false

      return true
    })
  }, [auctions, activeTab, searchQuery, categoryFilter])

  const categories = useMemo(() => {
    const dbCategories = Array.from(new Set(auctions.map((auction) => auction.category).filter(Boolean))) as string[]
    return Array.from(new Set([...categoryFallbacks, ...dbCategories]))
  }, [auctions])

  const liveCount = auctions.filter((auction) => auction.status === 'live').length
  const endedCount = auctions.filter((auction) => auction.status === 'ended').length
  const featured =
    auctions.find((auction) => auction.status === 'live' && auction.is_featured) ||
    auctions.find((auction) => auction.status === 'live')

  return (
    <div className={shell}>
      <BackgroundFX />

      <main className="relative z-10 mx-auto max-w-[1500px] space-y-6">
        <header className={cn(panel, 'overflow-hidden')}>
          <div className="relative overflow-hidden border-b border-cyan-300/15 p-5 md:p-7">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_85%_0%,rgba(168,85,247,0.16),transparent_32%)]" />

            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className={cn('relative flex shrink-0 items-center justify-center rounded-[1.65rem] border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_34px_rgba(34,211,238,0.2)]', isMobileWidth ? 'h-14 w-14' : 'h-20 w-20')}>
                  <Gavel className={cn('text-cyan-100 drop-shadow-[0_0_14px_rgba(34,211,238,0.55)]', isMobileWidth ? 'h-7 w-7' : 'h-10 w-10')} />
                  <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-xl border border-purple-300/25 bg-purple-500/20">
                    <Sparkles className="h-4 w-4 text-purple-100" />
                  </div>
                </div>

                <div>
                  {!isMobileWidth && (
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100">
                        Mai Troll Auction House
                      </span>
                      <span className="rounded-full border border-purple-300/20 bg-purple-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-purple-100">
                        Powered by Troll Coins
                      </span>
                    </div>
                  )}

                  <h1 className={cn('bg-gradient-to-r from-white via-cyan-100 to-blue-300 bg-clip-text font-black tracking-tight text-transparent', isMobileWidth ? 'text-2xl' : 'text-4xl md:text-6xl')}>
                    Live Auctions
                  </h1>
                  {!isMobileWidth && (
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                      Enter official live auction shows, place real-time bids with Troll Coins, and follow upcoming
                      drops from verified auctioneers.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={() => void fetchAuctions()} className={secondaryButton}>
                  <RefreshCw className="h-4 w-4" />
                  Refresh Floor
                </button>

                {isMobileWidth && isAuctioneer && (
                  <button onClick={() => navigate('/auctioneer/scanner')} className={secondaryButton}>
                    <Scan className="h-4 w-4" />
                    Scanner
                  </button>
                )}

                <button onClick={() => navigate('/auctions/studio')} className={primaryButton}>
                  <Video className="h-4 w-4" />
                  Auctioneer Studio
                </button>
              </div>
            </div>
          </div>

          <div className={cn('grid gap-3 p-4', isMobileWidth ? 'grid-cols-2' : 'md:grid-cols-3')}>
            <StatCard icon={<Zap className="h-5 w-5" />} label="Live Now" value={liveCount} tone="red" />
            <StatCard icon={<Trophy className="h-5 w-5" />} label="Recently Ended" value={endedCount} tone="green" />
          </div>
        </header>

        {featured && activeTab === 'live' && !isMobileWidth && (
          <section className={cn(panel, 'overflow-hidden p-4 md:p-5')}>
            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="relative aspect-video overflow-hidden rounded-[1.65rem] border border-cyan-300/16 bg-slate-900 shadow-[0_0_38px_rgba(34,211,238,0.10)]">
                {featured.thumbnail_url ? (
                  <img src={featured.thumbnail_url} alt={featured.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle,rgba(34,211,238,0.15),transparent_58%)]">
                    <Gavel className="h-24 w-24 text-cyan-200/35" />
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/10 to-transparent" />

                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-2xl bg-red-500 px-3 py-2 text-sm font-black uppercase text-white shadow-[0_0_22px_rgba(239,68,68,0.32)]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  Live Featured
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Now Showing</p>
                  <h2 className="mt-1 line-clamp-1 text-2xl font-black text-white md:text-3xl">{featured.title}</h2>
                </div>
              </div>

              <div className="flex flex-col justify-center p-2">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase text-cyan-100">
                    Featured Auction
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
                    {featured.category || 'General'}
                  </span>
                </div>

                <h2 className="text-3xl font-black text-white md:text-4xl">{featured.title}</h2>
                <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-300">
                  {featured.description || 'Join this live auction and place bids in real time.'}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <MiniMetric icon={<BadgeCheck className="h-5 w-5" />} label="Verified Show" value="Official Auction" />
                  <MiniMetric icon={<Clock className="h-5 w-5" />} label="Started" value={formatTime(featured.live_started_at)} />
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button onClick={() => navigate(`/auctions/${featured.id}`)} className={primaryButton}>
                    <Play className="h-4 w-4" />
                    Enter Auction
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className={cn(panel, 'p-4 md:p-5')}>
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <TabButton active={activeTab === 'live'} onClick={() => setActiveTab('live')} icon={<Play className="h-4 w-4" />} label={isMobileWidth ? 'Live' : 'Live Now'} count={liveCount} />
              <TabButton active={activeTab === 'ended'} onClick={() => setActiveTab('ended')} icon={<Trophy className="h-4 w-4" />} label={isMobileWidth ? 'Ended' : 'Recently Ended'} count={endedCount} />
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-cyan-300/15 bg-cyan-400/6 px-4 py-3 text-sm font-bold text-cyan-100">
              <ShieldCheck className="h-4 w-4" />
              Verified auction floor
            </div>
          </div>

          <div className={cn('mb-4 grid gap-3', isMobileWidth ? 'grid-cols-[1fr_48px]' : 'lg:grid-cols-[1fr_260px_52px]')}>
            <div className="relative">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search live auctions, categories, and featured shows..."
                className={cn(input, 'pl-12')}
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className={input}
            >
              {categories.map((category) => (
                <option key={category || 'all'} value={category || 'all'} className="bg-slate-950">
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>

            <button className="flex h-[48px] items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 transition hover:bg-cyan-400/18">
              <Filter className="h-5 w-5" />
            </button>
          </div>

          {loading ? (
            <LoadingState />
          ) : visibleAuctions.length === 0 ? (
            <EmptyState activeTab={activeTab} setActiveTab={setActiveTab} />
          ) : (
            <div className={cn('grid gap-4', isMobileWidth ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-3')}>
              {visibleAuctions.map((auction) => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  onOpen={() => navigate(`/auctions/${auction.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[1.35rem] border border-amber-300/22 bg-amber-400/10 p-4 text-sm font-bold text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.08)]">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Minimum <span className="text-amber-200">{formatNumber(BID_MINIMUM_COINS)} coins</span> required to place bids.
              Review the item, current bid, condition, and auctioneer terms before bidding.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

function AuctionCard({ auction, onOpen }: { auction: AuctionShow; onOpen: () => void }) {
  const isLive = auction.status === 'live'
  const isScheduled = auction.status === 'scheduled'
  const currentBid = auction.current_lot?.current_highest_bid || auction.current_lot?.starting_bid || 0

  return (
    <article className={cn(card, 'group overflow-hidden transition hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-[0_0_38px_rgba(34,211,238,0.16)]')}>
      <div className="relative aspect-video overflow-hidden bg-slate-900">
        {auction.thumbnail_url ? (
          <img src={auction.thumbnail_url} alt={auction.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle,rgba(34,211,238,0.13),transparent_60%)]">
            <Gavel className="h-16 w-16 text-cyan-200/35" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/76 via-black/8 to-transparent" />

        <div className="absolute left-3 top-3">
          <StatusBadge status={auction.status} />
        </div>

        {auction.is_featured && (
          <div className="absolute right-3 top-3 rounded-full border border-cyan-300/25 bg-cyan-400/12 px-3 py-1 text-xs font-black text-cyan-100 backdrop-blur-xl">
            Featured
          </div>
        )}

        {auction.category && (
          <div className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-xs font-bold text-white backdrop-blur-xl">
            {auction.category}
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="line-clamp-1 text-xl font-black text-white transition group-hover:text-cyan-200">
          {auction.title}
        </h3>

        {auction.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
            {auction.description}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <CardMetric label="Status" value={isLive ? 'Live Now' : isScheduled ? 'Scheduled' : 'Ended'} />
          <CardMetric
            label={isLive ? 'Current Bid' : isScheduled ? 'Starts' : 'Ended'}
            value={isLive && currentBid > 0 ? `${formatNumber(currentBid)} TC` : isScheduled ? formatDate(auction.scheduled_for) : formatDate(auction.ended_at)}
          />
        </div>

        <div className="mt-4 space-y-2">
          {isLive && (
            <InfoLine
              icon={<Clock className="h-4 w-4" />}
              text={auction.live_started_at ? `Started ${formatTime(auction.live_started_at)}` : 'Live now'}
            />
          )}

          {isScheduled && auction.scheduled_for && (
            <InfoLine icon={<Calendar className="h-4 w-4" />} text={formatDate(auction.scheduled_for)} />
          )}

          {auction.current_lot && (
            <InfoLine icon={<Coins className="h-4 w-4" />} text={`Current lot: ${auction.current_lot.title}`} />
          )}
        </div>

        <button onClick={onOpen} className={cn(isLive ? primaryButton : secondaryButton, 'mt-5 w-full')}>
          {isLive ? (
            <>
              <Play className="h-4 w-4" />
              Join Live Auction
              <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              View Auction
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </article>
  )
}

function BackgroundFX() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.20),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(168,85,247,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:44px_44px] opacity-16" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-52 bg-gradient-to-b from-cyan-400/12 to-transparent" />
    </>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1 rounded-2xl bg-red-500 px-3 py-1.5 text-xs font-black uppercase text-white shadow-[0_0_20px_rgba(239,68,68,0.22)]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
        Live
      </span>
    )
  }

  if (status === 'scheduled') {
    return (
      <span className="rounded-2xl border border-cyan-300/30 bg-cyan-400/15 px-3 py-1.5 text-xs font-black uppercase text-cyan-100 backdrop-blur-xl">
        Upcoming
      </span>
    )
  }

  return (
    <span className="rounded-2xl border border-slate-400/20 bg-slate-700/70 px-3 py-1.5 text-xs font-black uppercase text-slate-200 backdrop-blur-xl">
      Ended
    </span>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: 'red' | 'cyan' | 'green'
}) {
  return (
    <div className={cn(card, 'p-5')}>
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-2xl border',
            tone === 'red' && 'border-red-300/25 bg-red-500/10 text-red-200',
            tone === 'cyan' && 'border-cyan-300/25 bg-cyan-400/10 text-cyan-200',
            tone === 'green' && 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200'
          )}
        >
          {icon}
        </div>
        <div>
          <p
            className={cn(
              'text-3xl font-black',
              tone === 'red' && 'text-red-300',
              tone === 'cyan' && 'text-cyan-200',
              tone === 'green' && 'text-emerald-300'
            )}
          >
            {value}
          </p>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  )
}

function MiniMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
      <div className="mb-2 flex items-center gap-2 text-cyan-200">{icon}</div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 font-black text-white">{value}</p>
    </div>
  )
}

function CardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  )
}

function TabButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition',
        active
          ? 'border-cyan-300/40 bg-gradient-to-r from-cyan-300 to-blue-400 text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.25)]'
          : 'border-white/10 bg-slate-950/65 text-slate-400 hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-cyan-400/10 hover:text-white'
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[10px]',
          active ? 'bg-slate-950/18 text-slate-950' : 'bg-white/10 text-slate-300'
        )}
      >
        {count}
      </span>
    </button>
  )
}

function InfoLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <span className="text-cyan-300">{icon}</span>
      <span className="line-clamp-1">{text}</span>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex min-h-[360px] items-center justify-center text-center">
      <div className="rounded-[2rem] border border-cyan-300/15 bg-white/[0.04] px-10 py-8 backdrop-blur-xl">
        <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-cyan-300" />
        <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200/80">Loading Auctions</p>
      </div>
    </div>
  )
}

function EmptyState({
  activeTab,
  setActiveTab,
}: {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
}) {
  return (
    <div className="flex min-h-[360px] items-center justify-center text-center">
      <div className="max-w-md rounded-[2rem] border border-cyan-300/15 bg-white/[0.04] px-8 py-10 backdrop-blur-xl">
        <Gavel className="mx-auto mb-4 h-16 w-16 text-cyan-200/35" />
        <h3 className="text-xl font-black text-white">No auctions found</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {activeTab === 'live'
            ? 'No live auctions are running right now. Refresh the auction floor or check back soon.'
            : 'No ended auctions are available.'}
        </p>
      </div>
    </div>
  )
}
