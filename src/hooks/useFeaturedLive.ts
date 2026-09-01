import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { FeaturedBroadcaster, FeaturedLiveCycle, FeaturedLiveEvent, FeaturedLiveState } from '../types/featuredLive'

const FEATURED_CHANNEL = 'featured-live-state'

interface UseFeaturedLiveOptions {
  streamId?: string | null
  enabled?: boolean
}

const normalizeBroadcaster = (row: any): FeaturedBroadcaster | null => {
  if (!row) return null
  const streamId = row.stream_id || row.id || row.streamId
  const broadcasterId = row.broadcaster_id || row.user_id || row.broadcasterId
  if (!streamId || !broadcasterId) return null

  return {
    stream_id: String(streamId),
    broadcaster_id: String(broadcasterId),
    username: row.username || row.display_name || row.user_name || 'Broadcaster',
    avatar_url: row.avatar_url || row.avatarUrl || null,
    current_viewers: Number(row.current_viewers ?? row.viewer_count ?? 0),
    stream_coins: Number(row.stream_coins ?? row.coins_sent ?? row.total_coins ?? 0),
    stream_likes: Number(row.stream_likes ?? row.likes ?? row.total_likes ?? 0),
    featured_score: Number(row.featured_score ?? row.score ?? 0),
    featured_rank: Number(row.featured_rank ?? row.rank ?? 0),
    featured_started_at: row.featured_started_at || row.started_at || null,
    featured_ends_at: row.featured_ends_at || row.ends_at || null,
    is_featured: row.is_featured ?? row.featured ?? true,
  }
}

function safeIsoNow() {
  return new Date().toISOString()
}

