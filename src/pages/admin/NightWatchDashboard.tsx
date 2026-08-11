import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  Circle,
  Clock,
  Download,
  Flag,
  Headphones,
  MessageCircle,
  Mic,
  MicOff,
  Radio,
  RefreshCcw,
  Shield,
  Siren,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useLiveKitRoom } from '@/hooks/useLiveKitRoom'
import { useBroadcastRecorder } from '@/hooks/useBroadcastRecorder'
import { getLiveKitRoomName } from '@/lib/liveUtils'

const TABS = [
  { id: 'all-streams', label: 'All Streams', icon: Radio },
  { id: 'patrol-room', label: 'Patrol Room', icon: Headphones },
  { id: 'live-chat', label: 'Live Chat', icon: MessageCircle },
  { id: 'users', label: 'Users in Stream', icon: Users },
  { id: 'reports', label: 'Reports', icon: Flag },
  { id: 'recordings', label: 'Recordings', icon: Circle },
  { id: 'my-shift', label: 'My Shift', icon: Clock },
] as const

type TabId = (typeof TABS)[number]['id']

type ActiveStream = {
  id: string
  title: string | null
  status: string | null
  viewer_count: number | null
  current_viewers: number | null
  started_at: string | null
  livekit_room_name: string | null
  broadcaster_id: string | null
  user_id?: string | null
}

type ChatMessage = {
  id: string
  created_at: string | null
  user_id: string | null
  message: string | null
}

type PatrolReport = {
  id: string
  created_at: string | null
  reporter_id: string | null
  description: string | null
  status: string | null
  subject_id: string | null
}

type PatrolRecording = {
  id: string
  created_at: string | null
  started_at: string | null
  ended_at: string | null
  stream_id: string | null
  user_id: string | null
  status?: string | null
  notes?: string | null
  cloudflare_recording_id?: string | null
  cloudflare_playback_url?: string | null
  storage_path?: string | null
}

type NightWatchShift = {
  id: string
  started_at: string | null
  ended_at: string | null
  status: string | null
  stream_id: string | null
  user_id: string | null
}

type ProfileLite = {
  id: string
  username: string | null
  name: string | null
  avatar_url?: string | null
}

function safeDateTime(value?: string | null) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString()
}

function safeTime(value?: string | null) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleTimeString()
}

function getViewerCount(stream: ActiveStream | null) {
  if (!stream) return 0
  return stream.viewer_count ?? stream.current_viewers ?? 0
}

function getDisplayName(profile: ProfileLite | null, fallback?: string | null) {
  return profile?.name || profile?.username || fallback || 'Unknown'
}

function getParticipantIdentity(participant: any) {
  return participant?.identity || participant?.name || participant?.sid || 'Unknown participant'
}

function getParticipantTrackCount(participant: any) {
  const sources = [
    participant?.trackPublications,
    participant?.tracks,
    participant?.trackPublicationMap,
    participant?.audioTracks,
    participant?.videoTracks,
  ]

  return sources.reduce((total, item) => {
    if (!item) return total
    if (typeof item.size === 'number') return total + item.size
    if (Array.isArray(item)) return total + item.length
    if (typeof item === 'object') return total + Object.keys(item).length
    return total
  }, 0)
}

function getParticipantSpeaking(participant: any) {
  return Boolean(participant?.isSpeaking || participant?.speaking || participant?.audioLevel > 0.02)
}

