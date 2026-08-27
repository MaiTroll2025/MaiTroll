import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePresenceStore } from '@/lib/presenceStore'
import { supabase } from '@/lib/supabase'

export interface LiveItem {
  id: string
  title: string
  type: 'stream' | 'podcast' | 'auction'
  viewerCount: number
  streamerName: string
  streamerAvatar: string | null
  broadcasterId?: string
  isFeatured?: boolean
  isBattle?: boolean
  battleFormat?: string
  battleStatus?: string
  category?: string | null
  visibilityScore?: number
  hotScore?: number
  isRising?: boolean
  isTrending?: boolean
  momentumLevel?: number
  velocityTrend?: string
}

export interface AuctionShow {
  id: string
  title: string
  description?: string | null
  category?: string | null
  thumbnail_url?: string | null
  status: string
  scheduled_for?: string | null
  live_started_at?: string | null
  ended_at?: string | null
  livekit_room_name?: string | null
  auctioneer_id: string
  current_lot_id?: string | null
  hls_url?: string | null
  egress_id?: string | null
  visibilityScore?: number
  hotScore?: number
  isRising?: boolean
  isTrending?: boolean
}

interface LiveContentState {
  liveItems: LiveItem[]
  liveAuctions: AuctionShow[]
  totalViewers: number
  onlineUsers: number
  loadingLive: boolean
  loadingOnline: boolean
  refresh: () => void
}

const LiveContentContext = createContext<LiveContentState | null>(null)

