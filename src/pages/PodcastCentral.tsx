import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Headphones,
  Loader2,
  Lock,
  Mic,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Volume2,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import useSEO from '@/hooks/useSEO';

import { RTCAdminMonitor } from '@/components/admin'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { usePodcastStore } from '@/stores/podcastStore'
import { MaiTrollBroadcastTheme as theme } from '@/styles/broadcastTheme'
import { showStorageStartWarning } from '@/hooks/useStorageUsage'
import { usePodcastLockdown } from '@/hooks/useFeatureLockdown'

type PodcastStatus =
  | 'scheduled'
  | 'live'
  | 'active'
  | 'ended'
  | 'archived'
  | 'draft'
  | 'paused'
  | 'cancelled'

interface Podcast {
  id: string
  host_user_id: string
  title: string
  description: string | null
  status: PodcastStatus
  agora_channel_name: string
  started_at: string | null
  ended_at: string | null
  listener_count: number | null
  peak_listener_count: number | null
  created_at: string
  updated_at: string
  host_username?: string | null
  recording_url?: string | null
}

interface PodcastEpisode {
  id: string
  podcast_id: string
  title: string
  description: string | null
  duration_seconds: number | null
  recorded_at: string | null
  audio_url: string | null
  listener_count: number | null
}

const LIVE_PODCAST_STATUSES: PodcastStatus[] = ['live', 'active']

const STAFF_ROLES_REQUIRING_LEVEL_10 = new Set([
  'staff',
  'admin',
  'officer',
  'broadofficer',
  'troll_officer',
  'lead_troll_officer',
  'secretary',
  'agency_hr',
  'agency_hr_manager',
])

const CEO_ADMIN_ROLES = new Set(['admin', 'ceo'])

