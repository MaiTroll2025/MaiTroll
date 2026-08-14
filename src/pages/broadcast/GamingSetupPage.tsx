import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, Outlet, useLocation } from 'react-router-dom'
import { Gamepad2 } from 'lucide-react'
import GamingSetup from '@/components/broadcast/GamingSetup'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { generateUUID } from '@/lib/uuid'
import { toast } from 'sonner'
import { useAgoraScreenShare } from '@/hooks/useAgoraScreenShare'
import { useGamingHeartbeat } from '@/hooks/useGamingHeartbeat'
import { useHytroGamingLockdown } from '@/hooks/useFeatureLockdown'
import GamingChat from '@/components/broadcast/GamingChat'
import TipBanner from '@/components/broadcast/TipBanner'
import { GamingStreamProvider, useSetGamingStreamId } from '@/contexts/GamingStreamContext'

import {
  DEFAULT_SCENES,
  SceneConfig,
} from '@/components/broadcast/GamingSceneManager'

// ─── Types ───────────────────────────────────────────────────────────────────

interface StreamData {
  id: string
  title: string
  status: string
  is_live: boolean
  current_viewers: number | null
  started_at: string | null
  ended_at: string | null
  created_at: string | null
  user_id: string | null
  category: string | null
  game_title: string | null
  agora_channel: string | null
}

// ─── Wrapper with context ────────────────────────────────────────────────────

export default function GamingSetupPage() {
  return (
    <GamingStreamProvider>
      <GamingSetupPageInner />
    </GamingStreamProvider>
  )
}

// ─── Inner component ─────────────────────────────────────────────────────────

function GamingSetupPageInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuthStore()
  const setGamingStreamId = useSetGamingStreamId()
  const isSubPage = location.pathname !== '/broadcast/setup/gaming'

  // ── Stream state ──
  const [streamTitle, setStreamTitle] = useState('')
  const [selectedGame, setSelectedGame] = useState('')
  const [streamId] = useState(() => generateUUID())
  const [streamData, setStreamData] = useState<StreamData | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [streamDuration, setStreamDuration] = useState('00:00:00')

  // ── Agora screen share ──
  const agora = useAgoraScreenShare()

  // HytroGaming lockdown check
  const { isLocked: isGamingLockedDown } = useHytroGamingLockdown();

  // ── Scenes ──
  const [scenes, setScenes] = useState<SceneConfig[]>(DEFAULT_SCENES)
  const [activeSceneId, setActiveSceneId] = useState<string | null>(DEFAULT_SCENES[0]?.id || null)
  const [inlineAgreementChecked, setInlineAgreementChecked] = useState(false)

  // ── Refs ──
  const isMountedRef = useRef(true)

  // ── Derived ──
  const username = profile?.username || profile?.display_name || 'Broadcaster'
  const userLevel = Number(profile?.level || 1)
  const userAvatar = profile?.avatar_url || null
  const channelName = streamData?.agora_channel || streamData?.id || null

  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false } }, [])
  useEffect(() => { setGamingStreamId(streamData?.id || null) }, [streamData?.id, setGamingStreamId])

  // ── Heartbeat + auto-disconnect ──
  const isAdmin = Boolean(
    user?.id && (
      profile?.role === 'admin' ||
      profile?.role === 'superadmin' ||
      profile?.is_admin === true ||
      profile?.is_superadmin === true ||
      profile?.role === 'ceo' ||
      profile?.is_ceo === true
    )
  )
  const heartbeat = useGamingHeartbeat({
    streamId: streamData?.id || '',
    channelName: channelName || '',
    enabled: Boolean(streamData?.id && agora.isLive && !isAdmin),
    chatTimeoutMs: 10 * 60 * 1000,
    audioTimeoutMs: 8 * 60 * 1000,
    checkIntervalMs: 30 * 1000,
    onAutoDisconnect: useCallback(
      (reason: string) => {
        console.log('[GamingSetupPage] Auto-disconnect:', reason);
        toast.warning(`Stream ending: ${reason}`);
        void handleEndStream();
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    ),
  })

  // ── Lifecycle ──
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    setGamingStreamId(streamData?.id || null);
  }, [streamData?.id, setGamingStreamId]);

  // Hide the global bottom nav while the HytroGaming setup preview/live flow is active.
  useEffect(() => {
    const shouldHideBottomNav = location.pathname === '/broadcast/setup/gaming' && (agora.isPreviewing || isLive)

    if (shouldHideBottomNav) {
      sessionStorage.setItem('tc_hytro_gaming_setup_live', 'true')
    } else {
      sessionStorage.removeItem('tc_hytro_gaming_setup_live')
    }

    window.dispatchEvent(new CustomEvent('tc-hytro-gaming-setup-live-changed'))
  }, [agora.isPreviewing, isLive, location.pathname])

  // ── Initialize stream record ──
  useEffect(() => {
    if (!user?.id) { setInitialized(true); return; }
    let cancelled = false;

    const init = async () => {
      try {
        const defaultTitle = profile?.username || profile?.display_name
          ? `${profile?.username || profile?.display_name}'s gaming stream`
          : 'Live gaming stream';

        // Check for existing active gaming stream
        const { data: existing } = await supabase
          .from('streams')
          .select('id,title,game_title,status,is_live,current_viewers,started_at,ended_at,created_at,user_id,broadcaster_id,category,agora_channel')
          .eq('user_id', user.id)
          .eq('category', 'gaming')
          .in('status', ['starting', 'live'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (existing) {
          setStreamData(existing as StreamData);
          setStreamTitle(existing.title || '');
          setSelectedGame(existing.game_title || '');
          setIsLive(Boolean(existing.is_live));
          return;
        }

        // Create new stream record
        const agoraChannel = `gaming-${streamId}`;
        const { data: newStream, error: createError } = await supabase
          .from('streams')
          .insert({
            id: streamId,
            user_id: user.id,
            broadcaster_id: user.id,
            title: defaultTitle,
            game_title: selectedGame || '',
            category: 'gaming',
            status: 'starting',
            is_live: false,
            agora_channel: agoraChannel,
          })
          .select('id,title,game_title,status,is_live,current_viewers,started_at,ended_at,created_at,user_id,category,agora_channel')
          .single();

        if (createError) throw createError;
        if (!cancelled && newStream) {
          setStreamData(newStream as StreamData);
          setStreamTitle(newStream.title || '');
        }
      } catch (err: any) {
        console.error('[GamingSetupPage] Init failed:', err);
        toast.error(err?.message || 'Failed to initialize gaming stream');
      } finally {
        if (!cancelled) setInitialized(true);
      }
    };

    void init();
    return () => { cancelled = true; };
  }, [user?.id, profile?.username, profile?.display_name, streamId]);

  // ── Realtime subscription ──
  useEffect(() => {
    if (!streamData?.id) return;
    const channel = supabase
      .channel(`gaming-setup-${streamData.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'streams',
        filter: `id=eq.${streamData.id}`,
      }, (payload) => {
        const next = payload.new as StreamData | null;
        if (!next) return;
        setStreamData((prev) => ({ ...(prev || {}), ...next } as StreamData));
        setViewerCount(Number(next.current_viewers || 0));
        setIsLive(Boolean(next.is_live || next.status === 'live'));
      }).subscribe();
    return () => { 
      if (channel) {
        supabase.removeChannel(channel); 
      }
    };
  }, [streamData?.id]);

  // ── Duration ticker ──
  useEffect(() => {
    const update = () => {
      if (isLive && streamData?.started_at) {
        const start = new Date(streamData.started_at).getTime();
        if (Number.isFinite(start)) {
          const ms = Math.max(0, Date.now() - start);
          const ts = Math.floor(ms / 1000);
          const h = Math.floor(ts / 3600), m = Math.floor((ts % 3600) / 60), s = ts % 60;
          setStreamDuration([h, m, s].map((p) => String(p).padStart(2, '0')).join(':'));
        }
      } else { setStreamDuration('00:00:00'); }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [streamData?.started_at, isLive]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (streamData?.id) {
        navigator.sendBeacon(
          `${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/agora-token`,
          JSON.stringify({ action: 'endStream', streamId: streamData.id }),
        );
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [streamData?.id]);

  // ── Handlers ──

  // Phase 1: Start preview (get display media, show locally)
  const handleStartPreview = useCallback(async () => {
    if (!streamData?.id) { toast.error('Stream not initialized yet'); return; }
    await supabase.from('streams').update({ status: 'starting' }).eq('id', streamData.id);
    await agora.startPreview();
    sessionStorage.setItem('tc_hytro_gaming_setup_live', 'true')
    window.dispatchEvent(new CustomEvent('tc-hytro-gaming-setup-live-changed'))
  }, [streamData?.id, agora]);

  // Phase 2: Go live (join Agora + publish)
  const doGoLive = async (agreementAcceptedAt: string) => {
    if (isGamingLockedDown) {
      toast.error('HytroGaming is currently disabled by admin. No one can go live while lockdown is active.');
      return;
    }
    if (!streamData?.id || !channelName) { toast.error('Stream not ready'); return; }
    try {
      await supabase.from('streams').update({
        status: 'live',
        is_live: true,
        started_at: new Date().toISOString(),
        broadcast_disclaimer_accepted: true,
        broadcast_disclaimer_accepted_at: agreementAcceptedAt,
        broadcast_disclaimer_user_id: user?.id,
      }).eq('id', streamData.id);
      await agora.goLive(channelName, streamData.id);
      setIsLive(true);
      toast.success('You are now LIVE on HytroGaming!');
      await supabase.functions.invoke('notify-stream-live', {
        body: { streamId: streamData.id, userId: user?.id, category: 'gaming' },
      });
    } catch (err: any) {
      console.error('[GamingSetupPage] Go live failed:', err);
      toast.error(err?.message || 'Failed to go live');
    }
  };

  const handleGoLive = useCallback(() => {
    if (!inlineAgreementChecked) {
      toast.error('You must agree to the Broadcast Agreement before going live.');
      return;
    }
    setInlineAgreementChecked(false);
    const agreementAcceptedAt = new Date().toISOString();
    void doGoLive(agreementAcceptedAt);
  }, [inlineAgreementChecked, doGoLive]);

  // Phase 3: End stream (full disconnect)
  const handleEndStream = useCallback(async () => {
    await agora.endStream()
    setIsLive(false)
    sessionStorage.removeItem('tc_hytro_gaming_setup_live')
    window.dispatchEvent(new CustomEvent('tc-hytro-gaming-setup-live-changed'))
  }, [agora])

  const handleStopPreview = useCallback(async () => {
    await agora.stopPreview();
    sessionStorage.removeItem('tc_hytro_gaming_setup_live')
    window.dispatchEvent(new CustomEvent('tc-hytro-gaming-setup-live-changed'))
  }, [agora]);

  const handleToggleMic = useCallback(async () => {
    await agora.toggleMic();
  }, [agora]);

  const handleToggleCamera = useCallback(async () => {
    await agora.toggleCamera();
  }, [agora]);

  // ── Scene handlers ──
  const handleCreateScene = useCallback((name: string) => {
    const newScene: SceneConfig = {
      id: `scene-${Date.now()}`, name, backgroundColor: '#02040a',
      backgroundImage: null, textOverlays: [], audioUrl: null,
      audioVolume: 0.5, audioMuted: false,
    };
    setScenes((prev) => [...prev, newScene]);
  }, []);

  const handleDeleteScene = useCallback((sceneId: string) => {
    setScenes((prev) => {
      const filtered = prev.filter((s) => s.id !== sceneId);
      if (activeSceneId === sceneId && filtered.length > 0) setActiveSceneId(filtered[0].id);
      return filtered;
    });
  }, [activeSceneId]);

  const handleSwitchScene = useCallback((sceneId: string) => {
    setActiveSceneId(sceneId);
  }, []);

  const handleUpdateScene = useCallback((sceneId: string, updates: Partial<SceneConfig>) => {
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, ...updates } : s)));
  }, []);

  const handleAddTextOverlay = useCallback((sceneId: string) => {
    setScenes((prev) => prev.map((s) => s.id === sceneId ? {
      ...s, textOverlays: [...s.textOverlays, {
        id: `text-${Date.now()}`, text: 'New Text', x: 50, y: 50,
        fontSize: 24, color: '#ffffff', bold: false,
      }],
    } : s));
  }, []);

  const handleUpdateTextOverlay = useCallback((sceneId: string, overlayId: string, updates: Partial<SceneConfig['textOverlays'][0]>) => {
    setScenes((prev) => prev.map((s) => s.id === sceneId ? {
      ...s, textOverlays: s.textOverlays.map((o) => o.id === overlayId ? { ...o, ...updates } : o),
    } : s));
  }, []);

  const handleDeleteTextOverlay = useCallback((sceneId: string, overlayId: string) => {
    setScenes((prev) => prev.map((s) => s.id === sceneId ? {
      ...s, textOverlays: s.textOverlays.filter((o) => o.id !== overlayId),
    } : s));
  }, []);

  const handleSetBackgroundImage = useCallback((sceneId: string, imageUrl: string | null) => {
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, backgroundImage: imageUrl } : s)));
  }, []);

  // ── Loading state ──
  if (!initialized) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05080f] text-white">
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10">
            <Gamepad2 className="h-8 w-8 animate-pulse text-cyan-300" />
          </div>
          <p className="mt-4 text-sm font-black text-slate-300">Initializing HytroGaming...</p>
        </div>
      </div>
    );
  }

  if (isSubPage) return <Outlet />;

  // ── Render ──
  return (
    <GamingSetup
      streamTitle={streamTitle}
      onStreamTitleChange={setStreamTitle}
      gameTitle={streamData?.game_title || selectedGame}
      onGameChange={(game) => {
        setSelectedGame(game);
        setStreamData((prev) => (prev ? { ...prev, game_title: game } : prev));
      }}
      isLive={isLive}
      isPreviewing={agora.isPreviewing}
      isConnecting={agora.isConnecting}
      hasMicTrack={agora.hasMicTrack}
      isMicEnabled={agora.micEnabled}
      hasCameraTrack={agora.hasCameraTrack}
      isCameraEnabled={agora.cameraEnabled}
      viewerCount={viewerCount}
      streamDuration={streamDuration}
      username={username}
      userLevel={userLevel}
      userAvatar={userAvatar}
      errorMessage={agora.error}
      heartbeatStatus={{
        isChatActive: heartbeat.isChatActive,
        isAudioActive: heartbeat.isAudioActive,
        isIdle: heartbeat.isIdle,
        idleReason: heartbeat.idleReason,
      }}
      scenes={scenes}
      activeSceneId={activeSceneId}
      onStartPreview={() => void handleStartPreview()}
      onGoLive={() => void handleGoLive()}
      onEndStream={() => void handleEndStream()}
      onStopPreview={() => void handleStopPreview()}
      onToggleMic={() => void handleToggleMic()}
      onToggleCamera={() => void handleToggleCamera()}
      onCreateScene={handleCreateScene}
      onDeleteScene={handleDeleteScene}
      onSwitchScene={handleSwitchScene}
      onUpdateScene={handleUpdateScene}
      onAddTextOverlay={handleAddTextOverlay}
      onUpdateTextOverlay={handleUpdateTextOverlay}
      onDeleteTextOverlay={handleDeleteTextOverlay}
      onSetBackgroundImage={handleSetBackgroundImage}
      chatPanel={streamData?.id ? <GamingChat streamId={streamData.id} /> : null}
      screenStream={agora.screenStream}
      cameraStream={agora.cameraStream}
      micStream={agora.micStream}
      screenAudioTrack={agora.screenAudioTrack}
      hasScreenAudioTrack={Boolean(agora.screenAudioTrack)}
      inlineAgreementChecked={inlineAgreementChecked}
      onInlineAgreementChange={setInlineAgreementChecked}
      streamId={streamData?.id || null}
    />
  );
}
