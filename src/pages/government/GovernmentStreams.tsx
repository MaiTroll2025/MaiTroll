import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Eye,
  Gavel,
  Lock,
  MessageSquareOff,
  MicOff,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  Sparkles,
  StopCircle,
  Users,
  Video,
  Waves,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { normalizeTextArray } from '@/lib/courtUtils'
import { isBroadcastChatLockActive } from '@/lib/broadcastModeration'

import StreamWatchModal from '@/components/broadcast/StreamWatchModal'
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

interface StreamParticipant {
  user_id: string
  guest_id?: string | null
  username: string
  avatar_url?: string
  is_active: boolean
  summonable?: boolean
}

function isCurrentStreamChatDisabled(stream: StreamRow) {
  return isBroadcastChatLockActive({
    disabled: stream.broadcaster?.broadcast_chat_disabled,
    until: stream.broadcaster?.broadcast_chat_disabled_until,
    streamId: stream.id,
    lockedStreamId: stream.broadcaster?.broadcast_chat_disabled_stream_id,
  })
}

function getChatLockRemainingSeconds(stream: StreamRow) {
  const until = stream.broadcaster?.broadcast_chat_disabled_until
  if (!until) return null

  const remainingMs = Date.parse(until) - Date.now()
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null

  return Math.max(1, Math.ceil(remainingMs / 1000))
}

