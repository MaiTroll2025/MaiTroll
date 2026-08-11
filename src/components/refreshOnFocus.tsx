import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, Outlet, useLocation } from 'react-router-dom'
import { Gamepad2 } from 'lucide-react'
import GamingSetup from '@/components/broadcast/GamingSetup'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { generateUUID } from '@/lib/uuid'
import { toast } from 'sonner'
import { useObsHeartbeat } from '@/hooks/useObsHeartbeat'
import { useBroadcastRecorder } from '@/hooks/useBroadcastRecorder'
import GamingChat from '@/components/broadcast/GamingChat'
import SaveBroadcastButton from '@/components/broadcast/SaveBroadcastButton'
import {
  GamingStreamProvider,
  useSetGamingStreamId,
} from '@/contexts/GamingStreamContext'

type ObsStatus =
  | 'idle'
  | 'generating'
  | 'ready'
  | 'waiting'
  | 'connected'
  | 'live'
  | 'error'
  | 'gateway_not_configured'
  | 'reconnecting'

type StreamHealthLabel =
  | 'Excellent'
  | 'Good'
  | 'Fair'
  | 'Poor'
  | 'Offline'
  | 'Unknown'
  | string

interface StreamData {
  id: string
  title: string
  status: string
  is_live: boolean
  stream_key: string | null
  agora_channel: string | null
  current_viewers?: number | null
  started_at?: string | null
  ended_at?: string | null
  created_at?: string | null
  user_id?: string | null
  category?: string | null
  game_title?: string | null
}

interface StreamHealthSnapshot {
  status: string
  obsConnected: boolean
  bitrateKbps: number | null
  health: StreamHealthLabel
  checkedAt: number | null
  raw: any
}

const ACTIVE_GAMING_STATUSES = ['starting', 'waiting', 'ready', 'connected', 'live', 'reconnecting']
const HEALTH_CHECK_INTERVAL_MS = 10_000
const DURATION_TICK_MS = 1_000

function normalizeStatus(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function parseNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') return null

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.]/g, '')
    if (!cleaned) return null
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function resolveHealthStatus(data: any): string {
  return normalizeStatus(
    data?.status ||
      data?.streamStatus ||
      data?.connectionStatus ||
      data?.state ||
      data?.obsStatus ||
      '',
  )
}

function resolveObsConnected(data: any): boolean {
  const status = resolveHealthStatus(data)

  return Boolean(
    data?.obsConnected === true ||
      data?.rtlsActive === true ||
      data?.connected === true ||
      data?.isConnected === true ||
      data?.streamConnected === true ||
      status === 'connected' ||
      status === 'live' ||
      status === 'publishing' ||
      status === 'active',
  )
}

function resolveBitrateKbps(data: any): number | null {
  const candidates = [
    data?.rtlsBitrateKbps,
    data?.bitrateKbps,
    data?.bitrate_kbps,
    data?.bitrate,
    data?.currentBitrate,
    data?.current_bitrate,
    data?.ingestBitrate,
    data?.ingest_bitrate,
    data?.stats?.bitrateKbps,
    data?.stats?.bitrate_kbps,
    data?.stats?.bitrate,
    data?.metrics?.bitrateKbps,
    data?.metrics?.bitrate_kbps,
    data?.metrics?.bitrate,
  ]

  for (const candidate of candidates) {
    const parsed = parseNumber(candidate)
    if (parsed !== null) return parsed
  }

  return null
}

function resolveHealthLabel(data: any, connected: boolean, isLive: boolean): StreamHealthLabel {
  const explicit =
    data?.health ||
    data?.streamHealth ||
    data?.quality ||
    data?.qualityLabel ||
    data?.metrics?.health ||
    data?.metrics?.quality

  if (explicit) return String(explicit)

  const bitrate = resolveBitrateKbps(data)

  if (!connected && !isLive) return 'Offline'
  if (bitrate === null) return connected || isLive ? 'Good' : 'Unknown'
  if (bitrate >= 4500) return 'Excellent'
  if (bitrate >= 2500) return 'Good'
  if (bitrate >= 1000) return 'Fair'
  return 'Poor'
}

