import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  'border border-[#00BFFF]/10 bg-[#070711]/85 backdrop-blur-2xl shadow-[0_15px_50px_rgba(0,0,0,0.40)]'

const neonGradient =
  'bg-gradient-to-br from-[#00BFFF] via-[#1787FF] to-[#BF00FF]'

const neonBorder =
  'border border-[#00BFFF]/30 shadow-[0_0_25px_rgba(0,191,255,0.10),0_0_35px_rgba(191,0,255,0.08)]'

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
      className="group relative h-[190px] w-[145px] shrink-0 overflow-hidden rounded-2xl border border-[#00BFFF]/15 bg-[#090914] text-left shadow-[0_8px_30px_rgba(0,0,0,0.40)] transition-all duration-200 active:scale-[0.97] hover:border-[#00BFFF]/40 hover:shadow-[0_0_25px_rgba(0,191,255,0.15)]"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#BF00FF]/25 via-[#070711] to-[#00BFFF]/25" />

      {item.streamerAvatar ? (
        <img
          src={item.streamerAvatar}
          alt={item.streamerName || 'Live streamer'}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-75 transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
            <Play className="h-7 w-7 text-[#00BFFF]/50" />
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-[#03030a]/10 via-transparent to-[#03030a]" />

      {/* Neon LIVE badge */}
      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-lg border border-[#00BFFF]/30 bg-[#05050c]/75 px-2 py-1 text-[8px] font-black tracking-wider text-white backdrop-blur-md">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00BFFF] shadow-[0_0_8px_#00BFFF]" />
        LIVE
      </div>

      <div className="absolute right-2 top-2 rounded-lg border border-white/10 bg-black/55 px-1.5 py-1 text-[8px] font-black text-white backdrop-blur-md">
        👁 {item.viewerCount || 0}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className="truncate text-[11px] font-black text-white">
          {item.title || 'Live Broadcast'}
        </p>

        <p className="mt-0.5 truncate text-[9px] font-bold text-[#00BFFF]/70">
          {item.streamerName || 'Unknown'}
        </p>
      </div>
    </button>
  )
})

/* -------------------------------------------------------------------------- */
/* Section                                                                     */
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
    <section className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/20 to-[#BF00FF]/20" />
            <Icon size={15} className="relative text-[#00BFFF]" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-sm font-black tracking-tight text-white">
              {title}
            </h2>

            {count !== undefined && (
              <p className="text-[9px] font-bold text-[#00BFFF]/55">
                {count} {count === 1 ? 'active stream' : 'active streams'}
              </p>
            )}
          </div>
        </div>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="group flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#00BFFF] transition hover:bg-[#00BFFF]/10"
          >
            Explore
            <ChevronRight
              size={12}
              className="transition-transform group-hover:translate-x-0.5"
            />
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
/* Live Now                                                                    */
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
            className="h-[190px] w-[145px] shrink-0 animate-pulse rounded-2xl border border-[#00BFFF]/10 bg-gradient-to-br from-[#00BFFF]/5 to-[#BF00FF]/5"
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
          className={`flex h-[150px] w-full min-w-[280px] flex-col items-center justify-center rounded-2xl ${neonBorder} bg-gradient-to-br from-[#00BFFF]/5 via-[#070711] to-[#BF00FF]/5 px-5 text-center transition active:scale-[0.98]`}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
            <Radio className="h-6 w-6 text-[#00BFFF]/60" />
          </div>

          <p className="mt-3 text-xs font-black text-zinc-300">
            The network is quiet
          </p>

          <p className="mt-1 text-[9px] font-bold text-zinc-600">
            Explore MaiTroll or be the first to go live.
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
/* Auctions                                                                    */
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
        <div className="flex h-[145px] w-full min-w-[280px] flex-col items-center justify-center rounded-2xl border border-[#BF00FF]/15 bg-gradient-to-br from-[#BF00FF]/5 to-[#00BFFF]/5 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#BF00FF]/10">
            <Gavel className="h-6 w-6 text-[#BF00FF]/50" />
          </div>

          <p className="mt-2 text-xs font-black text-zinc-400">
            No live auctions
          </p>

          <p className="mt-1 text-[9px] font-bold text-zinc-600">
            Check back when the bidding starts.
          </p>
        </div>
      ) : (
        auctions.slice(0, 10).map((auction) => (
          <button
            key={auction.id}
            type="button"
            onClick={() => onClick(auction.id)}
            className="group relative h-[145px] w-[150px] shrink-0 overflow-hidden rounded-2xl border border-[#BF00FF]/15 bg-[#0b0b18] text-left transition-all active:scale-[0.97]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/25 via-[#070711] to-[#BF00FF]/30" />

            {auction.thumbnail_url ? (
              <img
                src={auction.thumbnail_url}
                alt={auction.title || 'Auction'}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <Gavel className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-[#BF00FF]/30" />
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/95" />

            <span className="absolute right-2 top-2 rounded-lg border border-[#BF00FF]/30 bg-black/60 px-1.5 py-1 text-[8px] font-black text-white backdrop-blur-md">
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
/* Online Users                                                                */
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
        className={`group flex w-full items-center justify-between rounded-2xl ${neonBorder} bg-gradient-to-r from-[#00BFFF]/5 via-[#070711] to-[#BF00FF]/5 px-4 py-3 transition active:scale-[0.99]`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
            <Users size={17} className="text-[#00BFFF]" />
          </div>

          <div className="text-left">
            <p className="text-xs font-black text-white">
              Online Community
            </p>

            <p className="text-[9px] font-bold text-[#00BFFF]/60">
              {onlineUsers.toLocaleString()} people are online
            </p>
          </div>
        </div>

        <ChevronRight
          size={16}
          className="text-[#00BFFF]/50 transition-transform group-hover:translate-x-0.5"
        />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md">
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-hidden rounded-t-3xl border-t border-[#00BFFF]/25 bg-[#070711] shadow-[0_-10px_60px_rgba(0,191,255,0.10)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div>
                <h3 className="text-sm font-black text-white">
                  Online Community
                </h3>

                <p className="text-[9px] text-[#00BFFF]/55">
                  {onlineUsers.toLocaleString()} people online
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400"
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
                      className="h-14 animate-pulse rounded-xl bg-gradient-to-r from-[#00BFFF]/5 to-[#BF00FF]/5"
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
                        className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[#00BFFF]/5 active:bg-white/5"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] text-xs font-black text-white shadow-[0_0_15px_rgba(0,191,255,0.15)]">
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
                              <Crown className="ml-1 inline h-3 w-3 text-[#BF00FF]" />
                            )}
                          </p>

                          <p className="truncate text-[9px] text-zinc-500">
                            @{u.username}
                          </p>
                        </div>

                        <span className="h-2 w-2 rounded-full bg-[#00BFFF] shadow-[0_0_8px_#00BFFF]" />
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
/* Global Activity                                                             */
/* -------------------------------------------------------------------------- */

function PhoneActivityTicker() {
  const events = useGlobalActivity()

  if (!events?.length) return null

  return (
    <div className="overflow-hidden rounded-xl border border-[#00BFFF]/10 bg-gradient-to-r from-[#00BFFF]/5 to-[#BF00FF]/5 px-3 py-2">
      <div className="flex items-center gap-2">
        <Radio size={11} className="shrink-0 text-[#00BFFF]" />

        <div className="min-w-0 overflow-hidden whitespace-nowrap">
          <div className="flex animate-[phoneTicker_22s_linear_infinite] gap-8 text-[9px] font-bold text-[#00BFFF]/60">
            {events.slice(0, 8).map((event, index) => (
              <span key={`${event.id}-${index}`} className="shrink-0">
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
/* Quick Links                                                                 */
/* -------------------------------------------------------------------------- */

function PhoneQuickLinks() {
  const navigate = useNavigate()

  const links = [
    {
      label: 'Battles',
      icon: Sparkles,
      path: '/battles',
    },
    {
      label: 'Leagues',
      icon: Trophy,
      path: '/leagues',
    },
    {
      label: 'Academy',
      icon: BookOpen,
      path: '/academy',
    },
    {
      label: 'Record Label',
      icon: Music,
      path: '/mai-record-label',
    },
  ]

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-black tracking-tight text-white">
            Explore MaiTroll
          </h2>

          <p className="text-[9px] font-bold text-[#00BFFF]/45">
            More ways to connect, compete and create
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {links.map((link, index) => {
          const Icon = link.icon

          return (
            <button
              key={link.label}
              type="button"
              onClick={() => navigate(link.path)}
              className="group relative flex min-h-[78px] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-[#00BFFF]/10 bg-[#080812] px-1 text-center transition-all active:scale-95 hover:border-[#00BFFF]/25"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/5 to-[#BF00FF]/5 opacity-0 transition-opacity group-hover:opacity-100" />

              <div
                className={`relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#00BFFF]/15 bg-gradient-to-br ${
                  index % 2 === 0
                    ? 'from-[#00BFFF]/15 to-[#BF00FF]/10'
                    : 'from-[#BF00FF]/15 to-[#00BFFF]/10'
                }`}
              >
                <Icon
                  size={16}
                  className={
                    index % 2 === 0
                      ? 'text-[#00BFFF]'
                      : 'text-[#BF00FF]'
                  }
                />
              </div>

              <span className="relative text-[8px] font-black leading-tight text-zinc-400">
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
/* Homepage                                                                    */
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

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
    }
  }, [refresh])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#03030a]">
        <PhoneHeader />

        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="text-center">
            <div className="relative mx-auto h-12 w-12">
              <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] opacity-30 blur-xl" />

              <div className="relative h-12 w-12 animate-spin rounded-full border-2 border-[#BF00FF]/20 border-t-[#00BFFF]" />
            </div>

            <p className="mt-4 text-xs font-black text-[#00BFFF]/50">
              Loading MaiTroll...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#03030a] text-white">
      <PhoneHeader />

      <main className="px-3 pb-24 pt-3">
        {/* ---------------------------------------------------------------- */}
        {/* Welcome                                                           */}
        {/* ---------------------------------------------------------------- */}

        {!user && (
          <section className="relative mb-4 overflow-hidden rounded-3xl border border-[#00BFFF]/15 bg-gradient-to-br from-[#BF00FF]/15 via-[#070711] to-[#00BFFF]/15 p-4 shadow-[0_0_40px_rgba(0,191,255,0.06)]">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#00BFFF]/15 blur-3xl" />

            <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-[#BF00FF]/10 blur-3xl" />

            <div className="relative flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] shadow-[0_0_25px_rgba(0,191,255,0.25)]">
                <Sparkles size={20} className="text-white" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-black text-white">
                  Welcome to MaiTroll
                </h2>

                <p className="mt-0.5 text-[9px] font-bold text-zinc-400">
                  Watch. Battle. Troll. Gift. Connect.
                </p>
              </div>

              <button
                type="button"
                onClick={() => go('/auth?mode=signup')}
                className="shrink-0 rounded-xl bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] px-3 py-2 text-[9px] font-black text-white shadow-[0_0_18px_rgba(0,191,255,0.20)] transition active:scale-95"
              >
                Join
              </button>
            </div>
          </section>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Stats + Go Live                                                   */}
        {/* ---------------------------------------------------------------- */}

        <section className="mb-5 grid grid-cols-3 gap-2">
          <div className={`${glass} rounded-2xl p-3`}>
            <Radio size={14} className="text-[#00BFFF]" />

            <p className="mt-2 text-base font-black text-white">
              {totalLive}
            </p>

            <p className="text-[8px] font-black uppercase tracking-wider text-[#00BFFF]/45">
              Live Now
            </p>
          </div>

          {/* MAIN CTA */}
          <button
            type="button"
            onClick={() => go('/go-live')}
            className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-[#00BFFF]/50 bg-gradient-to-br from-[#00BFFF] via-[#1787FF] to-[#BF00FF] p-3 text-white shadow-[0_0_25px_rgba(0,191,255,0.30),0_0_35px_rgba(191,0,255,0.20)] transition-all duration-200 active:scale-[0.97] hover:scale-[1.02]"
          >
            <div className="absolute -right-5 -top-5 h-16 w-16 rounded-full bg-white/20 blur-2xl transition-transform duration-500 group-hover:scale-150" />

            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10" />

            <div className="relative flex flex-col items-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-black/10 shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                <Radio
                  size={18}
                  className="text-white transition-transform duration-200 group-hover:scale-110"
                />
              </div>

              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                GO LIVE
              </p>

              <p className="mt-0.5 text-[7px] font-black uppercase tracking-wider text-white/80">
                Start Your Broadcast
              </p>
            </div>
          </button>

          <div className={`${glass} rounded-2xl p-3`}>
            <Users size={14} className="text-[#BF00FF]" />

            <p className="mt-2 text-base font-black text-white">
              {onlineUsers.toLocaleString()}
            </p>

            <p className="text-[8px] font-black uppercase tracking-wider text-[#BF00FF]/45">
              Online
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Header                                                            */}
        {/* ---------------------------------------------------------------- */}

        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-[#00BFFF]/50">
              TROLL CITY NETWORK
            </p>

            <h1 className="text-lg font-black tracking-tight text-white">
              What’s Happening Now
            </h1>

            <p className="mt-0.5 text-[9px] font-bold text-zinc-600">
              Live broadcasts, battles and events across MaiTroll
            </p>
          </div>

          <button
            type="button"
            disabled={refreshing}
            onClick={refreshLiveContent}
            className="rounded-xl border border-[#00BFFF]/15 bg-[#00BFFF]/5 px-3 py-2 text-[9px] font-black text-[#00BFFF] transition active:scale-95 disabled:opacity-50"
          >
            {refreshing ? 'Updating...' : 'Refresh'}
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Activity                                                           */}
        {/* ---------------------------------------------------------------- */}

        <div className="mb-5">
          <PhoneActivityTicker />
        </div>

        <div className="space-y-6">
          {/* Live */}
          <PhoneLiveNow
            items={liveItems}
            loading={loadingLive}
            onItemClick={handleStreamClick}
            onViewAll={() => go('/live')}
          />

          {/* Auctions */}
          <PhoneAuctions
            auctions={liveAuctions}
            onClick={handleAuctionClick}
          />

          {/* -------------------------------------------------------------- */}
          {/* Battles                                                          */}
          {/* -------------------------------------------------------------- */}

          <PhoneSection
            title="Universal Battles"
            icon={Sparkles}
            count={battleItems.length}
            onViewAll={() => go('/battles')}
          >
            {battleItems.length === 0 ? (
              <div className="flex h-[125px] w-full min-w-[280px] flex-col items-center justify-center rounded-2xl border border-[#BF00FF]/15 bg-gradient-to-br from-[#BF00FF]/5 to-[#00BFFF]/5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#BF00FF]/10">
                  <Sparkles className="h-5 w-5 text-[#BF00FF]/40" />
                </div>

                <p className="mt-2 text-[10px] font-black text-zinc-500">
                  No battles are active
                </p>

                <p className="mt-0.5 text-[8px] font-bold text-zinc-700">
                  Check back for the next matchup.
                </p>
              </div>
            ) : (
              battleItems.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleStreamClick(item)}
                  className="group relative h-[140px] w-[165px] shrink-0 overflow-hidden rounded-2xl border border-[#BF00FF]/25 bg-gradient-to-br from-[#BF00FF]/20 via-[#080812] to-[#00BFFF]/15 p-3 text-left transition active:scale-[0.97]"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#BF00FF]/10 to-[#00BFFF]/10 opacity-0 transition-opacity group-hover:opacity-100" />

                  <span className="relative rounded-full border border-[#BF00FF]/30 bg-[#BF00FF]/15 px-2 py-1 text-[7px] font-black text-[#BF00FF]">
                    {item.battleFormat?.toUpperCase() || 'BATTLE'}
                  </span>

                  <span className="absolute right-2 top-2 rounded-lg border border-[#00BFFF]/30 bg-black/60 px-1.5 py-1 text-[7px] font-black text-white">
                    LIVE
                  </span>

                  <div className="absolute inset-x-3 bottom-3">
                    <p className="truncate text-xs font-black text-white">
                      {item.title}
                    </p>

                    <p className="mt-1 truncate text-[9px] font-bold text-[#00BFFF]/60">
                      {item.streamerName}
                    </p>
                  </div>
                </button>
              ))
            )}
          </PhoneSection>

          {/* -------------------------------------------------------------- */}
          {/* Troll Court                                                     */}
          {/* -------------------------------------------------------------- */}

          <PhoneSection
            title="Troll Court"
            icon={Gavel}
            count={courtItems.length}
            onViewAll={() => go('/court')}
          >
            {courtItems.length === 0 ? (
              <div className="flex h-[120px] w-full min-w-[280px] items-center justify-center rounded-2xl border border-[#00BFFF]/10 bg-[#00BFFF]/[0.02] text-center">
                <div>
                  <Gavel className="mx-auto h-7 w-7 text-[#00BFFF]/20" />

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

          {/* -------------------------------------------------------------- */}
          {/* TCNN                                                             */}
          {/* -------------------------------------------------------------- */}

          <PhoneSection
            title="TCNN News"
            icon={MessageCircle}
            count={tcnnItems.length}
            onViewAll={() => go('/tcnn')}
          >
            {tcnnItems.length === 0 ? (
              <div className="flex h-[120px] w-full min-w-[280px] items-center justify-center rounded-2xl border border-[#BF00FF]/10 bg-[#BF00FF]/[0.02] text-center">
                <div>
                  <MessageCircle className="mx-auto h-7 w-7 text-[#BF00FF]/20" />

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

          {/* Online */}
          <PhoneOnlineUsers
            onlineUsers={onlineUsers}
            currentUserId={user?.id}
          />

          {/* -------------------------------------------------------------- */}
          {/* Community Wall                                                   */}
          {/* -------------------------------------------------------------- */}

          <button
            type="button"
            onClick={() => go('/community-wall')}
            className={`group flex w-full items-center gap-3 rounded-2xl ${neonBorder} bg-gradient-to-r from-[#BF00FF]/10 via-[#070711] to-[#00BFFF]/10 p-4 text-left transition active:scale-[0.99]`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#BF00FF]/20 bg-[#BF00FF]/10">
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
              <span className="rounded-full bg-gradient-to-r from-[#BF00FF] to-[#00BFFF] px-2 py-1 text-[8px] font-black text-white shadow-[0_0_12px_rgba(191,0,255,0.25)]">
                {newPostCount}
              </span>
            )}

            <ArrowRight
              size={15}
              className="text-[#00BFFF]/50 transition-transform group-hover:translate-x-0.5"
            />
          </button>

          {/* -------------------------------------------------------------- */}
          {/* Creator CTA                                                     */}
          {/* -------------------------------------------------------------- */}

          {user && (
            <button
              type="button"
              onClick={() => go('/broadcast/setup')}
              className="group relative w-full overflow-hidden rounded-2xl border border-[#00BFFF]/20 bg-gradient-to-r from-[#BF00FF]/15 via-[#0d0d19] to-[#00BFFF]/15 p-4 text-left shadow-[0_0_35px_rgba(0,191,255,0.08)] transition active:scale-[0.99]"
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#00BFFF]/15 blur-2xl transition-transform duration-500 group-hover:scale-125" />

              <div className="absolute -bottom-8 -left-8 h-20 w-20 rounded-full bg-[#BF00FF]/10 blur-2xl" />

              <div className="relative flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] shadow-[0_0_18px_rgba(0,191,255,0.18)]">
                  <Radio size={20} className="text-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white">
                    Ready to Go Live?
                  </p>

                  <p className="mt-0.5 text-[9px] font-bold text-zinc-500">
                    Start your broadcast and join the Troll City network.
                  </p>
                </div>

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
                  <ChevronRight
                    size={17}
                    className="text-[#00BFFF] transition-transform group-hover:translate-x-0.5"
                  />
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Quick Links */}
        <div className="mt-7">
          <PhoneQuickLinks />
        </div>

        <footer className="mt-7 border-t border-[#00BFFF]/10 py-5 text-center">
          <p className="text-[9px] font-bold text-zinc-700">
            MaiTroll • Troll City
          </p>

          <p className="mt-1 text-[8px] font-bold text-zinc-800">
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
