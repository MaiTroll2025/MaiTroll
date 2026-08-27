import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Eye,
  Gavel,
  Loader2,
  MessageSquareOff,
  MicOff,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  StopCircle,
  Users,
  Video,
  Waves,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrack,
} from 'livekit-client'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { isBroadcastChatLockActive } from '@/lib/broadcastModeration'
import { requestLiveKitToken } from '@/lib/livekitToken'

import UserNameWithAge from '@/components/UserNameWithAge'

interface OfficerLog {
  officer_id: string
  actions_taken: number
  joined_at: string
  officer: {
    username: string
    avatar_url: string
  }
}

interface StreamRow {
  id: string
  broadcaster_id: string
  user_id?: string
  status: string
  is_live: boolean
  viewer_count: number
  current_viewers?: number
  title: string
  room_name?: string
  livekit_room_name?: string
  streamChannel: string
  hls_url?: string
  agora_channel?: string

  broadcaster: {
    username: string
    avatar_url: string
    broadcast_chat_disabled?: boolean
    broadcast_chat_disabled_until?: string | null
    broadcast_chat_disable_strike_count?: number
    broadcast_chat_disabled_stream_id?: string | null
    broadcast_mic_muted?: boolean
  }

  active_officers?: OfficerLog[]
}

interface PodRow {
  id: string
  host_id: string
  title: string
  is_live: boolean
  viewer_count: number
  current_viewers?: number
  started_at: string
  host?: {
    username: string
    avatar_url: string
  }
}

function isCurrentStreamChatDisabled(stream: StreamRow) {
  return isBroadcastChatLockActive({
    disabled: stream.broadcaster?.broadcast_chat_disabled,
    until: stream.broadcaster?.broadcast_chat_disabled_until,
    streamId: stream.id,
    lockedStreamId:
      stream.broadcaster?.broadcast_chat_disabled_stream_id,
  })
}

function getChatLockRemainingSeconds(stream: StreamRow) {
  const until =
    stream.broadcaster?.broadcast_chat_disabled_until

  if (!until) return null

  const remainingMs = Date.parse(until) - Date.now()

  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return null
  }

  return Math.max(1, Math.ceil(remainingMs / 1000))
}

/* -------------------------------------------------------------------------- */
/*                              LIVEKIT MONITOR                               */
/* -------------------------------------------------------------------------- */

interface LiveKitMonitorProps {
  stream: StreamRow
  active: boolean
  governmentUserId: string
  onConnected?: () => void
  onDisconnected?: () => void
}

