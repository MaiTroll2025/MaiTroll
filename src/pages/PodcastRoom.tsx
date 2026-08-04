import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  Headphones,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  Radio,
  ShieldCheck,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MaiTrollBroadcastTheme as theme } from '@/styles/broadcastTheme'
import { usePodcastStore } from '@/stores/podcastStore'
import { usePodcastAgora } from '@/hooks/usePodcastAgora'
import { useBroadcastRecorder } from '@/hooks/useBroadcastRecorder'
import SaveBroadcastButton from '@/components/broadcast/SaveBroadcastButton'
import { cn } from '@/lib/utils'

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
  ended_at?: string | null
  listener_count: number | null
  peak_listener_count: number | null
  created_at?: string
  updated_at?: string
  host_username?: string | null
  recording_url?: string | null
  video_url?: string | null
}

const LIVE_STATUSES: PodcastStatus[] = ['live', 'active']

const glassCard =
  'rounded-3xl border border-white/10 bg-white/[0.055] shadow-2xl shadow-black/25 backdrop-blur-xl'

const neonCard =
  'rounded-3xl border border-cyan-300/20 bg-cyan-400/[0.06] shadow-2xl shadow-cyan-950/30 backdrop-blur-xl'

const formatStartedTime = (value?: string | null) => {
  if (!value) return 'recently'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'recently'

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function PodcastRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { isMobileWidth } = useIsMobile()

  const [podcast, setPodcast] = useState<Podcast | null>(null)
  const [loading, setLoading] = useState(true)

  // Kick guard: check on page load if user was kicked from this podcast
  useEffect(() => {
    if (!id || !user?.id) return

    const KICK_BAN_DURATION_MS = 24 * 60 * 60 * 1000
    const getKickStorageKey = (sid: string, uid: string) => `kick_${sid}_${uid}`

    const checkKickGuard = async () => {
      try {
        // Check localStorage for recent kick
        const raw = localStorage.getItem(getKickStorageKey(id, user.id))
        if (raw) {
          const kickData = JSON.parse(raw)
          if (kickData && typeof kickData.timestamp === 'number') {
            const timeSinceKick = Date.now() - kickData.timestamp
            if (timeSinceKick < KICK_BAN_DURATION_MS) {
              const remainingMs = KICK_BAN_DURATION_MS - timeSinceKick
              const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000))
              toast.error(`You were kicked from this podcast and cannot rejoin for ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}.`)
              navigate('/', { replace: true })
              return
            }
          }
        }

        // Check stream_kicks table
        const { data: kickRecord } = await supabase
          .from('stream_kicks')
          .select('id, created_at')
          .eq('stream_id', id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (kickRecord) {
          const kickTimestamp = new Date(kickRecord.created_at).getTime()
          const timeSinceKick = Date.now() - kickTimestamp
          if (timeSinceKick < KICK_BAN_DURATION_MS) {
            const remainingMs = KICK_BAN_DURATION_MS - timeSinceKick
            const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000))
            toast.error(`You were kicked from this podcast and cannot rejoin for ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}.`)
            localStorage.setItem(getKickStorageKey(id, user.id), JSON.stringify({
              timestamp: kickTimestamp,
              streamId: id,
              reason: 'Kicked by moderator'
            }))
            navigate('/', { replace: true })
          }
        }
      } catch (err) {
        console.warn('[PodcastRoom] Kick guard check failed:', err)
      }
    }

    void checkKickGuard()
  }, [id, user?.id, navigate])
  const [endingPodcast, setEndingPodcast] = useState(false)

  const activePodcast = usePodcastStore((state) => state.activePodcast)
  const setActivePodcast = usePodcastStore((state) => state.setActivePodcast)
  const setShowMiniPlayer = usePodcastStore((state) => state.setShowMiniPlayer)
  const isPlaying = usePodcastStore((state) => state.isPlaying)
  const isMuted = usePodcastStore((state) => state.isMuted)
  const volume = usePodcastStore((state) => state.volume)
  const setPlaying = usePodcastStore((state) => state.setPlaying)
  const setMuted = usePodcastStore((state) => state.setMuted)
  const setVolume = usePodcastStore((state) => state.setVolume)
  const clearPodcast = usePodcastStore((state) => state.clearPodcast)

  const isHost = useMemo(() => {
    if (!podcast?.host_user_id || !user?.id) return false
    return podcast.host_user_id === user.id
  }, [podcast?.host_user_id, user?.id])

  const isLive = useMemo(() => {
    return podcast ? LIVE_STATUSES.includes(podcast.status) : false
  }, [podcast])

  const agoraEnabled = Boolean(podcast?.agora_channel_name && podcast?.id && isLive)

  const {
    isConnected,
    isMuted: hookIsMuted,
    joinPodcast,
    leavePodcast,
    toggleMute: hookToggleMute,
    error: agoraError,
  } = usePodcastAgora({
    channelName: podcast?.agora_channel_name || '',
    enabled: agoraEnabled,
    isHost,
    podcastId: podcast?.id,
    onClientReady: (client, localAudioTrack) => {
      agoraClientRef.current = client
      localAudioTrackRef.current = localAudioTrack
    },
  })

  // Refs to hold Agora client/track references for merging audio into recording
  const agoraClientRef = useRef<any>(null)
  const localAudioTrackRef = useRef<any>(null)

  // Use the same recorder as BroadcastPage — captures the entire screen
  // (full Mai Troll UI) via getDisplayMedia, with Agora audio tracks merged in
  // so the recording includes both the screen video AND the podcast audio (mic + remote users)
  const recorder = useBroadcastRecorder({
    sourceStream: () => {
      const tracks: MediaStreamTrack[] = []

      // Collect remote users' audio tracks from Agora
      const client = agoraClientRef.current
      if (client?.remoteUsers) {
        client.remoteUsers.forEach((u: any) => {
          if (u.audioTrack) {
            const raw = u.audioTrack.mediaStreamTrack || u.audioTrack._track
            if (raw && raw.readyState !== 'ended') tracks.push(raw)
          }
        })
      }

      // Local host microphone track
      const localTrack = localAudioTrackRef.current
      if (localTrack) {
        const raw = localTrack.mediaStreamTrack || localTrack._track
        if (raw && raw.readyState !== 'ended') tracks.push(raw)
      }

      if (tracks.length === 0) return null
      return new MediaStream(tracks)
    },
    replaySource: 'broadcast',
    replayTitlePrefix: 'Podcast',
  })

  const fetchPodcast = useCallback(async () => {
    if (!id) return

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('podcasts')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        toast.error('Podcast not found.')
        navigate('/podcast')
        return
      }

      setPodcast(data as Podcast)
    } catch (err) {
      console.error('[PodcastRoom] Error fetching podcast:', err)
      toast.error('Podcast not found.')
      navigate('/podcast')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    fetchPodcast()
  }, [fetchPodcast])

  useEffect(() => {
    if (!podcast) return

    setActivePodcast({
      id: podcast.id,
      host_user_id: podcast.host_user_id,
      title: podcast.title,
      description: podcast.description || '',
      status: podcast.status as any,
      agora_channel_name: podcast.agora_channel_name,
      started_at: podcast.started_at || new Date().toISOString(),
      listener_count: podcast.listener_count || 0,
      host_username: podcast.host_username || profile?.username || undefined,
      recordingUrl: podcast.recording_url || null,
    })

    setPlaying(isLive)
    setShowMiniPlayer(!isHost)
  }, [
    podcast,
    profile?.username,
    isHost,
    isLive,
    setActivePodcast,
    setShowMiniPlayer,
    setPlaying,
  ])

  useEffect(() => {
    if (agoraError) {
      toast.error(agoraError)
    }
  }, [agoraError])

  const handleLeavePodcast = useCallback(async () => {
    try {
      await leavePodcast?.()
    } catch (err) {
      console.warn('[PodcastRoom] leavePodcast warning:', err)
    }

    if (!isHost) {
      clearPodcast()
    } else {
      setShowMiniPlayer(false)
    }

    navigate('/podcast')
  }, [leavePodcast, isHost, clearPodcast, setShowMiniPlayer, navigate])

  const handleEndPodcast = useCallback(async () => {
    if (!podcast?.id || !isHost) return

    setEndingPodcast(true)

    try {
      const { error } = await supabase
        .from('podcasts')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', podcast.id)
        .eq('host_user_id', user?.id)

      if (error) throw error

      await supabase.from('podcast_rtc_logs').insert({
        podcast_id: podcast.id,
        user_id: user?.id,
        username: profile?.username || '',
        role: profile?.role || '',
        level: (profile as any)?.level || 1,
        event_type: 'podcast_ended',
        message: `Host ended podcast: ${podcast.title}`,
        metadata: {
          title: podcast.title,
          source: 'PodcastRoom',
        },
      })

      try {
        await leavePodcast?.()
      } catch (err) {
        console.warn('[PodcastRoom] leave after end warning:', err)
      }

      clearPodcast()
      toast.success('Podcast ended.')
      navigate('/podcast')
    } catch (err: any) {
      console.error('[PodcastRoom] Error ending podcast:', err)
      toast.error(err?.message || 'Failed to end podcast.')
    } finally {
      setEndingPodcast(false)
    }
  }, [
    podcast,
    isHost,
    user?.id,
    profile,
    leavePodcast,
    clearPodcast,
    navigate,
  ])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
      </div>
    )
  }

  if (!podcast) return null

  return (
    <div className="relative min-h-full w-full overflow-y-auto overflow-x-hidden md:overflow-hidden bg-slate-950">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.20),transparent_42%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.16),transparent_46%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.11),transparent_44%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px] opacity-20" />
      </div>

      <div className="safe-top relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 pb-8 pt-3 md:px-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/podcast')}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide',
              isHost
                ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200'
                : 'border-cyan-300/25 bg-cyan-400/10 text-cyan-200'
            )}
          >
            {isHost ? <Radio className="h-3.5 w-3.5" /> : <Headphones className="h-3.5 w-3.5" />}
            {isHost ? 'Host Studio' : 'Listener Room'}
          </div>
        </div>

        <header className={cn(neonCard, 'relative overflow-hidden p-5 md:p-7')}>
          <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-28 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />

          <div className="relative z-10 grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="flex gap-4">
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-600/35 via-cyan-500/25 to-pink-500/25">
                <Mic className="h-10 w-10 text-cyan-100" />
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide',
                      isLive
                        ? 'border-rose-300/25 bg-rose-500/15 text-rose-100'
                        : 'border-slate-300/20 bg-white/10 text-slate-300'
                    )}
                  >
                    {isLive ? 'Live' : podcast.status}
                  </span>

                  {isHost && (
                    <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-200">
                      You are host
                    </span>
                  )}
                </div>

                <h1 className="line-clamp-2 text-3xl font-black tracking-tight text-white md:text-4xl">
                  {podcast.title}
                </h1>

                <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-base">
                  {podcast.description || 'No description'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <Users className="mb-2 h-5 w-5 text-cyan-200" />
                <p className="text-2xl font-black text-white">{podcast.listener_count || 0}</p>
                <p className="text-xs text-slate-400">Listeners</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <Clock className="mb-2 h-5 w-5 text-purple-200" />
                <p className="text-2xl font-black text-white">{formatStartedTime(podcast.started_at)}</p>
                <p className="text-xs text-slate-400">Started</p>
              </div>
            </div>
          </div>
        </header>

        <main className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className={cn(theme.panelStrong, 'p-5')}>
            {isHost ? (
              <div>
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15">
                   <Radio className="h-6 w-6 text-emerald-200" />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-white">Host Studio Controls</h2>
                    <p className="text-sm text-slate-400">
                      You created this podcast, so you publish audio as host.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={cn(glassCard, 'p-5')}>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-black text-white">Host Mic</p>
                        <p className="text-xs text-slate-400">
                          {isMuted ? 'Muted' : 'Broadcasting audio'}
                        </p>
                      </div>

                      {isMuted ? (
                        <MicOff className="h-6 w-6 text-red-300" />
                      ) : (
                        <Mic className="h-6 w-6 text-emerald-300" />
                      )}
                    </div>

                    <button
                      type="button"
                        onClick={() => {
                          hookToggleMute()
                          setMuted(!isMuted)
                        }}
                      className={cn(
                        'w-full rounded-2xl px-4 py-3 text-sm font-black transition',
                        isMuted
                          ? 'bg-red-500/15 text-red-100 hover:bg-red-500/25'
                          : 'bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/25'
                      )}
                    >
                      {isMuted ? 'Unmute Host Mic' : 'Mute Host Mic'}
                    </button>
                  </div>

                  <div className={cn(glassCard, 'p-5')}>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-black text-white">Connection</p>
                        <p className="text-xs text-slate-400">
                          {isConnected ? 'Agora connected' : 'Connecting to Agora'}
                        </p>
                      </div>

                      <Radio
                        className={cn(
                          'h-6 w-6',
                          isConnected ? 'text-cyan-300' : 'animate-pulse text-yellow-300'
                        )}
                      />
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
                      Channel: <span className="font-mono text-cyan-200">{podcast.agora_channel_name}</span>
                    </div>
                  </div>
                </div>

                {/* Recording controls — same SaveBroadcastButton as BroadcastPage */}
                {isHost && isLive && (
                  <div className="mt-4">
                    <SaveBroadcastButton
                      isRecording={recorder.isRecording}
                      isUploading={recorder.isUploading}
                      recordingDuration={recorder.recordingDuration}
                      recordingSize={recorder.recordingSize}
                      streamId={podcast?.id ?? null}
                      onStartRecording={recorder.startRecording}
                      onStopRecording={recorder.stopRecording}
                      onSaveClip={recorder.saveClip}
                    />
                  </div>
                )}

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPlaying(!isPlaying)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-cyan-500 to-pink-500 px-4 py-3 font-black text-white shadow-lg shadow-cyan-950/30 transition hover:scale-[1.01]"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {isPlaying ? 'Pause Local Playback' : 'Resume Local Playback'}
                  </button>

                  <button
                    type="button"
                    onClick={handleEndPodcast}
                    disabled={endingPodcast}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3 font-black text-red-100 transition hover:bg-red-500/25 disabled:opacity-50"
                  >
                    {endingPodcast ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    End Podcast
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15">
                    <Headphones className="h-6 w-6 text-cyan-200" />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-white">Listener Controls</h2>
                    <p className="text-sm text-slate-400">
                      You are listening to this podcast with the mini player enabled.
                    </p>
                  </div>
                </div>

                <div className={cn(glassCard, 'p-5')}>
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-white">Playback</p>
                      <p className="text-xs text-slate-400">
                        {isConnected ? 'Connected to podcast audio' : 'Connecting...'}
                      </p>
                    </div>

                    <Volume2 className="h-6 w-6 text-cyan-200" />
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(event) => setVolume(parseFloat(event.target.value))}
                    className="mb-5 h-2 w-full appearance-none rounded-full bg-white/20"
                  />

                  <div className="grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                        onClick={() => {
                          hookToggleMute()
                          setMuted(!isMuted)
                        }}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black text-white transition hover:bg-white/10',
                        isMuted && 'border-red-500/30 bg-red-500/10 text-red-100'
                      )}
                    >
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      {isMuted ? 'Unmute' : 'Mute'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setPlaying(!isPlaying)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-500 px-4 py-3 font-black text-white transition hover:scale-[1.01]"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {isPlaying ? 'Pause' : 'Play'}
                    </button>

                    <button
                      type="button"
                      onClick={handleLeavePodcast}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-black text-red-200 transition hover:bg-red-500/20"
                    >
                      <X className="h-4 w-4" />
                      Leave
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside className="grid gap-5">
            <section className={cn(glassCard, 'p-5')}>
              <div className="mb-4 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-cyan-200" />
                <h2 className="font-black text-white">Room Role Debug</h2>
              </div>

              <div className="space-y-3 text-xs">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-slate-400">Your user id</p>
                  <p className="break-all font-mono text-cyan-100">{user?.id || 'Missing user'}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-slate-400">Podcast host id</p>
                  <p className="break-all font-mono text-purple-100">{podcast.host_user_id}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-slate-400">Detected role</p>
                  <p className={cn('font-black', isHost ? 'text-emerald-200' : 'text-cyan-200')}>
                    {isHost ? 'HOST' : 'LISTENER'}
                  </p>
                </div>
              </div>
            </section>

            <section className={cn(glassCard, 'p-5')}>
              <h2 className="mb-3 font-black text-white">Status</h2>

              <div className="grid gap-3 text-xs">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-slate-400">Podcast Status</p>
                  <p className="font-black text-white">{podcast.status}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-slate-400">Agora</p>
                  <p className={cn('font-black', isConnected ? 'text-emerald-200' : 'text-yellow-200')}>
                    {isConnected ? 'Connected' : 'Connecting'}
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </main>
      </div>
    </div>
  )
}