function formatBitrate(bitrateKbps: number | null, connected: boolean): string {
  if (!connected) return '0 kbps'
  if (bitrateKbps === null) return 'Connected'
  return `${Math.round(bitrateKbps).toLocaleString()} kbps`
}

function formatDurationFromStartedAt(startedAt?: string | null): string {
  if (!startedAt) return '00:00:00'

  const start = new Date(startedAt).getTime()
  if (!Number.isFinite(start)) return '00:00:00'

  const elapsedMs = Math.max(0, Date.now() - start)
  const totalSeconds = Math.floor(elapsedMs / 1000)

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}

function mapStreamStatusToObsStatus(stream: StreamData | null): ObsStatus {
  const status = normalizeStatus(stream?.status)

  if (!stream) return 'idle'
  if (stream.is_live || status === 'live') return 'live'
  if (status === 'connected') return 'connected'
  if (status === 'reconnecting') return 'reconnecting'
  if (status === 'error') return 'error'
  if (stream.stream_key) return 'ready'
  if (status === 'starting' || status === 'waiting' || status === 'ready') return 'waiting'

  return 'idle'
}

export default function GamingSetupPage() {
  return (
    <GamingStreamProvider>
      <GamingSetupPageInner />
    </GamingStreamProvider>
  )
}

function GamingSetupPageInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuthStore()
  const setGamingStreamId = useSetGamingStreamId()

  const isSubPage = location.pathname !== '/broadcast/setup/gaming'

  const [streamTitle, setStreamTitle] = useState('')
  const [selectedGame, setSelectedGame] = useState('')
  const [streamId] = useState(() => generateUUID())
  const [streamData, setStreamData] = useState<StreamData | null>(null)
  const [obsStatus, setObsStatus] = useState<ObsStatus>('idle')
  const [isGeneratingCredentials, setIsGeneratingCredentials] = useState(false)
  const [isObsConnected, setIsObsConnected] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isCameraEnabled, setIsCameraEnabled] = useState(true)
  const [isMicEnabled, setIsMicEnabled] = useState(true)
  const [hasCameraTrack, setHasCameraTrack] = useState(false)
  const [hasMicTrack, setHasMicTrack] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [rtmpUrl, setRtmpUrl] = useState<string | null>(null)
  const [viewerCount, setViewerCount] = useState(0)
  const [streamDuration, setStreamDuration] = useState('00:00:00')
  const [healthSnapshot, setHealthSnapshot] = useState<StreamHealthSnapshot>({
    status: 'idle',
    obsConnected: false,
    bitrateKbps: null,
    health: 'Offline',
    checkedAt: null,
    raw: null,
  })

  const reconnectAttempts = useRef(0)
  const healthCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef(true)

  const recorder = useBroadcastRecorder()
  
  // Heartbeat is only enabled when OBS is actually detected as connected.
  // The health check interval (runHealthCheck) polls the backend to detect OBS.
  // Once detected, the heartbeat keeps updated_at fresh so the stream doesn't
  // get marked stale. Enabling it before OBS is connected causes false positives.
  const heartbeat = useObsHeartbeat({
    streamId: streamData?.id || null,
    enabled: Boolean(streamData?.id && (isObsConnected || isLive)),
    interval: 5000,
  })

  const username = profile?.username || profile?.display_name || 'Broadcaster'
  const userLevel = Number(profile?.level || 1)
  const userAvatar = profile?.avatar_url || null

  const bitrateDisplay = useMemo(() => {
    return formatBitrate(healthSnapshot.bitrateKbps, isObsConnected || isLive)
  }, [healthSnapshot.bitrateKbps, isObsConnected, isLive])

  const streamHealthDisplay = useMemo(() => {
    return healthSnapshot.health || (isLive ? 'Good' : isObsConnected ? 'Good' : 'Offline')
  }, [healthSnapshot.health, isLive, isObsConnected])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Stream duration timer - updates every second based on stream start time
  useEffect(() => {
    if (!isLive || !streamData?.started_at) {
      setStreamDuration('00:00:00');
      return;
    }
    const start = new Date(streamData.started_at).getTime();
    if (!Number.isFinite(start)) {
      setStreamDuration('00:00:00');
      return;
    }
    const update = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      setStreamDuration(
        [h, m, s].map((p) => String(p).padStart(2, '0')).join(':')
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isLive, streamData?.started_at])

  useEffect(() => {
    setGamingStreamId(streamData?.id || null)
  }, [streamData?.id, setGamingStreamId])

  const applyStreamState = useCallback((stream: StreamData | null) => {
    if (!stream) {
      setStreamData(null)
      setIsLive(false)
      setIsObsConnected(false)
      setObsStatus('idle')
      setViewerCount(0)
      return
    }

    const mappedStatus = mapStreamStatusToObsStatus(stream)
    const status = normalizeStatus(stream.status)

    setStreamData(stream)
    setStreamTitle(stream.title || '')
    setSelectedGame(stream.game_title || '')
    setViewerCount(Number(stream.current_viewers || 0))
    setIsLive(Boolean(stream.is_live || status === 'live'))
    setIsObsConnected(status === 'connected' || status === 'live' || Boolean(stream.is_live))
    setObsStatus(mappedStatus)
  }, [])

  const refreshStreamRow = useCallback(async (): Promise<StreamData | null> => {
    if (!streamData?.id) return null

    const { data, error } = await supabase
      .from('streams')
      .select(
        [
          'id',
          'title',
          'game_title',
          'status',
          'is_live',
          'stream_key',
          'agora_channel',
          'current_viewers',
          'started_at',
          'ended_at',
          'created_at',
          'user_id',
          'category',
        ].join(','),
      )
      .eq('id', streamData.id)
      .maybeSingle()

    if (error) {
      console.warn('[GamingSetupPage] Failed to refresh stream row:', error)
      return null
    }

    if (data && isMountedRef.current) {
      applyStreamState(data as unknown as StreamData)
    }

    return (data as unknown as StreamData) || null
  }, [streamData?.id, applyStreamState])

  const updateStreamConnectionState = useCallback(
    async (nextStatus: string, nextIsLive?: boolean) => {
      if (!streamData?.id) return

      const payload: Record<string, any> = {
        status: nextStatus,
      }

      if (typeof nextIsLive === 'boolean') {
        payload.is_live = nextIsLive
      }

      const { error } = await supabase
        .from('streams')
        .update(payload)
        .eq('id', streamData.id)

      if (error) {
        console.warn('[GamingSetupPage] Failed to update stream connection state:', error)
      }
    },
    [streamData?.id],
  )

  const runHealthCheck = useCallback(
    async (options?: { silent?: boolean; forceStream?: StreamData | null }) => {
      const targetStream = options?.forceStream || streamData

      if (!targetStream?.id || !targetStream?.stream_key) {
        if (isMountedRef.current) {
          setIsObsConnected(false)
          setHealthSnapshot({
            status: 'missing_credentials',
            obsConnected: false,
            bitrateKbps: null,
            health: 'Offline',
            checkedAt: Date.now(),
            raw: null,
          })

          if (!isGeneratingCredentials) {
            setObsStatus(targetStream?.id ? 'idle' : 'idle')
          }
        }

        return {
          connected: false,
          status: 'missing_credentials',
          data: null,
          bitrateKbps: null,
          health: 'Offline',
        }
      }

      try {
        const { data, error } = await supabase.functions.invoke('stream-health-monitor', {
          body: {
            action: 'checkStream',
            streamId: targetStream.id,
            streamKey: targetStream.stream_key,
            channel: targetStream.agora_channel,
          },
        })

        if (error) {
          if (!options?.silent) {
            console.warn('[GamingSetupPage] Health check error:', error)
          }

          if (isMountedRef.current) {
            setHealthSnapshot((prev) => ({
              ...prev,
              status: 'error',
              health: isObsConnected || isLive ? prev.health : 'Unknown',
              checkedAt: Date.now(),
              raw: { error },
            }))
          }

          return {
            connected: isObsConnected,
            status: 'error',
            data: null,
            bitrateKbps: null,
            health: 'Unknown',
          }
        }

        const status = resolveHealthStatus(data)
        const connected = resolveObsConnected(data)
        const bitrateKbps = resolveBitrateKbps(data)
        const health = resolveHealthLabel(data, connected, Boolean(targetStream.is_live))

        if (!isMountedRef.current) {
          return {
            connected,
            status,
            data,
            bitrateKbps,
            health,
          }
        }

        setHealthSnapshot({
          status: status || (connected ? 'connected' : 'disconnected'),
          obsConnected: connected,
          bitrateKbps,
          health,
          checkedAt: Date.now(),
          raw: data,
        })

        if (status === 'key_invalid') {
          setIsObsConnected(false)
          setObsStatus('error')
          setErrorMessage('Stream key expired or invalid — regenerate credentials')
          return {
            connected: false,
            status,
            data,
            bitrateKbps,
            health,
          }
        }

        if (connected) {
          reconnectAttempts.current = 0
          setIsObsConnected(true)
          setErrorMessage(null)

          if (targetStream.is_live || normalizeStatus(targetStream.status) === 'live') {
            setIsLive(true)
            setObsStatus('live')
          } else {
            setObsStatus('connected')

            if (normalizeStatus(targetStream.status) !== 'connected') {
              void updateStreamConnectionState('connected', false)
            }
          }
        } else {
          setIsObsConnected(false)

          if (targetStream.is_live || normalizeStatus(targetStream.status) === 'live') {
            reconnectAttempts.current += 1

            if (reconnectAttempts.current >= 3) {
              setObsStatus('reconnecting')
              setErrorMessage('OBS signal lost — attempting to reconnect...')
            }
          } else {
            setObsStatus(targetStream.stream_key ? 'waiting' : 'idle')
          }
        }

        return {
          connected,
          status,
          data,
          bitrateKbps,
          health,
        }
      } catch (err: any) {
        if (!options?.silent) {
          console.warn('[GamingSetupPage] Health check failed:', err)
        }

        if (isMountedRef.current) {
          setHealthSnapshot((prev) => ({
            ...prev,
            status: 'error',
            health: isObsConnected || isLive ? prev.health : 'Unknown',
            checkedAt: Date.now(),
            raw: { error: err?.message || String(err) },
          }))
        }

        return {
          connected: isObsConnected,
          status: 'error',
          data: null,
          bitrateKbps: null,
          health: 'Unknown',
        }
      }
    },
    [streamData, isGeneratingCredentials, isObsConnected, isLive, updateStreamConnectionState],
  )

  useEffect(() => {
    if (!user?.id) {
      setInitialized(true)
      return
    }

    let cancelled = false

    const initStream = async () => {
      setInitialized(false)

      try {
          const defaultTitle = profile?.username || profile?.display_name
            ? `${profile?.username || profile?.display_name}'s gaming stream`
            : 'Live gaming stream'

        const { data: existingStream, error: existingError } = await supabase
          .from('streams')
          .select(
            [
              'id',
              'title',
              'game_title',
              'status',
              'is_live',
              'stream_key',
              'agora_channel',
              'current_viewers',
              'started_at',
              'ended_at',
              'created_at',
              'user_id',
              'category',
            ].join(','),
          )
          .eq('user_id', user.id)
          .eq('category', 'gaming')
          .in('status', ACTIVE_GAMING_STATUSES)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existingError) throw existingError
        if (cancelled) return

        if (existingStream) {
          const stream = existingStream as unknown as StreamData
          applyStreamState(stream)

          if (stream.stream_key) {
            setObsStatus('waiting')
            void runHealthCheck({ silent: true, forceStream: stream })
          }

          return
        }

        const { data: newStream, error: createError } = await supabase
          .from('streams')
          .insert({
            id: streamId,
            user_id: user.id,
            title: defaultTitle,
            game_title: selectedGame || '',
            category: 'gaming',
            status: 'starting',
            is_live: false,
          })
          .select(
            [
              'id',
              'title',
              'game_title',
              'status',
              'is_live',
              'stream_key',
              'agora_channel',
              'current_viewers',
              'started_at',
              'ended_at',
              'created_at',
              'user_id',
              'category',
            ].join(','),
          )
          .single()

        if (createError) throw createError
        if (cancelled) return

        if (newStream) {
          applyStreamState(newStream as unknown as StreamData)
        }
      } catch (err: any) {
        console.error('[GamingSetupPage] Failed to initialize stream:', err)
        toast.error(err?.message || 'Failed to initialize gaming stream')
      } finally {
        if (!cancelled) {
          setInitialized(true)
        }
      }
    }

    void initStream()

    return () => {
      cancelled = true
    }
  }, [
    user?.id,
    profile?.username,
    profile?.display_name,
    streamId,
    applyStreamState,
  ])

  useEffect(() => {
    if (!streamData?.id) return

    const channel = supabase
      .channel(`gaming-setup-${streamData.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamData.id}`,
        },
        (payload) => {
          const next = payload.new as StreamData | null
          if (!next) return

          setStreamData((prev) => {
            const merged = {
              ...(prev || {}),
              ...next,
            } as StreamData

            setViewerCount(Number(merged.current_viewers || 0))

            const status = normalizeStatus(merged.status)
            setIsLive(Boolean(merged.is_live || status === 'live'))

            if (status === 'connected' || status === 'live' || merged.is_live) {
              setIsObsConnected(true)
              setObsStatus(status === 'live' || merged.is_live ? 'live' : 'connected')
              setErrorMessage(null)
              reconnectAttempts.current = 0
            } else if (status === 'error') {
              setObsStatus('error')
              setErrorMessage('Stream connection error')
            } else if (merged.stream_key && !isObsConnected) {
              setObsStatus('waiting')
            }

            return merged
          })
        },
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [streamData?.id, isObsConnected])

  useEffect(() => {
    if (!streamData?.id || !streamData?.stream_key) return

    void runHealthCheck({ silent: true })

    healthCheckRef.current = setInterval(() => {
      void runHealthCheck({ silent: true })
    }, HEALTH_CHECK_INTERVAL_MS)

    return () => {
      if (healthCheckRef.current) {
        clearInterval(healthCheckRef.current)
        healthCheckRef.current = null
      }
    }
  }, [streamData?.id, streamData?.stream_key, runHealthCheck])

  useEffect(() => {
    const refreshOnFocus = () => {
      if (!streamData?.id) return

      void refreshStreamRow().then((freshStream) => {
        if (freshStream?.stream_key) {
          void runHealthCheck({ silent: true, forceStream: freshStream })
        }
      })
    }

    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnFocus)

    return () => {
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnFocus)
    }
  }, [streamData?.id, refreshStreamRow, runHealthCheck])

  useEffect(() => {
    const updateDuration = () => {
      if (isLive && streamData?.started_at) {
        setStreamDuration(formatDurationFromStartedAt(streamData?.started_at))
      } else {
        setStreamDuration('00:00:00')
      }
    }

    updateDuration()

    const interval = setInterval(updateDuration, DURATION_TICK_MS)

    return () => clearInterval(interval)
  }, [streamData?.started_at, isLive])

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!streamData?.id || !streamData?.stream_key) return

      const edgeUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL
      if (!edgeUrl) return

      navigator.sendBeacon(
        `${edgeUrl}/stream-health-monitor`,
        JSON.stringify({
          action: 'cleanupStream',
          streamId: streamData.id,
          streamKey: streamData.stream_key,
        }),
      )
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [streamData?.id, streamData?.stream_key])

  const runCredentialFlow = useCallback(
    async (regenerate: boolean) => {
      if (!user?.id || !streamData?.id) {
        toast.error('User or stream not initialized')
        return
      }

      setIsGeneratingCredentials(true)
      setObsStatus('generating')
      setErrorMessage(null)

      try {
        if (regenerate) {
          await supabase
            .from('streams')
            .update({
              stream_key: null,
              agora_channel: null,
              status: 'starting',
              is_live: false,
            })
            .eq('id', streamData.id)
        }

        const { data: credsData, error: credsError } =
          await supabase.functions.invoke('generate-obs-credentials', {
            body: {
              streamId: streamData.id,
              userId: user.id,
              regenerate,
            },
          })

        if (credsError) {
          throw new Error(credsError.message)
        }

        if (credsData?.error) {
          setObsStatus('gateway_not_configured')
          setErrorMessage(credsData.error)
          toast.error(credsData.error)
          return
        }

        if (!credsData?.rtmpUrl || !credsData?.streamKey) {
          throw new Error('No OBS credentials received from server')
        }

        const nextRtmpUrl = String(credsData.rtmpUrl)
        const nextStreamKey = String(credsData.streamKey)
        const nextAgoraChannel = credsData?.agoraChannel
          ? String(credsData.agoraChannel)
          : streamData.agora_channel

        setRtmpUrl(nextRtmpUrl)

        const updatePayload: Record<string, any> = {
          stream_key: nextStreamKey,
          status: 'waiting',
          is_live: false,
        }

        if (nextAgoraChannel) {
          updatePayload.agora_channel = nextAgoraChannel
        }

        const { data: updatedStream, error: updateError } = await supabase
          .from('streams')
          .update(updatePayload)
          .eq('id', streamData.id)
          .select(
            [
              'id',
              'title',
              'status',
              'is_live',
              'stream_key',
              'agora_channel',
              'current_viewers',
              'started_at',
              'ended_at',
              'created_at',
              'user_id',
              'category',
            ].join(','),
          )
          .single()

        if (updateError) throw updateError

        const nextStream = updatedStream as unknown as StreamData
        applyStreamState(nextStream)
        setObsStatus('waiting')
        setIsObsConnected(false)

        toast.success(
          regenerate
            ? 'OBS credentials regenerated'
            : 'OBS credentials generated',
        )

        void runHealthCheck({ silent: true, forceStream: nextStream })
      } catch (err: any) {
        console.error('[GamingSetupPage] Credential flow failed:', err)
        setObsStatus('error')
        setErrorMessage(err?.message || 'Failed to generate OBS credentials')
        toast.error(err?.message || 'Failed to generate OBS credentials')
      } finally {
        setIsGeneratingCredentials(false)
      }
    },
    [user?.id, streamData, applyStreamState, runHealthCheck],
  )

  const handleGenerateCredentials = useCallback(() => {
    void runCredentialFlow(false)
  }, [runCredentialFlow])

  const handleRegenerateCredentials = useCallback(() => {
    void runCredentialFlow(true)
  }, [runCredentialFlow])

  const handleGoLive = useCallback(async () => {
    if (!streamData?.id || !user?.id) {
      toast.error('Stream not initialized')
      return
    }

    if (!streamData.stream_key) {
      toast.error('Generate OBS credentials first')
      return
    }

    const freshHealth = await runHealthCheck({
      silent: false,
      forceStream: streamData,
    })

    if (!freshHealth.connected) {
      toast.error('Waiting for OBS signal. Start streaming in OBS first.')
      return
    }

    try {
      const startedAt = streamData.started_at || new Date().toISOString()

      const { data: updatedStream, error } = await supabase
        .from('streams')
        .update({
          status: 'live',
          is_live: true,
          started_at: startedAt,
        })
        .eq('id', streamData.id)
        .select(
          [
            'id',
            'title',
            'status',
            'is_live',
            'stream_key',
            'agora_channel',
            'current_viewers',
            'started_at',
            'ended_at',
            'created_at',
            'user_id',
            'category',
          ].join(','),
        )
        .single()

      if (error) throw error

      if (updatedStream) {
        applyStreamState(updatedStream as unknown as StreamData)
      }

      setIsLive(true)
      setObsStatus('live')
      setIsObsConnected(true)
      setErrorMessage(null)

      setIsLive(true)
      setObsStatus('live')
      setIsObsConnected(true)
      setErrorMessage(null)

      await supabase.functions.invoke('notify-stream-live', {
        body: {
          streamId: streamData.id,
          userId: user.id,
          category: 'gaming',
        },
      })
    } catch (err: any) {
      console.error('[GamingSetupPage] Failed to go live:', err)
      toast.error(err?.message || 'Failed to go live')
    }
  }, [streamData, user?.id, runHealthCheck, applyStreamState, navigate])

  const handleTestStream = useCallback(async () => {
    if (!streamData?.id) {
      toast.error('Stream not initialized')
      return
    }

    if (!streamData.stream_key) {
      toast.info('Generate OBS credentials first to test stream')
      return
    }

    const result = await runHealthCheck({
      silent: false,
      forceStream: streamData,
    })

    if (result.status === 'key_invalid') {
      toast.error('Stream key expired or invalid — regenerate credentials')
      return
    }

    if (result.connected) {
      toast.success('OBS signal detected. Stream is connected and ready.')
      return
    }

    toast.warning('OBS signal not detected. Start streaming in OBS first.')
  }, [streamData, runHealthCheck])

  const handleEndStream = useCallback(async () => {
    if (!streamData?.id) {
      toast.error('No active stream to end')
      return
    }

    try {
      if (recorder.isRecording) {
        try { await recorder.stopRecording() } catch (recErr) { console.warn('[refreshOnFocus] Failed to stop recording:', recErr) }
      }

      const { error } = await supabase
        .from('streams')
        .update({
          status: 'ended',
          is_live: false,
          ended_at: new Date().toISOString(),
        })
        .eq('id', streamData.id)

      if (error) throw error

      setIsLive(false)
      setObsStatus('idle')
      setIsObsConnected(false)
      setErrorMessage(null)

      toast.success('Stream ended')
    } catch (err: any) {
      console.error('[GamingSetupPage] Failed to end stream:', err)
      toast.error(err?.message || 'Failed to end stream')
    }
  }, [streamData?.id])

  const handleToggleCamera = useCallback(() => {
    setIsCameraEnabled((prev) => !prev)
    setHasCameraTrack(true)
  }, [])

  const handleToggleMic = useCallback(() => {
    setIsMicEnabled((prev) => !prev)
    setHasMicTrack(true)
  }, [])

  if (!initialized) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080f] text-white">
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10">
            <Gamepad2 className="h-8 w-8 animate-pulse text-cyan-300" />
          </div>
          <p className="mt-4 text-sm font-black text-slate-300">
            Initializing gaming setup...
          </p>
        </div>
      </div>
    )
  }

  if (isSubPage) {
    return <Outlet />
  }

  return (
    <GamingSetup
      streamTitle={streamTitle}
      onStreamTitleChange={setStreamTitle}
      rtmpUrl={rtmpUrl}
      streamKey={streamData?.stream_key || null}
      agoraChannel={streamData?.agora_channel || null}
      gameTitle={streamData?.game_title || ''}
      onGameChange={(game) => {
        setStreamData(prev => prev ? { ...prev, game_title: game } : prev)
      }}
      obsStatus={obsStatus}
      isCameraEnabled={isCameraEnabled}
      isMicEnabled={isMicEnabled}
      hasCameraTrack={hasCameraTrack}
      hasMicTrack={hasMicTrack}
      isGeneratingCredentials={isGeneratingCredentials}
      isObsConnected={isObsConnected}
      isLive={isLive}
      errorMessage={errorMessage}
      viewerCount={viewerCount}
      streamDuration={streamDuration}
      bitrate={bitrateDisplay}
      streamHealth={streamHealthDisplay}
      username={username}
      userLevel={userLevel}
      userAvatar={userAvatar}
      onToggleCamera={handleToggleCamera}
      onToggleMic={handleToggleMic}
      onGenerateCredentials={handleGenerateCredentials}
      onRegenerateCredentials={handleRegenerateCredentials}
      onGoLive={() => void handleGoLive()}
      onTestStream={() => void handleTestStream()}
      onEndStream={() => void handleEndStream()}
      chatPanel={
        streamData?.id ? (
          <GamingChat streamId={streamData.id} />
        ) : null
      }
      cameraPreview={undefined}
      saveBroadcastButton={
        <SaveBroadcastButton
          isRecording={recorder.isRecording}
          isUploading={recorder.isUploading}
          recordingDuration={recorder.recordingDuration}
          recordingSize={recorder.recordingSize}
          streamId={streamData?.id || null}
          onStartRecording={recorder.startRecording}
          onStopRecording={recorder.stopRecording}
          onSaveClip={recorder.saveClip}
        />
      }
    />
  )
}