function LiveKitMonitor({
  stream,
  active,
  governmentUserId,
  onConnected,
  onDisconnected,
}: LiveKitMonitorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const roomRef = useRef<Room | null>(null)

  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [hasVideo, setHasVideo] = useState(false)

  const cleanup = useCallback(() => {
    const room = roomRef.current

    if (room) {
      room.disconnect()
      roomRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    if (audioRef.current) {
      audioRef.current.srcObject = null
    }

    setConnected(false)
    setConnecting(false)
    setHasVideo(false)
    setAudioBlocked(false)

    onDisconnected?.()
  }, [onDisconnected])

  const attachTrack = useCallback(
    (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Video) {
        if (!videoRef.current) return

        track.attach(videoRef.current)

        videoRef.current
          .play()
          .catch(() => {
            // Video autoplay should normally work because it is muted
          })

        setHasVideo(true)
      }

      if (track.kind === Track.Kind.Audio) {
        if (!audioRef.current) return

        track.attach(audioRef.current)

        audioRef.current.muted = false

        audioRef.current
          .play()
          .then(() => {
            setAudioBlocked(false)
          })
          .catch(() => {
            setAudioBlocked(true)
          })
      }
    },
    []
  )

  const connect = useCallback(async () => {
    if (!active) return
    if (roomRef.current) return
    if (!governmentUserId) return

    const roomName =
      stream.livekit_room_name ||
      stream.room_name ||
      stream.id

    if (!roomName) return

    try {
      setConnecting(true)

      /*
       * The existing helper is used here.
       *
       * IMPORTANT:
       * Your livekit-token Edge Function should grant this request
       * subscriber/viewer permissions rather than publisher permissions
       * for Government monitoring.
       */
      const { token } = await requestLiveKitToken(
        roomName,
        governmentUserId
      )

      if (!active) return

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      })

      roomRef.current = room

      const handleTrackSubscribed = (
        track: RemoteTrack,
        _publication: any,
        _participant: RemoteParticipant
      ) => {
        attachTrack(track)
      }

      const handleTrackUnsubscribed = (
        track: RemoteTrack
      ) => {
        track.detach()

        if (track.kind === Track.Kind.Video) {
          setHasVideo(false)
        }
      }

      room.on(
        RoomEvent.TrackSubscribed,
        handleTrackSubscribed
      )

      room.on(
        RoomEvent.TrackUnsubscribed,
        handleTrackUnsubscribed
      )

      room.on(RoomEvent.Disconnected, () => {
        setConnected(false)
        setConnecting(false)
      })

      await room.connect(
        import.meta.env.VITE_LIVEKIT_URL,
        token
      )

      if (!active) {
        room.disconnect()
        roomRef.current = null
        return
      }

      setConnected(true)
      setConnecting(false)

      /*
       * Attach tracks that were already published before we connected.
       */
      room.remoteParticipants.forEach(
        (participant) => {
          participant.trackPublications.forEach(
            (publication) => {
              if (
                publication.isSubscribed &&
                publication.track
              ) {
                attachTrack(
                  publication.track as RemoteTrack
                )
              }
            }
          )
        }
      )

      onConnected?.()
    } catch (error) {
      console.error(
        'Government LiveKit monitor error:',
        error
      )

      roomRef.current?.disconnect()
      roomRef.current = null

      setConnecting(false)
      setConnected(false)

      /*
       * Don't toast here. Hovering over 20 monitors can cause
       * transient connections and we don't want a toast storm.
       */
    }
  }, [
    active,
    attachTrack,
    governmentUserId,
    onConnected,
    stream.id,
    stream.livekit_room_name,
    stream.room_name,
  ])

  useEffect(() => {
    if (active) {
      connect()
    } else {
      cleanup()
    }

    return () => {
      if (!active) {
        cleanup()
      }
    }
  }, [active, connect, cleanup])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  const enableAudio = async () => {
    if (!audioRef.current) return

    try {
      audioRef.current.muted = false
      await audioRef.current.play()
      setAudioBlocked(false)
    } catch {
      setAudioBlocked(true)
    }
  }

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          hasVideo && connected
            ? 'opacity-100'
            : 'opacity-0'
        }`}
      />

      <audio
        ref={audioRef}
        autoPlay
        playsInline
      />

      {!active && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
              <Eye className="h-6 w-6 text-cyan-300" />
            </div>

            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Hover to Monitor
            </p>
          </div>
        </div>
      )}

      {active && connecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90">
          <div className="text-center">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-cyan-300" />

            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
              Connecting
            </p>
          </div>
        </div>
      )}

      {active && connected && !hasVideo && !connecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
          <div className="text-center">
            <Video className="mx-auto mb-3 h-8 w-8 text-slate-600" />

            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Video unavailable
            </p>
          </div>
        </div>
      )}

      {active && audioBlocked && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            enableAudio()
          }}
          className="absolute bottom-3 left-3 z-30 inline-flex items-center gap-2 rounded-xl border border-yellow-300/30 bg-black/80 px-3 py-2 text-xs font-black text-yellow-200 backdrop-blur-xl"
        >
          <VolumeX className="h-4 w-4" />
          Enable Audio
        </button>
      )}

      {active && connected && !audioBlocked && (
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-black/70 px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-200 backdrop-blur-xl">
          <Volume2 className="h-3.5 w-3.5" />
          Audio Live
        </div>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*                            GOVERNMENT STREAMS                             */
/* -------------------------------------------------------------------------- */

export default function GovernmentStreams() {
  const navigate = useNavigate()

  const { user } = useAuthStore()

  const governmentUserId =
    user?.id || ''

  const [viewMode, setViewMode] =
    useState<'streams' | 'pods'>('streams')

  const [streams, setStreams] =
    useState<StreamRow[]>([])

  const [pods, setPods] =
    useState<PodRow[]>([])

  const [loading, setLoading] =
    useState(true)

  const [page, setPage] =
    useState(1)

  const [activeMonitorId, setActiveMonitorId] =
    useState<string | null>(null)

  const [showHistory, setShowHistory] =
    useState(false)

  const streamsPerPage = 20

  const totalPages = Math.max(
    1,
    Math.ceil(streams.length / streamsPerPage)
  )

  const paginatedStreams = useMemo(() => {
    const start =
      (page - 1) * streamsPerPage

    return streams.slice(
      start,
      start + streamsPerPage
    )
  }, [page, streams])

  const totalViewers = useMemo(() => {
    return streams.reduce(
      (sum, stream) =>
        sum +
        (stream.current_viewers ||
          stream.viewer_count ||
          0),
      0
    )
  }, [streams])

  const activeOfficerCount = useMemo(() => {
    const ids = new Set<string>()

    streams.forEach((stream) => {
      stream.active_officers?.forEach(
        (officer) => {
          ids.add(officer.officer_id)
        }
      )
    })

    return ids.size
  }, [streams])

  const fetchStreams = useCallback(async () => {
    try {
      setLoading(true)

      let query = supabase
        .from('streams')
        .select(`
          id,
          broadcaster_id,
          user_id,
          status,
          is_live,
          viewer_count,
          current_viewers,
          title,
          agora_channel,
          livekit_room_name,
          hls_url,
          created_at,
          broadcaster:user_profiles!streams_broadcaster_id_fkey(
            username,
            avatar_url,
            broadcast_chat_disabled,
            broadcast_chat_disabled_until,
            broadcast_chat_disable_strike_count,
            broadcast_chat_disabled_stream_id,
            broadcast_mic_muted
          )
        `)
        .order('created_at', {
          ascending: false,
        })
        .limit(1000)

      if (!showHistory) {
        query = query.or(
          'is_live.eq.true,status.eq.live'
        )
      }

      const {
        data,
        error,
      } = await query

      if (error) throw error

      const mappedStreams =
        (data || []).map((stream: any) => ({
          ...stream,

          streamChannel:
            stream.agora_channel,

          livekit_room_name:
            stream.livekit_room_name,

          room_name:
            stream.livekit_room_name ||
            stream.id,

          broadcaster:
            Array.isArray(stream.broadcaster)
              ? stream.broadcaster[0]
              : stream.broadcaster,
        })) || []

      const streamIds =
        mappedStreams.map(
          (stream) => stream.id
        )

      let officerLogs: any[] = []

      if (streamIds.length > 0) {
        const {
          data: logs,
        } = await supabase
          .from('officer_stream_logs')
          .select(`
            stream_id,
            officer_id,
            actions_taken,
            joined_at,
            officer:user_profiles!officer_id(
              username,
              avatar_url
            )
          `)
          .in(
            'stream_id',
            streamIds
          )
          .is('left_at', null)

        officerLogs = logs || []
      }

      const streamsWithOfficers =
        mappedStreams.map(
          (stream) => ({
            ...stream,

            active_officers:
              officerLogs
                .filter(
                  (log) =>
                    log.stream_id ===
                    stream.id
                )
                .map((log) => ({
                  ...log,

                  officer:
                    Array.isArray(
                      log.officer
                    )
                      ? log.officer[0]
                      : log.officer,
                })),
          })
        )

      setStreams(
        streamsWithOfficers
      )

      /*
       * If the current page disappeared because streams ended,
       * move back to the last valid page.
       */
      const newTotalPages =
        Math.max(
          1,
          Math.ceil(
            streamsWithOfficers.length /
              streamsPerPage
          )
        )

      setPage((current) =>
        Math.min(
          current,
          newTotalPages
        )
      )

      /*
       * If the currently monitored stream disappeared,
       * stop monitoring it.
       */
      if (
        activeMonitorId &&
        !streamsWithOfficers.some(
          (stream) =>
            stream.id ===
            activeMonitorId
        )
      ) {
        setActiveMonitorId(null)
      }
    } catch (err) {
      console.error(err)
      toast.error(
        'Failed to load streams'
      )
    } finally {
      setLoading(false)
    }
  }, [
    activeMonitorId,
    showHistory,
  ])

  const fetchPods = useCallback(async () => {
    try {
      let query = supabase
        .from('podcasts')
        .select(`
          id,
          host_user_id,
          title,
          status,
          listener_count,
          started_at,
          host:user_profiles!host_user_id(
            username,
            avatar_url
          )
        `)
        .order('started_at', {
          ascending: false,
        })
        .limit(100)

      if (!showHistory) {
        query = query.in(
          'status',
          ['live', 'active']
        )
      }

      const {
        data,
        error,
      } = await query

      if (error) throw error

      const transformed =
        data?.map((pod: any) => ({
          ...pod,

          host_id:
            pod.host_user_id,

          is_live:
            ['live', 'active'].includes(
              pod.status
            ),

          viewer_count:
            pod.listener_count || 0,

          host:
            Array.isArray(pod.host)
              ? pod.host[0]
              : pod.host,
        })) || []

      setPods(transformed)
    } catch (err) {
      console.error(err)

      toast.error(
        'Failed to load podcasts'
      )
    }
  }, [showHistory])

  useEffect(() => {
    fetchStreams()
    fetchPods()

    const interval =
      setInterval(() => {
        fetchStreams()
        fetchPods()
      }, 12000)

    return () =>
      clearInterval(interval)
  }, [
    fetchStreams,
    fetchPods,
  ])

  /* ------------------------------------------------------------------------ */
  /*                              MODERATION                                  */
  /* ------------------------------------------------------------------------ */

  const handleEndLive = async (
    streamId: string
  ) => {
    if (
      !confirm(
        'Force end this stream?'
      )
    ) {
      return
    }

    try {
      const {
        error,
      } = await supabase
        .from('streams')
        .update({
          is_live: false,
          status: 'ended',
          ended_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          streamId
        )

      if (error) throw error

      setActiveMonitorId(null)

      toast.success(
        'Stream ended'
      )

      fetchStreams()
    } catch (err) {
      console.error(err)

      toast.error(
        'Failed to end stream'
      )
    }
  }

  const handleMuteBroadcaster =
    async (
      stream: StreamRow
    ) => {
      try {
        const broadcasterId =
          stream.broadcaster_id ||
          stream.user_id

        if (!broadcasterId) {
          toast.error(
            'Broadcaster not found'
          )

          return
        }

        const nextMuted =
          !stream.broadcaster
            ?.broadcast_mic_muted

        const {
          data,
          error,
        } = await supabase.rpc(
          'set_broadcaster_moderation_lock',
          {
            p_broadcaster_id:
              broadcasterId,

            p_chat_disabled:
              null,

            p_mic_muted:
              nextMuted,

            p_reason:
              nextMuted
                ? 'Government mute'
                : 'Government unmute',
          }
        )

        if (error) throw error

        if (
          data?.success === false
        ) {
          throw new Error(
            data.error
          )
        }

        setStreams(
          (prev) =>
            prev.map((item) => {
              const sid =
                item.broadcaster_id ||
                item.user_id

              if (
                sid !==
                broadcasterId
              ) {
                return item
              }

              return {
                ...item,

                broadcaster: {
                  ...item.broadcaster,

                  broadcast_mic_muted:
                    nextMuted,
                },
              }
            })
        )

        toast.success(
          nextMuted
            ? 'Host muted'
            : 'Host unmuted'
        )
      } catch (err) {
        console.error(err)

        toast.error(
          'Failed to update host'
        )
      }
    }

  const handleDisableChats =
    async (
      stream: StreamRow
    ) => {
      try {
        const broadcasterId =
          stream.broadcaster_id ||
          stream.user_id

        if (!broadcasterId) {
          toast.error(
            'Broadcaster not found'
          )

          return
        }

        const currentlyDisabled =
          isCurrentStreamChatDisabled(
            stream
          )

        if (currentlyDisabled) {
          const {
            data,
            error,
          } = await supabase.rpc(
            'set_broadcaster_moderation_lock',
            {
              p_broadcaster_id:
                broadcasterId,

              p_chat_disabled:
                false,

              p_chat_disabled_until:
                null,

              p_chat_disable_strike_count:
                0,

              p_chat_disabled_stream_id:
                stream.id,

              p_mic_muted:
                null,

              p_reason:
                'Government chat unlock',
            }
          )

          if (error) throw error

          if (
            data?.success === false
          ) {
            throw new Error(
              data.error
            )
          }

          setStreams(
            (prev) =>
              prev.map(
                (item) => {
                  const sid =
                    item.broadcaster_id ||
                    item.user_id

                  if (
                    sid !==
                    broadcasterId
                  ) {
                    return item
                  }

                  return {
                    ...item,

                    broadcaster: {
                      ...item.broadcaster,

                      broadcast_chat_disabled:
                        false,

                      broadcast_chat_disabled_until:
                        null,

                      broadcast_chat_disable_strike_count:
                        0,

                      broadcast_chat_disabled_stream_id:
                        null,
                    },
                  }
                }
              )
          )

          toast.success(
            'Chat enabled'
          )

          return
        }

        const storedStrikeCount =
          stream.broadcaster
            ?.broadcast_chat_disabled_stream_id ===
          stream.id
            ? stream.broadcaster
                ?.broadcast_chat_disable_strike_count ??
              0
            : 0

        const nextStrikeCount =
          Math.min(
            storedStrikeCount +
              1,
            3
          )

        const durationMs =
          nextStrikeCount ===
          1
            ? 30_000
            : 60_000

        const chatDisabledUntil =
          new Date(
            Date.now() +
              durationMs
          ).toISOString()

        const {
          data,
          error,
        } = await supabase.rpc(
          'set_broadcaster_moderation_lock',
          {
            p_broadcaster_id:
              broadcasterId,

            p_chat_disabled:
              true,

            p_chat_disabled_until:
              chatDisabledUntil,

            p_chat_disable_strike_count:
              nextStrikeCount,

            p_chat_disabled_stream_id:
              stream.id,

            p_mic_muted:
              null,

            p_reason:
              nextStrikeCount ===
              1
                ? 'Government chat lock: 30 seconds'
                : 'Government chat lock: 60 seconds',
          }
        )

        if (error) throw error

        if (
          data?.success === false
        ) {
          throw new Error(
            data.error
          )
        }

        setStreams(
          (prev) =>
            prev.map((item) => {
              const sid =
                item.broadcaster_id ||
                item.user_id

              if (
                sid !==
                broadcasterId
              ) {
                return item
              }

              return {
                ...item,

                broadcaster: {
                  ...item.broadcaster,

                  broadcast_chat_disabled:
                    true,

                  broadcast_chat_disabled_until:
                    chatDisabledUntil,

                  broadcast_chat_disable_strike_count:
                    nextStrikeCount,

                  broadcast_chat_disabled_stream_id:
                    stream.id,
                },
              }
            })
        )

        if (
          nextStrikeCount >= 3
        ) {
          toast.warning(
            'Third chat lock. Ending broadcast.'
          )

          const {
            error: endError,
          } = await supabase
            .from('streams')
            .update({
              is_live: false,
              status: 'ended',
              ended_at:
                new Date().toISOString(),
            })
            .eq(
              'id',
              stream.id
            )

          if (endError)
            throw endError

          setActiveMonitorId(
            null
          )

          toast.success(
            'Broadcast ended'
          )

          fetchStreams()

          return
        }

        toast.warning(
          nextStrikeCount === 1
            ? 'Chat disabled for 30 seconds'
            : 'Second chat lock. Chat disabled for 1 minute'
        )
      } catch (err) {
        console.error(err)

        toast.error(
          'Failed to update chat'
        )
      }
    }

  return (
    <div className="min-h-screen overflow-y-auto bg-[#020617] text-white">
      {/* ------------------------------------------------------------------ */}
      {/* BACKGROUND                                                         */}
      {/* ------------------------------------------------------------------ */}

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.10),transparent_28%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.08),transparent_35%)]" />

        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.025)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative z-10 p-4 md:p-6">
        <div className="mx-auto max-w-[1800px] space-y-5">

          {/* ---------------------------------------------------------------- */}
          {/* HEADER                                                           */}
          {/* ---------------------------------------------------------------- */}

          <div className="rounded-[2rem] border border-cyan-400/20 bg-slate-950/80 p-5 shadow-[0_0_60px_rgba(34,211,238,0.10)] backdrop-blur-xl">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">
                  <Shield className="h-3.5 w-3.5" />
                  Mai Troll Government Network
                </div>

                <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                  Government
                  <span className="ml-2 bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                    Surveillance Wall
                  </span>
                </h1>

                <p className="mt-2 text-xs text-slate-500">
                  Hover any live monitor to connect to its
                  LiveKit broadcast.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <StatCard
                  icon={Radio}
                  label="Live"
                  value={streams.length}
                />

                <StatCard
                  icon={Users}
                  label="Viewers"
                  value={totalViewers}
                />

                <StatCard
                  icon={Shield}
                  label="Officers"
                  value={activeOfficerCount}
                />

                <StatCard
                  icon={ShieldAlert}
                  label="Threat"
                  value="Low"
                  glow="pink"
                />
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* CONTROLS                                                         */}
          {/* ---------------------------------------------------------------- */}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex flex-wrap items-center gap-2">

              <div className="flex rounded-2xl border border-cyan-400/20 bg-slate-950/80 p-1">
                <button
                  onClick={() => {
                    setViewMode('streams')
                    setPage(1)
                  }}
                  className={`rounded-xl px-4 py-2 text-xs font-black ${
                    viewMode === 'streams'
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Streams
                </button>

                <button
                  onClick={() => {
                    setViewMode('pods')
                    setPage(1)
                    setActiveMonitorId(null)
                  }}
                  className={`rounded-xl px-4 py-2 text-xs font-black ${
                    viewMode === 'pods'
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pods
                </button>
              </div>

              <button
                onClick={() => {
                  setShowHistory(
                    !showHistory
                  )

                  setPage(1)
                  setActiveMonitorId(
                    null
                  )
                }}
                className={`rounded-2xl border px-4 py-2 text-xs font-black ${
                  showHistory
                    ? 'border-fuchsia-400/30 bg-fuchsia-500/20 text-fuchsia-200'
                    : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200'
                }`}
              >
                {showHistory
                  ? 'History'
                  : 'Live Network'}
              </button>

              {viewMode ===
                'streams' && (
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-xs font-black text-slate-400">
                  Page {page} / {totalPages}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                fetchStreams()
                fetchPods()
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400 px-4 py-2 text-xs font-black text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.20)] hover:bg-cyan-300"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* CONTENT                                                          */}
          {/* ---------------------------------------------------------------- */}

          {loading ? (
            <div className="flex min-h-[700px] items-center justify-center rounded-[2rem] border border-cyan-400/10 bg-slate-950/60">
              <div className="text-center">
                <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-cyan-300" />

                <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-200">
                  Scanning City Frequencies
                </p>
              </div>
            </div>
          ) : viewMode ===
            'streams' ? (
            streams.length === 0 ? (
              <EmptyState
                icon={Video}
                title="No Active Streams"
                description="No live broadcasts are currently active in Mai Troll."
              />
            ) : (
              <>
                {/* ---------------------------------------------------------- */}
                {/* MONITOR WALL                                               */}
                {/* ---------------------------------------------------------- */}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {paginatedStreams.map(
                    (stream) => (
                      <SurveillanceTile
                        key={stream.id}
                        stream={stream}
                        active={
                          activeMonitorId ===
                          stream.id
                        }
                        governmentUserId={
                          governmentUserId
                        }
                        onEnter={() =>
                          setActiveMonitorId(
                            stream.id
                          )
                        }
                        onLeave={() =>
                          setActiveMonitorId(
                            (current) =>
                              current ===
                              stream.id
                                ? null
                                : current
                          )
                        }
                        onEndLive={() =>
                          handleEndLive(
                            stream.id
                          )
                        }
                        onMuteBroadcaster={() =>
                          handleMuteBroadcaster(
                            stream
                          )
                        }
                        onDisableChats={() =>
                          handleDisableChats(
                            stream
                          )
                        }
                      />
                    )
                  )}
                </div>

                {/* ---------------------------------------------------------- */}
                {/* PAGINATION                                                 */}
                {/* ---------------------------------------------------------- */}

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <button
                      disabled={page <= 1}
                      onClick={() => {
                        setActiveMonitorId(
                          null
                        )

                        setPage(
                          (current) =>
                            Math.max(
                              1,
                              current - 1
                            )
                        )
                      }}
                      className="rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-xs font-black text-slate-300 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Previous
                    </button>

                    {Array.from(
                      {
                        length: totalPages,
                      },
                      (_, index) =>
                        index + 1
                    ).map(
                      (pageNumber) => (
                        <button
                          key={
                            pageNumber
                          }
                          onClick={() => {
                            setActiveMonitorId(
                              null
                            )

                            setPage(
                              pageNumber
                            )
                          }}
                          className={`h-9 min-w-9 rounded-xl px-3 text-xs font-black ${
                            page ===
                            pageNumber
                              ? 'bg-cyan-400 text-slate-950'
                              : 'border border-white/10 bg-slate-950 text-slate-400 hover:text-white'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      )
                    )}

                    <button
                      disabled={
                        page >=
                        totalPages
                      }
                      onClick={() => {
                        setActiveMonitorId(
                          null
                        )

                        setPage(
                          (current) =>
                            Math.min(
                              totalPages,
                              current + 1
                            )
                        )
                      }}
                      className="rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-xs font-black text-slate-300 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )
          ) : pods.length ===
            0 ? (
            <EmptyState
              icon={Waves}
              title="No Active Podcasts"
              description="There are currently no live podcasts active."
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {pods.map((pod) => (
                <PodCard
                  key={pod.id}
                  pod={pod}
                  onWatch={() =>
                    navigate(
                      `/podcast/${pod.id}`
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                           SURVEILLANCE TILE                                */
/* -------------------------------------------------------------------------- */

function SurveillanceTile({
  stream,
  active,
  governmentUserId,
  onEnter,
  onLeave,
  onEndLive,
  onMuteBroadcaster,
  onDisableChats,
}: {
  stream: StreamRow
  active: boolean
  governmentUserId: string
  onEnter: () => void
  onLeave: () => void
  onEndLive: () => void
  onMuteBroadcaster: () => void
  onDisableChats: () => void
}) {
  const viewerCount =
    stream.current_viewers ||
    stream.viewer_count ||
    0

  const chatLocked =
    isCurrentStreamChatDisabled(
      stream
    )

  const avatar =
    stream.broadcaster
      ?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      stream.broadcaster
        ?.username ||
        'User'
    )}`

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={`group relative overflow-hidden rounded-2xl border bg-black transition-all duration-200 ${
        active
          ? 'border-cyan-300 shadow-[0_0_35px_rgba(34,211,238,0.28)]'
          : 'border-white/10 hover:border-cyan-400/30'
      }`}
    >
      {/* VIDEO */}

      <div className="relative aspect-video overflow-hidden bg-slate-950">
        <LiveKitMonitor
          stream={stream}
          active={active}
          governmentUserId={
            governmentUserId
          }
        />

        {/* Top monitor HUD */}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-black/90 via-black/30 to-transparent p-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-500/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-red-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              Live
            </span>

            {active && (
              <span className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-cyan-200">
                MONITORING
              </span>
            )}
          </div>

          <span className="rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-[9px] font-black text-slate-300">
            {viewerCount}
            {' '}
            VIEWERS
          </span>
        </div>

        {/* Hover instruction */}

        {!active && (
          <div className="pointer-events-none absolute bottom-3 right-3 z-20 rounded-lg border border-white/10 bg-black/70 px-2 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 opacity-0 backdrop-blur-xl transition group-hover:opacity-100">
            Hover to monitor
          </div>
        )}
      </div>

      {/* INFORMATION */}

      <div className="border-t border-white/5 bg-slate-950/95 p-3">
        <div className="flex items-center gap-3">
          <img
            src={avatar}
            className="h-9 w-9 rounded-xl border border-cyan-300/20 object-cover"
            alt=""
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-white">
              {stream.title ||
                'Untitled Stream'}
            </p>

            <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-cyan-300">
              @{stream.broadcaster?.username}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            {stream.broadcaster
              ?.broadcast_mic_muted && (
              <span className="rounded-md border border-yellow-400/20 bg-yellow-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase text-yellow-200">
                Muted
              </span>
            )}

            {chatLocked && (
              <span className="rounded-md border border-pink-400/20 bg-pink-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase text-pink-200">
                Chat Locked
              </span>
            )}
          </div>
        </div>

        {/* Government controls appear while monitoring */}

        <div
          className={`grid grid-cols-3 gap-1.5 overflow-hidden transition-all duration-200 ${
            active
              ? 'mt-3 max-h-20 opacity-100'
              : 'mt-0 max-h-0 opacity-0'
          }`}
        >
          <MiniAction
            icon={Gavel}
            label="Summon"
            color="orange"
            onClick={(e) => {
              e.stopPropagation()

              /*
               * Your existing SummonModal can be reconnected
               * here if you want summons directly from the wall.
               */
              toast.info(
                'Summon control ready'
              )
            }}
          />

          <MiniAction
            icon={stream.broadcaster
              ?.broadcast_mic_muted
              ? Volume2
              : MicOff}
            label={
              stream.broadcaster
                ?.broadcast_mic_muted
                ? 'Unmute'
                : 'Mute'
            }
            color={
              stream.broadcaster
                ?.broadcast_mic_muted
                ? 'green'
                : 'yellow'
            }
            onClick={(e) => {
              e.stopPropagation()
              onMuteBroadcaster()
            }}
          />

          <MiniAction
            icon={MessageSquareOff}
            label={
              chatLocked
                ? 'Chat On'
                : 'Chat Off'
            }
            color={
              chatLocked
                ? 'green'
                : 'pink'
            }
            onClick={(e) => {
              e.stopPropagation()
              onDisableChats()
            }}
          />

          <MiniAction
            icon={StopCircle}
            label="End"
            color="red"
            onClick={(e) => {
              e.stopPropagation()
              onEndLive()
            }}
          />

          <div className="col-span-2 flex items-center justify-center rounded-lg border border-emerald-400/10 bg-emerald-500/5 px-2 text-[8px] font-black uppercase tracking-[0.1em] text-emerald-300">
            <Activity className="mr-1 h-3 w-3" />
            Government Monitor
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                              MINI ACTION                                   */
/* -------------------------------------------------------------------------- */

function MiniAction({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: React.ElementType
  label: string
  color:
    | 'orange'
    | 'red'
    | 'yellow'
    | 'pink'
    | 'green'
  onClick: (
    e: React.MouseEvent<HTMLButtonElement>
  ) => void
}) {
  const styles = {
    orange:
      'border-orange-400/20 bg-orange-500/10 text-orange-200 hover:bg-orange-500/20',
    red:
      'border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20',
    yellow:
      'border-yellow-400/20 bg-yellow-500/10 text-yellow-200 hover:bg-yellow-500/20',
    pink:
      'border-pink-400/20 bg-pink-500/10 text-pink-200 hover:bg-pink-500/20',
    green:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20',
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[8px] font-black uppercase tracking-[0.08em] transition ${styles[color]}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*                               STAT CARD                                    */
/* -------------------------------------------------------------------------- */

function StatCard({
  icon: Icon,
  label,
  value,
  glow = 'cyan',
}: {
  icon: React.ElementType
  label: string
  value: string | number
  glow?: 'cyan' | 'pink'
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        glow === 'pink'
          ? 'border-pink-400/20 bg-pink-500/5'
          : 'border-cyan-400/20 bg-cyan-400/5'
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <Icon
          className={`h-4 w-4 ${
            glow === 'pink'
              ? 'text-pink-300'
              : 'text-cyan-300'
          }`}
        />

        <span
          className={`h-1.5 w-1.5 rounded-full ${
            glow === 'pink'
              ? 'bg-pink-300'
              : 'bg-cyan-300'
          }`}
        />
      </div>

      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">
        {label}
      </p>

      <p className="mt-0.5 text-xl font-black text-white">
        {value}
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                              EMPTY STATE                                   */
/* -------------------------------------------------------------------------- */

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-[600px] flex-col items-center justify-center rounded-[2rem] border border-cyan-400/10 bg-slate-950/60 px-6 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
        <Icon className="h-10 w-10" />
      </div>

      <h3 className="text-2xl font-black text-white">
        {title}
      </h3>

      <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                POD CARD                                    */
/* -------------------------------------------------------------------------- */

function PodCard({
  pod,
  onWatch,
}: {
  pod: PodRow
  onWatch: () => void
}) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-slate-950/75">
      <div className="border-b border-white/5 p-5">
        <div className="flex items-center gap-4">
          <img
            src={
              pod.host?.avatar_url ||
              'https://ui-avatars.com/api/?name=Pod'
            }
            className="h-14 w-14 rounded-2xl border border-cyan-300/20 object-cover"
            alt=""
          />

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-black text-white">
              {pod.title ||
                'Untitled Pod'}
            </h3>

            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
              @{pod.host?.username}
            </p>
          </div>

          <div className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-black text-red-300">
            LIVE
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-5 flex items-center justify-between text-sm text-slate-400">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {pod.viewer_count || 0}
          </span>

          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Active
          </span>
        </div>

        <button
          onClick={onWatch}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
        >
          <Eye className="h-4 w-4" />
          Join Pod
        </button>
      </div>
    </div>
  )
}