export function useFeaturedLive(options: UseFeaturedLiveOptions = {}) {
  const { streamId, enabled = true } = options

  const [featuredState, setFeaturedState] = useState<FeaturedLiveState | null>(null)
  const [featuredCycle, setFeaturedCycle] = useState<FeaturedLiveCycle | null>(null)
  const [featuredBroadcasters, setFeaturedBroadcasters] = useState<FeaturedBroadcaster[]>([])
  const [featuredEvent, setFeaturedEvent] = useState<FeaturedLiveEvent | null>(null)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)

  const fetchCurrentFeaturedCycle = useCallback(async () => {
    if (!enabled) return

    try {
      const { data, error } = await supabase
        .from('featured_live_cycles')
        .select('*')
        .eq('status', 'active')
        .or('ends_at.is.null,ends_at.gt.' + new Date().toISOString())
        .order('cycle_number', { ascending: false })
        .limit(1)

      if (error) {
        setFeaturedCycle(null)
        return
      }

      const nextCycle = (data && data[0]) || null
      setFeaturedCycle(nextCycle ? {
        id: String(nextCycle.id),
        cycle_number: Number(nextCycle.cycle_number ?? 0),
        status: String(nextCycle.status || 'active') as FeaturedLiveCycle['status'],
        started_at: nextCycle.started_at || null,
        ends_at: nextCycle.ends_at || null,
        winner_stream_id: nextCycle.winner_stream_id || null,
        winner_broadcaster_id: nextCycle.winner_broadcaster_id || null,
        featured_count: Number(nextCycle.featured_count ?? 0),
        created_at: nextCycle.created_at || null,
        updated_at: nextCycle.updated_at || null,
      } : null)
    } catch {
      setFeaturedCycle(null)
    }
  }, [enabled])

  const fetchCurrentFeatured = useCallback(async () => {
    if (!enabled) return

    try {
      const { data, error } = await supabase
        .from('featured_live_state')
        .select('*')
        .eq('is_featured', true)
        .gt('featured_ends_at', safeIsoNow())
        .order('featured_rank', { ascending: true })

      if (error) {
        return
      }

      const rows = (data || [])
        .map(normalizeBroadcaster)
        .filter(Boolean) as FeaturedBroadcaster[]

      setFeaturedBroadcasters(rows)

      if (rows.length > 0) {
        const primary = rows[0]
        setFeaturedState({
          stream_id: primary.stream_id,
          broadcaster_id: primary.broadcaster_id,
          cycle_id: primary.featured_started_at || null,
          featured_score: primary.featured_score,
          featured_rank: primary.featured_rank,
          featured_started_at: primary.featured_started_at || null,
          featured_ends_at: primary.featured_ends_at || null,
          is_featured: true,
          current_viewers: primary.current_viewers,
          stream_coins: primary.stream_coins,
          stream_likes: primary.stream_likes,
        })
      } else {
        setFeaturedState(null)
      }
    } catch (error) {
      setFeaturedBroadcasters([])
      setFeaturedState(null)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setFeaturedBroadcasters([])
      setFeaturedState(null)
      setFeaturedCycle(null)
      setFeaturedEvent(null)
      return
    }

    void fetchCurrentFeaturedCycle()
    void fetchCurrentFeatured()

    const channel = supabase.channel(FEATURED_CHANNEL, {
      config: { broadcast: { self: false } },
    })

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'featured_live_state',
      },
      (payload: any) => {
        const nextRow = payload?.new || payload?.old
        const normalized = normalizeBroadcaster(nextRow)

        if (!normalized) {
          return
        }

        setFeaturedBroadcasters((prev) => {
          const existing = prev.filter((item) => item.stream_id !== normalized.stream_id)
          const nextList = [...existing, normalized].sort((a, b) => (a.featured_rank ?? 999) - (b.featured_rank ?? 999))

          const primary = nextList[0] || { ...normalized }
          setFeaturedState({
            stream_id: primary.stream_id,
            broadcaster_id: primary.broadcaster_id,
            cycle_id: primary.featured_started_at || null,
            featured_score: primary.featured_score,
            featured_rank: primary.featured_rank,
            featured_started_at: primary.featured_started_at || null,
            featured_ends_at: primary.featured_ends_at || null,
            is_featured: true,
            current_viewers: primary.current_viewers,
            stream_coins: primary.stream_coins,
            stream_likes: primary.stream_likes,
          })

          return nextList
        })

        setFeaturedBroadcasters((prev) => {
          const nextList = [
            ...prev.filter((item) => item.stream_id !== normalized.stream_id),
            normalized,
          ].sort((a, b) => (a.featured_rank ?? 999) - (b.featured_rank ?? 999))

          const nextEvent: FeaturedLiveEvent = {
            type: payload?.eventType === 'UPDATE' ? 'featured_updated' : 'featured_started',
            cycle_id: payload?.new?.cycle_id || normalized.featured_started_at || null,
            broadcasters: nextList,
            started_at: normalized.featured_started_at || new Date().toISOString(),
            ends_at: normalized.featured_ends_at || null,
          }

          setFeaturedEvent(nextEvent)
          return nextList
        })
      },
    )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, fetchCurrentFeatured, fetchCurrentFeaturedCycle])

  const hasFeaturedState = Boolean(featuredState || featuredBroadcasters.length)
  const isFeaturedEvent = Boolean(featuredEvent && featuredEvent.broadcasters.length > 0 && hasFeaturedState)

  const openFeaturedLeaderboard = useCallback(() => {
    setLeaderboardOpen(true)
  }, [])

  const closeFeaturedLeaderboard = useCallback(() => {
    setLeaderboardOpen(false)
  }, [])

  const currentStreamFeatured = useMemo(() => {
    if (!streamId) return null
    return featuredBroadcasters.find((b) => b.stream_id === streamId) || null
  }, [featuredBroadcasters, streamId])

  return {
    featuredState,
    featuredCycle,
    featuredBroadcasters,
    featuredEvent,
    isFeaturedEvent,
    currentStreamFeatured,
    leaderboardOpen,
    openFeaturedLeaderboard,
    closeFeaturedLeaderboard,
    refresh: async () => {
      await fetchCurrentFeaturedCycle()
      await fetchCurrentFeatured()
    },
  }
}
