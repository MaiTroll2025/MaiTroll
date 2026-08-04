import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb, CTASection } from './SEOLayout'
import { Crown, TrendingUp, Users, Star, ArrowRight, Play, Radio, DollarSign, Award, Flame, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Creator {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  level: number
  xp: number
  followers_count: number
  total_earned_coins: number
  is_live: boolean
  stream_id: string | null
  stream_title: string | null
}

export default function TopCreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'followers' | 'earnings' | 'level'>('followers')

  useEffect(() => {
    let mounted = true

    const fetchTopCreators = async () => {
      try {
        // Get top creators by followers
        const { data: profiles, error } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, avatar_url, level, xp, total_earned_coins')
          .not('username', 'is', null)
          .neq('username', '')
          .order(sortBy === 'earnings' ? 'total_earned_coins' : sortBy === 'level' ? 'level' : 'xp', { ascending: false })
          .limit(50)

        if (error) throw error

        // Get follower counts
        const userIds = (profiles || []).map((p: any) => p.id)
        const { data: follows } = await supabase
          .from('user_follows')
          .select('following_id')
          .in('following_id', userIds)

        const followerMap = new Map<string, number>()
        ;(follows || []).forEach((f: any) => {
          followerMap.set(f.following_id, (followerMap.get(f.following_id) || 0) + 1)
        })

        // Get live status
        const { data: liveStreams } = await supabase
          .from('streams')
          .select('id, broadcaster_id, title')
          .eq('is_live', true)

        const liveMap = new Map<string, { id: string; title: string }>()
        ;(liveStreams || []).forEach((s: any) => {
          liveMap.set(s.broadcaster_id, { id: s.id, title: s.title })
        })

        if (mounted) {
          const creatorsList: Creator[] = (profiles || []).map((p: any) => {
            const live = liveMap.get(p.id)
            return {
              id: p.id,
              username: p.username,
              display_name: p.display_name,
              avatar_url: p.avatar_url,
              level: p.level || 1,
              xp: p.xp || 0,
              followers_count: followerMap.get(p.id) || 0,
              total_earned_coins: p.total_earned_coins || 0,
              is_live: !!live,
              stream_id: live?.id || null,
              stream_title: live?.title || null,
            }
          })

          // Sort by selected metric
          creatorsList.sort((a, b) => {
            if (sortBy === 'earnings') return b.total_earned_coins - a.total_earned_coins
            if (sortBy === 'level') return b.level - a.level || b.xp - a.xp
            return b.followers_count - a.followers_count
          })

          setCreators(creatorsList)
          setLoading(false)
        }
      } catch (err) {
        console.error('Error fetching top creators:', err)
        if (mounted) setLoading(false)
      }
    }

    fetchTopCreators()
    const interval = setInterval(fetchTopCreators, 60000)
    return () => { mounted = false; clearInterval(interval) }
  }, [sortBy])

  return (
    <SEOLayout
      title="Top Creators on Mai Troll | Trending Streamers & Leaders"
      description="Discover the top creators on Mai Troll. See the most-followed streamers, highest-earning creators, and trending live broadcasters on our social streaming platform."
      keywords={[
        'MaiTroll creators', 'top creators', 'trending streamers', 'MaiTroll leaders',
        'best streamers', 'popular creators', 'MaiTroll rankings', 'top broadcasters',
        'social streaming platform', 'creator leaderboard'
      ]}
    >
      <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Top Creators' }]} />

      {/* Hero */}
      <section className="relative py-16 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-slate-900 to-purple-900/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-600/20 border border-amber-500/30 text-amber-300 text-sm font-medium mb-6">
            <Crown className="w-4 h-4" />
            Creator Leaderboard
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Top Creators on{' '}
            <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
              Mai Troll
            </span>
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Discover the most popular, highest-earning, and top-level creators on Mai Troll.
            Follow your favorite streamers and watch them go live.
          </p>
        </div>
      </section>

      {/* Sort Tabs */}
      <section className="pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-2">
            {[
              { key: 'followers' as const, label: 'Most Followed', icon: Users },
              { key: 'earnings' as const, label: 'Top Earners', icon: DollarSign },
              { key: 'level' as const, label: 'Highest Level', icon: Award },
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setSortBy(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sortBy === tab.key
                      ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30'
                      : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Creators List */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            </div>
          ) : (
            <div className="grid gap-3">
              {creators.map((creator, index) => (
                <Link
                  key={creator.id}
                  to={`/profile/${encodeURIComponent(creator.username)}`}
                  className="group flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-xl transition-all"
                >
                  {/* Rank */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg ${
                    index === 0 ? 'bg-amber-500/20 text-amber-400' :
                    index === 1 ? 'bg-slate-400/20 text-slate-300' :
                    index === 2 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-slate-800 text-slate-500'
                  }`}>
                    {index < 3 ? (
                      <Crown className={`w-5 h-5 ${index === 0 ? 'text-amber-400' : index === 1 ? 'text-slate-300' : 'text-orange-400'}`} />
                    ) : (
                      `#${index + 1}`
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                      {creator.avatar_url ? (
                        <img src={creator.avatar_url} alt={creator.username} className="w-full h-full object-cover" />
                      ) : (
                        (creator.display_name || creator.username || '?')[0].toUpperCase()
                      )}
                    </div>
                    {creator.is_live && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold truncate">{creator.display_name || creator.username}</span>
                      {creator.is_live && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 rounded-full text-red-400 text-[10px] font-bold">
                          <Radio className="w-3 h-3" /> LIVE
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 text-sm">@{creator.username}</span>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="text-white font-bold">{creator.followers_count.toLocaleString()}</div>
                      <div className="text-slate-500 text-xs">Followers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-white font-bold">Lv.{creator.level}</div>
                      <div className="text-slate-500 text-xs">Level</div>
                    </div>
                    <div className="text-center">
                      <div className="text-amber-400 font-bold">{creator.total_earned_coins.toLocaleString()}</div>
                      <div className="text-slate-500 text-xs">Earned</div>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="flex items-center gap-2">
                    {creator.is_live && creator.stream_id ? (
                      <Link
                        to={`/watch/${creator.stream_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 border border-red-500/30 rounded-lg text-red-400 text-xs font-bold hover:bg-red-600/30 transition-colors"
                      >
                        <Play className="w-3 h-3" /> Watch
                      </Link>
                    ) : (
                      <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-purple-400 transition-colors" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Live Now Section */}
      <section className="py-12 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Flame className="w-6 h-6 text-red-400" />
                Live Right Now
              </h2>
              <p className="text-slate-400 text-sm mt-1">Creators currently streaming on Mai Troll</p>
            </div>
            <Link to="/live-swipe" className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center gap-1">
              Browse All Live <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {creators.filter(c => c.is_live).slice(0, 8).map((creator) => (
              <Link
                key={creator.id}
                to={creator.stream_id ? `/watch/${creator.stream_id}` : `/profile/${encodeURIComponent(creator.username)}`}
                className="group relative rounded-xl overflow-hidden border border-slate-800 hover:border-red-500/30 transition-all"
              >
                <div className="aspect-video bg-slate-800 flex items-center justify-center">
                  {creator.avatar_url ? (
                    <img src={creator.avatar_url} alt={creator.username} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
                  ) : (
                    <Play className="w-10 h-10 text-slate-600" />
                  )}
                </div>
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-red-600 rounded text-white text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <p className="text-white text-sm font-bold truncate">{creator.display_name || creator.username}</p>
                  {creator.stream_title && (
                    <p className="text-slate-300 text-xs truncate">{creator.stream_title}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title="Want to Be on the Leaderboard?"
        description="Start streaming on Mai Troll, build your audience, and climb the creator rankings."
        primaryAction={{ label: 'Start Streaming', path: '/go-live' }}
        secondaryAction={{ label: 'Browse Categories', path: '/categories' }}
      />
    </SEOLayout>
  )
}
