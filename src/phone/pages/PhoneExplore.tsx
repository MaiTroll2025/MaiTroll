import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Eye,
  Play,
  Radio,
  Search,
  Users,
  Flame,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { searchUsers } from '@/lib/filtered'
import { getPhoneNavSections, type PhoneNavSection } from '../phoneNav'
import { usePhoneRoleAccess } from '../usePhoneRoleAccess'
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

interface WallPost {
  id: string
  content: string
  created_at: string
  user_id: string
  username?: string
  avatar_url?: string
  likes_count?: number
  replies_count?: number
  user_liked?: boolean
}

export default function PhoneExplore() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roleAccess = usePhoneRoleAccess()

  const initialQuery = searchParams.get('q') || ''
  const [search, setSearch] = useState(initialQuery)
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [posts, setPosts] = useState<WallPost[]>([])
  const [users, setUsers] = useState<{ id: string; username: string; display_name?: string; avatar_url?: string }[]>([])
  const [loadingStreams, setLoadingStreams] = useState(true)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(false)

  const sections: PhoneNavSection[] = useMemo(
    () => getPhoneNavSections(roleAccess),
    [roleAccess],
  )

  const visibleSections = useMemo(
    () =>
      sections.filter((section) =>
        section.items.some((item) => item.show !== false),
      ),
    [sections],
  )

  const flatPages = useMemo(
    () =>
      visibleSections.flatMap((section) =>
        section.items
          .filter((item) => item.show !== false)
          .map((item) => ({ ...item, section: section.title })),
      ),
    [visibleSections],
  )

  const filteredPages = useMemo(() => {
    if (!search.trim()) return flatPages
    const q = search.trim().toLowerCase()
    return flatPages.filter((item) =>
      item.label.toLowerCase().includes(q),
    )
  }, [flatPages, search])

  const fetchStreams = useCallback(async () => {
    try {
      setLoadingStreams(true)
      const { data, error } = await supabase
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
        .order('current_viewers', { ascending: false })
        .limit(12)

      if (error) throw error

      const streamsWithBroadcasters: any[] = []
      if (data && data.length > 0) {
        const broadcasterIds = Array.from(
          new Set(
            data
              .map((stream: any) => stream.broadcaster_id)
              .filter(Boolean),
          ),
        )

        let broadcasterMap = new Map<string, any>()
        if (broadcasterIds.length > 0) {
          const { data: broadcasters } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url, level, created_at')
            .in('id', broadcasterIds)

          if (broadcasters) {
            broadcasterMap = new Map(
              broadcasters.map((b: any) => [b.id, b]),
            )
          }
        }

        streamsWithBroadcasters.push(
          ...data.map((stream: any) => ({
            ...stream,
            user_profiles: broadcasterMap.get(stream.broadcaster_id),
            type: 'stream',
          })),
        )
      }

      setBroadcasts(streamsWithBroadcasters)
    } catch (err) {
      console.error('Failed to fetch explore streams:', err)
    } finally {
      setLoadingStreams(false)
    }
  }, [])

  const fetchPosts = useCallback(async () => {
    try {
      setLoadingPosts(true)
      const { data, error } = await supabase
        .from('troll_wall_posts')
        .select(
          'id, content, created_at, user_id, username, avatar_url, likes_count, replies_count',
        )
        .is('reply_to_post_id', null)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setPosts((data || []) as WallPost[])
    } catch (err) {
      console.error('Failed to fetch explore posts:', err)
    } finally {
      setLoadingPosts(false)
    }
  }, [])

  useEffect(() => {
    fetchStreams()
    fetchPosts()
  }, [fetchStreams, fetchPosts])

  useEffect(() => {
    const query = search.trim()
    if (!query) {
      setUsers([])
      return
    }

    let cancelled = false
    setLoadingUsers(true)

    const isUserQuery = query.startsWith('@') || query.length >= 2

    if (isUserQuery) {
      const term = query.startsWith('@') ? query.slice(1) : query
      searchUsers(term)
        .then((results) => {
          if (!cancelled) {
            setUsers(
              results.map((u: any) => ({
                id: u.id,
                username: u.username,
                display_name: u.display_name,
                avatar_url: u.avatar_url,
              })),
            )
          }
        })
        .catch((err) => {
          console.error('Failed to search users:', err)
        })
        .finally(() => {
          if (!cancelled) setLoadingUsers(false)
        })
    } else {
      setLoadingUsers(false)
      setUsers([])
    }

    return () => {
      cancelled = true
    }
  }, [search])

  const getTimeSince = (timestamp: string) => {
    const minutes = Math.floor(
      (Date.now() - new Date(timestamp).getTime()) / 60000,
    )
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

  const totalViewers = broadcasts.reduce(
    (total, b) => total + (b.current_viewers || b.viewer_count || 0),
    0,
  )

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#05010f] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-25%] top-[-10%] h-[320px] w-[320px] rounded-full bg-[#8b00ff]/10 blur-[100px]" />
        <div className="absolute right-[-25%] top-[20%] h-[280px] w-[280px] rounded-full bg-[#00BFFF]/10 blur-[100px]" />
        <div className="absolute bottom-[10%] left-[20%] h-[240px] w-[240px] rounded-full bg-purple-600/10 blur-[100px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-[#00BFFF]/20 bg-[#05010f]/90 px-4 py-3 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Go back"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition active:scale-95"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
               <input
                 type="text"
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 placeholder="Search pages, users, posts, #tags..."
                 className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20"
               />
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-4 pb-10 pt-4">
        {!search.trim() && (
          <>
            {/* Live Now */}
            <section className={`${neonCard} overflow-hidden p-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#8b00ff] to-[#00BFFF] shadow-[0_0_20px_rgba(0,191,255,.25)]">
                    <Radio size={16} className="text-white" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00BFFF]">
                      Broadcast Network
                    </p>
                    <h2 className={`text-lg font-black ${neonTextGradient}`}>
                      Live Now
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-black text-zinc-400">
                  <Eye size={12} />
                  {totalViewers.toLocaleString()}
                </div>
              </div>

              {loadingStreams ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-video rounded-xl bg-white/[0.04] animate-pulse"
                    />
                  ))}
                </div>
              ) : broadcasts.length === 0 ? (
                <p className="mt-4 text-center text-xs text-zinc-500">
                  No one is live right now.
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {broadcasts.slice(0, 6).map((broadcast) => (
                    <button
                      key={broadcast.id}
                      onClick={() =>
                        broadcast.is_ended
                          ? navigate(`/replay/id/${broadcast.id}`)
                          : navigate(`/watch/${broadcast.id}`)
                      }
                      className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] text-left transition active:scale-[0.97]"
                    >
                      {broadcast.thumbnail_url ? (
                        <img
                          src={broadcast.thumbnail_url}
                          alt={broadcast.title || 'Live'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-950 via-[#09051b] to-cyan-950">
                          <Play size={20} className="text-white/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-red-600/90 px-1.5 py-1 backdrop-blur-md">
                        {broadcast.is_ended ? (
                          <Play size={8} fill="white" />
                        ) : (
                          <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
                        )}
                        <span className="text-[8px] font-black uppercase tracking-wider text-white">
                          {broadcast.is_ended ? 'Replay' : 'Live'}
                        </span>
                      </div>
                      <div className="absolute bottom-2 left-2 right-2">
                        <p className="truncate text-[10px] font-black text-white">
                          {broadcast.title || 'Untitled Stream'}
                        </p>
                        <p className="truncate text-[8px] font-bold text-zinc-300">
                          {broadcast.user_profiles?.username || 'Unknown'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Trending Posts */}
            <section className="mt-6">
              <div className="flex items-center gap-2 px-1">
                <Flame size={16} className="text-orange-400" />
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-300">
                  Trending Posts
                </h3>
              </div>

              {loadingPosts ? (
                <div className="mt-3 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className={`${neonCard} h-20 animate-pulse`}
                    />
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <p className="mt-3 text-center text-xs text-zinc-500">
                  No posts yet. Be the first!
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {posts.slice(0, 8).map((post) => (
                    <button
                      key={post.id}
                      onClick={() => navigate('/community-wall')}
                      className={`${neonCard} w-full px-4 py-3 text-left transition active:scale-[0.985]`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8b00ff] to-[#00BFFF] text-[10px] font-black text-white">
                          {(post.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate text-xs font-black text-white">
                          {post.username || 'Unknown'}
                        </span>
                        <span className="text-[9px] font-bold text-zinc-500">
                          {getTimeSince(post.created_at)}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-300">
                        {post.content}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* All Pages */}
            <section className="mt-6">
              <h3 className="px-1 text-sm font-black uppercase tracking-[0.2em] text-zinc-300">
                All Pages
              </h3>
              <div className="mt-3 space-y-4">
                {visibleSections.map((section) => (
                  <div key={section.title}>
                    <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                      {section.title}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {section.items
                        .filter((item) => item.show !== false)
                        .map((item) => {
                          const ItemIcon = item.icon
                          return (
                            <button
                              key={item.path + item.label}
                              onClick={() => navigate(item.path)}
                              className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center transition active:scale-[0.97]"
                            >
                              <ItemIcon className="h-5 w-5 text-slate-300" />
                              <span className="text-[10px] font-bold leading-tight text-slate-300">
                                {item.label}
                              </span>
                            </button>
                          )
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {search.trim() && (
          <section className="mt-2 space-y-4">
            {/* Users */}
            {(() => {
              const q = search.trim()
              const showUsers = q.startsWith('@') || q.length >= 2
              if (!showUsers) return null

              const displayUsers = users
              if (loadingUsers) {
                return (
                  <div>
                    <h3 className="px-1 text-sm font-black uppercase tracking-[0.2em] text-zinc-300">Users</h3>
                    <div className="mt-2 space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className={`${neonCard} h-14 animate-pulse`} />
                      ))}
                    </div>
                  </div>
                )
              }

              if (displayUsers.length === 0) {
                return null
              }

              return (
                <div>
                  <h3 className="px-1 text-sm font-black uppercase tracking-[0.2em] text-zinc-300">Users</h3>
                  <div className="mt-2 space-y-2">
                    {displayUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => navigate(`/profile/${user.username}`)}
                        className={`${neonCard} flex w-full items-center gap-3 px-4 py-3 text-left transition active:scale-[0.985]`}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8b00ff] to-[#00BFFF] text-xs font-black text-white">
                          {(user.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-white">@{user.username}</p>
                          {user.display_name && <p className="truncate text-[10px] text-zinc-400">{user.display_name}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Hashtag / text posts */}
            {(() => {
              const q = search.trim()
              const isTag = q.startsWith('#')
              const term = isTag ? q.slice(1).toLowerCase() : q.toLowerCase()

              const matchedPosts = isTag
                ? posts.filter((post) => post.content.toLowerCase().includes(`#${term}`))
                : posts.filter((post) => post.content.toLowerCase().includes(term))

              if (matchedPosts.length === 0) return null

              return (
                <div>
                  <h3 className="px-1 text-sm font-black uppercase tracking-[0.2em] text-zinc-300">
                    {isTag ? 'Hashtag Posts' : 'Matching Posts'}
                  </h3>
                  <div className="mt-2 space-y-2">
                    {matchedPosts.slice(0, 8).map((post) => (
                      <button
                        key={post.id}
                        onClick={() => navigate('/community-wall')}
                        className={`${neonCard} w-full px-4 py-3 text-left transition active:scale-[0.985]`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8b00ff] to-[#00BFFF] text-[10px] font-black text-white">
                            {(post.username || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate text-xs font-black text-white">{post.username || 'Unknown'}</span>
                          <span className="text-[9px] font-bold text-zinc-500">{getTimeSince(post.created_at)}</span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-300">{post.content}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Pages */}
            {filteredPages.length > 0 ? (
              <div>
                <h3 className="px-1 text-sm font-black uppercase tracking-[0.2em] text-zinc-300">Pages</h3>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {filteredPages.map((item) => {
                    const ItemIcon = item.icon
                    return (
                      <button
                        key={item.path + item.label}
                        onClick={() => navigate(item.path)}
                        className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center transition active:scale-[0.97]"
                      >
                        <ItemIcon className="h-5 w-5 text-slate-300" />
                        <span className="text-[10px] font-bold leading-tight text-slate-300">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              !loadingUsers &&
              users.length === 0 && (
                <p className="mt-4 text-center text-xs text-zinc-500">
                  No results for &quot;{search}&quot;
                </p>
              )
            )}
          </section>
        )}
      </main>
    </div>
  )
}
