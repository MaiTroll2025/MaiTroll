import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Clock, Users, Coins, Pin, ChevronRight, Star, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface EventPost {
  id: string
  title: string
  description: string | null
  status: 'upcoming' | 'active' | 'paused' | 'completed' | 'cancelled'
  event_start_at: string
  event_end_at: string | null
  stream_id: string | null
  raffle_ticket_price: number
  participation_bonus_coins: number
  music_request_cost: number
  trivia_reward_coins: number
  tro_drop_enabled: boolean
  max_seats: number
  total_participants: number
  total_raffle_entries: number
  total_coins_distributed: number
  dj_user_id: string | null
}

// ============================================================================
// Helpers
// ============================================================================

function timeUntil(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = then - now
  if (diff <= 0) return 'Started'
  const secs = Math.floor(diff / 1000)
  const mins = Math.floor(secs / 60)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `${days}d ${hrs % 24}h`
  if (hrs > 0) return `${hrs}h ${mins % 60}m`
  return `${mins}m`
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

// ============================================================================
// Component
// ============================================================================

export default function EventRollPost() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [event, setEvent] = useState<EventPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  const isAdmin = profile?.is_admin === true || profile?.role === 'admin'

  // Fetch the latest active/upcoming event
  const fetchEvent = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('smokeathon_events')
        .select('*')
        .in('status', ['active', 'upcoming'])
        .order('event_start_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      setEvent(data as EventPost | null)
    } catch (err) {
      console.error('[EventRollPost] Failed to fetch event:', err)
      setEvent(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvent()

    // Realtime subscription for live updates
    const channel = supabase
      .channel('event-roll-post')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'smokeathon_events' },
        () => fetchEvent()
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [fetchEvent])

  // Handle join button click
  const handleJoin = useCallback(async () => {
    if (!event) return

    // Admin can always view (even before event starts)
    if (isAdmin) {
      navigate('/smokeathon')
      return
    }

    // Regular users: if event is active and has a stream, go to broadcast
    if (event.status === 'active' && event.stream_id) {
      navigate(`/broadcast/${event.stream_id}`)
      return
    }

    // If event is upcoming, go to the event page to see details
    if (event.status === 'upcoming') {
      navigate('/smokeathon')
      return
    }

    // Fallback: go to event page
    navigate('/smokeathon')
  }, [event, isAdmin, navigate])

  if (loading) return null
  if (!event) return null

  const isLive = event.status === 'active'
  const isUpcoming = event.status === 'upcoming'

  return (
    <div className="relative w-full">
      {/* White and red border — event style */}
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-2xl border-2',
          'border-white/80 shadow-[0_0_30px_rgba(255,255,255,0.12)]',
          'bg-gradient-to-br from-[#0a0e1a] via-[#0d1225] to-[#0a0e1a]'
        )}
      >
        {/* Red accent line at top */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-red-500 to-transparent" />

        {/* Pinned indicator */}
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-600 shadow-lg">
          <Pin className="h-2.5 w-2.5" />
          Event
        </div>

        {/* Status badge */}
        <div className="absolute right-3 top-3 z-10">
          {isLive ? (
            <span className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-lg">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              LIVE NOW
            </span>
          ) : isUpcoming ? (
            <span className="flex items-center gap-1 rounded-lg bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-800 shadow-lg">
              <Clock className="h-3 w-3 text-red-600" />
              {timeUntil(event.event_start_at)}
            </span>
          ) : null}
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row items-stretch">
          {/* Left: Event image / visual */}
          <div className="relative w-full md:w-[260px] lg:w-[300px] shrink-0 overflow-hidden">
            <div
              className={cn(
                'flex h-full min-h-[180px] md:min-h-[220px] flex-col items-center justify-center p-6',
                'bg-gradient-to-br from-red-950/40 via-purple-950/30 to-[#0a0e1a]'
              )}
            >
              {/* Event icon / emoji */}
              <div className="text-5xl mb-3">💨</div>

              {/* Event title */}
              <h3 className="text-xl md:text-2xl font-black text-white text-center leading-tight">
                {event.title}
              </h3>

              {/* Subtitle */}
              <p className="text-white/40 text-xs mt-1 text-center">
                Mai Troll Community Event
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-semibold">
                  🎫 Raffle
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-semibold">
                  🎵 DJ Queue
                </span>
                <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-semibold">
                  🏆 Trivia
                </span>
                <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-semibold">
                  🪙 Tro Drops
                </span>
              </div>
            </div>
          </div>

          {/* Right: Event details */}
          <div className="flex-1 p-5 md:p-6 flex flex-col justify-between">
            <div>
              {/* Event info */}
              <div className="flex flex-wrap items-center gap-4 text-white/50 text-xs mb-3">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-red-400" />
                  {formatTime(event.event_start_at)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  {event.total_participants} joined
                </span>
                <span className="flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-yellow-400" />
                  {event.total_coins_distributed} coins given
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-purple-400" />
                  {event.max_seats} beam seats
                </span>
              </div>

              {/* Description */}
              {event.description && (
                <p className="text-white/60 text-sm leading-relaxed mb-4 line-clamp-2">
                  {event.description}
                </p>
              )}

              {/* Feature highlights */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-yellow-400">{event.participation_bonus_coins}</div>
                  <div className="text-[10px] text-white/40">Join Bonus</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-purple-400">{event.raffle_ticket_price}</div>
                  <div className="text-[10px] text-white/40">Raffle Ticket</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-pink-400">{event.music_request_cost}</div>
                  <div className="text-[10px] text-white/40">Song Request</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-green-400">{event.trivia_reward_coins}</div>
                  <div className="text-[10px] text-white/40">Trivia Win</div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleJoin}
                disabled={joining}
                className={cn(
                  'flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all',
                  'flex items-center justify-center gap-2',
                  isLive
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/30'
                )}
              >
                {isLive ? (
                  <>
                    <Star className="w-4 h-4" />
                    Join Event
                    <ChevronRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    {isAdmin ? 'Open Event Page' : 'View Event'}
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {isAdmin && (
                <button
                  onClick={() => navigate('/smokeathon')}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                >
                  Admin Panel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom red accent line */}
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
      </div>
    </div>
  )
}
