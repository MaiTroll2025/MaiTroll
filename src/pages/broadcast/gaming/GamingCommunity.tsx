import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Users, Gift, Crown, Heart } from 'lucide-react';
import { supabase } from '@/lib/supabase'
import { useGamingStreamId } from '@/contexts/GamingStreamContext'

interface TopGifter {
  username: string
  avatar_url: string | null
  total_coins: number
}

interface Follower {
  username: string
  avatar_url: string | null
}

export default function GamingCommunity() {
  const streamId = useGamingStreamId()
  const [topGifters, setTopGifters] = useState<TopGifter[]>([])
  const [followers, setFollowers] = useState<Follower[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!streamId) return

    const fetchCommunity = async () => {
      try {
        const { data: gifts } = await supabase
          .from('stream_gifts')
          .select('sender_id, total_coins, profiles!stream_gifts_sender_id_fkey(username, avatar_url)')
          .eq('stream_id', streamId)
          .order('total_coins', { ascending: false })
          .limit(10)

        if (gifts) {
          const gifters: TopGifter[] = gifts.map((g: any) => ({
            username: g.profiles?.username || 'Anonymous',
            avatar_url: g.profiles?.avatar_url || null,
            total_coins: g.total_coins || 0,
          }))
          setTopGifters(gifters)
        }

        const { data: stream } = await supabase
          .from('streams')
          .select('broadcaster_id')
          .eq('id', streamId)
          .maybeSingle()

        if (stream?.broadcaster_id) {
          const { data: subs } = await supabase
            .from('user_subscriptions')
            .select('subscriber_id, subscriber:user_profiles!user_subscriptions_subscriber_id_fkey(username, avatar_url)')
            .eq('broadcaster_id', stream.broadcaster_id)
            .eq('is_active', true)
            .limit(20);

          if (subs) {
            setFollowers(subs.map((s: any) => ({
              username: s.subscriber?.username || 'User',
              avatar_url: s.subscriber?.avatar_url || null,
            })))
          }
        }
      } catch (err) {
        console.error('[GamingCommunity] Fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchCommunity()
  }, [streamId])

  if (loading) {
    return (
      <div className="grid min-h-[400px] place-items-center">
        <p className="text-sm text-slate-400">Loading community...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#05080f] p-4 sm:p-6 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Link to={`/broadcast/setup/gaming`} className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Users className="h-5 w-5 text-purple-300" />
          <h1 className="text-xl font-black">Community</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-purple-400/20 bg-white/[0.04] p-4">
            <div className="mb-4 flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-black text-amber-300">Top Gifters</h3>
            </div>
            {topGifters.length === 0 ? (
              <p className="text-xs text-slate-500">No gifts yet</p>
            ) : (
              <div className="space-y-3">
                {topGifters.map((g, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-5 text-center text-xs font-black text-slate-500">{i + 1}</span>
                    {g.avatar_url ? (
                      <img src={g.avatar_url} className="h-8 w-8 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-purple-500/20 text-xs font-black text-purple-300">
                        {g.username.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-xs font-bold text-white">{g.username}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-amber-300">
                      <Gift className="h-3 w-3" />
                      {g.total_coins.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-cyan-400/20 bg-white/[0.04] p-4">
            <div className="mb-4 flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-400" />
              <h3 className="text-sm font-black text-pink-300">Followers</h3>
            </div>
            {followers.length === 0 ? (
              <p className="text-xs text-slate-500">No followers yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {followers.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2">
                    {f.avatar_url ? (
                      <img src={f.avatar_url} className="h-6 w-6 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="grid h-6 w-6 place-items-center rounded-full bg-cyan-500/20 text-[10px] font-black text-cyan-300">
                        {f.username.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-bold text-white truncate">{f.username}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
