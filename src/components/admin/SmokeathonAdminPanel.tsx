import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { isStaffProfile } from '@/lib/staff'
import { toast } from 'sonner'
import { Coins, Music, Trophy, Gift, Search, Play, SkipForward, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils'

interface SmokeathonEvent {
  id: string
  title: string
  status: string
  stream_id: string | null
  dj_user_id: string | null
  total_participants: number
  total_raffle_entries: number
  total_music_requests: number
  total_trivia_answers: number
  total_coins_distributed: number
}

interface MusicRequest {
  id: string
  username: string
  song_title: string
  artist: string | null
  status: string
  queue_position: number | null
}

export default function SmokeathonAdminPanel() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [event, setEvent] = useState<SmokeathonEvent | null>(null)
  const [musicQueue, setMusicQueue] = useState<MusicRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [triviaSearch, setTriviaSearch] = useState('')
  const [triviaResult, setTriviaResult] = useState<{ id: string; username: string } | null>(null)
  const [dropAmount, setDropAmount] = useState(500)

  const isAdmin = profile ? isStaffProfile(profile) : false

  useEffect(() => {
    if (!isAdmin) return

    const fetchData = async () => {
      setLoading(true)
      try {
        // Get active event
        const { data: eventData } = await supabase
          .from('smokeathon_events')
          .select('*')
          .in('status', ['active', 'upcoming'])
          .order('event_start_at', { ascending: false })
          .limit(1)
          .single()

        setEvent(eventData as SmokeathonEvent)

        // Get music queue
        if (eventData?.id) {
          const { data: queueData } = await supabase
            .from('smokeathon_music_requests')
            .select('id, username, song_title, artist, status, queue_position')
            .eq('event_id', eventData.id)
            .in('status', ['pending', 'playing'])
            .order('queue_position', { ascending: true })
            .limit(10)

          setMusicQueue((queueData || []) as MusicRequest[])
        }
      } catch (err) {
        console.error('Failed to fetch smokeathon data:', err)
      }
      setLoading(false)
    }

    fetchData()

    // Realtime subscription
    const channel = supabase
      .channel('smokeathon-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'smokeathon_events' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'smokeathon_music_requests' },
        () => fetchData()
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [isAdmin])

  if (!isAdmin) {
    return <div className="text-red-400 p-4">Access denied. Admin only.</div>
  }

  if (loading) {
    return <div className="text-white/50 p-4">Loading Smoke-a-thon admin...</div>
  }

  if (!event) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-white/50">No active Smoke-a-thon event found.</div>
        <button
          onClick={() => navigate('/smokeathon')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors text-sm"
        >
          <ExternalLink className="w-4 h-4" />
          Open Event Page
        </button>
      </div>
    )
  }

  // Actions
  const handleTriggerDrop = async () => {
    const username = profile?.username || 'admin'
    const { error } = await supabase.rpc('smokeathon_trigger_drop', {
      p_event_id: event.id,
      p_activator_id: profile?.id,
      p_activator_username: username,
      p_total_amount: dropAmount,
      p_per_click: 5,
      p_max_per_user: 100,
    })
    if (error) toast.error(error.message)
    else toast.success(`Tro Drop triggered: ${dropAmount} coins`)
  }

  const handleDrawRaffle = async () => {
    const { error } = await supabase.rpc('smokeathon_draw_raffle', {
      p_event_id: event.id,
      p_admin_id: profile?.id,
    })
    if (error) toast.error(error.message)
    else toast.success('Raffle drawn!')
  }

  const handleRewardTrivia = async () => {
    if (!triviaResult) {
      toast.error('Search for a user first')
      return
    }
    const { error } = await supabase.rpc('smokeathon_reward_trivia', {
      p_event_id: event.id,
      p_user_id: triviaResult.id,
      p_username: triviaResult.username,
      p_admin_id: profile?.id,
    })
    if (error) toast.error(error.message)
    else {
      toast.success(`Rewarded ${triviaResult.username} 50 coins!`)
      setTriviaSearch('')
      setTriviaResult(null)
    }
  }

  const handleSearchUser = async () => {
    if (!triviaSearch.trim()) return
    const { data } = await supabase
      .from('user_profiles')
      .select('id, username')
      .ilike('username', `%${triviaSearch}%`)
      .limit(1)
      .single()
    if (data) {
      setTriviaResult({ id: data.id, username: data.username })
    } else {
      toast.error('User not found')
      setTriviaResult(null)
    }
  }

  const handleSkipSong = async (requestId: string) => {
    const { error } = await supabase
      .from('smokeathon_music_requests')
      .update({ status: 'skipped', completed_at: new Date().toISOString() })
      .eq('id', requestId)
    if (error) toast.error(error.message)
    else toast.success('Song skipped')
  }

  const handleCompleteSong = async (requestId: string) => {
    const { error } = await supabase
      .from('smokeathon_music_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', requestId)
    if (error) toast.error(error.message)
    else toast.success('Song completed')
  }

  const handleSetStatus = async (status: string) => {
    const { error } = await supabase
      .from('smokeathon_events')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', event.id)
    if (error) toast.error(error.message)
    else toast.success(`Event ${status}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            💨 Smoke-a-thon Admin
          </h2>
          <p className="text-white/50 text-sm">{event.title}</p>
        </div>
        <span className={cn(
          'px-3 py-1 rounded-full text-xs font-medium',
          event.status === 'active' ? 'bg-green-500/20 text-green-400' :
          event.status === 'upcoming' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-white/10 text-white/50'
        )}>
          {event.status.toUpperCase()}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-white">{event.total_participants}</div>
          <div className="text-xs text-white/50">Participants</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-white">{event.total_raffle_entries}</div>
          <div className="text-xs text-white/50">Raffle Entries</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-yellow-400">{event.total_coins_distributed}</div>
          <div className="text-xs text-white/50">Coins Distributed</div>
        </div>
      </div>

      {/* Event Controls */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Event Controls</h3>
        <div className="flex flex-wrap gap-2">
          {event.status === 'upcoming' && (
            <button
              onClick={() => handleSetStatus('active')}
              className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30 flex items-center gap-1"
            >
              <Play className="w-3 h-3" /> Start Event
            </button>
          )}
          {event.status === 'active' && (
            <>
              <button
                onClick={() => handleSetStatus('paused')}
                className="px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs hover:bg-yellow-500/30"
              >
                Pause Event
              </button>
              <button
                onClick={() => handleSetStatus('completed')}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30"
              >
                End Event
              </button>
            </>
          )}
          {event.status === 'paused' && (
            <button
              onClick={() => handleSetStatus('active')}
              className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30 flex items-center gap-1"
            >
              <Play className="w-3 h-3" /> Resume
            </button>
          )}
        </div>
      </div>

      {/* Tro Drop */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Gift className="w-4 h-4 text-green-400" /> Tro Drop
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={dropAmount}
            onChange={(e) => setDropAmount(Number(e.target.value))}
            className="w-24 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50"
            min={1}
            max={1000}
          />
          <button
            onClick={handleTriggerDrop}
            className="px-4 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30"
          >
            Trigger Drop
          </button>
        </div>
      </div>

      {/* Raffle */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-purple-400" /> Raffle
        </h3>
        <button
          onClick={handleDrawRaffle}
          className="px-4 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-sm hover:bg-purple-500/30"
        >
          🎰 Draw Winner
        </button>
      </div>

      {/* Trivia Rewards */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Coins className="w-4 h-4 text-yellow-400" /> Trivia Reward
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
            <input
              type="text"
              value={triviaSearch}
              onChange={(e) => setTriviaSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
              placeholder="Search username..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-500/50"
            />
          </div>
          <button
            onClick={handleSearchUser}
            className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20"
          >
            Find
          </button>
          {triviaResult && (
            <button
              onClick={handleRewardTrivia}
              className="px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 text-sm hover:bg-yellow-500/30"
            >
              Reward {triviaResult.username}
            </button>
          )}
        </div>
      </div>

      {/* Music Queue */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Music className="w-4 h-4 text-pink-400" /> Music Queue
        </h3>
        {musicQueue.length === 0 ? (
          <p className="text-white/30 text-sm">No pending requests</p>
        ) : (
          <div className="space-y-2">
            {musicQueue.map((req) => (
              <div key={req.id} className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                <span className="text-white/30 text-xs w-5">#{req.queue_position}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-medium truncate">{req.song_title}</div>
                  <div className="text-white/40 text-xs">{req.username}</div>
                </div>
                <button
                  onClick={() => handleCompleteSong(req.id)}
                  className="p-1 rounded text-green-400 hover:bg-green-500/20"
                  title="Mark as played"
                >
                  <Play className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleSkipSong(req.id)}
                  className="p-1 rounded text-yellow-400 hover:bg-yellow-500/20"
                  title="Skip"
                >
                  <SkipForward className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
