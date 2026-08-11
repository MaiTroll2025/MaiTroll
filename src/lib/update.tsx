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
import { GamingStreamProvider, useSetGamingStreamId } from '@/contexts/GamingStreamContext'

type ObsStatus = 'idle' | 'generating' | 'ready' | 'waiting' | 'signal_detected' | 'connected' | 'live' | 'ended' | 'error' | 'reconnecting'

interface StreamData {
  id: string; title: string; status: string; is_live: boolean
  stream_key: string | null; agora_channel: string | null
  current_viewers?: number | null; started_at?: string | null
  ended_at?: string | null; created_at?: string | null
  user_id?: string | null; category?: string | null
  game_title?: string | null
}

interface StreamHealth {
  obsConnected: boolean; bitrateKbps: number | null
  fps: number | null; resolution: string | null
  ingestActive: boolean; checkedAt: number
}

const ACTIVE_STATUSES = ['starting', 'waiting', 'signal_detected', 'connected', 'live', 'reconnecting']
const HEALTH_CHECK_INTERVAL_MS = 8_000
const DURATION_TICK_MS = 1_000

function normalizeStatus(v: unknown): string { return String(v || '').trim().toLowerCase() }
function parseNumber(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') { const c = v.replace(/[^\d.]/g, ''); if (!c) return null; const p = Number(c); return Number.isFinite(p) ? p : null }
  return null
}

