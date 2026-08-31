import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Crown,
  Gavel,
  MessageCircle,
  Music,
  Play,
  Radio,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'

import PhoneHeader from '../PhoneHeader'
import { useAuthStore } from '@/lib/store'
import {
  useLiveContent,
  type AuctionShow,
  type LiveItem,
} from '@/contexts/LiveContentContext'
import { usePresenceStore } from '@/lib/presenceStore'
import { supabase } from '@/lib/supabase'
import useGlobalActivity from '@/hooks/useGlobalActivity'
import { useWallNotifications } from '@/hooks/useWallNotifications'

const glass =
  'border border-white/[0.08] bg-[#070711]/80 backdrop-blur-2xl shadow-[0_15px_50px_rgba(0,0,0,0.35)]'

interface PhoneHomepageProps {
  onNavigate?: (path: string) => void
}

/* -------------------------------------------------------------------------- */
/* Live Stream Tile                                                           */
/* -------------------------------------------------------------------------- */

const PhoneLiveTile = React.memo(function PhoneLiveTile({
  item,
  onClick,
}: {
  item: LiveItem
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative h-[190px] w-[145px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b18] text-left shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition active:scale-[0.97]"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#BF00FF]/30 via-[#070711] to-[#00BFFF]/25" />

      {item.streamerAvatar ? (
        <img
          src={item.streamerAvatar}
          alt={item.streamerName || 'Live streamer'}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-80"
        />
      ) : (
        <Play className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-white/20" />
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/95" />

      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[8px] font-black tracking-wider text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        LIVE
      </div>

      <div className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-1 text-[8px] font-black text-white backdrop-blur-md">
        👁 {item.viewerCount || 0}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className="truncate text-[11px] font-black text-white">
          {item.title || 'Live Broadcast'}
        </p>

        <p className="mt-0.5 truncate text-[9px] font-bold text-zinc-400">
          {item.streamerName || 'Unknown'}
        </p>
      </div>
    </button>
  )
})

/* -------------------------------------------------------------------------- */
/* Horizontal Section                                                         */
/* -------------------------------------------------------------------------- */

function PhoneSection({
  title,
  icon: Icon,
  count,
  children,
  onViewAll,
}: {
  title: string
  icon: React.ElementType
  count?: number
  children: React.ReactNode
  onViewAll?: () => void
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#00BFFF]/20 bg-[#00BFFF]/10">
            <Icon size={14} className="text-[#00BFFF]" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-sm font-black text-white">
              {title}
            </h2>

            {count !== undefined && (
              <p className="text-[9px] font-bold text-zinc-500">
                {count} active
              </p>
            )}
          </div>
        </div>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex shrink-0 items-center gap-0.5 text-[9px] font-black uppercase tracking-wider text-[#00BFFF]"
          >
            View All
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
        {children}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Live Now                                                                   */
/* -------------------------------------------------------------------------- */

function PhoneLiveNow({
  items,
  loading,
  onItemClick,
  onViewAll,
}: {
  items: LiveItem[]
  loading: boolean
  onItemClick: (item: LiveItem) => void
  onViewAll?: () => void
}) {
  if (loading) {
    return (
      <PhoneSection title="Live Now" icon={Radio}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[190px] w-[145px] shrink-0 animate-pulse rounded-2xl bg-white/5"
          />
        ))}
      </PhoneSection>
    )
  }

  return (
    <PhoneSection
      title="Live Now"
      icon={Radio}
      count={items.length}
      onViewAll={onViewAll}
    >
      {items.length === 0 ? (
        <button
          type="button"
          onClick={onViewAll}
          className="flex h-[150px] w-full min-w-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#00BFFF]/20 bg-[#00BFFF]/[0.03] px-5 text-center"
        >
          <Radio className="h-8 w-8 text-[#00BFFF]/40" />

          <p className="mt-2 text-xs font-black text-zinc-300">
            Nobody is live right now
          </p>

          <p className="mt-1 text-[9px] font-bold text-zinc-600">
            Tap to explore the live network
          </p>
        </button>
      ) : (
        items.slice(0, 12).map((item) => (
          <PhoneLiveTile
            key={item.id}
            item={item}
            onClick={() => onItemClick(item)}
          />
        ))
      )}
    </PhoneSection>
  )
}

/* -------------------------------------------------------------------------- */
/* Auctions                                                                   */
/* -------------------------------------------------------------------------- */

function PhoneAuctions({
  auctions,
  onClick,
}: {
  auctions: AuctionShow[]
  onClick: (id?: string) => void
}) {
  return (
    <PhoneSection
      title="Live Auctions"
      icon={Gavel}
      count={auctions.length}
      onViewAll={() => onClick()}
    >
      {auctions.length === 0 ? (
        <div className="flex h-[145px] w-full min-w-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#BF00FF]/20 bg-[#BF00FF]/[0.03] text-center">
          <Gavel className="h-8 w-8 text-[#BF00FF]/40" />

          <p className="mt-2 text-xs font-black text-zinc-400">
            No auctions live
          </p>
        </div>
      ) : (
        auctions.slice(0, 10).map((auction) => (
          <button
            key={auction.id}
            type="button"
            onClick={() => onClick(auction.id)}
            className="relative h-[145px] w-[150px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b18] text-left active:scale-[0.97]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/30 via-[#070711] to-[#BF00FF]/30" />

            {auction.thumbnail_url ? (
              <img
                src={auction.thumbnail_url}
                alt={auction.title || 'Auction'}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-75"
              />
            ) : (
              <Gavel className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-[#00BFFF]/30" />
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/95" />

            <span className="absolute right-2 top-2 rounded-md bg-red-600 px-1.5 py-1 text-[8px] font-black text-white">
              LIVE
            </span>

            <div className="absolute inset-x-0 bottom-0 p-2.5">
              <p className="truncate text-[10px] font-black text-white">
                {auction.title || 'Live Auction'}
              </p>
            </div>
          </button>
        ))
      )}
    </PhoneSection>
  )
}

/* -------------------------------------------------------------------------- */
/* Online Users                                                               */
/* -------------------------------------------------------------------------- */

function PhoneOnlineUsers({
  onlineUsers,
  currentUserId,
}: {
  onlineUsers: number
  currentUserId?: string
}) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds)

  useEffect(() => {
    if (!open) return

    let cancelled = false

    const fetchUsers = async () => {
      setLoading(true)

      try {
        const ids = Array.from(onlineUserIds).slice(0, 100)

        if (!ids.length) {
          if (!cancelled) setUsers([])
          return
        }

        const { data, error } = await supabase
          .from('user_profiles')
          .select(
            'id, username, display_name, avatar_url, role, is_admin',
          )
          .in('id', ids)

        if (error) throw error

        if (!cancelled) {
          setUsers(data || [])
        }
      } catch {
        if (!cancelled) setUsers([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchUsers()

    return () => {
      cancelled = true
    }
  }, [open, onlineUserIds])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] px-4 py-3 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10">
            <Users size={17} className="text-emerald-300" />
          </div>

          <div className="text-left">
            <p className="text-xs font-black text-white">
              Online Community
            </p>

            <p className="text-[9px] font-bold text-emerald-300/70">
              {onlineUsers.toLocaleString()} people online
            </p>
          </div>
        </div>

        <ChevronRight size={16} className="text-zinc-600" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm">
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-hidden rounded-t-3xl border-t border-[#00BFFF]/20 bg-[#070711]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div>
                <h3 className="text-sm font-black text-white">
                  Online Users
                </h3>

                <p className="text-[9px] text-zinc-500">
                  {onlineUsers.toLocaleString()} online
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-zinc-400"
              >
                ×
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-3">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-14 animate-pulse rounded-xl bg-white/5"
                    />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <div className="py-10 text-center text-xs text-zinc-500">
                  No users online.
                </div>
              ) : (
                <div className="space-y-1">
                  {users.map((u) => {
                    const admin =
                      u.is_admin ||
                      ['admin', 'ceo', 'superadmin'].includes(
                        u.role || '',
                      )

                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setOpen(false)
                          window.location.href = `/profile/id/${u.id}`
                        }}
                        className="flex w-full items-center gap-3 rounded-xl p-3 text-left active:bg-white/5"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] text-xs font-black text-white">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (
                              u.display_name ||
                              u.username ||
                              '?'
                            )[0]?.toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-white">
                            {u.display_name || u.username}

                            {u.id === currentUserId && (
                              <span className="ml-1 text-[8px] text-[#00BFFF]">
                                YOU
                              </span>
                            )}

                            {admin && (
                              <Crown className="ml-1 inline h-3 w-3 text-yellow-400" />
                            )}
                          </p>

                          <p className="truncate text-[9px] text-zinc-500">
                            @{u.username}
                          </p>
                        </div>

                        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Global Activity                                                            */
/* -------------------------------------------------------------------------- */

function PhoneActivityTicker() {
  const events = useGlobalActivity()

  if (!events?.length) return null

  return (
    <div className="overflow-hidden rounded-xl border border-[#00BFFF]/10 bg-[#00BFFF]/[0.03] px-3 py-2">
      <div className="flex items-center gap-2">
        <Radio size={11} className="shrink-0 text-red-400" />

        <div className="min-w-0 overflow-hidden whitespace-nowrap">
          <div className="flex animate-[phoneTicker_22s_linear_infinite] gap-8 text-[9px] font-bold text-cyan-200/70">
            {events.slice(0, 8).map((event, index) => (
              <span
                key={`${event.id}-${index}`}
                className="shrink-0"
              >
                • {event.message}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Quick Navigation                                                           */
/* -------------------------------------------------------------------------- */

function PhoneQuickLinks() {
  const navigate = useNavigate()

  const links = [
    {
      label: 'Battles',
      icon: Sparkles,
      path: '/battles',
      color: 'text-yellow-300',
      bg: 'bg-yellow-400/10',
    },
    {
      label: 'Leagues',
      icon: Trophy,
      path: '/leagues',
      color: 'text-purple-300',
      bg: 'bg-purple-400/10',
    },
    {
      label: 'Academy',
      icon: BookOpen,
      path: '/academy',
      color: 'text-emerald-300',
      bg: 'bg-emerald-400/10',
    },
    {
      label: 'Record Label',
      icon: Music,
      path: '/mai-record-label',
      color: 'text-pink-300',
      bg: 'bg-pink-400/10',
    },
  ]

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-black text-white">
          Explore MaiTroll
        </h2>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {links.map((link) => {
          const Icon = link.icon

          return (
            <button
              key={link.label}
              type="button"
              onClick={() => navigate(link.path)}
              className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.07] bg-[#080812] px-1 text-center active:scale-95"
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${link.bg}`}
              >
                <Icon size={15} className={link.color} />
              </div>

              <span className="text-[8px] font-black leading-tight text-zinc-400">
                {link.label}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Homepage                                                                   */
/* -------------------------------------------------------------------------- */

export default function PhoneHomepage({
  onNavigate,
}: PhoneHomepageProps) {
  const navigate = useNavigate()

  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)

  const {
    liveItems,
    liveAuctions,
    onlineUsers,
    loadingLive,
    refresh,
  } = useLiveContent()

  const { newPostCount } = useWallNotifications(false)

  const [refreshing, setRefreshing] = useState(false)

  const battleItems = useMemo(
    () => liveItems.filter((item) => item.isBattle),
    [liveItems],
  )

  const courtItems = useMemo(
    () => liveItems.filter((item) => item.category === 'court'),
    [liveItems],
  )

  const tcnnItems = useMemo(
    () => liveItems.filter((item) => item.category === 'tcnn'),
    [liveItems],
  )

  const totalLive = liveItems.length + liveAuctions.length

  const go = useCallback(
    (path: string) => {
      if (onNavigate) {
        onNavigate(path)
      } else {
        navigate(path)
      }
    },
    [navigate, onNavigate],
  )

  const handleStreamClick = useCallback(
    (item: LiveItem) => {
      go(`/watch/${item.id}`)
    },
    [go],
  )

  const handleAuctionClick = useCallback(
    (id?: string) => {
      go(id ? `/auctions/${id}` : '/auctions')
    },
    [go],
  )

  const refreshLiveContent = useCallback(async () => {
    setRefreshing(true)

    try {
      await refresh()
      await new Promise((resolve) => setTimeout(resolve, 300))
    } finally {
      setRefreshing(false)
    }
  }, [refresh])

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'instant',
    })
  }, [])

  useEffect(() => {
    const handleOpenLive = () => {
      go('/live')
    }

    window.addEventListener('phone-open-live', handleOpenLive)

    return () => {
      window.removeEventListener('phone-open-live', handleOpenLive)
    }
  }, [go])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refresh])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#03030a]">
        {/* PhoneHeader owns PhoneDrawer */}
        <PhoneHeader />

        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-[#BF00FF]/30 border-t-[#00BFFF]" />

            <p className="mt-4 text-xs font-black text-zinc-500">
              Loading MaiTroll...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#03030a] text-white">
      {/* 
        PhoneHeader contains the PhoneDrawer.
        Do NOT add another PhoneDrawer here.
      */}
      <PhoneHeader />

      <main className="px-3 pb-24 pt-3">
        {!user && (
          <section className="mb-3 overflow-hidden rounded-2xl border border-[#00BFFF]/15 bg-gradient-to-r from-[#BF00FF]/15 via-[#070711] to-[#00BFFF]/15 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#BF00FF] to-[#00BFFF] shadow-[0_0_25px_rgba(0,191,255,0.2)]">
                <Sparkles size={20} className="text-white" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-black text-white">
                  Welcome to MaiTroll
                </h2>

                <p className="mt-0.5 text-[9px] font-bold text-zinc-400">
                  Watch live, battle, troll, gift and connect.
                </p>
              </div>

              <button
                type="button"
                onClick={() => go('/auth?mode=signup')}
                className="shrink-0 rounded-xl bg-gradient-to-r from-[#BF00FF] to-[#00BFFF] px-3 py-2 text-[9px] font-black text-white shadow-[0_0_18px_rgba(191,0,255,0.2)]"
              >
                Join
              </button>
            </div>
          </section>
        )}

        <section className="mb-4 grid grid-cols-3 gap-2">
          <div className={`${glass} rounded-2xl p-3`}>
            <Radio size={14} className="text-red-400" />

            <p className="mt-2 text-base font-black text-white">
              {totalLive}
            </p>

            <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-600">
              Live
            </p>
          </div>

          <button
  type="button"
  onClick={() => go('/go-live')}
  className="group flex flex-col items-center justify-center rounded-2xl border border-red-400 bg-red-500 p-3 text-black shadow-[0_0_25px_rgba(239,68,68,0.25)] transition active:scale-[0.97] hover:bg-red-400"
>
  <Radio
    size={18}
    className="text-black transition group-hover:scale-110"
  />

  <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-black">
    GO LIVE
  </p>

  <p className="mt-0.5 text-[7px] font-black uppercase tracking-wider text-black/70">
    Start Broadcast
  </p>
</button>

          <div className={`${glass} rounded-2xl p-3`}>
            <Users size={14} className="text-emerald-300" />

            <p className="mt-2 text-base font-black text-white">
              {onlineUsers.toLocaleString()}
            </p>

            <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-600">
              Online
            </p>
          </div>
        </section>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black tracking-tight text-white">
              Powered By Troll City 
            </h1>

            <p className="text-[9px] font-bold text-zinc-600">
              Live broadcasts happening now
            </p>
          </div>

          <button
            type="button"
            disabled={refreshing}
            onClick={refreshLiveContent}
            className="rounded-xl border border-[#00BFFF]/15 bg-[#00BFFF]/5 px-3 py-2 text-[9px] font-black text-[#00BFFF] active:scale-95 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="space-y-5">
          <PhoneLiveNow
            items={liveItems}
            loading={loadingLive}
            onItemClick={handleStreamClick}
            onViewAll={() => go('/live')}
          />

          <PhoneAuctions
            auctions={liveAuctions}
            onClick={handleAuctionClick}
          />

          <PhoneSection
            title="Universal Battles"
            icon={Sparkles}
            count={battleItems.length}
            onViewAll={() => go('/battles')}
          >
            {battleItems.length === 0 ? (
              <div className="flex h-[125px] w-full min-w-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-yellow-400/15 bg-yellow-400/[0.03]">
                <Sparkles className="h-7 w-7 text-yellow-300/30" />

                <p className="mt-2 text-[10px] font-black text-zinc-500">
                  No battles active
                </p>
              </div>
            ) : (
              battleItems.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleStreamClick(item)}
                  className="relative h-[140px] w-[165px] shrink-0 overflow-hidden rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-900/30 to-orange-950/50 p-3 text-left active:scale-[0.97]"
                >
                  <span className="rounded-full bg-yellow-400 px-2 py-1 text-[7px] font-black text-black">
                    {item.battleFormat?.toUpperCase() || 'BATTLE'}
                  </span>

                  <span className="absolute right-2 top-2 rounded-md bg-red-600 px-1.5 py-1 text-[7px] font-black text-white">
                    LIVE
                  </span>

                  <div className="absolute inset-x-3 bottom-3">
                    <p className="truncate text-xs font-black text-white">
                      {item.title}
                    </p>

                    <p className="mt-1 truncate text-[9px] font-bold text-yellow-200/70">
                      {item.streamerName}
                    </p>
                  </div>
                </button>
              ))
            )}
          </PhoneSection>

          <PhoneSection
            title="Troll Court"
            icon={Gavel}
            count={courtItems.length}
            onViewAll={() => go('/court')}
          >
            {courtItems.length === 0 ? (
              <div className="flex h-[120px] w-full min-w-[260px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-center">
                <div>
                  <Gavel className="mx-auto h-7 w-7 text-zinc-700" />

                  <p className="mt-2 text-[9px] font-black text-zinc-600">
                    No court broadcasts live
                  </p>
                </div>
              </div>
            ) : (
              courtItems.slice(0, 10).map((item) => (
                <PhoneLiveTile
                  key={item.id}
                  item={item}
                  onClick={() => {
                    const sessionId = item.id.startsWith('court-')
                      ? item.id.slice(6)
                      : item.id

                    go(`/court/${sessionId}`)
                  }}
                />
              ))
            )}
          </PhoneSection>

          <PhoneSection
            title="TCNN News"
            icon={MessageCircle}
            count={tcnnItems.length}
            onViewAll={() => go('/tcnn')}
          >
            {tcnnItems.length === 0 ? (
              <div className="flex h-[120px] w-full min-w-[260px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-center">
                <div>
                  <MessageCircle className="mx-auto h-7 w-7 text-zinc-700" />

                  <p className="mt-2 text-[9px] font-black text-zinc-600">
                    No TCNN broadcasts live
                  </p>
                </div>
              </div>
            ) : (
              tcnnItems.slice(0, 10).map((item) => (
                <PhoneLiveTile
                  key={item.id}
                  item={item}
                  onClick={() => go(`/tcnn/viewer/${item.id}`)}
                />
              ))
            )}
          </PhoneSection>

          <PhoneOnlineUsers
            onlineUsers={onlineUsers}
            currentUserId={user?.id}
          />

          <button
            type="button"
            onClick={() => go('/community-wall')}
            className="flex w-full items-center gap-3 rounded-2xl border border-[#BF00FF]/15 bg-gradient-to-r from-[#BF00FF]/10 to-[#00BFFF]/10 p-4 text-left active:scale-[0.99]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#BF00FF]/10">
              <MessageCircle size={18} className="text-[#BF00FF]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-white">
                Community Wall
              </p>

              <p className="text-[9px] font-bold text-zinc-500">
                See what the MaiTroll community is talking about
              </p>
            </div>

            {newPostCount > 0 && (
              <span className="rounded-full bg-[#BF00FF] px-2 py-1 text-[8px] font-black text-white">
                {newPostCount}
              </span>
            )}

            <ArrowRight size={15} className="text-zinc-600" />
          </button>

          {user && (
            <button
              type="button"
              onClick={() => go('/broadcast/setup')}
              className="relative w-full overflow-hidden rounded-2xl border border-[#00BFFF]/20 bg-gradient-to-r from-[#BF00FF]/20 via-[#101020] to-[#00BFFF]/20 p-4 text-left shadow-[0_0_35px_rgba(0,191,255,0.08)] active:scale-[0.99]"
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#00BFFF]/10 blur-2xl" />

              <div className="relative flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#BF00FF] to-[#00BFFF]">
                  <Radio size={20} className="text-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white">
                    Go Live
                  </p>

                  <p className="mt-0.5 text-[9px] font-bold text-zinc-500">
                    Start your broadcast and join the network.
                  </p>
                </div>

                <ChevronRight
                  size={18}
                  className="text-[#00BFFF]"
                />
              </div>
            </button>
          )}
        </div>

        <PhoneQuickLinks />

        <footer className="mt-6 border-t border-white/5 py-4 text-center">
          <p className="text-[9px] font-bold text-zinc-600">
            All rights reserved © 2025 Troll City
          </p>
        </footer>
      </main>

      <style>{`
        @keyframes phoneTicker {
          0% {
            transform: translateX(0);
          }

          100% {
            transform: translateX(-50%);
          }
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}