export default function GovernmentStreams() {
  const navigate = useNavigate()

  const [viewMode, setViewMode] = useState<'streams' | 'pods'>('streams')
  const [streams, setStreams] = useState<StreamRow[]>([])
  const [pods, setPods] = useState<PodRow[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedStream, setSelectedStream] = useState<StreamRow | null>(null)

  const [summonModalOpen, setSummonModalOpen] = useState(false)
  const [summonTargetStream, setSummonTargetStream] = useState<StreamRow | null>(null)

  const [showHistory, setShowHistory] = useState(false)

  const totalViewers = useMemo(() => {
    return streams.reduce((sum, s) => sum + (s.current_viewers || s.viewer_count || 0), 0)
  }, [streams])

  const activeOfficerCount = useMemo(() => {
    const ids = new Set<string>()

    streams.forEach((stream) => {
      stream.active_officers?.forEach((officer) => {
        ids.add(officer.officer_id)
      })
    })

    return ids.size
  }, [streams])

  const fetchStreams = React.useCallback(async () => {
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
        .order('created_at', { ascending: false })
        .limit(100)

      if (!showHistory) {
        query = query.or('is_live.eq.true,status.eq.live')
      }

      const { data, error } = await query

      if (error) throw error

      const mappedStreams =
        (data || []).map((stream: any) => ({
          ...stream,
          streamChannel: stream.agora_channel,
          livekit_room_name: stream.livekit_room_name,
          // Canonical LiveKit room name used by the broadcaster is
          // `livekit_room_name` (falls back to the stream id). The watch modal
          // reads `room_name`, so populate it here or audience playback connects
          // to the wrong/empty room and never plays.
          room_name: stream.livekit_room_name || stream.id,
          broadcaster: Array.isArray(stream.broadcaster)
            ? stream.broadcaster[0]
            : stream.broadcaster,
        })) || []

      const streamIds = mappedStreams.map((s) => s.id)

      const { data: officerLogs } = await supabase
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
        .in('stream_id', streamIds)
        .is('left_at', null)

      const streamsWithOfficers = mappedStreams.map((stream) => ({
        ...stream,
        active_officers:
          officerLogs
            ?.filter((log: any) => log.stream_id === stream.id)
            .map((log: any) => ({
              ...log,
              officer: Array.isArray(log.officer)
                ? log.officer[0]
                : log.officer,
            })) || [],
      }))

      setStreams(streamsWithOfficers)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load streams')
    } finally {
      setLoading(false)
    }
  }, [showHistory])

  const fetchPods = React.useCallback(async () => {
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
        .order('started_at', { ascending: false })
        .limit(100)

      if (!showHistory) {
        query = query.in('status', ['live', 'active'])
      }

      const { data, error } = await query

      if (error) throw error

      const transformed =
        data?.map((pod: any) => ({
          ...pod,
          host_id: pod.host_user_id,
          is_live: ['live', 'active'].includes(pod.status),
          viewer_count: pod.listener_count || 0,
          host: Array.isArray(pod.host)
            ? pod.host[0]
            : pod.host,
        })) || []

      setPods(transformed)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load podcasts')
    }
  }, [showHistory])

  useEffect(() => {
    fetchStreams()
    fetchPods()

    const interval = setInterval(() => {
      fetchStreams()
      fetchPods()
    }, 12000)

    return () => clearInterval(interval)
  }, [fetchStreams, fetchPods])

  const handleEndLive = async (streamId: string) => {
    if (!confirm('Force end this stream?')) return

    try {
      const { error } = await supabase
        .from('streams')
        .update({
          is_live: false,
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', streamId)

      if (error) throw error

      toast.success('Stream ended')
      fetchStreams()
    } catch (err) {
      console.error(err)
      toast.error('Failed to end stream')
    }
  }

  const handleMuteBroadcaster = async (stream: StreamRow) => {
    try {
      const broadcasterId = stream.broadcaster_id || stream.user_id

      if (!broadcasterId) {
        toast.error('Broadcaster not found')
        return
      }

      const nextMuted = !stream.broadcaster?.broadcast_mic_muted

      const { data, error } = await supabase.rpc(
        'set_broadcaster_moderation_lock',
        {
          p_broadcaster_id: broadcasterId,
          p_chat_disabled: null,
          p_mic_muted: nextMuted,
          p_reason: nextMuted
            ? 'Government mute'
            : 'Government unmute',
        }
      )

      if (error) throw error
      if (data?.success === false) {
        throw new Error(data.error)
      }

      setStreams((prev) =>
        prev.map((s) => {
          const sid = s.broadcaster_id || s.user_id

          if (sid !== broadcasterId) return s

          return {
            ...s,
            broadcaster: {
              ...s.broadcaster,
              broadcast_mic_muted: nextMuted,
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
      toast.error('Failed to update host')
    }
  }

  const handleDisableChats = async (stream: StreamRow) => {
    try {
      const broadcasterId = stream.broadcaster_id || stream.user_id

      if (!broadcasterId) {
        toast.error('Broadcaster not found')
        return
      }

      const currentlyDisabled = isCurrentStreamChatDisabled(stream)

      if (currentlyDisabled) {
        const { data, error } = await supabase.rpc(
          'set_broadcaster_moderation_lock',
          {
            p_broadcaster_id: broadcasterId,
            p_chat_disabled: false,
            p_chat_disabled_until: null,
            p_chat_disable_strike_count: 0,
            p_chat_disabled_stream_id: stream.id,
            p_mic_muted: null,
            p_reason: 'Government chat unlock',
          }
        )

        if (error) throw error
        if (data?.success === false) {
          throw new Error(data.error)
        }

        setStreams((prev) =>
          prev.map((s) => {
            const sid = s.broadcaster_id || s.user_id

            if (sid !== broadcasterId) return s

            return {
              ...s,
              broadcaster: {
                ...s.broadcaster,
                broadcast_chat_disabled: false,
                broadcast_chat_disabled_until: null,
                broadcast_chat_disable_strike_count: 0,
                broadcast_chat_disabled_stream_id: null,
              },
            }
          })
        )

        toast.success('Chat enabled')
        return
      }

      const storedStrikeCount =
        stream.broadcaster?.broadcast_chat_disabled_stream_id === stream.id
          ? stream.broadcaster?.broadcast_chat_disable_strike_count ?? 0
          : 0
      const nextStrikeCount = Math.min(storedStrikeCount + 1, 3)
      const durationMs = nextStrikeCount === 1 ? 30_000 : 60_000
      const chatDisabledUntil = new Date(Date.now() + durationMs).toISOString()

      const { data, error } = await supabase.rpc(
        'set_broadcaster_moderation_lock',
        {
          p_broadcaster_id: broadcasterId,
          p_chat_disabled: true,
          p_chat_disabled_until: chatDisabledUntil,
          p_chat_disable_strike_count: nextStrikeCount,
          p_chat_disabled_stream_id: stream.id,
          p_mic_muted: null,
          p_reason:
            nextStrikeCount === 1
              ? 'Government chat lock: 30 seconds'
              : 'Government chat lock: 60 seconds',
        }
      )

      if (error) throw error
      if (data?.success === false) {
        throw new Error(data.error)
      }

      setStreams((prev) =>
        prev.map((s) => {
          const sid = s.broadcaster_id || s.user_id

          if (sid !== broadcasterId) return s

          return {
            ...s,
            broadcaster: {
              ...s.broadcaster,
              broadcast_chat_disabled: true,
              broadcast_chat_disabled_until: chatDisabledUntil,
              broadcast_chat_disable_strike_count: nextStrikeCount,
              broadcast_chat_disabled_stream_id: stream.id,
            },
          }
        })
      )

      if (nextStrikeCount >= 3) {
        toast.warning('Third chat lock. Ending broadcast.')

        const { error: endError } = await supabase
          .from('streams')
          .update({
            is_live: false,
            status: 'ended',
            ended_at: new Date().toISOString(),
          })
          .eq('id', stream.id)

        if (endError) throw endError

        toast.success('Broadcast ended')
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
      toast.error('Failed to update chat')
    }
  }

  const handleSummonClick = (stream: StreamRow) => {
    setSummonTargetStream(stream)
    setSummonModalOpen(true)
  }

  return (
    <div className="min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
      {/* BACKGROUND */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.10),transparent_28%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.08),transparent_35%)]" />

        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative z-10 p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          {/* HEADER */}
          <div className="rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-6 shadow-[0_0_60px_rgba(34,211,238,0.12)] backdrop-blur-xl">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                  <Shield className="h-4 w-4" />
                  Mai Troll Government Network
                </div>

                <h1 className="text-4xl font-black tracking-tight md:text-6xl">
                  Government
                  <span className="block bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                    Command Center
                  </span>
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
                  Monitor broadcasts, dispatch officers, moderate hosts, and enforce Mai Troll laws in real-time.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard
                  icon={Radio}
                  label="Live Streams"
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
                  label="Threat Level"
                  value="Low"
                  glow="pink"
                />
              </div>
            </div>
          </div>

          {/* CONTROL BAR */}
          <div className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/70 p-4 backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-2xl border border-cyan-400/20 bg-black/30 p-1">
                  <button
                    onClick={() => setViewMode('streams')}
                    className={`rounded-xl px-5 py-2 text-sm font-black transition ${
                      viewMode === 'streams'
                        ? 'bg-cyan-400 text-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.35)]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Streams
                  </button>

                  <button
                    onClick={() => setViewMode('pods')}
                    className={`rounded-xl px-5 py-2 text-sm font-black transition ${
                      viewMode === 'pods'
                        ? 'bg-cyan-400 text-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.35)]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Pods
                  </button>
                </div>

                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`rounded-2xl border px-5 py-2 text-sm font-black transition ${
                    showHistory
                      ? 'border-fuchsia-400/30 bg-fuchsia-500/20 text-fuchsia-200'
                      : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200'
                  }`}
                >
                  {showHistory ? 'History Mode' : 'Live Mode'}
                </button>
              </div>

              <button
                onClick={() => {
                  fetchStreams()
                  fetchPods()
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400 px-5 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.25)] transition hover:bg-cyan-300"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Network
              </button>
            </div>
          </div>

          {/* CONTENT */}
          {loading ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[2rem] border border-cyan-400/10 bg-slate-950/60">
              <div className="mb-5 h-14 w-14 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />

              <p className="text-lg font-black text-cyan-200">
                Scanning City Frequencies
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Monitoring broadcasts and pods...
              </p>
            </div>
          ) : viewMode === 'streams' ? (
            streams.length === 0 ? (
              <EmptyState
                icon={Video}
                title="No Active Streams"
                description="No live broadcasts are currently active in Mai Troll."
              />
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {streams.map((stream) => (
                  <StreamCard
                    key={stream.id}
                    stream={stream}
                    onWatch={() => {
                      localStorage.setItem(
                        'fromGovernmentStreams',
                        'true'
                      )

                      setSelectedStream(stream)
                    }}
                    onSummon={() =>
                      handleSummonClick(stream)
                    }
                    onEndLive={() =>
                      handleEndLive(stream.id)
                    }
                    onMuteBroadcaster={() =>
                      handleMuteBroadcaster(stream)
                    }
                    onDisableChats={() =>
                      handleDisableChats(stream)
                    }
                  />
                ))}
              </div>
            )
          ) : pods.length === 0 ? (
            <EmptyState
              icon={Waves}
              title="No Active Podcasts"
              description="There are currently no live podcasts active."
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {pods.map((pod) => (
                <PodCard
                  key={pod.id}
                  pod={pod}
                  onWatch={() =>
                    navigate(`/podcast/${pod.id}`)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedStream && (
        <StreamWatchModal
          stream={selectedStream}
          onClose={() => setSelectedStream(null)}
        />
      )}

      {summonModalOpen && summonTargetStream && (
        <SummonModal
          stream={summonTargetStream}
          onClose={() => {
            setSummonModalOpen(false)
            setSummonTargetStream(null)
          }}
        />
      )}
    </div>
  )
}

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
      className={`rounded-3xl border p-4 backdrop-blur-xl ${
        glow === 'pink'
          ? 'border-pink-400/20 bg-pink-500/5'
          : 'border-cyan-400/20 bg-cyan-400/5'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <Icon
          className={`h-5 w-5 ${
            glow === 'pink'
              ? 'text-pink-300'
              : 'text-cyan-300'
          }`}
        />

        <span
          className={`h-2 w-2 rounded-full ${
            glow === 'pink'
              ? 'bg-pink-300'
              : 'bg-cyan-300'
          }`}
        />
      </div>

      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-2xl font-black text-white">
        {value}
      </p>
    </div>
  )
}

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
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[2rem] border border-cyan-400/10 bg-slate-950/60 px-6 text-center">
      <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 shadow-[0_0_40px_rgba(34,211,238,0.14)]">
        <Icon className="h-12 w-12" />
      </div>

      <h3 className="text-2xl font-black text-white">
        {title}
      </h3>

      <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
        {description}
      </p>
    </div>
  )
}

function PodCard({
  pod,
  onWatch,
}: {
  pod: PodRow
  onWatch: () => void
}) {
  return (
    <div className="group overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 transition hover:-translate-y-1 hover:border-cyan-300/40 hover:shadow-[0_0_50px_rgba(34,211,238,0.14)]">
      <div className="border-b border-white/5 bg-white/[0.03] p-5">
        <div className="flex items-center gap-4">
          <img
            src={
              pod.host?.avatar_url ||
              'https://ui-avatars.com/api/?name=Pod'
            }
            className="h-14 w-14 rounded-2xl border border-cyan-300/20 object-cover"
          />

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-black text-white">
              {pod.title || 'Untitled Pod'}
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
            {pod.viewer_count || 0} Viewers
          </span>

          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Active
          </span>
        </div>

        <button
          onClick={onWatch}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.2)] transition hover:bg-cyan-300"
        >
          <Eye className="h-4 w-4" />
          Join Pod
        </button>
      </div>
    </div>
  )
}

function StreamCard({
  stream,
  onWatch,
  onEndLive,
  onMuteBroadcaster,
  onDisableChats,
  onSummon,
}: {
  stream: StreamRow
  onWatch: () => void
  onEndLive: () => void
  onMuteBroadcaster: () => void
  onDisableChats: () => void
  onSummon: () => void
}) {
  return (
    <div
      onClick={onWatch}
      className="group cursor-pointer overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 transition-all hover:-translate-y-1 hover:border-cyan-300/40 hover:shadow-[0_0_60px_rgba(34,211,238,0.15)]"
    >
      {/* TOP */}
      <div className="relative border-b border-white/5 bg-gradient-to-br from-cyan-400/10 via-transparent to-fuchsia-500/10 p-5">
        <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-red-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
          Live
        </div>

        <div className="flex items-start gap-4">
          <img
            src={
              stream.broadcaster?.avatar_url ||
              `https://ui-avatars.com/api/?name=${stream.broadcaster?.username}`
            }
            className="h-16 w-16 rounded-2xl border border-cyan-300/20 object-cover"
          />

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xl font-black text-white">
              {stream.title || 'Untitled Stream'}
            </h3>

            <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
              @{stream.broadcaster?.username}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusBadge
                label={`${stream.current_viewers || stream.viewer_count || 0} Viewers`}
                color="cyan"
              />

              {stream.broadcaster?.broadcast_mic_muted && (
                <StatusBadge
                  label="Muted"
                  color="yellow"
                />
              )}

              {isCurrentStreamChatDisabled(stream) && (
                <StatusBadge
                  label={
                    getChatLockRemainingSeconds(stream)
                      ? `Chat Locked ${getChatLockRemainingSeconds(stream)}s`
                      : 'Chat Locked'
                  }
                  color="pink"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* OFFICERS */}
      <div className="border-b border-white/5 bg-black/20 p-4">
        {stream.active_officers &&
        stream.active_officers.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {stream.active_officers.map((log) => (
              <div
                key={log.officer_id}
                className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1"
              >
                <img
                  src={log.officer?.avatar_url}
                  className="h-5 w-5 rounded-full"
                />

                <UserNameWithAge
                  user={{
                    username:
                      log.officer?.username ||
                      'Unknown',
                    id: log.officer_id,
                  }}
                  className="text-xs font-black text-emerald-200"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <AlertTriangle className="h-4 w-4" />
            No officers monitoring
          </div>
        )}
      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-2 gap-3 p-5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onWatch()
          }}
          className="col-span-2 flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.25)] transition hover:bg-cyan-300"
        >
          <Eye className="h-4 w-4" />
          Watch Live
        </button>

        <ActionButton
          color="orange"
          icon={Gavel}
          label="Summon"
          onClick={(e) => {
            e.stopPropagation()
            onSummon()
          }}
        />

        <ActionButton
          color="red"
          icon={StopCircle}
          label="Force End"
          onClick={(e) => {
            e.stopPropagation()
            onEndLive()
          }}
        />

        <ActionButton
          color={
            stream.broadcaster?.broadcast_mic_muted
              ? 'green'
              : 'yellow'
          }
          icon={MicOff}
          label={
            stream.broadcaster?.broadcast_mic_muted
              ? 'Unmute'
              : 'Mute Host'
          }
          onClick={(e) => {
            e.stopPropagation()
            onMuteBroadcaster()
          }}
        />

        <ActionButton
          color={
            isCurrentStreamChatDisabled(stream)
              ? 'green'
              : 'pink'
          }
          icon={MessageSquareOff}
          label={
            isCurrentStreamChatDisabled(stream)
              ? 'Enable Chat'
              : 'Disable Chat'
          }
          onClick={(e) => {
            e.stopPropagation()
            onDisableChats()
          }}
        />
      </div>
    </div>
  )
}

function StatusBadge({
  label,
  color,
}: {
  label: string
  color: 'cyan' | 'yellow' | 'pink'
}) {
  const styles = {
    cyan: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200',
    yellow:
      'border-yellow-400/20 bg-yellow-500/10 text-yellow-200',
    pink: 'border-pink-400/20 bg-pink-500/10 text-pink-200',
  }

  return (
    <div
      className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${styles[color]}`}
    >
      {label}
    </div>
  )
}

function ActionButton({
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
    red: 'border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20',
    yellow:
      'border-yellow-400/20 bg-yellow-500/10 text-yellow-200 hover:bg-yellow-500/20',
    pink: 'border-pink-400/20 bg-pink-500/10 text-pink-200 hover:bg-pink-500/20',
    green:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20',
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black transition ${styles[color]}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

/* KEEP YOUR EXISTING SUMMON MODAL LOGIC BELOW */
/* only redesign styles if desired */
function SummonModal({
  stream,
  onClose,
}: {
  stream: StreamRow
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl">
      <div className="w-full max-w-lg rounded-[2rem] border border-cyan-400/20 bg-slate-950/95 p-6 shadow-[0_0_70px_rgba(34,211,238,0.14)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-orange-200">
              <Gavel className="h-3 w-3" />
              Court Summons
            </div>

            <h3 className="text-2xl font-black text-white">
              Issue Summons
            </h3>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-2xl border border-cyan-400/10 bg-black/30 p-5 text-sm text-slate-400">
          Keep your existing summon modal logic here.
        </div>
      </div>
    </div>
  )
}