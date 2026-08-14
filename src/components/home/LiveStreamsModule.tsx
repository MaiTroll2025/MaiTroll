import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Video, Star, Trophy, TrendingUp, Flame, Zap, Crown, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MaiTrollTheme } from '@/styles/trollCityTheme'
import { useLiveStreams, queryKeys } from '@/hooks/useQueries'
import { useQueryClient } from '@tanstack/react-query'

interface Stream {
  id: string
  user_id: string
  title: string | null
  status: string | null
  viewer_count: number | null
  current_viewers: number | null
  thumbnail_url?: string | null
  is_featured?: boolean
  likes_count?: number
  gifts_value?: number
  visibility_score?: number
  hot_score?: number
  is_rising?: boolean
  is_trending?: boolean
  momentum_level?: number
  velocity_trend?: string
  user_profiles?: {
    username: string | null
    avatar_url: string | null
  }
}

interface SectionConfig {
  key: string
  label: string
  icon: React.ReactNode
  description: string
  filter: (s: Stream) => boolean
  sort: (a: Stream, b: Stream) => number
  badgeColor: string
  limit: number
}

interface LiveStreamsModuleProps {
  onRequireAuth: (intent?: string) => boolean
}

export default function LiveStreamsModule({ onRequireAuth }: LiveStreamsModuleProps) {
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: streamsData, isLoading: streamsLoading } = useLiveStreams({
    enabled: true
  })

  // OPTIMIZED: Replaced realtime channel with 30s polling to reduce connection count.
  // Home page visitors don't need instant stream updates — React Query cache handles data.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ queryKey: queryKeys.liveStreams })
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [queryClient])

  useEffect(() => {
    if (streamsData) {
      const normalized = (streamsData || []).map((row: any) => ({
        ...row,
        user_profiles: Array.isArray(row.user_profiles) ? row.user_profiles[0] : row.user_profiles,
        status: 'live' as const,
        visibility_score: row.visibility_score || (row as any).final_visibility_score || 0,
        hot_score: row.hot_score || 0,
        is_rising: row.is_rising || false,
        is_trending: row.is_trending || false,
        momentum_level: row.momentum_level || (row as any).stream_momentum?.momentum || 0,
        velocity_trend: row.velocity_trend || (row as any).stream_momentum?.velocity_trend || 'stable',
      }))
      setStreams(normalized as Stream[])
      setLoading(false)
    } else {
      setLoading(streamsLoading)
    }
  }, [streamsData, streamsLoading])

  const sections: SectionConfig[] = useMemo(() => [
    {
      key: 'featured',
      label: 'Featured',
      icon: <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />,
      description: 'Hand-picked by our team',
      filter: (s) => s.is_featured === true,
      sort: (a, b) => (b.visibility_score || 0) - (a.visibility_score || 0),
      badgeColor: 'bg-gradient-to-r from-pink-600 to-purple-600',
      limit: 4,
    },
    {
      key: 'trending',
      label: 'Trending Now',
      icon: <Flame className="w-5 h-5 text-orange-400" />,
      description: 'Hottest streams right now',
      filter: (s) => (s.hot_score || 0) > 50 || s.is_trending === true,
      sort: (a, b) => (b.hot_score || 0) - (a.hot_score || 0),
      badgeColor: 'bg-gradient-to-r from-orange-500 to-red-500',
      limit: 6,
    },
    {
      key: 'rising',
      label: 'Rising',
      icon: <TrendingUp className="w-5 h-5 text-green-400" />,
      description: 'Fastest growing streams',
      filter: (s) => s.is_rising === true,
      sort: (a, b) => (b.momentum_level || 0) - (a.momentum_level || 0),
      badgeColor: 'bg-gradient-to-r from-green-500 to-emerald-400',
      limit: 6,
    },
    {
      key: 'live',
      label: 'All Live Streams',
      icon: <Trophy className="w-5 h-5 text-cyan-400" />,
      description: 'Ranked by visibility score',
      filter: () => true,
      sort: (a, b) => (b.visibility_score || b.current_viewers || 0) - (a.visibility_score || a.current_viewers || 0),
      badgeColor: '',
      limit: 100,
    },
  ], [])

  const sectionStreams = useMemo(() => {
    return sections.map(section => ({
      ...section,
      streams: streams.filter(section.filter).sort(section.sort).slice(0, section.limit),
    }))
  }, [streams, sections])

  const handleJoin = (streamId: string, username?: string | null) => {
    if (!onRequireAuth('join live streams')) return
    if (username) {
      navigate(`/live/${encodeURIComponent(username)}`)
    } else {
      navigate(`/watch/${streamId}`)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} aspect-video rounded-2xl animate-pulse`}
          />
        ))}
      </div>
    )
  }

  if (streams.length === 0) {
    return (
      <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl p-6 text-center`}>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
          <Video className="h-6 w-6 text-white/40" />
        </div>
        <h3 className="text-lg font-semibold text-white">No Live Streams</h3>
        <p className={`${MaiTrollTheme.text.muted} text-sm mt-1`}>Be the first to go live.</p>
      </div>
    )
  }

  const getSectionBadge = (section: SectionConfig) => {
    switch (section.key) {
      case 'featured':
        return (
          <span className="px-2 py-1 bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-bold rounded flex items-center gap-1">
            <Star className="w-3 h-3 fill-white" />
            FEATURED
          </span>
        )
      case 'trending':
        return (
          <span className="px-2 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded flex items-center gap-1">
            <Flame className="w-3 h-3" />
            TRENDING
          </span>
        )
      case 'rising':
        return (
          <span className="px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-400 text-white text-xs font-bold rounded flex items-center gap-1">
            <Zap className="w-3 h-3" />
            RISING
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="max-h-[800px] overflow-y-auto pr-2 custom-scrollbar space-y-6">
      {sectionStreams.map((section) => {
        if (section.streams.length === 0) return null
        const isSpecialSection = section.key !== 'live'

        return (
          <div key={section.key}>
            <div className="flex items-center gap-2 mb-3">
              {section.icon}
              <h3 className="text-lg font-semibold text-white">{section.label}</h3>
              {getSectionBadge(section)}
              {section.key !== 'live' && (
                <span className="text-xs text-slate-400">({section.streams.length})</span>
              )}
            </div>
            <div className={`grid gap-4 ${isSpecialSection ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
              {section.streams.map((stream) => (
                <div
                  key={stream.id}
                  onClick={() => handleJoin(stream.id, stream.user_profiles?.username)}
                  className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 ${
                    isSpecialSection && section.key === 'featured'
                      ? 'hover:border-yellow-400/40 hover:shadow-lg hover:shadow-yellow-500/10 border-2 border-yellow-500/30'
                      : isSpecialSection && section.key === 'trending'
                      ? 'hover:border-orange-400/40 hover:shadow-lg hover:shadow-orange-500/10 border border-orange-500/20'
                      : isSpecialSection && section.key === 'rising'
                      ? 'hover:border-green-400/40 hover:shadow-lg hover:shadow-green-500/10 border border-green-500/20'
                      : 'hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10'
                  }`}
                >
                  <div className="relative aspect-video bg-black/40 flex items-center justify-center overflow-hidden">
                    {stream.thumbnail_url ? (
                      <img src={stream.thumbnail_url} alt={stream.title || 'Live stream'} className="w-full h-full object-cover" />
                    ) : stream.user_profiles?.avatar_url ? (
                      <img src={stream.user_profiles.avatar_url} alt={stream.user_profiles.username || ''} className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-cyan-900/20">
                        <Video className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 text-white/20" />
                      </div>
                    )}

                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded flex items-center gap-1 shadow-lg shadow-red-900/20 animate-pulse">
                        <span className="w-2 h-2 bg-white rounded-full" />
                        LIVE
                      </span>
                      {stream.velocity_trend === 'accelerating' && (
                        <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          FAST
                        </span>
                      )}
                    </div>

                    {stream.is_rising && section.key !== 'rising' && (
                      <div className="absolute top-3 right-3">
                        <div className="px-2 py-1 bg-green-500/80 text-white text-xs font-bold rounded flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {Math.round(stream.momentum_level || 0)}
                        </div>
                      </div>
                    )}

                    {stream.visibility_score !== undefined && stream.visibility_score > 0 && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs font-medium text-white/90">
                        <Sparkles className="w-3 h-3 text-yellow-400" />
                        {Math.round(stream.visibility_score)}
                      </div>
                    )}

                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs font-medium text-white/90">
                      <Users className="w-3 h-3" />
                      {stream.current_viewers || stream.viewer_count || 0}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border border-white/10">
                          {stream.user_profiles?.avatar_url ? (
                            <img src={stream.user_profiles.avatar_url} alt={stream.user_profiles.username || ''} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600 text-white font-bold text-lg">
                              {stream.user_profiles?.username?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate hover:text-yellow-400 transition-colors">
                          {stream.title || 'Untitled Stream'}
                        </p>
                        <p className="text-slate-400 text-sm truncate">
                          {stream.user_profiles?.username || 'Unknown streamer'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