export function LiveContentProvider({ children }: { children: React.ReactNode }) {
  const [liveItems, setLiveItems] = useState<LiveItem[]>([])
  const [liveAuctions, setLiveAuctions] = useState<AuctionShow[]>([])
  const [onlineUsers, setOnlineUsers] = useState(0)
  const [loadingLive, setLoadingLive] = useState(true)
  const [loadingOnline, setLoadingOnline] = useState(true)
  const presenceOnlineCount = usePresenceStore((state) => state.onlineCount)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    setOnlineUsers(presenceOnlineCount)
    setLoadingOnline(false)
  }, [presenceOnlineCount])

  const totalViewers = useMemo(() => liveItems.reduce((sum, item) => sum + item.viewerCount, 0), [liveItems])

  const mapStreamRow = useCallback((row: any) => ({
    id: row.id,
    title: row.title || 'Untitled Stream',
    type: 'stream' as const,
    viewerCount: row.current_viewers || 0,
    streamerName: 'Unknown' as string,
    streamerAvatar: null as string | null,
    broadcasterId: row.broadcaster_id || row.user_id || null,
    isFeatured: false,
    isBattle: row.battle_mode === 'universal',
    battleFormat: row.battle_format,
    battleStatus: row.battle_status,
    category: row.category || null,
    visibilityScore: 0,
    hotScore: 0,
    isRising: false,
    isTrending: false,
    momentumLevel: 0,
    velocityTrend: 'stable',
  }), [])

  const enrichStreamItem = useCallback(async (streamId: string, broadcasterId?: string) => {
    const profilePromise = broadcasterId
      ? supabase.from('user_profiles').select('username, avatar_url').eq('id', broadcasterId).maybeSingle()
      : Promise.resolve({ data: null as any })

    const [{ data: profile }, { data: vis }, { data: mom }] = await Promise.all([
      profilePromise,
      supabase.from('visibility_scores').select('final_visibility_score, hot_score, is_rising, is_trending').eq('content_id', streamId).eq('content_type', 'stream').maybeSingle(),
      supabase.from('momentum_tracking').select('momentum_level, velocity_trend').eq('content_id', streamId).eq('content_type', 'stream').maybeSingle(),
    ])
    return {
      streamerName: profile?.username || 'Unknown',
      streamerAvatar: profile?.avatar_url || null,
      visibilityScore: vis?.final_visibility_score || 0,
      hotScore: vis?.hot_score || 0,
      isRising: vis?.is_rising || false,
      isTrending: vis?.is_trending || false,
      momentumLevel: mom?.momentum_level || 0,
      velocityTrend: mom?.velocity_trend || 'stable',
    }
  }, [])

  const fetchLiveContent = useCallback(async () => {
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_active_streams_v2', {
        p_limit: 100,
        p_offset: 0,
        p_sort_by: 'visibility'
      })

      let streams: LiveItem[] = []

      if (rpcError) {
        const { data: streamsData, error: streamsError } = await supabase
          .from('streams')
          .select(`
            id,
            title,
            current_viewers,
            viewer_count,
            is_featured,
            battle_mode,
            battle_format,
            battle_status,
            category,
            broadcaster_id,
            user_profiles!streams_broadcaster_id_fkey(username, avatar_url)
          `)
          .eq('is_live', true)
          .order('current_viewers', { ascending: false })
          .limit(100)

        if (streamsError) throw streamsError
        if (!mountedRef.current) return

        streams = (streamsData || []).map((stream: any) => ({
          id: stream.id,
          title: stream.title || 'Untitled Stream',
          type: 'stream' as const,
          viewerCount: stream.current_viewers || stream.viewer_count || 0,
          streamerName: stream.user_profiles?.username || 'Unknown',
          streamerAvatar: stream.user_profiles?.avatar_url || null,
          broadcasterId: stream.broadcaster_id || stream.user_id || null,
          isFeatured: stream.is_featured || false,
          isBattle: stream.battle_mode === 'universal',
          battleFormat: stream.battle_format,
          battleStatus: stream.battle_status,
          category: stream.category || null,
          visibilityScore: 0,
          hotScore: 0,
          isRising: false,
          isTrending: false,
          momentumLevel: 0,
          velocityTrend: 'stable',
        }))
      } else {
        if (!mountedRef.current) return

        streams = (rpcData || []).map((row: any) => ({
          id: row.id,
          title: row.title || 'Untitled Stream',
          type: 'stream' as const,
          viewerCount: row.current_viewers || 0,
          streamerName: row.broadcaster_username || 'Unknown',
          streamerAvatar: row.broadcaster_avatar || null,
          broadcasterId: row.broadcaster_id || null,
          isFeatured: row.visibility_score > 0,
          isBattle: false,
          category: row.category || null,
          visibilityScore: row.visibility_score || 0,
          hotScore: row.hot_score || 0,
          isRising: row.is_rising || false,
          isTrending: row.is_trending || false,
          momentumLevel: row.momentum_level || 0,
          velocityTrend: row.stream_momentum?.velocity_trend || 'stable',
        }))
      }

      if (!mountedRef.current) return

      const broadcasterIds = streams
        .map(s => s.broadcasterId)
        .filter((id): id is string => Boolean(id))

      let enrichedStreams = streams
      if (broadcasterIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', broadcasterIds)

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))
        enrichedStreams = streams.map(item => {
          const profile = profileMap.get(item.broadcasterId || '')
          return {
            ...item,
            streamerName: profile?.username || item.streamerName || 'Unknown',
            streamerAvatar: profile?.avatar_url || item.streamerAvatar || null,
          }
        })
      }

      let courtLiveItems: LiveItem[] = []
      try {
        const { data: activeCourts } = await supabase
          .from('court_sessions')
          .select('id, started_by, created_at, status')
          .in('status', ['active', 'live'])

        if (activeCourts && activeCourts.length > 0) {
          const startedByIds = [...new Set(activeCourts.map((cs: any) => cs.started_by).filter(Boolean))]
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url')
            .in('id', startedByIds)

          const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

          courtLiveItems = activeCourts.map((cs: any) => {
            const profile = profileMap.get(cs.started_by)
            return {
              id: `court-${cs.id}`,
              title: `Troll Court Session - ${new Date(cs.created_at).toLocaleDateString()}`,
              type: 'stream' as const,
              viewerCount: 0,
              streamerName: profile?.username || 'Troll Court',
              streamerAvatar: profile?.avatar_url || null,
              broadcasterId: cs.started_by || null,
              isFeatured: false,
              isBattle: false,
              category: 'court',
              visibilityScore: 0,
              hotScore: 0,
              isRising: false,
              isTrending: false,
              momentumLevel: 0,
              velocityTrend: 'stable',
            }
          })
        }
      } catch (courtErr) {
        console.warn('[LiveContentContext] Court session fallback failed:', courtErr)
      }

      const allItems = [...enrichedStreams, ...courtLiveItems]
      setLiveItems(allItems)
    } catch (err) {
      console.error('Error fetching live content:', err)
    } finally {
      if (mountedRef.current) setLoadingLive(false)
    }
  }, [])

  const fetchLiveAuctions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('auction_shows')
        .select('*')
        .eq('status', 'live')
        .order('live_started_at', { ascending: false })
        .limit(5)

      if (error) throw error
      if (!mountedRef.current) return
      setLiveAuctions(data || [])
    } catch (err) {
      console.error('Error fetching live auctions:', err)
    }
  }, [])

  const refresh = useCallback(() => {
    fetchLiveContent()
    fetchLiveAuctions()
  }, [fetchLiveContent, fetchLiveAuctions])

  useEffect(() => {
    fetchLiveContent()
    fetchLiveAuctions()

    const homeChannel = supabase.channel('home:global')

    homeChannel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'streams' }, async (payload) => {
        const row = payload.new as any
        if (!row || row.is_live !== true) return
        try {
          const base = mapStreamRow(row)
          setLiveItems(prev => {
            if (prev.some(item => item.id === row.id)) return prev
            return [...prev, base]
          })
          const enrichment = await enrichStreamItem(row.id, row.broadcaster_id || row.user_id)
          if (mountedRef.current) {
            setLiveItems(prev => prev.map(item => item.id === row.id ? { ...item, ...enrichment } : item))
          }
        } catch (e) {
          console.warn('home:global streams INSERT handler error', e)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams' }, (payload) => {
        try {
          const oldRow = (payload.old || null) as any
          const newRow = (payload.new || null) as any
          if (!oldRow || !newRow) return

          const wasLive = !!oldRow.is_live
          const isLive = !!newRow.is_live

          if (wasLive && !isLive) {
            setLiveItems(prev => prev.filter(item => item.id !== newRow.id))
          } else if (!wasLive && isLive) {
            const base = mapStreamRow(newRow)
            setLiveItems(prev => {
              if (prev.some(item => item.id === newRow.id)) return prev
              return [...prev, base]
            })
            enrichStreamItem(newRow.id, newRow.broadcaster_id || newRow.user_id).then(enrichment => {
              if (mountedRef.current) {
                setLiveItems(prev => prev.map(item => item.id === newRow.id ? { ...item, ...enrichment } : item))
              }
            })
          } else if (wasLive && isLive) {
            setLiveItems(prev => prev.map(item => {
              if (item.id !== newRow.id) return item
              return {
                ...item,
                title: newRow.title || item.title,
                viewerCount: newRow.current_viewers ?? item.viewerCount,
                isBattle: newRow.battle_mode === 'universal',
                battleFormat: newRow.battle_format,
                battleStatus: newRow.battle_status,
                category: newRow.category || null,
              }
            }))
          }
        } catch (e) {
          console.warn('home:global streams UPDATE handler error', e)
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'streams' }, (payload) => {
        const oldRow = payload.old as any
        if (!oldRow) return
        setLiveItems(prev => prev.filter(item => item.id !== oldRow.id))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visibility_scores' }, (payload) => {
        const row = payload.new as any || payload.old as any
        if (!row || row.content_type !== 'stream') return
        setLiveItems(prev => prev.map(item => {
          if (item.id !== row.content_id) return item
          return {
            ...item,
            visibilityScore: row.final_visibility_score || 0,
            hotScore: row.hot_score || 0,
            isRising: row.is_rising || false,
            isTrending: row.is_trending || false,
          }
        }))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'momentum_tracking' }, (payload) => {
        const row = payload.new as any || payload.old as any
        if (!row || row.content_type !== 'stream') return
        setLiveItems(prev => prev.map(item => {
          if (item.id !== row.content_id) return item
          return {
            ...item,
            momentumLevel: row.momentum_level || 0,
            velocityTrend: row.velocity_trend || 'stable',
          }
        }))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'court_sessions' }, async (payload) => {
        const row = payload.new as any || payload.old as any
        if (!row) return

        if (payload.eventType === 'DELETE' || !['active', 'live'].includes(row.status)) {
          setLiveItems(prev => prev.filter(item => item.id !== `court-${row.id}`))
          return
        }

        const courtItem: LiveItem = {
          id: `court-${row.id}`,
          title: `Troll Court Session - ${new Date(row.created_at).toLocaleDateString()}`,
          type: 'stream',
          viewerCount: 0,
          streamerName: 'Troll Court',
          streamerAvatar: null,
          broadcasterId: row.started_by || null,
          isFeatured: false,
          isBattle: false,
          category: 'court',
          visibilityScore: 0,
          hotScore: 0,
          isRising: false,
          isTrending: false,
          momentumLevel: 0,
          velocityTrend: 'stable',
        }

        setLiveItems(prev => {
          const exists = prev.some(item => item.id === `court-${row.id}`)
          if (exists) {
            return prev.map(item => item.id === `court-${row.id}` ? courtItem : item)
          }
          return [...prev, courtItem]
        })

        if (row.started_by) {
          const enrichment = await enrichStreamItem(`court-${row.id}`, row.started_by)
          if (mountedRef.current) {
            setLiveItems(prev => prev.map(item => item.id === `court-${row.id}` ? { ...item, ...enrichment } : item))
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_shows' }, (payload) => {
        const row = payload.new as any || payload.old as any
        if (!row) return

        if (payload.eventType === 'DELETE') {
          setLiveAuctions(prev => prev.filter(a => a.id !== row.id))
          return
        }

        const auction: AuctionShow = {
          id: row.id,
          title: row.title || '',
          description: row.description,
          category: row.category,
          thumbnail_url: row.thumbnail_url,
          status: row.status,
          scheduled_for: row.scheduled_for,
          live_started_at: row.live_started_at,
          ended_at: row.ended_at,
          livekit_room_name: row.livekit_room_name,
          auctioneer_id: row.auctioneer_id,
          current_lot_id: row.current_lot_id,
          hls_url: row.hls_url,
          egress_id: row.egress_id,
          visibilityScore: row.visibility_score || 0,
          hotScore: row.hot_score || 0,
          isRising: row.is_rising || false,
          isTrending: row.is_trending || false,
        }

        setLiveAuctions(prev => {
          const exists = prev.some(a => a.id === row.id)
          if (exists) {
            return prev.map(a => a.id === row.id ? auction : a)
          }
          if (row.status !== 'live') return prev
          return [...prev, auction]
        })
      })
      .subscribe()

    return () => {
      try { supabase.removeChannel(homeChannel) } catch {}
    }
  }, [fetchLiveContent, fetchLiveAuctions, mapStreamRow, enrichStreamItem])

  useEffect(() => {
    if (presenceOnlineCount > 0) {
      setOnlineUsers(presenceOnlineCount)
      setLoadingOnline(false)
    }
  }, [presenceOnlineCount])

  const value = useMemo(() => ({
    liveItems: liveItems || [],
    liveAuctions: liveAuctions || [],
    totalViewers: totalViewers || 0,
    onlineUsers: onlineUsers || 0,
    loadingLive: loadingLive !== undefined ? loadingLive : true,
    loadingOnline: loadingOnline !== undefined ? loadingOnline : true,
    refresh,
  }), [liveItems, liveAuctions, totalViewers, onlineUsers, loadingLive, loadingOnline, refresh])

  return (
    <LiveContentContext.Provider value={value}>
      {children}
    </LiveContentContext.Provider>
  )
}

export function useLiveContent() {
  const ctx = useContext(LiveContentContext)
  if (!ctx) throw new Error('useLiveContent must be used within LiveContentProvider')
  return ctx
}