const normalizeRole = (role?: string | null) => String(role || '').trim().toLowerCase()

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const formatTime = (seconds?: number | null) => {
  const safeSeconds = Math.max(0, Number(seconds || 0))
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatStartedTime = (value?: string | null) => {
  if (!value) return 'recently'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'recently'

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

const glassCard =
  'rounded-3xl border border-white/10 bg-white/[0.055] shadow-2xl shadow-black/25 backdrop-blur-xl'

const neonCard =
  'rounded-3xl border border-cyan-300/20 bg-cyan-400/[0.06] shadow-2xl shadow-cyan-950/30 backdrop-blur-xl'

export default function PodcastCentral() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { isMobileWidth } = useIsMobile()
  const { isLocked: isPodcastLockedDown } = usePodcastLockdown()

  useSEO({
    title: 'Podcasts | Mai Troll - Live Podcast Streaming & Creator Podcasts',
    description: 'Listen to live podcasts on Mai Troll. Discover trending podcasts, creator-hosted shows, and podcast streaming from a vibrant community of podcasters and listeners.',
    keywords: [
      'podcasts', 'live podcasts', 'podcast streaming', 'podcast community',
      'creator podcasts', 'listen to podcasts', 'podcast platform',
      'MaiTroll podcasts', 'audio content', 'podcast shows'
    ]
  });

  const [livePodcasts, setLivePodcasts] = useState<Podcast[]>([])
  const [trendingPodcasts, setTrendingPodcasts] = useState<Podcast[]>([])
  const [recentEpisodes, setRecentEpisodes] = useState<PodcastEpisode[]>([])
  const [userHistory, setUserHistory] = useState<PodcastEpisode[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [showStartForm, setShowStartForm] = useState(false)
  const [podcastTitle, setPodcastTitle] = useState('')
  const [podcastDescription, setPodcastDescription] = useState('')
  const [isStarting, setIsStarting] = useState(false)

  const setActivePodcast = usePodcastStore((state) => state.setActivePodcast)
  const setShowMiniPlayer = usePodcastStore((state) => state.setShowMiniPlayer)
  const setPlaying = usePodcastStore((state) => state.setPlaying)

  const currentRole = useMemo(() => normalizeRole(profile?.role), [profile?.role])
  const currentTrollRole = useMemo(() => normalizeRole((profile as any)?.troll_role), [profile])
  const currentLevel = useMemo(() => {
    return asNumber((profile as any)?.level ?? (profile as any)?.user_level, 1)
  }, [profile])

  const isAdminOrCeo = useMemo(() => {
    return (
      Boolean((profile as any)?.is_admin) ||
      CEO_ADMIN_ROLES.has(currentRole) ||
      CEO_ADMIN_ROLES.has(currentTrollRole)
    )
  }, [profile, currentRole, currentTrollRole])

  const canStartPodcast = useMemo(() => {
    if (!user?.id || !profile) return false

    if (isAdminOrCeo) return true
    if (currentLevel >= 10) return true

    if (STAFF_ROLES_REQUIRING_LEVEL_10.has(currentRole)) return false
    if (STAFF_ROLES_REQUIRING_LEVEL_10.has(currentTrollRole)) return false

    return true
  }, [user?.id, profile, isAdminOrCeo, currentLevel, currentRole, currentTrollRole])

  const lockedMessage = useMemo(() => {
    if (!profile) return 'Sign in to start podcasts.'

    const isLockedStaff =
      currentLevel < 10 &&
      (STAFF_ROLES_REQUIRING_LEVEL_10.has(currentRole) ||
        STAFF_ROLES_REQUIRING_LEVEL_10.has(currentTrollRole))

    if (isLockedStaff) return 'Staff accounts need Level 10 to start podcasts.'

    return 'Podcast Central unlocks at Level 10.'
  }, [profile, currentLevel, currentRole, currentTrollRole])

  const totalLiveListeners = useMemo(() => {
    return livePodcasts.reduce((sum, podcast) => sum + Number(podcast.listener_count || 0), 0)
  }, [livePodcasts])

  const topPodcast = livePodcasts[0] || null

  const fetchLivePodcasts = useCallback(async () => {
    const { data, error } = await supabase
      .from('podcasts')
      .select('*')
      .in('status', LIVE_PODCAST_STATUSES)
      .order('started_at', { ascending: false, nullsFirst: false })
      .limit(12)

    if (error) throw error
    setLivePodcasts((data || []) as Podcast[])
  }, [])

  const fetchTrendingPodcasts = useCallback(async () => {
    const { data, error } = await supabase
      .from('podcasts')
      .select('*')
      .eq('status', 'ended')
      .order('peak_listener_count', { ascending: false, nullsFirst: false })
      .limit(9)

    if (error) throw error
    setTrendingPodcasts((data || []) as Podcast[])
  }, [])

  const fetchRecentEpisodes = useCallback(async () => {
    const { data, error } = await supabase
      .from('podcast_episodes')
      .select('*')
      .order('recorded_at', { ascending: false, nullsFirst: false })
      .limit(9)

    if (error) throw error
    setRecentEpisodes((data || []) as PodcastEpisode[])
  }, [])

  const fetchUserHistory = useCallback(async () => {
    if (!user?.id) {
      setUserHistory([])
      return
    }

    const { data, error } = await supabase
      .from('podcast_episodes')
      .select(
        `
        *,
        podcasts!inner(host_user_id)
      `
      )
      .eq('podcasts.host_user_id', user.id)
      .order('recorded_at', { ascending: false, nullsFirst: false })
      .limit(6)

    if (error) throw error
    setUserHistory((data || []) as PodcastEpisode[])
  }, [user?.id])

  const loadPodcastData = useCallback(
    async (mode: 'initial' | 'refresh' = 'refresh') => {
      if (mode === 'initial') {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      try {
        await Promise.all([
          fetchLivePodcasts(),
          fetchTrendingPodcasts(),
          fetchRecentEpisodes(),
          fetchUserHistory(),
        ])
      } catch (err) {
        console.error('[PodcastCentral] Error loading podcast data:', err)
        toast.error('Could not load Podcast Central.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [fetchLivePodcasts, fetchTrendingPodcasts, fetchRecentEpisodes, fetchUserHistory]
  )

  useEffect(() => {
    loadPodcastData('initial')

    const interval = window.setInterval(() => {
      loadPodcastData('refresh')
    }, 30000)

    return () => window.clearInterval(interval)
  }, [loadPodcastData])

  const checkUserCanJoinPodcast = useCallback(async () => {
    if (!user?.id) {
      return true
    }

    const { data: jailData, error } = await supabase
      .from('jail')
      .select('release_time')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.warn('[PodcastCentral] Jail check failed:', error)
      return true
    }

    if (jailData?.release_time && new Date(jailData.release_time) > new Date()) {
      toast.error('You are in jail and cannot join podcasts.')
      return false
    }

    return true
  }, [user?.id])

  const handleJoinPodcast = useCallback(
    async (podcast: Podcast) => {
      try {
        const allowed = await checkUserCanJoinPodcast()
        if (!allowed) return

        setActivePodcast({
          id: podcast.id,
          host_user_id: podcast.host_user_id,
          title: podcast.title,
          description: podcast.description || '',
          status: podcast.status as any,
          agora_channel_name: podcast.agora_channel_name,
          started_at: podcast.started_at || new Date().toISOString(),
          listener_count: podcast.listener_count || 0,
          host_username: podcast.host_username || undefined,
          recordingUrl: podcast.recording_url || null,
        })

        setShowMiniPlayer(true)
        setPlaying(true)

        toast.success(`Joining "${podcast.title}"`)
      } catch (err) {
        console.error('[PodcastCentral] Error joining podcast:', err)
        toast.error('Failed to join podcast.')
      }
    },
    [checkUserCanJoinPodcast, setActivePodcast, setShowMiniPlayer, setPlaying]
  )

  const handleStartPodcast = useCallback(async () => {
    if (isPodcastLockedDown) {
      toast.error('Podcasts are currently disabled by admin. No one can start a podcast while lockdown is active.');
      return;
    }
    if (!user?.id) {
      toast.error('Sign in to start a podcast.')
      return
    }

    if (!canStartPodcast) {
      toast.error(lockedMessage)
      return
    }

    const title = podcastTitle.trim() || 'Untitled Podcast'
    const description = podcastDescription.trim() || null
    const channelName = `podcast_${user.id}_${Date.now()}`

    setIsStarting(true)

    try {
      const { data: podcast, error } = await supabase
        .from('podcasts')
        .insert({
          host_user_id: user.id,
          title,
          description,
          status: 'live',
          agora_channel_name: channelName,
          started_at: new Date().toISOString(),
          listener_count: 0,
          peak_listener_count: 0,
        })
        .select('*')
        .single()

      if (error) throw error
      if (!podcast?.id) throw new Error('Podcast was created but no podcast id was returned.')

      const { error: rtcLogError } = await supabase.from('podcast_rtc_logs').insert({
        podcast_id: podcast.id,
        user_id: user.id,
        username: profile?.username || '',
        role: profile?.role || '',
        level: currentLevel,
        event_type: 'podcast_started',
        message: `User started podcast: ${podcast.title}`,
        metadata: {
          title: podcast.title,
          channelName,
          status: podcast.status,
          source: 'PodcastCentral',
        },
      })

      if (rtcLogError) {
        console.warn('[PodcastCentral] RTCAdmin Monitor log failed:', rtcLogError)
      }

      setActivePodcast({
        id: podcast.id,
        host_user_id: podcast.host_user_id,
        title: podcast.title,
        description: podcast.description || '',
        status: podcast.status,
        agora_channel_name: podcast.agora_channel_name,
        started_at: podcast.started_at || new Date().toISOString(),
        listener_count: podcast.listener_count || 0,
        host_username: profile?.username || undefined,
      })

      setShowMiniPlayer(true)
      setPlaying(true)

      setPodcastTitle('')
      setPodcastDescription('')
      setShowStartForm(false)

      toast.success('Podcast started!')
      void showStorageStartWarning(user.id, 'podcast')
      navigate(`/podcast/${podcast.id}`)
    } catch (err: any) {
      console.error('[PodcastCentral] Error starting podcast:', err)

      if (
        err?.code === '23514' &&
        String(err?.message || '').includes('podcasts_status_check')
      ) {
        toast.error('Database status constraint needs live added to podcasts_status_check.')
      } else if (err?.code === '42501') {
        toast.error('RLS blocked podcast creation. Check podcasts insert policy.')
      } else {
        toast.error(err?.message || 'Failed to start podcast.')
      }
    } finally {
      setIsStarting(false)
    }
  }, [
    isPodcastLockedDown,
    user?.id,
    profile?.username,
    profile?.role,
    canStartPodcast,
    lockedMessage,
    podcastTitle,
    podcastDescription,
    currentLevel,
    setActivePodcast,
    setShowMiniPlayer,
    setPlaying,
    navigate,
  ])

  const PodcastTile = ({
    podcast,
    variant = 'default',
  }: {
    podcast: Podcast
    variant?: 'default' | 'featured' | 'compact'
  }) => {
    const isLive = LIVE_PODCAST_STATUSES.includes(podcast.status)

    return (
      <article
        className={cn(
          'group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.08]',
          variant === 'featured' && 'min-h-[320px] border-cyan-300/25 bg-cyan-400/[0.07]',
          variant === 'compact' && 'p-3'
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
          <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-purple-500/20 blur-3xl" />
        </div>

        <div className="relative z-10 flex h-full flex-col">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div
              className={cn(
                'flex items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600/35 via-cyan-500/25 to-pink-500/25',
                variant === 'featured' ? 'h-16 w-16' : 'h-12 w-12'
              )}
            >
              <Mic className={cn('text-cyan-200', variant === 'featured' ? 'h-8 w-8' : 'h-6 w-6')} />
            </div>

            {isLive ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-300/25 bg-rose-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-rose-100">
                <span className="h-2 w-2 animate-pulse rounded-full bg-rose-300" />
                Live
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-300">
                Replay
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                'line-clamp-2 font-black text-white',
                variant === 'featured' ? 'text-2xl' : 'text-base'
              )}
            >
              {podcast.title}
            </h3>

            <p
              className={cn(
                'mt-2 text-slate-300',
                variant === 'featured' ? 'line-clamp-4 text-sm' : 'line-clamp-2 text-xs'
              )}
            >
              {podcast.description || 'No description'}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center gap-1 text-slate-400">
                <Users className="h-3.5 w-3.5" />
                Listeners
              </div>
              <p className="mt-1 font-black text-white">{podcast.listener_count || 0}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center gap-1 text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                Started
              </div>
              <p className="mt-1 font-black text-white">{formatStartedTime(podcast.started_at)}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleJoinPodcast(podcast)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-cyan-500 to-pink-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-950/30 transition hover:scale-[1.02]"
          >
            <Play className="h-4 w-4" />
            {isLive ? 'Listen Live' : 'Open Replay'}
          </button>
        </div>
      </article>
    )
  }

  const EpisodeTile = ({
    episode,
    label = 'Play',
  }: {
    episode: PodcastEpisode
    label?: string
  }) => {
    return (
      <article className="group rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.08]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-600/35 to-purple-500/25">
            <Volume2 className="h-6 w-6 text-cyan-200" />
          </div>

          <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-300">
            Episode
          </span>
        </div>

        <h3 className="line-clamp-2 font-black text-white">{episode.title}</h3>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-slate-400">Duration</p>
            <p className="mt-1 font-black text-white">
              {episode.duration_seconds ? formatTime(episode.duration_seconds) : 'Recorded'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-slate-400">Plays</p>
            <p className="mt-1 font-black text-white">{episode.listener_count || 0}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/podcast/${episode.podcast_id}`)}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/20"
        >
          <Play className="h-4 w-4" />
          {label}
        </button>
      </article>
    )
  }

  return (
    <div className="relative min-h-full w-full overflow-y-auto overflow-x-hidden md:overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_18%_12%,rgba(147,51,234,0.22),transparent_42%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(140%_140%_at_84%_0%,rgba(45,212,191,0.17),transparent_46%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.13),transparent_44%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px] opacity-20" />
      </div>

      <div className="safe-top relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-5 px-3 pb-8 pt-3 md:px-5">
        <header className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 p-5 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl md:p-7">
            <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 -left-28 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />

            <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-cyan-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  Agora Audio Hub
                </div>

                <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
                  Podcast Central
                </h1>

                <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-base">
                  Start live audio rooms, keep listeners connected with the mini player, and let
                  RTCAdmin Monitor track the session.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
                  <Radio className="mb-2 h-5 w-5 text-cyan-200" />
                  <p className="text-2xl font-black text-white">{livePodcasts.length}</p>
                  <p className="text-xs text-slate-400">Live Rooms</p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
                  <Users className="mb-2 h-5 w-5 text-purple-200" />
                  <p className="text-2xl font-black text-white">{totalLiveListeners}</p>
                  <p className="text-xs text-slate-400">Listeners</p>
                </div>
              </div>
            </div>
          </section>

          <section className={cn(neonCard, 'p-5')}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white">Start Studio</h2>
                <p className="text-xs text-slate-400">Go live with Agora audio</p>
              </div>

              {canStartPodcast ? (
                <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
                  Unlocked
                </span>
              ) : (
                <span className="rounded-full border border-red-300/20 bg-red-500/10 px-3 py-1 text-xs font-black text-red-200">
                  Locked
                </span>
              )}
            </div>

            {canStartPodcast ? (
              showStartForm ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={podcastTitle}
                    onChange={(event) => setPodcastTitle(event.target.value)}
                    placeholder="Podcast title..."
                    maxLength={100}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/60"
                  />

                  <textarea
                    value={podcastDescription}
                    onChange={(event) => setPodcastDescription(event.target.value)}
                    placeholder="Description optional..."
                    rows={4}
                    maxLength={500}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/60"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setShowStartForm(false)}
                      disabled={isStarting}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black text-white transition hover:bg-white/10 disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleStartPodcast}
                      disabled={isStarting}
                      className="rounded-2xl bg-gradient-to-r from-purple-600 via-cyan-500 to-pink-500 px-4 py-3 font-black text-white shadow-lg shadow-cyan-950/30 transition hover:scale-[1.02] disabled:opacity-50"
                    >
                      {isStarting ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Starting
                        </span>
                      ) : (
                        'Go Live'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowStartForm(true)}
                  className="flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-purple-600/25 via-cyan-500/15 to-pink-500/20 px-6 py-6 text-center transition hover:scale-[1.01] hover:border-cyan-300/40"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400/20 shadow-lg shadow-cyan-950/30">
                    <Mic className="h-8 w-8 text-cyan-100" />
                  </div>

                  <div>
                    <p className="text-xl font-black text-white">Start Podcast</p>
                    <p className="mt-1 text-xs text-slate-300">Creates a live Agora podcast room</p>
                  </div>
                </button>
              )
            ) : (
              <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-4">
                <div className="flex items-start gap-3">
                  <Lock className="mt-1 h-5 w-5 text-red-300" />
                  <div>
                    <p className="font-black text-red-200">Access Locked</p>
                    <p className="mt-1 text-sm text-red-200/80">{lockedMessage}</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className={cn(glassCard, 'p-4')}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/15">
                <Headphones className="h-5 w-5 text-cyan-200" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Mini Player</p>
                <p className="text-xs text-slate-400">Listen while navigating</p>
              </div>
            </div>
          </div>

          <div className={cn(glassCard, 'p-4')}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-400/15">
                <ShieldCheck className="h-5 w-5 text-purple-200" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Access Rules</p>
                <p className="text-xs text-slate-400">Staff need Level 10</p>
              </div>
            </div>
          </div>

          <div className={cn(glassCard, 'p-4')}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-400/15">
                <Zap className="h-5 w-5 text-pink-200" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Agora Powered</p>
                <p className="text-xs text-slate-400">Audio-only sessions</p>
              </div>
            </div>
          </div>

          <div className={cn(glassCard, 'p-4')}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/15">
                {refreshing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-200" />
                ) : (
                  <RefreshCw className="h-5 w-5 text-emerald-200" />
                )}
              </div>
              <div>
                <p className="text-sm font-black text-white">Auto Refresh</p>
                <p className="text-xs text-slate-400">Updates every 30 seconds</p>
              </div>
            </div>
          </div>
        </section>

        <main className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <section className={cn(theme.panelStrong, 'p-5')}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-white">Live Podcast Grid</h2>
                <p className="text-sm text-slate-400">No long tabs — just live room cards</p>
              </div>

              <Link
                to="/podcast/explore"
                className="inline-flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/20"
              >
                Explore <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-72 animate-pulse rounded-3xl bg-white/5" />
                ))}
              </div>
            ) : livePodcasts.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] text-center">
                <Radio className="mb-3 h-14 w-14 text-slate-600" />
                <p className="text-lg font-black text-white">No live podcasts right now</p>
                <p className="mt-1 text-sm text-slate-400">Start one from the studio card.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {livePodcasts.map((podcast, index) => (
                  <PodcastTile
                    key={podcast.id}
                    podcast={podcast}
                    variant={index === 0 && !isMobileWidth ? 'featured' : 'default'}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="grid gap-5">
            <section className={cn(neonCard, 'p-5')}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15">
                  <Star className="h-6 w-6 text-cyan-100" />
                </div>

                <div>
                  <h2 className="text-lg font-black text-white">Featured Room</h2>
                  <p className="text-xs text-slate-400">Top current live podcast</p>
                </div>
              </div>

              {loading ? (
                <div className="h-64 animate-pulse rounded-3xl bg-white/5" />
              ) : topPodcast ? (
                <PodcastTile podcast={topPodcast} variant="compact" />
              ) : (
                <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center">
                  <Radio className="mx-auto mb-2 h-10 w-10 text-slate-600" />
                  <p className="text-sm font-bold text-slate-300">Nothing featured yet</p>
                </div>
              )}
            </section>

            <section className={cn(glassCard, 'p-5')}>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                Rules Grid
              </h2>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3">
                  <p className="text-sm font-black text-emerald-100">Level 10+</p>
                  <p className="text-xs text-emerald-100/75">Can start and host podcasts.</p>
                </div>

                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3">
                  <p className="text-sm font-black text-cyan-100">All Users</p>
                  <p className="text-xs text-cyan-100/75">Can listen to live podcasts.</p>
                </div>

                <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-3">
                  <p className="text-sm font-black text-red-100">Staff Under Level 10</p>
                  <p className="text-xs text-red-100/75">Cannot start podcasts.</p>
                </div>

                <div className="rounded-2xl border border-purple-300/20 bg-purple-400/10 p-3">
                  <p className="text-sm font-black text-purple-100">Admin / CEO</p>
                  <p className="text-xs text-purple-100/75">Always has access.</p>
                </div>
              </div>
            </section>
          </aside>
        </main>

        <section className="grid gap-5 lg:grid-cols-2">
          <section className={cn(theme.panel, 'p-5')}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black text-white">
                  <TrendingUp className="h-5 w-5 text-purple-200" />
                  Trending Grid
                </h2>
                <p className="text-sm text-slate-400">Top ended podcasts by peak listeners</p>
              </div>
            </div>

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-48 animate-pulse rounded-3xl bg-white/5" />
                ))}
              </div>
            ) : trendingPodcasts.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-10 text-center">
                <p className="text-sm text-slate-500">No trending podcasts yet.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {trendingPodcasts.slice(0, 6).map((podcast) => (
                  <PodcastTile key={podcast.id} podcast={podcast} variant="compact" />
                ))}
              </div>
            )}
          </section>

          <section className={cn(theme.panel, 'p-5')}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black text-white">
                  <BarChart3 className="h-5 w-5 text-cyan-200" />
                  Recent Episodes
                </h2>
                <p className="text-sm text-slate-400">Recorded podcast cards</p>
              </div>
            </div>

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-48 animate-pulse rounded-3xl bg-white/5" />
                ))}
              </div>
            ) : recentEpisodes.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-10 text-center">
                <p className="text-sm text-slate-500">No episodes recorded yet.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {recentEpisodes.slice(0, 6).map((episode) => (
                  <EpisodeTile key={episode.id} episode={episode} label="Play" />
                ))}
              </div>
            )}
          </section>
        </section>

        {user?.id && (
          <section className={cn(theme.panel, 'p-5')}>
            <div className="mb-4">
              <h2 className="text-xl font-black text-white">My Podcast History</h2>
              <p className="text-sm text-slate-400">Your hosted podcast episodes in grid view</p>
            </div>

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-48 animate-pulse rounded-3xl bg-white/5" />
                ))}
              </div>
            ) : userHistory.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-10 text-center">
                <p className="text-sm text-slate-500">No podcast history yet.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {userHistory.map((episode) => (
                  <EpisodeTile key={episode.id} episode={episode} label="Replay" />
                ))}
              </div>
            )}
          </section>
        )}

        <section className={cn(theme.panel, 'p-5')}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/15">
              <ShieldCheck className="h-5 w-5 text-cyan-100" />
            </div>

            <div>
              <h2 className="text-xl font-black text-white">RTCAdmin Monitor</h2>
              <p className="text-sm text-slate-400">Podcast sessions report into admin monitoring</p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
            <RTCAdminMonitor />
          </div>
        </section>
      </div>
    </div>
  )
}