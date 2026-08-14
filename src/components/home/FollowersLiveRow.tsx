import React, { useEffect, useState, useCallback } from 'react'
import { Radio, Users, Play, UserPlus, Heart } from 'lucide-react'
import HorizontalScrollRow from './HorizontalScrollRow'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useNavigate } from 'react-router-dom'

interface FollowerLiveStream {
  id: string
  title: string
  streamerName: string
  streamerAvatar: string | null
  viewerCount: number
  category: string | null
  isBattle: boolean
  battleFormat: string | null
}

export default function FollowersLiveRow({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const [streams, setStreams] = useState<FollowerLiveStream[]>([])
  const [loading, setLoading] = useState(true)
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const fetchFollowersLive = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false)
      onCountChange?.(0)
      return
    }

    try {
      const { data: follows, error: followsError } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', profile.id)

      if (followsError) throw followsError

      const followingIds = (follows || []).map((f: any) => f.following_id)
      if (followingIds.length === 0) {
        setStreams([])
        onCountChange?.(0)
        setLoading(false)
        return
      }

      const { data: liveStreams, error: streamsError } = await supabase
        .from('streams')
        .select(`
          id,
          title,
          current_viewers,
          viewer_count,
          category,
          battle_mode,
          battle_format,
          broadcaster_id,
          user_profiles!streams_broadcaster_id_fkey(username, avatar_url)
        `)
        .eq('is_live', true)
        .in('broadcaster_id', followingIds)
        .order('current_viewers', { ascending: false })
        .limit(20)

      if (streamsError) throw streamsError

      const mapped: FollowerLiveStream[] = (liveStreams || []).map((s: any) => ({
        id: s.id,
        title: s.title || 'Untitled Stream',
        streamerName: s.user_profiles?.username || 'Unknown',
        streamerAvatar: s.user_profiles?.avatar_url || null,
        viewerCount: s.current_viewers || s.viewer_count || 0,
        category: s.category || null,
        isBattle: s.battle_mode === 'universal',
        battleFormat: s.battle_format || null,
      }))

      setStreams(mapped)
      onCountChange?.(mapped.length)
    } catch (err) {
      console.error('Error fetching followers live streams:', err)
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    fetchFollowersLive()

    if (!profile?.id) return

    const channel = supabase
      .channel(`followers-live:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'streams',
          filter: `status=eq.live`,
        },
        () => fetchFollowersLive(),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `status=eq.live`,
        },
        () => fetchFollowersLive(),
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [fetchFollowersLive, profile?.id])

  if (!profile?.id) return null

  return (
    <HorizontalScrollRow
      title="Following Live"
      subtitle={
        !loading && streams.length > 0
          ? `${streams.length} followed ${streams.length === 1 ? 'creator is' : 'creators are'} live`
          : 'Creators you follow going live'
      }
      icon={<Heart className="h-3.5 w-3.5 text-pink-400" />}
    >
      {loading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[220px] w-[180px] shrink-0 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.03]" />
        ))
      ) : streams.length > 0 ? (
        streams.map((item) => {
          const avatarUrl =
            item.streamerAvatar ||
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.streamerName)}`

          return (
            <button
              key={item.id}
              onClick={() =>
                navigate(
                  item.category === 'gaming'
                    ? `/gaming/live/${encodeURIComponent(item.streamerName)}`
                    : `/live/${encodeURIComponent(item.streamerName)}`
                )
              }
              className="group relative flex h-[220px] w-[180px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080c1a]/95 text-left transition-all duration-200 hover:border-pink-400/30 hover:shadow-[0_0_24px_rgba(244,114,182,0.12)]"
            >
              <div className="relative h-[130px] w-full shrink-0 overflow-hidden">
                {item.streamerAvatar ? (
                  <img src={item.streamerAvatar} alt="" loading="lazy" className="h-full w-full object-cover opacity-70 transition-transform duration-500 group-hover:scale-[1.06]" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-pink-900/40 via-[#080c1a] to-purple-900/30" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#080c1a]/95" />

                <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  LIVE
                </div>

                {item.isBattle && (
                  <div className="absolute left-2 top-8 flex items-center gap-1 rounded-md bg-yellow-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
                    ⚔️ {item.battleFormat?.toUpperCase() || 'BATTLE'}
                  </div>
                )}

                <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                  <Users className="h-2.5 w-2.5" />
                  {item.viewerCount}
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-pink-600/90 shadow-[0_0_20px_rgba(244,114,182,0.4)] backdrop-blur-sm">
                    <Play className="h-5 w-5 text-white" fill="white" />
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
                    <img src={avatarUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#080c1a] bg-pink-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-white">{item.streamerName}</p>
                    <p className="truncate text-[9px] font-bold text-white/35">{item.category || 'Streaming'}</p>
                  </div>
                </div>
                <p className="line-clamp-2 flex-1 text-[10px] leading-relaxed text-white/40">{item.title}</p>
              </div>
            </button>
          )
        })
      ) : (
        <div className="flex h-[220px] w-full shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.08] bg-[#080c1a]/60 p-4 text-center">
          <UserPlus className="h-8 w-8 text-pink-400/40" />
          <p className="text-xs font-bold text-white/30">No Followers Live</p>
          <p className="text-[10px] text-white/15 max-w-[200px]">
            Follow creators to see them here when they go live!
          </p>
        </div>
      )}
    </HorizontalScrollRow>
  )
}
