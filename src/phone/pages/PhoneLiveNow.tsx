import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Eye,
  Play,
  Radio,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import UserNameWithAge from '../../components/UserNameWithAge'
import { neonCard, neonTextGradient } from '../phoneTheme'

interface Broadcast {
  id: string
  broadcaster_id: string
  title: string
  category: string
  viewer_count?: number
  current_viewers: number
  started_at: string
  ended_at?: string
  thumbnail_url?: string
  type: 'stream'
  is_ended?: boolean
  recording_url?: string | null
  user_profiles?: {
    id?: string
    username: string
    avatar_url?: string
    level?: number
    created_at?: string
  }
}

type FilterType = 'all' | 'irl'

const ITEMS_PER_PAGE = 20

export default function PhoneLiveNow() {
  const navigate = useNavigate()

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const particles = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, index) => {
        const seed = index * 137.508

        return {
          id: index,
          left: (seed * 7.31) % 100,
          top: (seed * 13.17) % 100,
          duration: 5 + (index % 5) * 2,
          delay: index % 5,
        }
      }),
    [],
  )

  const fetchBroadcasts = useCallback(
    async (
      targetPage: number,
      isLoadMore = false,
    ) => {
      try {
        if (isLoadMore) {
          setLoadingMore(true)
        } else {
          setLoading(true)
        }

        const from = targetPage * ITEMS_PER_PAGE
        const to = from + ITEMS_PER_PAGE - 1

        let query = supabase
          .from('streams')
          .select(
            `
              id,
              title,
              category,
              current_viewers,
              viewer_count,
              is_live,
              is_featured,
              broadcaster_id,
              battle_mode,
              battle_format
            `,
            { count: 'exact' },
          )
          .eq('is_live', true)
          .order('current_viewers', {
            ascending: false,
          })
          .range(from, to)

        if (filter !== 'all') {
          query = query.eq('category', filter)
        }

        const {
          data: streamsData,
          error: streamsError,
          count,
        } = await query

        if (streamsError) {
          throw streamsError
        }

        const streamsWithBroadcasters: any[] = []

        if (streamsData && streamsData.length > 0) {
          const broadcasterIds = Array.from(
            new Set(
              streamsData
                .map((stream: any) => stream.broadcaster_id)
                .filter(Boolean),
            ),
          )

          let broadcasterMap = new Map<string, any>()

          if (broadcasterIds.length > 0) {
            const {
              data: broadcasters,
              error: broadcasterError,
            } = await supabase
              .from('user_profiles')
              .select(
                'id, username, avatar_url, level, created_at',
              )
              .in('id', broadcasterIds)

            if (broadcasterError) {
              console.error(
                'Error fetching broadcasters:',
                broadcasterError,
              )
            }

            if (broadcasters) {
              broadcasterMap = new Map(
                broadcasters.map((broadcaster: any) => [
                  broadcaster.id,
                  broadcaster,
                ]),
              )
            }
          }

          streamsWithBroadcasters.push(
            ...streamsData.map((stream: any) => ({
              ...stream,
              user_profiles: broadcasterMap.get(
                stream.broadcaster_id,
              ),
            })),
          )
        }

        const formattedStreams: Broadcast[] =
          streamsWithBroadcasters.map((stream) => ({
            ...stream,
            type: 'stream',
          }))

        /*
         * If there are no live streams on the first page,
         * show recent completed broadcasts as replays.
         */
        let endedStreams: Broadcast[] = []

        if (
          targetPage === 0 &&
          formattedStreams.length === 0
        ) {
          const {
            data: endedData,
            error: endedError,
          } = await supabase
            .from('streams')
            .select(
              `
                id,
                title,
                category,
                viewer_count,
                current_viewers,
                is_live,
                is_featured,
                broadcaster_id,
                battle_mode,
                battle_format,
                ended_at,
                started_at,
                recording_url
              `,
            )
            .eq('status', 'ended')
            .not('ended_at', 'is', null)
            .order('ended_at', {
              ascending: false,
            })
            .limit(20)

          if (
            !endedError &&
            endedData &&
            endedData.length > 0
          ) {
            const endedBroadcasterIds = Array.from(
              new Set(
                endedData
                  .map((stream: any) => stream.broadcaster_id)
                  .filter(Boolean),
              ),
            )

            let endedBroadcasterMap =
              new Map<string, any>()

            if (endedBroadcasterIds.length > 0) {
              const {
                data: endedBroadcasters,
              } = await supabase
                .from('user_profiles')
                .select(
                  'id, username, avatar_url, level, created_at',
                )
                .in('id', endedBroadcasterIds)

              if (endedBroadcasters) {
                endedBroadcasterMap = new Map(
                  endedBroadcasters.map(
                    (broadcaster: any) => [
                      broadcaster.id,
                      broadcaster,
                    ],
                  ),
                )
              }
            }

            endedStreams = endedData.map(
              (stream: any) => ({
                ...stream,
                type: 'stream' as const,
                user_profiles:
                  endedBroadcasterMap.get(
                    stream.broadcaster_id,
                  ),
                is_ended: true,
              }),
            )
          }
        }

        const newBroadcasts = [
          ...formattedStreams,
          ...endedStreams,
        ]

        if (isLoadMore) {
          setBroadcasts((previous) => [
            ...previous,
            ...newBroadcasts,
          ])
          setPage(targetPage)
        } else {
          setBroadcasts(newBroadcasts)
          setPage(0)
        }

        if (count !== null) {
          setHasMore(to < count - 1)
        } else {
          setHasMore(
            (streamsData?.length || 0) ===
              ITEMS_PER_PAGE,
          )
        }
      } catch (error) {
        console.error(
          'Error fetching broadcasts:',
          error,
        )

        toast.error('Failed to load live broadcasts')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filter],
  )

  /*
   * Initial load + filter changes.
   */
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'instant' as ScrollBehavior,
    })

    setBroadcasts([])
    setPage(0)
    setHasMore(true)

    const jitter = Math.random() * 500

    const timeout = window.setTimeout(() => {
      fetchBroadcasts(0, false)
    }, jitter)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [filter, fetchBroadcasts])

  /*
   * Refresh live streams periodically.
   */
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.hidden) return

      if (window.scrollY < 500) {
        fetchBroadcasts(0, false)
      }
    }, 60000)

    return () => {
      window.clearInterval(interval)
    }
  }, [fetchBroadcasts])

  /*
   * Realtime stream updates.
   */
  useEffect(() => {
    const channel = supabase
      .channel('phone_live_now_streams')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: 'is_live=eq.true',
        },
        () => {
          if (window.scrollY < 500) {
            fetchBroadcasts(0, false)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchBroadcasts])

  const getTimeSince = (timestamp?: string) => {
    if (!timestamp) return ''

    const difference = Math.max(
      0,
      Date.now() -
        new Date(timestamp).getTime(),
    )

    const minutes = Math.floor(
      difference / 60000,
    )

    if (minutes < 1) return 'now'

    if (minutes < 60) {
      return `${minutes}m ago`
    }

    const hours = Math.floor(minutes / 60)

    if (hours < 24) {
      return `${hours}h ago`
    }

    const days = Math.floor(hours / 24)

    return `${days}d ago`
  }

  const handleBroadcastClick = (
    broadcast: Broadcast,
  ) => {
    if (broadcast.is_ended) {
      navigate(
        `/replay/id/${broadcast.id}`,
        {
          state: {
            fromExplore: true,
            fromPhoneLiveNow: true,
          },
        },
      )
      return
    }

    navigate(
      `/watch/${broadcast.id}`,
      {
        state: {
          fromExplore: true,
          fromPhoneLiveNow: true,
        },
      },
    )
  }

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return

    fetchBroadcasts(page + 1, true)
  }

  const liveBroadcasts = broadcasts.filter(
    (broadcast) => !broadcast.is_ended,
  )

  const replayBroadcasts = broadcasts.filter(
    (broadcast) => broadcast.is_ended,
  )

  const totalViewers = liveBroadcasts.reduce(
    (total, broadcast) =>
      total +
      (broadcast.current_viewers ||
        broadcast.viewer_count ||
        0),
    0,
  )

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#05010f] text-white">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-25%] top-[-10%] h-[320px] w-[320px] rounded-full bg-[#8b00ff]/10 blur-[100px]" />

        <div className="absolute right-[-25%] top-[20%] h-[280px] w-[280px] rounded-full bg-[#00BFFF]/10 blur-[100px]" />

        <div className="absolute bottom-[10%] left-[20%] h-[240px] w-[240px] rounded-full bg-purple-600/10 blur-[100px]" />
      </div>

      {/* Floating particles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="absolute h-1 w-1 rounded-full bg-[#00BFFF]/30"
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              animation: `phone-live-particle ${particle.duration}s ease-in-out infinite`,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#00BFFF]/20 bg-[#05010f]/90 px-4 py-3 backdrop-blur-2xl">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition active:scale-95"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-2">
          <Radio
            size={17}
            className="text-[#00BFFF]"
          />

          <h1
            className={`text-sm font-black uppercase tracking-widest ${neonTextGradient}`}
          >
            Live Now
          </h1>
        </div>

        <div className="flex h-9 w-9 items-center justify-center">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
        </div>
      </header>

      <main className="relative z-10 px-4 pb-10 pt-4">
        {/* Page intro */}
        <section
          className={`${neonCard} overflow-hidden p-5`}
        >
          <div className="relative">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#00BFFF]/10 blur-3xl" />

            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#8b00ff] to-[#00BFFF] shadow-[0_0_20px_rgba(0,191,255,.25)]">
                  <Radio
                    size={16}
                    className="text-white"
                  />
                </span>

                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00BFFF]">
                  Broadcast Network
                </span>
              </div>

              <h2
                className={`mt-4 text-2xl font-black ${neonTextGradient}`}
              >
                Live Now
              </h2>

              <p className="mt-2 text-xs leading-5 text-zinc-400">
                Browse live broadcasts across the
                MaiTroll network.
              </p>
            </div>
          </div>
        </section>

        {/* Filters */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(['all', 'irl'] as FilterType[]).map(
            (category) => {
              const active =
                filter === category

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() =>
                    setFilter(category)
                  }
                  className={[
                    'shrink-0 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all',
                    active
                      ? 'bg-gradient-to-r from-[#8b00ff] to-[#00BFFF] text-white shadow-[0_0_20px_rgba(0,191,255,.2)]'
                      : 'border border-white/10 bg-white/[0.04] text-zinc-400',
                  ].join(' ')}
                >
                  {category === 'all'
                    ? 'All'
                    : 'IRL'}
                </button>
              )
            },
          )}
        </div>

        {/* Stats */}
        <section
          className={`${neonCard} mt-4 flex items-center justify-between gap-3 p-4`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>

            <div className="min-w-0">
              <p className="text-sm font-black text-white">
                {liveBroadcasts.length}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                Live
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="flex min-w-0 items-center gap-2">
            <Users
              size={15}
              className="shrink-0 text-[#00BFFF]"
            />

            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">
                {totalViewers.toLocaleString()}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                Viewers
              </p>
            </div>
          </div>

          {replayBroadcasts.length > 0 && (
            <>
              <div className="h-8 w-px bg-white/10" />

              <div className="flex min-w-0 items-center gap-2">
                <Play
                  size={15}
                  className="shrink-0 text-purple-400"
                />

                <div className="min-w-0">
                  <p className="text-sm font-black text-white">
                    {replayBroadcasts.length}
                  </p>

                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                    Replays
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Loading */}
        {loading && broadcasts.length === 0 && (
          <div className="mt-5 grid grid-cols-1 gap-4">
            {Array.from({ length: 6 }).map(
              (_, index) => (
                <div
                  key={index}
                  className={`${neonCard} overflow-hidden animate-pulse`}
                >
                  <div className="aspect-video bg-white/[0.04]" />

                  <div className="space-y-3 p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-white/[0.06]" />

                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/2 rounded bg-white/[0.06]" />
                        <div className="h-2 w-1/3 rounded bg-white/[0.04]" />
                      </div>
                    </div>

                    <div className="h-4 w-4/5 rounded bg-white/[0.06]" />
                    <div className="h-3 w-20 rounded bg-white/[0.04]" />
                  </div>
                </div>
              ),
            )}
          </div>
        )}

        {/* Empty */}
        {!loading &&
          broadcasts.length === 0 && (
            <section
              className={`${neonCard} mt-5 px-5 py-14 text-center`}
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#00BFFF]/20 bg-[#00BFFF]/5">
                <Radio
                  size={28}
                  className="text-[#00BFFF]"
                />
              </div>

              <h3 className="mt-5 text-lg font-black text-white">
                No one is live
              </h3>

              <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-zinc-500">
                There are no live broadcasts right
                now. Check back later to see who is
                streaming.
              </p>

              <button
                type="button"
                onClick={() =>
                  fetchBroadcasts(0, false)
                }
                className="mt-5 rounded-xl bg-gradient-to-r from-[#8b00ff] to-[#00BFFF] px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(0,191,255,.2)]"
              >
                Refresh
              </button>
            </section>
          )}

        {/* Broadcast list */}
        {!loading && broadcasts.length > 0 && (
          <div className="mt-5 space-y-4">
            {broadcasts.map((broadcast) => {
              const viewerCount =
                broadcast.current_viewers ||
                broadcast.viewer_count ||
                0

              return (
                <article
                  key={broadcast.id}
                  onClick={() =>
                    handleBroadcastClick(
                      broadcast,
                    )
                  }
                  className={`${neonCard} group cursor-pointer overflow-hidden transition-transform active:scale-[0.985]`}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-purple-950 via-[#09051b] to-cyan-950">
                    {broadcast.thumbnail_url ? (
                      <img
                        src={
                          broadcast.thumbnail_url
                        }
                        alt={
                          broadcast.title ||
                          'Live broadcast'
                        }
                        className="h-full w-full object-cover transition-transform duration-500 group-active:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(139,0,255,.18),transparent_55%)]">
                        <Play
                          size={48}
                          className="text-white/20"
                        />
                      </div>
                    )}

                    {/* Thumbnail gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                    {/* Live / Replay badge */}
                    <div
                      className={[
                        'absolute left-3 top-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 backdrop-blur-md',
                        broadcast.is_ended
                          ? 'bg-purple-600/90'
                          : 'bg-red-600/90',
                      ].join(' ')}
                    >
                      {broadcast.is_ended ? (
                        <Play
                          size={10}
                          fill="white"
                        />
                      ) : (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      )}

                      <span className="text-[9px] font-black uppercase tracking-wider">
                        {broadcast.is_ended
                          ? 'Replay'
                          : 'Live'}
                      </span>
                    </div>

                    {/* Viewer count */}
                    <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 backdrop-blur-md">
                      <Eye
                        size={11}
                        className="text-white"
                      />

                      <span className="text-[10px] font-black text-white">
                        {viewerCount.toLocaleString()}
                      </span>
                    </div>

                    {/* Bottom metadata */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                      <span className="rounded-lg border border-white/10 bg-black/50 px-2.5 py-1.5 text-[9px] font-bold capitalize text-white backdrop-blur-md">
                        {broadcast.category ||
                          'General'}
                      </span>

                      <span className="text-[9px] font-bold text-zinc-300">
                        {getTimeSince(
                          broadcast.started_at,
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex gap-3">
                      {/* Avatar */}
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-[#00BFFF]/20 bg-gradient-to-br from-[#8b00ff] to-[#00BFFF] p-[1px]">
                        <div className="h-full w-full overflow-hidden rounded-full bg-[#090313]">
                          {broadcast.user_profiles
                            ?.avatar_url ? (
                            <img
                              src={
                                broadcast
                                  .user_profiles
                                  .avatar_url
                              }
                              alt={
                                broadcast
                                  .user_profiles
                                  .username ||
                                'Broadcaster'
                              }
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Users
                                size={18}
                                className="text-[#00BFFF]"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* User */}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-white">
                          <UserNameWithAge
                            user={{
                              username:
                                broadcast
                                  .user_profiles
                                  ?.username ||
                                'Unknown',
                              id: broadcast.broadcaster_id,
                              ...broadcast.user_profiles,
                            }}
                          />
                        </div>

                        <div className="mt-1 flex items-center gap-2">
                          {broadcast.user_profiles
                            ?.level ? (
                            <span className="rounded-md bg-gradient-to-r from-[#8b00ff] to-purple-500 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white">
                              T League
                            </span>
                          ) : null}

                          <span className="text-[9px] text-zinc-500">
                            {getTimeSince(
                              broadcast.started_at,
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="mt-3 line-clamp-2 text-sm font-black leading-5 text-white transition-colors group-active:text-[#00BFFF]">
                      {broadcast.title ||
                        'Untitled Stream'}
                    </h3>

                    {/* Bottom row */}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[9px] font-bold capitalize text-zinc-400">
                        {broadcast.category ||
                          'General'}
                      </span>

                      <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-500">
                        <Eye size={11} />
                        {viewerCount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* Load more */}
        {hasMore &&
          broadcasts.length > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={handleLoadMore}
                className="w-full rounded-xl border border-[#00BFFF]/20 bg-gradient-to-r from-[#8b00ff]/20 to-[#00BFFF]/20 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(139,0,255,.12)] transition active:scale-[0.98] disabled:opacity-50"
              >
                {loadingMore
                  ? 'Loading...'
                  : 'Load More Streams'}
              </button>
            </div>
          )}

        {/* End of feed */}
        {!hasMore &&
          broadcasts.length > 0 && (
            <div className="pb-4 pt-8 text-center">
              <div className="mx-auto mb-2 h-px w-16 bg-gradient-to-r from-transparent via-[#00BFFF]/40 to-transparent" />

              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
                End of Live Feed
              </p>
            </div>
          )}
      </main>

      <style>{`
        @keyframes phone-live-particle {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
            opacity: 0;
          }

          10% {
            opacity: 0.5;
          }

          50% {
            transform: translate3d(25px, -60px, 0);
            opacity: 0.35;
          }

          90% {
            opacity: 0.5;
          }
        }

        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }

        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}