export default function GamingSetupPage() {
  return <GamingStreamProvider><GamingSetupPageInner /></GamingStreamProvider>
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
  const [agoraSessionId, setAgoraSessionId] = useState<string | null>(null)
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
  const [health, setHealth] = useState<StreamHealth>({ obsConnected: false, bitrateKbps: null, fps: null, resolution: null, ingestActive: false, checkedAt: 0 })

  const reconnectAttempts = useRef(0)
  const healthCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef(true)
  const recorder = useBroadcastRecorder()
  const goLiveInProgressRef = useRef(false)

  // Heartbeat only when OBS is actually connected
  const heartbeat = useObsHeartbeat({
    streamId: streamData?.id || null,
    sessionId: agoraSessionId,
    enabled: Boolean(agoraSessionId && (isObsConnected || isLive)),
    interval: 5000,
  })

  const username = profile?.username || profile?.display_name || 'Broadcaster'
  const userLevel = Number(profile?.level || 1)
  const userAvatar = profile?.avatar_url || null

  const bitrateDisplay = useMemo(() => {
    if (!isObsConnected && !isLive) return '0 kbps'
    if (health.bitrateKbps === null) return 'Connected'
    return `${Math.round(health.bitrateKbps).toLocaleString()} kbps`
  }, [health.bitrateKbps, isObsConnected, isLive])

  const streamHealthDisplay = useMemo(() => {
    if (isLive) return 'Good'
    if (isObsConnected) return health.bitrateKbps ? 'Good' : 'Fair'
    return 'Offline'
  }, [health.bitrateKbps, isLive, isObsConnected])

  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false } }, [])
  useEffect(() => { setGamingStreamId(streamData?.id || null) }, [streamData?.id, setGamingStreamId])

  const applyStreamState = useCallback((stream: StreamData | null) => {
    if (!stream) { setStreamData(null); setIsLive(false); setIsObsConnected(false); setObsStatus('idle'); setViewerCount(0); return }
    const s = normalizeStatus(stream.status)
    setStreamData(stream)
    setStreamTitle(stream.title || '')
    setViewerCount(Number(stream.current_viewers || 0))
    setIsLive(Boolean(stream.is_live || s === 'live'))
    setIsObsConnected(s === 'connected' || s === 'live' || s === 'signal_detected' || Boolean(stream.is_live))

    if (stream.is_live || s === 'live') setObsStatus('live')
    else if (s === 'connected') setObsStatus('connected')
    else if (s === 'signal_detected') setObsStatus('signal_detected')
    else if (s === 'ended') setObsStatus('ended')
    else if (s === 'error') setObsStatus('error')
    else if (stream.stream_key) setObsStatus('waiting')
    else setObsStatus('idle')
  }, [])

  // ── Health Check ──────────────────────────────────────────────────────
  const runHealthCheck = useCallback(async () => {
    if (!streamData?.id || !streamData?.stream_key) {
      if (isMountedRef.current) {
        setIsObsConnected(false)
        setHealth({ obsConnected: false, bitrateKbps: null, fps: null, resolution: null, ingestActive: false, checkedAt: Date.now() })
        if (!isGeneratingCredentials) setObsStatus(streamData?.id ? 'waiting' : 'idle')
      }
      return { connected: false, ingestActive: false }
    }

    try {
      const { data, error } = await supabase.functions.invoke('agora-stream', {
        body: { action: 'checkStatus', channel: streamData.agora_channel },
      })

      if (error) {
        if (isMountedRef.current) {
          setHealth(h => ({ ...h, obsConnected: isObsConnected, checkedAt: Date.now() }))
        }
        return { connected: isObsConnected, ingestActive: false }
      }

      const ingestActive = data?.ingest?.isActive === true
      const connected = data?.session?.status === 'signal_detected' || data?.session?.status === 'connected' || data?.session?.status === 'live' || ingestActive
      const bitrate = parseNumber(data?.ingest?.bitrateKbps)
      const fps = parseNumber(data?.ingest?.fps)
      const resolution = data?.ingest?.resolution || null

      if (isMountedRef.current) {
        setHealth({
          obsConnected: connected,
          bitrateKbps: bitrate,
          fps,
          resolution,
          ingestActive,
          checkedAt: Date.now(),
        })

        if (ingestActive) {
          reconnectAttempts.current = 0
          setIsObsConnected(true)
          setErrorMessage(null)
          if (data?.session?.status === 'live' || streamData.is_live) {
            setIsLive(true)
            setObsStatus('live')
          } else if (data?.session?.status === 'signal_detected' || data?.session?.status === 'connected') {
            setObsStatus(data.session.status)
            if (normalizeStatus(streamData.status) !== data.session.status) {
              await supabase.from('streams').update({ status: data.session.status }).eq('id', streamData.id)
            }
          }
        } else {
          setIsObsConnected(false)
          if (streamData.is_live || normalizeStatus(streamData.status) === 'live') {
            reconnectAttempts.current++
            if (reconnectAttempts.current >= 3) { setObsStatus('reconnecting'); setErrorMessage('OBS signal lost — attempting to reconnect...') }
          } else {
            setObsStatus(streamData.stream_key ? 'waiting' : 'idle')
          }
        }
      }

      return { connected, ingestActive }
    } catch (err: any) {
      console.warn('[GamingSetupPage] Health check failed:', err)
      if (isMountedRef.current) {
        setHealth(h => ({ ...h, obsConnected: isObsConnected || isLive, checkedAt: Date.now() }))
      }
      return { connected: isObsConnected, ingestActive: false }
    }
  }, [streamData, isGeneratingCredentials, isObsConnected, isLive])

  // ── Initialize Stream ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) { setInitialized(true); return }
    let cancelled = false

    const init = async () => {
      try {
        const defaultTitle = profile?.username || profile?.display_name
          ? `${profile?.username || profile?.display_name}'s gaming stream`
          : 'Live gaming stream'

        const { data: existing } = await supabase.from('streams')
          .select('id,title,game_title,status,is_live,stream_key,agora_channel,current_viewers,started_at,ended_at,created_at,user_id,category')
          .eq('user_id', user.id).eq('category', 'gaming')
          .in('status', ACTIVE_STATUSES).order('created_at', { ascending: false }).limit(1).maybeSingle()

        if (cancelled) return

        if (existing) {
          applyStreamState(existing as unknown as StreamData)
          // Restore Agora session (id, rtmp_url) from edge function on refresh
          try {
            const { data: sessionData } = await supabase.functions.invoke('agora-stream', {
              body: { action: 'getSession', streamId: existing.id },
            })
            if (sessionData?.session?.id) {
              setAgoraSessionId(sessionData.session.id)
              if (sessionData.session.rtmp_url) setRtmpUrl(sessionData.session.rtmp_url)
            }
          } catch (e) { console.warn('[GamingSetupPage] Session restore failed:', e) }
          if (existing.stream_key) { setObsStatus('waiting'); void runHealthCheck() }
          return
        }

        const { data: newStream, error: createError } = await supabase.from('streams').insert({
          id: streamId, user_id: user.id, title: defaultTitle,
          game_title: selectedGame || '', category: 'gaming', status: 'starting', is_live: false,
        }).select('id,title,game_title,status,is_live,stream_key,agora_channel,current_viewers,started_at,ended_at,created_at,user_id,category').single()

        if (createError) throw createError
        if (!cancelled && newStream) applyStreamState(newStream as unknown as StreamData)
      } catch (err: any) {
        console.error('[GamingSetupPage] Init failed:', err)
        toast.error(err?.message || 'Failed to initialize gaming stream')
      } finally {
        if (!cancelled) setInitialized(true)
      }
    }

    void init()
    return () => { cancelled = true }
  }, [user?.id, profile?.username, profile?.display_name, streamId, applyStreamState])

  // ── Realtime Subscription ────────────────────────────────────────────
  useEffect(() => {
    if (!streamData?.id) return
    const channel = supabase.channel(`gaming-setup-${streamData.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams', filter: `id=eq.${streamData.id}` }, (payload) => {
        const next = payload.new as StreamData | null
        if (!next) return
        setStreamData(prev => {
          const merged = { ...(prev || {}), ...next } as StreamData
          setViewerCount(Number(merged.current_viewers || 0))
          const s = normalizeStatus(merged.status)
          setIsLive(Boolean(merged.is_live || s === 'live'))
          if (s === 'connected' || s === 'live' || s === 'signal_detected' || merged.is_live) {
            setIsObsConnected(true)
            setObsStatus(s === 'live' || merged.is_live ? 'live' : s === 'signal_detected' ? 'signal_detected' : 'connected')
            setErrorMessage(null)
            reconnectAttempts.current = 0
          } else if (s === 'ended') {
            setIsObsConnected(false)
            setObsStatus('ended')
            setIsLive(false)
          } else if (s === 'error') {
            setObsStatus('error')
            setErrorMessage('Stream connection error')
          } else if (merged.stream_key && !isObsConnected) {
            setObsStatus('waiting')
          }
          return merged
        })
      }).subscribe()
    return () => { 
      if (channel) {
        supabase.removeChannel(channel) 
      }
    }
  }, [streamData?.id, isObsConnected])

  // ── Health Check Interval ─────────────────────────────────────────────
  useEffect(() => {
    if (!streamData?.id || !streamData?.stream_key) return
    void runHealthCheck()
    healthCheckRef.current = setInterval(() => { void runHealthCheck() }, HEALTH_CHECK_INTERVAL_MS)
    return () => { if (healthCheckRef.current) { clearInterval(healthCheckRef.current); healthCheckRef.current = null } }
  }, [streamData?.id, streamData?.stream_key, runHealthCheck])

  // ── Duration Tick ─────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      if (isLive && streamData?.started_at) {
        const start = new Date(streamData.started_at).getTime()
        if (Number.isFinite(start)) {
          const ms = Math.max(0, Date.now() - start)
          const ts = Math.floor(ms / 1000)
          const h = Math.floor(ts / 3600), m = Math.floor((ts % 3600) / 60), s = ts % 60
          setStreamDuration([h, m, s].map(p => String(p).padStart(2, '0')).join(':'))
        }
      } else { setStreamDuration('00:00:00') }
    }
    update()
    const interval = setInterval(update, DURATION_TICK_MS)
    return () => clearInterval(interval)
  }, [streamData?.started_at, isLive])

  // ── Cleanup on Unload ─────────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!agoraSessionId) return
      const edgeUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL
      if (!edgeUrl) return
      navigator.sendBeacon(`${edgeUrl}/agora-stream`, JSON.stringify({ action: 'endStream', sessionId: agoraSessionId }))
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [agoraSessionId])

  // ── Credential Flow ───────────────────────────────────────────────────
  const runCredentialFlow = useCallback(async (regenerate: boolean) => {
    if (!user?.id || !streamData?.id) { toast.error('User or stream not initialized'); return }
    setIsGeneratingCredentials(true)
    setObsStatus('generating')
    setErrorMessage(null)

    try {
      if (regenerate) {
        await supabase.from('streams').update({ stream_key: null, agora_channel: null, status: 'starting', is_live: false }).eq('id', streamData.id)
      }

      console.log('[GamingSetupPage] Calling agora-stream edge function...', { action: 'startStream', streamId: streamData.id, userId: user.id });
      const { data, error } = await supabase.functions.invoke('agora-stream', {
        body: { action: 'startStream', streamId: streamData.id, userId: user.id, regenerate },
      })
      console.log('[GamingSetupPage] Edge function response:', { data, error });

      if (error) { console.error('[GamingSetupPage] Edge function error:', error); throw new Error(error.message) }
      if (data?.error) { console.error('[GamingSetupPage] Edge function returned error:', data.error); setObsStatus('error'); setErrorMessage(data.error); toast.error(data.error); return }

      const session = data.session
      console.log('[GamingSetupPage] Session created:', session);
      setRtmpUrl(session.rtmpUrl)
      setAgoraSessionId(session.id)

      const updatePayload: Record<string, any> = {
        stream_key: session.streamKey,
        status: 'waiting',
        is_live: false,
      }
      if (session.agoraChannel) updatePayload.agora_channel = session.agoraChannel

      const { data: updated, error: updateError } = await supabase.from('streams').update(updatePayload)
        .eq('id', streamData.id).select('id,title,status,is_live,stream_key,agora_channel,current_viewers,started_at,ended_at,created_at,user_id,category').single()

      if (updateError) throw updateError

      if (updated) applyStreamState(updated as unknown as StreamData)
      setObsStatus('waiting')
      setIsObsConnected(false)
      toast.success(regenerate ? 'Stream credentials regenerated' : 'Stream credentials generated')
      void runHealthCheck()
    } catch (err: any) {
      console.error('[GamingSetupPage] Credential flow failed:', err)
      setObsStatus('error')
      setErrorMessage(err?.message || 'Failed to generate stream credentials')
      toast.error(err?.message || 'Failed to generate stream credentials')
    } finally {
      setIsGeneratingCredentials(false)
    }
  }, [user?.id, streamData, applyStreamState, runHealthCheck])

  const handleGenerateCredentials = useCallback(() => { void runCredentialFlow(false) }, [runCredentialFlow])
  const handleRegenerateCredentials = useCallback(() => { void runCredentialFlow(true) }, [runCredentialFlow])

  // ── Go Live ──────────────────────────────────────────────────────────
  const handleGoLive = useCallback(async () => {
    if (!streamData?.id || !user?.id) { toast.error('Stream not initialized'); return }
    if (!streamData.stream_key) { toast.error('Generate stream credentials first'); return }
    if (goLiveInProgressRef.current) { toast.error('Go live already in progress'); return }

    goLiveInProgressRef.current = true
    const fresh = await runHealthCheck()
    if (!fresh.connected && !fresh.ingestActive) {
      toast.error('Waiting for OBS signal. Start streaming in OBS first.')
      goLiveInProgressRef.current = false
      return
    }

    try {
      const { data: liveData, error: liveError } = await supabase.functions.invoke('agora-stream', {
        body: { action: 'goLive', sessionId: agoraSessionId },
      })

      if (liveError) throw new Error(liveError.message)

      const startedAt = streamData.started_at || new Date().toISOString()
      const { data: updated, error } = await supabase.from('streams').update({
        status: 'live', is_live: true, started_at: startedAt,
      }).eq('id', streamData.id).select('id,title,status,is_live,stream_key,agora_channel,current_viewers,started_at,ended_at,created_at,user_id,category').single()

      if (error) throw error
      if (updated) applyStreamState(updated as unknown as StreamData)
      setIsLive(true)
      setObsStatus('live')
      setIsObsConnected(true)
      setErrorMessage(null)

      await supabase.functions.invoke('notify-stream-live', {
        body: { streamId: streamData.id, userId: user.id, category: 'gaming' },
      })
    } catch (err: any) {
      console.error('[GamingSetupPage] Go live failed:', err)
      toast.error(err?.message || 'Failed to go live')
    } finally {
      goLiveInProgressRef.current = false
    }
  }, [streamData, user?.id, runHealthCheck, applyStreamState, agoraSessionId])

  // ── Test Stream ──────────────────────────────────────────────────────
  const handleTestStream = useCallback(async () => {
    if (!streamData?.id) { toast.error('Stream not initialized'); return }
    if (!streamData.stream_key) { toast.info('Generate stream credentials first'); return }
    const result = await runHealthCheck()
    if (result.ingestActive) { toast.success('OBS signal detected. Stream is connected and ready.'); return }
    toast.warning('OBS signal not detected. Start streaming in OBS first.')
  }, [streamData, runHealthCheck])

  // ── End Stream ───────────────────────────────────────────────────────
  const handleEndStream = useCallback(async () => {
    if (!streamData?.id) { toast.error('No active stream to end'); return }
    try {
      if (recorder.isRecording) {
        try { await recorder.stopRecording() } catch (recErr) { console.warn('[update.tsx] Failed to stop recording:', recErr) }
      }
      await supabase.functions.invoke('agora-stream', { body: { action: 'endStream', sessionId: agoraSessionId } })
      const { error } = await supabase.from('streams').update({ status: 'ended', is_live: false, ended_at: new Date().toISOString() }).eq('id', streamData.id)
      if (error) throw error
      setIsLive(false)
      setObsStatus('ended')
      setIsObsConnected(false)
      setErrorMessage(null)
      toast.success('Stream ended')
    } catch (err: any) {
      console.error('[GamingSetupPage] End stream failed:', err)
      toast.error(err?.message || 'Failed to end stream')
    }
  }, [streamData?.id, agoraSessionId, recorder])

  const handleToggleCamera = useCallback(() => { setIsCameraEnabled(p => !p); setHasCameraTrack(true) }, [])
  const handleToggleMic = useCallback(() => { setIsMicEnabled(p => !p); setHasMicTrack(true) }, [])

  if (!initialized) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080f] text-white">
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10"><Gamepad2 className="h-8 w-8 animate-pulse text-cyan-300" /></div>
          <p className="mt-4 text-sm font-black text-slate-300">Initializing gaming setup...</p>
        </div>
      </div>
    )
  }

  if (isSubPage) return <Outlet />

  return (
    <GamingSetup
      streamTitle={streamTitle} onStreamTitleChange={setStreamTitle}
      rtmpUrl={rtmpUrl} streamKey={streamData?.stream_key || null}
      agoraChannel={streamData?.agora_channel || null}
      gameTitle={streamData?.game_title || ''} onGameChange={(game) => { setStreamData(prev => prev ? { ...prev, game_title: game } : prev) }}
      obsStatus={obsStatus} isGeneratingCredentials={isGeneratingCredentials}
      isObsConnected={isObsConnected} isLive={isLive}
      errorMessage={errorMessage} viewerCount={viewerCount}
      streamDuration={streamDuration} bitrate={bitrateDisplay}
      streamHealth={streamHealthDisplay}
      username={username} userLevel={userLevel} userAvatar={userAvatar}
      isCameraEnabled={isCameraEnabled} isMicEnabled={isMicEnabled}
      hasCameraTrack={hasCameraTrack} hasMicTrack={hasMicTrack}
      onToggleCamera={handleToggleCamera} onToggleMic={handleToggleMic}
      onGenerateCredentials={handleGenerateCredentials}
      onRegenerateCredentials={handleRegenerateCredentials}
      onGoLive={() => void handleGoLive()}
      onTestStream={() => void handleTestStream()}
      onEndStream={() => void handleEndStream()}
      chatPanel={streamData?.id ? <GamingChat streamId={streamData.id} /> : null}
      cameraPreview={undefined}
      saveBroadcastButton={
        streamData?.id ? (
          <SaveBroadcastButton
            isRecording={recorder.isRecording}
            isUploading={recorder.isUploading}
            recordingDuration={recorder.recordingDuration}
            recordingSize={recorder.recordingSize}
            streamId={streamData.id}
            onStartRecording={recorder.startRecording}
            onStopRecording={recorder.stopRecording}
            onSaveClip={recorder.saveClip}
          />
        ) : undefined
      }
    />
  )
}
