import React, { useEffect, useState } from 'react'
import { Users, Play, Crown } from 'lucide-react';
import HorizontalScrollRow from './HorizontalScrollRow'
import { supabase } from '@/lib/supabase'

interface BestTroller {
  id: string
  title: string
  streamerName: string
  streamerAvatar: string | null
  viewerCount: number
  category: string | null
  trollCoins: number
}

export default function BestTrollersRow({ onClickItem }: { onClickItem: (id: string) => void }) {
  const [streamers, setStreamers] = useState<BestTroller[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBestTrollers = async () => {
      try {
        const { data: liveStreams } = await supabase
          .from('streams')
          .select(`
            id,
            title,
            current_viewers,
            viewer_count,
            category,
            broadcaster_id,
            user_profiles!streams_broadcaster_id_fkey(username, avatar_url, troll_coins)
          `)
          .eq('is_live', true)
          .order('current_viewers', { ascending: false })
          .limit(50)

        if (!liveStreams) { setLoading(false); return }

        const sorted = liveStreams
          .sort((a: any, b: any) => {
            const aCoins = a.user_profiles?.troll_coins || 0
            const bCoins = b.user_profiles?.troll_coins || 0
            return bCoins - aCoins
          })
          .slice(0, 12)
          .map((s: any) => ({
            id: s.id,
            title: s.title || 'Untitled Stream',
            streamerName: s.user_profiles?.username || 'Unknown',
            streamerAvatar: s.user_profiles?.avatar_url || null,
            viewerCount: s.current_viewers || s.viewer_count || 0,
            category: s.category || null,
            trollCoins: s.user_profiles?.troll_coins || 0,
          }))

        setStreamers(sorted)
      } catch (err) {
        console.error('Error fetching best trollers:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchBestTrollers()
  }, [])

  return (
    <HorizontalScrollRow
      title="Best Trollers"
      subtitle={!loading && streamers.length > 0 ? 'Top creators by coins' : 'Top trollers will appear here'}
      icon={<Crown className="h-3.5 w-3.5 text-yellow-400" />}
    >
      {loading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[220px] w-[180px] shrink-0 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.03]" />
        ))
      ) : streamers.length > 0 ? (
        streamers.map((item, index) => {
          const avatarUrl =
            item.streamerAvatar ||
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.streamerName)}`

          return (
            <button
              key={item.id}
              onClick={() => onClickItem(item.id)}
              className="group relative flex h-[220px] w-[180px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080c1a]/95 text-left transition-all duration-200 hover:border-yellow-400/30 hover:shadow-[0_0_24px_rgba(250,204,21,0.12)]"
            >
              <div className="relative h-[130px] w-full shrink-0 overflow-hidden">
                {item.streamerAvatar ? (
                  <img src={item.streamerAvatar} alt="" loading="lazy" className="h-full w-full object-cover opacity-70 transition-transform duration-500 group-hover:scale-[1.06]" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-yellow-900/40 via-[#080c1a] to-amber-900/30" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#080c1a]/95" />
                <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  LIVE
                </div>
                <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                  <Users className="h-2.5 w-2.5" />
                  {item.viewerCount}
                </div>
                {index < 3 && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-yellow-600/90 px-1.5 py-0.5 text-[8px] font-black text-white">
                    <Crown className="h-2.5 w-2.5" />
                    #{index + 1}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-yellow-600/90 shadow-[0_0_20px_rgba(250,204,21,0.4)] backdrop-blur-sm">
                    <Play className="h-5 w-5 text-white" fill="white" />
                  </div>
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
                    <img src={avatarUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#080c1a] bg-yellow-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-white">{item.streamerName}</p>
                    <p className="truncate text-[9px] font-bold text-yellow-400/60">💰 {item.trollCoins.toLocaleString()} coins</p>
                  </div>
                </div>
                <p className="line-clamp-2 flex-1 text-[10px] leading-relaxed text-white/40">{item.title}</p>
              </div>
            </button>
          )
        })
      ) : (
        <div className="flex h-[220px] w-[180px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.08] bg-[#080c1a]/60 p-4 text-center">
          <Crown className="h-8 w-8 text-yellow-400/40" />
          <p className="text-xs font-bold text-white/30">No Trollers Live</p>
          <p className="text-[10px] text-white/15">Top trollers will appear here!</p>
        </div>
      )}
    </HorizontalScrollRow>
  )
}