export default function NightWatchDashboard() {
  const navigate = useNavigate()
  const profile = useAuthStore(state => state.profile)
  const user = useAuthStore(state => state.user)

  const officerId = profile?.id || user?.id || ''
  const officerName = profile?.username || profile?.name || user?.email || 'Night Watch Officer'

  const [streams, setStreams] = useState<ActiveStream[]>([])
  const [selectedStream, setSelectedStream] = useState<ActiveStream | null>(null)
  const [broadcaster, setBroadcaster] = useState<ProfileLite | null>(null)

  const [activeTab, setActiveTab] = useState<TabId>('all-streams')
  const [loadingStreams, setLoadingStreams] = useState(false)
  const [loadingPanelData, setLoadingPanelData] = useState(false)

  const [noticeVisible, setNoticeVisible] = useState(() => {
    try {
      return window.localStorage.getItem('nightwatch-notice-dismissed') !== 'true'
    } catch {
      return true
    }
  })

  const [shiftActive, setShiftActive] = useState(false)
  const [shiftId, setShiftId] = useState<string | null>(null)
  const [shiftStartedAt, setShiftStartedAt] = useState<string | null>(null)

  const [walkieActive, setWalkieActive] = useState(false)
  const [recordingActive, setRecordingActive] = useState(false)
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [reports, setReports] = useState<PatrolReport[]>([])
  const [recordings, setRecordings] = useState<PatrolRecording[]>([])
  const [liveKitError, setLiveKitError] = useState<string | null>(null)

  // Full-screen auto-recording for Night Watch shifts
  const recorder = useBroadcastRecorder({
    sourceStream: async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: true,
          ...('selfBrowserSurface' in (navigator.mediaDevices.getSupportedConstraints ? {} : {}) ? { selfBrowserSurface: 'include' } : {}),
        } as any)
        return stream
      } catch (err: any) {
        console.warn('[NightWatch] Screen capture denied or failed:', err?.message)
        return null
      }
    },
    replaySource: 'night_watch',
    replayTitlePrefix: 'Night Watch',
  })

  const selectedStreamId = selectedStream?.id || ''

  const patrolRoomName = useMemo(() => {
    return getLiveKitRoomName(selectedStream as any, selectedStream?.id) || ''
  }, [selectedStream?.livekit_room_name, selectedStream?.id])

  const patrolIdentity =
    selectedStreamId && officerId
      ? `nightwatch:${officerId}:${selectedStreamId}`
      : ''

  const {
  isConnected,
  isPublishing,
  isJoining,
  remoteUsers = [],
  error: connectionError,
  joinAsPublisher,
  leaveRoom,
  setMicEnabled,
  getMicEnabled,
} = useLiveKitRoom({
  roomId: patrolRoomName,
  roomType: 'broadcast',
  role: 'viewer',
  audioOnly: true,
  publish: false,
  isAdmin: profile?.role === 'admin' || profile?.role === 'ceo',
  userName: officerName,
  identity: patrolIdentity,
  initialAudioEnabled: false,
  onError: err => setLiveKitError(err?.message || 'LiveKit patrol connection error'),
})

  const liveKitActionsRef = useRef({
    joinAsPublisher,
    leaveRoom,
    setMicEnabled,
    getMicEnabled,
  })

  useEffect(() => {
    liveKitActionsRef.current = {
      joinAsPublisher,
      leaveRoom,
      setMicEnabled,
      getMicEnabled,
    }
  }, [joinAsPublisher, leaveRoom, setMicEnabled, getMicEnabled])

  const liveKitConnected = isConnected || isPublishing
  const currentConnectionState = liveKitConnected ? 'Connected' : isJoining ? 'Joining' : 'Disconnected'
  const selectedStreamStatus = selectedStream?.status || 'none'
  const currentUsers = remoteUsers.length

  const stats = useMemo(() => {
    const liveCount = streams.filter(stream => stream.status === 'live' || stream.status === 'starting').length
    const totalViewers = streams.reduce((sum, stream) => sum + getViewerCount(stream), 0)

    return {
      activeStreams: liveCount,
      totalViewers,
      patrolUsers: currentUsers,
    }
  }, [currentUsers, streams])

  const fetchStreams = useCallback(async () => {
    setLoadingStreams(true)

    try {
      const { data, error } = await supabase
        .from('streams')
        .select('id,title,status,viewer_count,current_viewers,started_at,livekit_room_name,broadcaster_id,user_id')
        .in('status', ['starting', 'live'])
        .order('started_at', { ascending: false, nullsFirst: false })

      if (error) {
        console.error('[NightWatchDashboard] Failed to fetch active streams', error)
        toast.error('Unable to load active streams')
        return
      }

      const nextStreams = (data ?? []) as ActiveStream[]
      setStreams(nextStreams)

      setSelectedStream(current => {
        if (!current) return null
        return nextStreams.find(stream => stream.id === current.id) ?? current
      })
    } finally {
      setLoadingStreams(false)
    }
  }, [])

  const fetchBroadcaster = useCallback(async (stream: ActiveStream | null) => {
    const broadcasterId = stream?.broadcaster_id || stream?.user_id

    if (!broadcasterId) {
      setBroadcaster(null)
      return
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id,username,name,avatar_url')
      .eq('id', broadcasterId)
      .maybeSingle()

    if (error) {
      console.warn('[NightWatchDashboard] Failed to fetch broadcaster profile', error)
      setBroadcaster(null)
      return
    }

    setBroadcaster((data as ProfileLite) ?? null)
  }, [])

  const fetchSupportingData = useCallback(async (streamId: string) => {
    if (!streamId) {
      setChatMessages([])
      setReports([])
      setRecordings([])
      return
    }

    setLoadingPanelData(true)

    try {
      const [chatResult, reportResult, recordingResult] = await Promise.all([
        supabase
          .from('stream_chat_messages')
          .select('id,created_at,user_id,message')
          .eq('stream_id', streamId)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('stream_reports')
          .select('id,created_at,reporter_id,description,status,subject_id')
          .eq('stream_id', streamId)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('night_watch_recordings')
          .select('id,created_at,started_at,ended_at,stream_id,user_id,status,notes,cloudflare_recording_id,cloudflare_playback_url,storage_path')
          .eq('stream_id', streamId)
          .order('created_at', { ascending: false })
          .limit(30),
      ])

      if (chatResult.error) {
        console.warn('[NightWatchDashboard] Chat fetch failed', chatResult.error)
        setChatMessages([])
      } else {
        setChatMessages((chatResult.data ?? []) as ChatMessage[])
      }

      if (reportResult.error) {
        console.warn('[NightWatchDashboard] Reports fetch failed', reportResult.error)
        setReports([])
      } else {
        setReports((reportResult.data ?? []) as PatrolReport[])
      }

      if (recordingResult.error) {
        console.warn('[NightWatchDashboard] Recordings fetch failed', recordingResult.error)
        setRecordings([])
      } else {
        setRecordings((recordingResult.data ?? []) as PatrolRecording[])
      }
    } finally {
      setLoadingPanelData(false)
    }
  }, [])

  const fetchActiveShift = useCallback(async () => {
    if (!officerId) return

    const { data, error } = await supabase
      .from('night_watch_shifts')
      .select('id,started_at,ended_at,status,stream_id,user_id')
      .eq('user_id', officerId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.warn('[NightWatchDashboard] Failed to check active shift', error)
      return
    }

    const activeShift = data as NightWatchShift | null

    setShiftActive(Boolean(activeShift))
    setShiftId(activeShift?.id ?? null)
    setShiftStartedAt(activeShift?.started_at ?? null)
  }, [officerId])

  const handleSelectStream = useCallback((stream: ActiveStream) => {
    setSelectedStream(stream)
    setActiveTab('patrol-room')
    setLiveKitError(null)
    setWalkieActive(false)
  }, [])

  const handleDismissNotice = useCallback(() => {
    try {
      window.localStorage.setItem('nightwatch-notice-dismissed', 'true')
    } catch {
      // ignore localStorage issues
    }

    setNoticeVisible(false)
  }, [])

  const handleToggleWalkie = useCallback(async () => {
    if (!selectedStream) {
      toast.error('Select a stream first')
      return
    }

    if (!patrolRoomName) {
      toast.error('LiveKit room name is missing')
      return
    }

    try {
      const currentEnabled = liveKitActionsRef.current.getMicEnabled?.() ?? walkieActive
      const nextEnabled = !currentEnabled

      await liveKitActionsRef.current.setMicEnabled?.(nextEnabled)

      setWalkieActive(nextEnabled)
      toast.success(nextEnabled ? 'Walkie mic enabled' : 'Walkie mic muted')
    } catch (error) {
      console.error('[NightWatchDashboard] Failed to toggle walkie', error)
      toast.error('Unable to toggle walkie')
    }
  }, [patrolRoomName, selectedStream, walkieActive])

  const handleStartShift = useCallback(async () => {
    if (!officerId) {
      toast.error('Profile unavailable')
      return
    }

    if (shiftActive) {
      toast.message('Your Night Watch shift is already active')
      return
    }

    const startedAt = new Date().toISOString()

    setShiftActive(true)
    setShiftStartedAt(startedAt)

    const { data, error } = await supabase
      .from('night_watch_shifts')
      .insert({
        started_at: startedAt,
        user_id: officerId,
        stream_id: selectedStream?.id ?? null,
        status: 'active',
      })
      .select('id,started_at,ended_at,status,stream_id,user_id')
      .single()

    if (error) {
      console.warn('[NightWatchDashboard] Could not log shift start', error)
      toast.error('Shift started locally, but Supabase did not save it')
      return
    }

    setShiftId((data as NightWatchShift)?.id ?? null)
    toast.success('Night Watch shift started')

    // Auto-start full-screen recording for the shift
    if (selectedStream?.id) {
      try {
        await recorder.startRecording(selectedStream.id)
        setRecordingActive(true)
        toast.success('Auto screen recording started')
      } catch (err: any) {
        console.warn('[NightWatch] Auto-recording failed to start:', err?.message)
        toast.error('Could not auto-start screen recording. You can start manually.')
      }
    }
  }, [officerId, selectedStream?.id, shiftActive, recorder])

  const handleEndShift = useCallback(async () => {
    if (!shiftActive && !shiftId) {
      toast.message('No active shift to end')
      return
    }

    const endedAt = new Date().toISOString()

    setShiftActive(false)
    setShiftStartedAt(null)

    if (recordingActive && recordingSessionId) {
      const { error } = await supabase
        .from('night_watch_recordings')
        .update({ ended_at: endedAt, status: 'finished' })
        .eq('id', recordingSessionId)

      if (error) {
        console.warn('[NightWatchDashboard] Could not close active recording while ending shift', error)
      }
    }

    if (shiftId) {
      const { error } = await supabase
        .from('night_watch_shifts')
        .update({ ended_at: endedAt, status: 'completed' })
        .eq('id', shiftId)

      if (error) {
        console.warn('[NightWatchDashboard] Could not log shift end by id', error)
      }
    } else if (officerId) {
      const { error } = await supabase
        .from('night_watch_shifts')
        .update({ ended_at: endedAt, status: 'completed' })
        .eq('user_id', officerId)
        .eq('status', 'active')

      if (error) {
        console.warn('[NightWatchDashboard] Could not log shift end by user', error)
      }
    }

    // Auto-stop the screen recording
    if (recorder.isRecording) {
      try {
        await recorder.stopRecording()
      } catch (err: any) {
        console.warn('[NightWatch] Auto-recording stop error:', err?.message)
      }
    }

    setShiftId(null)
    setRecordingActive(false)
    setRecordingSessionId(null)
    toast.success('Night Watch shift ended')
  }, [officerId, recordingActive, recordingSessionId, shiftActive, shiftId, recorder])

  const handleToggleRecording = useCallback(async () => {
    if (!selectedStream) {
      toast.error('Select a stream first')
      return
    }

    if (!officerId) {
      toast.error('Profile unavailable')
      return
    }

    if (!recordingActive) {
      const startedAt = new Date().toISOString()

      const { data, error } = await supabase
        .from('night_watch_recordings')
        .insert({
          stream_id: selectedStream.id,
          user_id: officerId,
          started_at: startedAt,
          status: 'recording',
          notes: `Night Watch patrol metadata started for LiveKit room: ${patrolRoomName || 'unknown'}. Cloudflare media capture should be handled by the recording worker.`,
        })
        .select('id,created_at,started_at,ended_at,stream_id,user_id,status,notes,cloudflare_recording_id,cloudflare_playback_url,storage_path')
        .single()

      if (error) {
        console.warn('[NightWatchDashboard] Failed to start recording', error)
        toast.error('Unable to start recording')
        return
      }

      setRecordingActive(true)
      setRecordingSessionId((data as PatrolRecording)?.id ?? null)
      toast.success('Recording metadata started')
      fetchSupportingData(selectedStream.id)
      return
    }

    if (!recordingSessionId) {
      setRecordingActive(false)
      toast.error('Recording session id is missing')
      return
    }

    const endedAt = new Date().toISOString()

    const { error } = await supabase
      .from('night_watch_recordings')
      .update({ ended_at: endedAt, status: 'finished' })
      .eq('id', recordingSessionId)

    if (error) {
      console.warn('[NightWatchDashboard] Failed to stop recording', error)
      toast.error('Unable to stop recording')
      return
    }

    setRecordingActive(false)
    setRecordingSessionId(null)
    toast.success('Recording metadata stopped')
    fetchSupportingData(selectedStream.id)
  }, [fetchSupportingData, officerId, patrolRoomName, recordingActive, recordingSessionId, selectedStream])

  const handleEmergencyOpenStream = useCallback(() => {
    if (!selectedStream?.id) {
      toast.error('Select a stream first')
      return
    }

    navigate(`/broadcast/${selectedStream.id}`)
  }, [navigate, selectedStream?.id])

  useEffect(() => {
    fetchStreams()
    fetchActiveShift()

    const interval = window.setInterval(() => {
      fetchStreams()
    }, 30000)

    return () => window.clearInterval(interval)
  }, [fetchActiveShift, fetchStreams])

  useEffect(() => {
    fetchBroadcaster(selectedStream)
  }, [fetchBroadcaster, selectedStream?.broadcaster_id, selectedStream?.user_id])

  useEffect(() => {
    fetchSupportingData(selectedStreamId)

    if (!selectedStreamId) return

    const interval = window.setInterval(() => {
      fetchSupportingData(selectedStreamId)
    }, 15000)

    return () => window.clearInterval(interval)
  }, [fetchSupportingData, selectedStreamId])

  useEffect(() => {
    let cancelled = false

    const connectToPatrolRoom = async () => {
      if (!selectedStreamId || !officerId || !patrolIdentity || !patrolRoomName) {
        try {
          await liveKitActionsRef.current.leaveRoom?.()
        } catch {
          // ignore cleanup errors
        }

        if (!cancelled) {
          setWalkieActive(false)
        }

        return
      }

      try {
        setLiveKitError(null)

        await liveKitActionsRef.current.leaveRoom?.()

        if (cancelled) return

        await liveKitActionsRef.current.joinAsPublisher?.(patrolIdentity)

        if (cancelled) return

        await liveKitActionsRef.current.setMicEnabled?.(false)

        if (!cancelled) {
          setWalkieActive(false)
        }
      } catch (error) {
        console.error('[NightWatchDashboard] Unable to join LiveKit patrol room', {
          error,
          selectedStreamId,
          patrolRoomName,
          patrolIdentity,
        })

        if (!cancelled) {
          setLiveKitError('Unable to connect to the patrol room')
          setWalkieActive(false)
        }
      }
    }

    connectToPatrolRoom()

    return () => {
      cancelled = true
      liveKitActionsRef.current.leaveRoom?.()
    }
  }, [officerId, patrolIdentity, patrolRoomName, selectedStreamId])

  useEffect(() => {
    if (connectionError) {
      setLiveKitError(String(connectionError))
    }
  }, [connectionError])

  return (
    <div className="min-h-screen space-y-6 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_35%),#020617] p-3 text-slate-100 sm:p-6">
      <header className="overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-slate-950/85 p-5 shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
              <Shield size={14} />
              Night Watch Patrol
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
              Live Broadcast Patrol Dashboard
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Select any active stream, join the exact same LiveKit room used by BroadcastPage, listen to active speakers,
              use walkie talkie during emergencies, review chat, check reports, and track shift activity.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
            <StatCard label="Active Streams" value={stats.activeStreams} tone="cyan" />
            <StatCard label="Total Viewers" value={stats.totalViewers} tone="purple" />
            <StatCard label="Patrol Users" value={stats.patrolUsers} tone="emerald" />
          </div>
        </div>
      </header>

      {noticeVisible ? (
        <section className="rounded-[1.75rem] border border-amber-400/20 bg-amber-400/10 p-4 shadow-xl shadow-amber-950/10">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-1 shrink-0 text-amber-300" size={22} />
              <div>
                <h2 className="font-black text-amber-200">Night Watch mode is for midnight patrol operations.</h2>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Night Watch connects to the broadcast LiveKit room as an audio-only patrol participant. Walkie mode
                  should only be activated when staff needs to speak for safety, moderation, or emergency response.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismissNotice}
              className="rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-300/20"
            >
              Dismiss
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[390px_1fr]">
        <div className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/85 p-4 shadow-xl shadow-cyan-950/20 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Selected Stream</p>
              <h2 className="mt-2 text-2xl font-black text-white">
                {selectedStream?.title || 'No stream selected'}
              </h2>
            </div>

            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
              {selectedStreamStatus}
            </span>
          </div>

          <div className="mt-5 space-y-3 rounded-[1.5rem] border border-slate-800 bg-slate-900/70 p-4 text-sm">
            <InfoRow label="Host" value={getDisplayName(broadcaster, selectedStream?.broadcaster_id || selectedStream?.user_id)} />
            <InfoRow label="LiveKit Room" value={patrolRoomName || 'Not connected'} />
            <InfoRow label="Raw Room Field" value={selectedStream?.livekit_room_name || 'Empty'} />
            <InfoRow label="Viewers" value={String(getViewerCount(selectedStream))} />
            <InfoRow label="Started" value={safeDateTime(selectedStream?.started_at)} />
          </div>

          <div className="mt-4 grid gap-3">
            <button
              type="button"
              onClick={handleToggleWalkie}
              disabled={!selectedStream || !patrolRoomName}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 ${
                walkieActive
                  ? 'bg-rose-500 text-white hover:bg-rose-400'
                  : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
              }`}
            >
              {walkieActive ? <MicOff size={18} /> : <Mic size={18} />}
              {walkieActive ? 'Mute Walkie Talkie' : 'Activate Walkie Talkie'}
            </button>

            <button
              type="button"
              onClick={handleToggleRecording}
              disabled={!selectedStream}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 ${
                recordingActive
                  ? 'bg-rose-600 text-white hover:bg-rose-500'
                  : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
            >
              <Circle size={18} className={recordingActive ? 'animate-pulse' : ''} />
              {recordingActive ? 'Stop Recording Metadata' : 'Start Recording Metadata'}
            </button>

            <button
              type="button"
              onClick={handleEmergencyOpenStream}
              disabled={!selectedStream}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-600"
            >
              <Siren size={18} />
              Emergency Enter Stream
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <StatusCard
            title="LiveKit Status"
            value={currentConnectionState}
            description={liveKitConnected ? 'Patrol audio room is connected.' : 'Select a stream to connect.'}
            icon={Headphones}
            good={liveKitConnected}
          />

          <StatusCard
            title="Walkie"
            value={walkieActive ? 'On Air' : 'Muted'}
            description={walkieActive ? 'Your mic is active in the broadcast room.' : 'Listening only. Mic is muted.'}
            icon={walkieActive ? Mic : MicOff}
            good={!walkieActive}
          />

          <StatusCard
            title="Shift"
            value={shiftActive ? 'Active' : 'Off Duty'}
            description={shiftStartedAt ? `Started ${safeDateTime(shiftStartedAt)}` : 'No active shift logged.'}
            icon={Clock}
            good={shiftActive}
          />

          <div className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/85 p-4 shadow-xl shadow-cyan-950/20 backdrop-blur lg:col-span-3">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Shift Controls</p>
                <h2 className="mt-1 text-xl font-black text-white">Night Watch work session</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Staff can start a shift before or after selecting a stream. Selected stream is saved with the shift when available.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleStartShift}
                  disabled={shiftActive}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                >
                  Start Shift
                </button>

                <button
                  type="button"
                  onClick={handleEndShift}
                  disabled={!shiftActive && !shiftId}
                  className="rounded-2xl bg-slate-800 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-600"
                >
                  End Shift
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {liveKitError ? (
        <section className="rounded-[1.5rem] border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-black">LiveKit patrol issue</p>
              <p className="mt-1 text-rose-100/80">{liveKitError}</p>
            </div>
          </div>
        </section>
      ) : null}

      <nav className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-3 shadow-xl shadow-slate-950/30 backdrop-blur">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${
                  active
                    ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-100 shadow-lg shadow-cyan-950/30'
                    : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-cyan-400/30 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <Icon size={17} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </nav>

      <main className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <section className="min-h-[520px] rounded-[2rem] border border-slate-800 bg-slate-950/85 p-4 shadow-xl shadow-slate-950/30 backdrop-blur">
          {activeTab === 'all-streams' ? (
            <AllStreamsPanel
              streams={streams}
              selectedStreamId={selectedStreamId}
              loading={loadingStreams}
              onRefresh={fetchStreams}
              onSelectStream={handleSelectStream}
            />
          ) : null}

          {activeTab === 'patrol-room' ? (
            <PatrolRoomPanel
              selectedStream={selectedStream}
              broadcaster={broadcaster}
              remoteUsers={remoteUsers}
              isPublishing={isPublishing}
              connectionState={currentConnectionState}
              patrolRoomName={patrolRoomName}
            />
          ) : null}

          {activeTab === 'live-chat' ? (
            <LiveChatPanel loading={loadingPanelData} messages={chatMessages} />
          ) : null}

          {activeTab === 'users' ? (
            <UsersPanel remoteUsers={remoteUsers} />
          ) : null}

          {activeTab === 'reports' ? (
            <ReportsPanel loading={loadingPanelData} reports={reports} />
          ) : null}

          {activeTab === 'recordings' ? (
            <RecordingsPanel loading={loadingPanelData} recordings={recordings} />
          ) : null}

          {activeTab === 'my-shift' ? (
            <MyShiftPanel
              shiftActive={shiftActive}
              shiftStartedAt={shiftStartedAt}
              selectedStream={selectedStream}
              recordingActive={recordingActive}
              walkieActive={walkieActive}
              patrolRoomName={patrolRoomName}
              onStartShift={handleStartShift}
              onEndShift={handleEndShift}
            />
          ) : null}
        </section>

        <aside className="space-y-4">
          <div className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/85 p-4 shadow-xl shadow-cyan-950/20 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Patrol Readiness</p>
                <h3 className="mt-1 text-lg font-black text-white">Core checks</h3>
              </div>
              <Shield className="text-cyan-300" size={22} />
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <ReadinessRow label="Stream selected" ready={Boolean(selectedStream)} />
              <ReadinessRow label="LiveKit room resolved" ready={Boolean(patrolRoomName)} />
              <ReadinessRow label="LiveKit connected" ready={liveKitConnected} />
              <ReadinessRow label="Shift active" ready={shiftActive} />
              <ReadinessRow label="Recording metadata" ready={recordingActive} />
              <ReadinessRow label="Walkie muted by default" ready={!walkieActive} />
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-4 shadow-xl shadow-slate-950/30 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Live Event</p>
                <h3 className="mt-1 text-lg font-black text-white">Stream alerts</h3>
              </div>
              <Bell className="text-slate-300" size={22} />
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <AlertTile label="Status" value={selectedStreamStatus} />
              <AlertTile label="View count" value={String(getViewerCount(selectedStream))} />
              <AlertTile label="Remote users" value={String(currentUsers)} />
              <AlertTile label="Room" value={patrolRoomName || 'Missing'} danger={!patrolRoomName && Boolean(selectedStream)} />
              <AlertTile label="Recording" value={recordingActive ? 'Active' : 'Idle'} danger={recordingActive} />
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-4 shadow-xl shadow-slate-950/30 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Resource Center</p>
                <h3 className="mt-1 text-lg font-black text-white">Patrol shortcuts</h3>
              </div>
              <Download className="text-slate-300" size={22} />
            </div>

            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin/stream-monitor')}
                className="rounded-2xl bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700"
              >
                Open Stream Monitor
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className="rounded-2xl bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700"
              >
                Review Stream Reports
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('recordings')}
                className="rounded-2xl bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700"
              >
                View Recordings
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone: 'cyan' | 'purple' | 'emerald'
}) {
  const toneClass =
    tone === 'cyan'
      ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200'
      : tone === 'purple'
        ? 'border-purple-400/20 bg-purple-400/10 text-purple-200'
        : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'

  return (
    <div className={`rounded-[1.5rem] border p-4 ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[220px] break-words text-right font-semibold text-slate-200">{value}</span>
    </div>
  )
}

function StatusCard({
  title,
  value,
  description,
  icon: Icon,
  good,
}: {
  title: string
  value: string
  description: string
  icon: React.ElementType
  good: boolean
}) {
  return (
    <div className="rounded-[2rem] border border-slate-800 bg-slate-950/85 p-4 shadow-xl shadow-slate-950/30 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{title}</p>
          <h3 className="mt-2 text-2xl font-black text-white">{value}</h3>
        </div>

        <div
          className={`rounded-2xl border p-3 ${
            good ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200' : 'border-slate-700 bg-slate-800 text-slate-300'
          }`}
        >
          <Icon size={22} />
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  )
}

function ReadinessRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-3">
      <span className="text-slate-300">{label}</span>
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] ${
          ready ? 'bg-cyan-400/10 text-cyan-200' : 'bg-slate-800 text-slate-500'
        }`}
      >
        {ready ? 'Ready' : 'Pending'}
      </span>
    </div>
  )
}

function AlertTile({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 ${
        danger ? 'border-rose-400/20 bg-rose-500/10 text-rose-100' : 'border-slate-800 bg-slate-900/70 text-slate-300'
      }`}
    >
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 break-words font-black">{value}</p>
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
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
      <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4 text-slate-300">
        <Icon size={28} />
      </div>
      <h3 className="mt-4 text-xl font-black text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{description}</p>
    </div>
  )
}

function AllStreamsPanel({
  streams,
  selectedStreamId,
  loading,
  onRefresh,
  onSelectStream,
}: {
  streams: ActiveStream[]
  selectedStreamId: string
  loading: boolean
  onRefresh: () => void
  onSelectStream: (stream: ActiveStream) => void
}) {
  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Active streams</h2>
          <p className="mt-1 text-sm text-slate-400">Double-click or select any stream to enter patrol mode.</p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700"
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <EmptyState icon={RefreshCcw} title="Loading streams" description="Checking for live and starting broadcasts." />
        ) : streams.length === 0 ? (
          <EmptyState icon={Radio} title="No active streams" description="When a broadcast goes live, it will appear here for Night Watch patrol." />
        ) : (
          streams.map(stream => {
            const selected = selectedStreamId === stream.id
            const resolvedRoomName = getLiveKitRoomName(stream as any, stream.id) || ''

            return (
              <button
                key={stream.id}
                type="button"
                onClick={() => onSelectStream(stream)}
                onDoubleClick={() => onSelectStream(stream)}
                className={`w-full rounded-[1.5rem] border p-4 text-left transition ${
                  selected
                    ? 'border-cyan-400/50 bg-cyan-400/10 shadow-lg shadow-cyan-950/20'
                    : 'border-slate-800 bg-slate-900/70 hover:border-cyan-400/30 hover:bg-slate-900'
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
                      <p className="text-lg font-black text-white">{stream.title || `Stream ${stream.id}`}</p>
                    </div>

                    <p className="mt-1 text-sm text-slate-400">Host ID: {stream.broadcaster_id || stream.user_id || 'Unknown'}</p>
                    <p className="mt-1 break-all text-xs text-cyan-200/80">LiveKit Room: {resolvedRoomName || 'Missing'}</p>
                  </div>

                  <div className="flex items-center gap-3 md:flex-col md:items-end">
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
                      {stream.status || 'live'}
                    </span>
                    <span className="text-sm font-semibold text-slate-300">{getViewerCount(stream)} viewers</span>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function PatrolRoomPanel({
  selectedStream,
  broadcaster,
  remoteUsers,
  isPublishing,
  connectionState,
  patrolRoomName,
}: {
  selectedStream: ActiveStream | null
  broadcaster: ProfileLite | null
  remoteUsers: any[]
  isPublishing: boolean
  connectionState: string
  patrolRoomName: string
}) {
  if (!selectedStream) {
    return (
      <EmptyState
        icon={Headphones}
        title="No patrol room selected"
        description="Choose a live stream from All Streams to connect to the broadcast room."
      />
    )
  }

  return (
    <div>
      <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">Patrol room overview</h2>
            <p className="mt-1 text-sm text-slate-400">
              Audio-only patrol connection using the same LiveKit room resolver as BroadcastPage.
            </p>
            <p className="mt-2 break-all text-xs font-semibold text-cyan-200">Room: {patrolRoomName || 'Missing'}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-300">
              {connectionState}
            </span>
            <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-cyan-200">
              {isPublishing ? 'Patrol Publisher' : 'Listener'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Selected Stream</p>
          <p className="mt-2 text-lg font-black text-white">{selectedStream.title || selectedStream.id}</p>
          <p className="mt-1 text-sm text-slate-400">{getViewerCount(selectedStream)} viewers</p>
        </div>

        <div className="rounded-[1.5rem] border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Broadcaster</p>
          <p className="mt-2 text-lg font-black text-white">
            {getDisplayName(broadcaster, selectedStream.broadcaster_id || selectedStream.user_id)}
          </p>
          <p className="mt-1 text-sm text-slate-400">ID: {selectedStream.broadcaster_id || selectedStream.user_id || 'Not available'}</p>
        </div>
      </div>

      <div className="mt-4 rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-white">LiveKit participants</h3>
            <p className="mt-1 text-sm text-slate-400">Active remote users detected in the broadcast room.</p>
          </div>

          <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-black text-white">{remoteUsers.length}</span>
        </div>

        <div className="mt-4 grid gap-3">
          {remoteUsers.length === 0 ? (
            <p className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
              No remote participants detected yet.
            </p>
          ) : (
            remoteUsers.slice(0, 20).map((participant, index) => (
              <ParticipantCard key={`${getParticipantIdentity(participant)}-${index}`} participant={participant} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function ParticipantCard({ participant }: { participant: any }) {
  const identity = getParticipantIdentity(participant)
  const speaking = getParticipantSpeaking(participant)

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-black text-white">{identity}</p>
          <p className="mt-1 text-xs text-slate-500">Tracks: {getParticipantTrackCount(participant)}</p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
            speaking ? 'bg-emerald-400/10 text-emerald-200' : 'bg-slate-800 text-slate-500'
          }`}
        >
          {speaking ? 'Speaking' : 'Silent'}
        </span>
      </div>
    </div>
  )
}

function LiveChatPanel({ loading, messages }: { loading: boolean; messages: ChatMessage[] }) {
  return (
    <div>
      <PanelHeader title="Live chat preview" description="Recent messages from the selected stream." />

      <div className="mt-5 space-y-3">
        {loading ? (
          <EmptyState icon={RefreshCcw} title="Loading chat" description="Fetching recent stream messages." />
        ) : messages.length === 0 ? (
          <EmptyState icon={MessageCircle} title="No chat activity" description="No recent messages are available for this stream." />
        ) : (
          messages.map(message => (
            <div key={message.id} className="rounded-[1.5rem] border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>User: {message.user_id || 'Unknown'}</span>
                <span>{safeTime(message.created_at)}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-200">{message.message || 'Empty message'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function UsersPanel({ remoteUsers }: { remoteUsers: any[] }) {
  return (
    <div>
      <PanelHeader title="Users in stream" description="LiveKit-visible participants and speaking status." />

      <div className="mt-5 grid gap-3">
        {remoteUsers.length === 0 ? (
          <EmptyState icon={Users} title="No visible participants" description="Participants will appear here after the patrol room connects." />
        ) : (
          remoteUsers.map((participant, index) => (
            <ParticipantCard key={`${getParticipantIdentity(participant)}-${index}`} participant={participant} />
          ))
        )}
      </div>
    </div>
  )
}

function ReportsPanel({ loading, reports }: { loading: boolean; reports: PatrolReport[] }) {
  return (
    <div>
      <PanelHeader title="Stream reports" description="Recent flagged events associated with the selected stream." />

      <div className="mt-5 space-y-3">
        {loading ? (
          <EmptyState icon={RefreshCcw} title="Loading reports" description="Fetching recent report activity." />
        ) : reports.length === 0 ? (
          <EmptyState icon={Flag} title="No reports" description="There are no reports attached to the current stream." />
        ) : (
          reports.map(report => (
            <div key={report.id} className="rounded-[1.5rem] border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{safeDateTime(report.created_at)}</span>
                <span className="rounded-full bg-slate-800 px-2 py-1 font-black uppercase tracking-[0.14em] text-slate-300">
                  {report.status || 'open'}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-200">{report.description || 'No description provided.'}</p>

              <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                <span>Reporter: {report.reporter_id || 'Unknown'}</span>
                <span>Subject: {report.subject_id || 'Unknown'}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function RecordingsPanel({ loading, recordings }: { loading: boolean; recordings: PatrolRecording[] }) {
  return (
    <div>
      <PanelHeader title="Recordings" description="Night Watch recording session metadata for the selected stream." />

      <div className="mt-5 space-y-3">
        {loading ? (
          <EmptyState icon={RefreshCcw} title="Loading recordings" description="Fetching recording metadata." />
        ) : recordings.length === 0 ? (
          <EmptyState
            icon={Circle}
            title="No recording sessions"
            description="Start recording metadata from the selected stream controls."
          />
        ) : (
          recordings.map(recording => (
            <div key={recording.id} className="rounded-[1.5rem] border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black text-white">Recording session</p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                    recording.ended_at ? 'bg-slate-800 text-slate-300' : 'bg-rose-500/10 text-rose-200'
                  }`}
                >
                  {recording.ended_at ? 'Completed' : 'Active'}
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                <InfoRow label="Created" value={safeDateTime(recording.created_at)} />
                <InfoRow label="Started" value={safeDateTime(recording.started_at)} />
                <InfoRow label="Ended" value={safeDateTime(recording.ended_at)} />
                <InfoRow label="Officer" value={recording.user_id || 'Unknown'} />
              </div>

              {recording.cloudflare_playback_url ? (
                <a
                  href={recording.cloudflare_playback_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-black text-cyan-200 hover:bg-cyan-400/15"
                >
                  Open Cloudflare Recording
                </a>
              ) : null}

              {recording.notes ? <p className="mt-3 text-sm text-slate-500">{recording.notes}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function MyShiftPanel({
  shiftActive,
  shiftStartedAt,
  selectedStream,
  recordingActive,
  walkieActive,
  patrolRoomName,
  onStartShift,
  onEndShift,
}: {
  shiftActive: boolean
  shiftStartedAt: string | null
  selectedStream: ActiveStream | null
  recordingActive: boolean
  walkieActive: boolean
  patrolRoomName: string
  onStartShift: () => void
  onEndShift: () => void
}) {
  return (
    <div>
      <PanelHeader title="My Shift" description="Track your Night Watch session and current patrol state." />

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Status</p>
          <p className="mt-2 text-3xl font-black text-white">{shiftActive ? 'On Patrol' : 'Off Duty'}</p>
          <p className="mt-2 text-sm text-slate-400">
            {shiftStartedAt ? `Started ${safeDateTime(shiftStartedAt)}` : 'No shift is currently active.'}
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Current Assignment</p>
          <p className="mt-2 text-xl font-black text-white">{selectedStream?.title || 'No stream selected'}</p>
          <p className="mt-2 break-all text-sm text-cyan-200">Room: {patrolRoomName || 'Missing'}</p>
          <p className="mt-2 text-sm text-slate-400">
            Recording: {recordingActive ? 'Active' : 'Idle'} · Walkie: {walkieActive ? 'On air' : 'Muted'}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onStartShift}
          disabled={shiftActive}
          className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
        >
          Start Shift
        </button>

        <button
          type="button"
          onClick={onEndShift}
          disabled={!shiftActive}
          className="rounded-2xl bg-slate-800 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-600"
        >
          End Shift
        </button>
      </div>
    </div>
  )
}

function PanelHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-2xl font-black text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
    </div>
  )
}