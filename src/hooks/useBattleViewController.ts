import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { Room, LocalAudioTrack, LocalVideoTrack, RemoteParticipant, RemoteTrackPublication, RoomEvent } from "livekit-client";

import { supabase } from "../lib/supabase";
import { logActiveChannels } from "../lib/realtimeChannelDiagnostics";
import { Stream } from "../types/broadcast";
import { useAuthStore } from "../lib/store";
import { PreflightStore } from "../lib/preflightStore";
import { useCoins } from "../lib/hooks/useCoins";
import useTrollFamilyActivity from "./useTrollFamilyActivity";
import { useBattleRealtime } from "./useBattleRealtime";
import { toast } from "sonner";
import { useActiveBattles, ActiveBattle } from "../components/broadcast/battle/ActiveBattlesPanel";
import { getTrackPublications, CrownInfo } from "../components/broadcast/BattleArena";

const MAIN_BATTLE_DURATION_MS = 180_000;
const SUDDEN_DEATH_DURATION_MS = 10_000;
const MAX_CONNECTION_RETRIES = 5;
const CONNECTION_TIMEOUT_MS = 3000;

const logBattleLifecycle = (event: string, data?: Record<string, any>) => {
  console.log(`[BattleLifecycle] ${event}`, data || "");
};

const logBattleRTC = (event: string, data?: Record<string, any>) => {
  console.log(`[BattleRTC] ${event}`, data || "");
};

type BattleEndReason = "manual" | "timer_expired" | "sudden_death";

type BattlePhase =
  | "IDLE"
  | "INITIALIZING"
  | "WAITING_FOR_BATTLE"
  | "CONNECTING_ARENA"
  | "WAITING_FOR_BOTH_HOST_TRACKS"
  | "ACTIVE_GAMEPLAY"
  | "SUDDEN_DEATH"
  | "ENDED"
  | "RETURNING"
  | "RECOVERED";

export interface OriginalBroadcastRef {
  streamId: string;
  roomName: string;
  userId: string;
}

export interface BattleViewProps {
  battleId: string;
  currentStreamId: string;
  viewerId?: string;
  localTracks?: [LocalAudioTrack | undefined, LocalVideoTrack | undefined] | null;
  remoteUsers?: RemoteParticipant[];
  userIdToLiveKitIdentity?: Record<string, string>;
  onReturnToStream?: () => void;
  onToggleCamera?: () => void;
  onToggleMic?: () => void;
}

export function useBattleViewController({
  battleId,
  currentStreamId,
  viewerId,
  localTracks: passedLocalTracks,
  userIdToLiveKitIdentity,
  onReturnToStream,
  onToggleCamera: onToggleCameraProp,
  onToggleMic: onToggleMicProp,
}: BattleViewProps) {
  // Provide safe defaults to prevent ReferenceError if props are undefined
  const onToggleCamera = onToggleCameraProp || (() => {});
  const onToggleMic = onToggleMicProp || (() => {});
  // Track connection phases to avoid repeated renders from track events
  const [trackRevision, setTrackRevision] = useState(0);
  const trackRevisionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrackRevisionRef = useRef(0);
  const preflightSetInBattleRef = useRef(false);
  const [battleTick, setBattleTick] = useState(0);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bumpTrackRevision = useCallback(() => {
    if (trackRevisionTimerRef.current) return;
    trackRevisionTimerRef.current = setTimeout(() => {
      trackRevisionTimerRef.current = null;
      setTrackRevision((v) => v + 1);
    }, 100);
  }, []);

  const deferError = useCallback((message: string, delayMs?: number) => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    connectionTimeoutRef.current = setTimeout(() => {
      setError(message);
      setLoading(false);
    }, delayMs ?? CONNECTION_TIMEOUT_MS);
  }, []);

  const clearDeferredError = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  }, []);
  
  const [battle, setBattle] = useState<any>(null);
  const [challengerStream, setChallengerStream] = useState<Stream | null>(null);
  const [opponentStream, setOpponentStream] = useState<Stream | null>(null);
  const [participantInfo, setParticipantInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [battlePhase, setBattlePhase] = useState<BattlePhase>("IDLE");
  const battlePhaseRef = useRef<BattlePhase>("IDLE");

  // Get coin/crown balances for display
  const { troll_coins: userCoins, crowns: userCrowns, trollmonds: userTrollmonds } = useCoins() as any;
  
  // Family activity recording
  const { recordBattleWon, recordBattleLost, recordBattleJoined } = useTrollFamilyActivity();
  const hasRecordedBattleJoinedRef = useRef(false);
  
  // Explicitly track enabled state to ensure camera stays on during battle
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  
  // Local track state - used for publishing to battle room (managed by component, not hook)
  const [battleLocalAudioTrack, setBattleLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [battleLocalVideoTrack, setBattleLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  // Cache tracks in refs to prevent disappearance during re-renders / effect re-runs
  const cachedAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const cachedVideoTrackRef = useRef<LocalVideoTrack | null>(null);
  // Track whether we've already connected for this battle to prevent re-connect loops
  const hasPublishedTracksRef = useRef(false);
  const [participantSnapshots, setParticipantSnapshots] = useState<Array<{ user_id: string; role: 'host' | 'stage' | 'viewer' }>>([]);
  // Battle-room participants only. Never reuse participants from the original broadcast room.
  const [remoteUsers, setRemoteUsers] = useState<RemoteParticipant[]>([]);
  // Full battle_participants rows (with profile join) — used by the mobile layout
  // to render team boxes. Crowns are intentionally NOT used for battle scoring.
  const [battleParticipants, setBattleParticipants] = useState<any[]>([]);
  // Real, authoritative per-recipient battle-point contributions aggregated from
  // realtime gift_sent events (gift coin value credited to the recipient). Never mocked.
  const [participantContributions, setParticipantContributions] = useState<Record<string, number>>({});
  const [arenaReadyAtMs, setArenaReadyAtMs] = useState<number | null>(null);
  const [arenaReady, setArenaReady] = useState(false);
  const [preBattleCountdown, setPreBattleCountdown] = useState<number | null>(null);
  const hasHandledReturnRef = useRef(false);
  const [challengerCrownInfo, setChallengerCrownInfo] = useState<CrownInfo>({ crowns: 0, streak: 0, hasStreak: false });
  const [opponentCrownInfo, setOpponentCrownInfo] = useState<CrownInfo>({ crowns: 0, streak: 0, hasStreak: false });
  
  // Track stream live status to detect when a stream ends during battle
  const prevStreamLiveRef = useRef({ challenger: true, opponent: true });
  
  const publishedArenaReadyRef = useRef(false);
  const battleRoomRef = useRef<Room | null>(null); // FIX 1: Prevent double connection
  const isConnectingRef = useRef(false); // FIX 1: Track connection state
  const connectedBattleIdRef = useRef<string | null>(null); // PHASE 3: Track which battleId the room is connected for
  const [livekitRoom, setLivekitRoom] = useState<Room | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting');
  const audioPublishedRef = useRef(false);
  const videoPublishedRef = useRef(false);
  const battleJoinInFlightRef = useRef(false);
  const battleReturnInFlightRef = useRef(false);
  const originalBroadcastRef = useRef<{ streamId: string; roomName: string; userId: string } | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });
  const lastBoxResolutionLogRef = useRef<string | null>(null);
  const battleBroadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const getBattleBroadcastChannel = useCallback(() => {
    if (!battleBroadcastChannelRef.current || battleBroadcastChannelRef.current.topic !== `battle:${battleId}`) {
      if (battleBroadcastChannelRef.current) {
        supabase.removeChannel(battleBroadcastChannelRef.current);
      }
      battleBroadcastChannelRef.current = supabase.channel(`battle:${battleId}`);
    }
    return battleBroadcastChannelRef.current;
  }, [battleId]);

  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const effectiveUserId = viewerId || user?.id;

  // ==========================================================================
  // DERIVED VALUES (must be declared before callbacks that reference them in
  // their dependency arrays — otherwise we hit a temporal-dead-zone error at
  // render time because React reads the deps array during the useCallback call.)
  // ==========================================================================
  const resolvedBattleRole = useMemo<'host' | 'stage' | 'viewer' | null>(() => {
    if (!effectiveUserId || !challengerStream?.user_id || !opponentStream?.user_id) return null;
    if (effectiveUserId === challengerStream.user_id || effectiveUserId === opponentStream.user_id) return 'host';
    if (participantInfo?.role === 'host' || participantInfo?.role === 'stage' || participantInfo?.role === 'viewer') {
      return participantInfo.role;
    }
    return 'viewer';
  }, [effectiveUserId, challengerStream?.user_id, opponentStream?.user_id, participantInfo?.role]);

  const isBroadcaster = resolvedBattleRole === 'host' || resolvedBattleRole === 'stage';
  // Broadcasters use LiveKit. All viewers use LiveKit only.
  const isRandomBattle = challengerStream?.battle_mode === 'random_queue' || opponentStream?.battle_mode === 'random_queue';

  // Use the userIdToLiveKitIdentity mapping from BroadcastPage to find video tracks
  // The mapping converts database user IDs to LiveKit identities
  const challengerLiveKitIdentity = challengerStream
    ? userIdToLiveKitIdentity?.[challengerStream.user_id] || challengerStream.user_id
    : undefined;
  const opponentLiveKitIdentity = opponentStream
    ? userIdToLiveKitIdentity?.[opponentStream.user_id] || opponentStream.user_id
    : undefined;

  // Phase transition helper — sets both the render-state and the ref so that
  // other callbacks/effects can read the current phase synchronously.
  const transitionToPhase = useCallback((phase: BattlePhase) => {
    const prev = battlePhaseRef.current;
    setBattlePhase(phase);
    battlePhaseRef.current = phase;
    logBattleLifecycle("PHASE_TRANSITION", { from: prev, to: phase });
  }, []);

  // Consolidated battle realtime hook (replaces 6 separate channel subscriptions)
  const { state: battleRealtime } = useBattleRealtime(battleId || null);

  // Realtime list of other live battles (for the Active Battles sidebar + next-stream nav)
  const { battles: activeBattles, loading: activeBattlesLoading } = useActiveBattles(battleId);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // ==========================================================================
  // TOKEN CONTRACT VALIDATION
  // ==========================================================================

  const validatePublisherToken = useCallback(
    (data: any, roomName: string, battleId: string) => {
      if (!data?.token) {
        console.error("[BattleTransition] INVALID_PUBLISHER_TOKEN", {
          battleId,
          roomName,
          authenticatedUserId: effectiveUserId,
          participantType: data?.participantType,
          canPublish: data?.canPublish,
          isPublisher: data?.isPublisher,
        });
        return false;
      }
      if (data.canPublish !== true || data.isPublisher !== true) {
        console.error("[BattleTransition] INVALID_PUBLISHER_TOKEN", {
          battleId,
          roomName,
          authenticatedUserId: effectiveUserId,
          participantType: data?.participantType,
          canPublish: data?.canPublish,
          isPublisher: data?.isPublisher,
        });
        return false;
      }
      return true;
    },
    [effectiveUserId]
  );

  // ==========================================================================
  // SINGLE AUTHORITATIVE PUBLISH FUNCTION
  // ==========================================================================

  const publishBattleMedia = useCallback(
    async (room: Room, tracks: [LocalAudioTrack | undefined, LocalVideoTrack | undefined]) => {
      const [audioTrack, videoTrack] = tracks;
      let audioPublished = false;
      let videoPublished = false;

      try {
        if (audioTrack) {
          await room.localParticipant.publishTrack(audioTrack, { name: "audio" });
          audioPublished = true;
          logBattleRTC("LOCAL_MEDIA", { audioPublished: true });
        }
      } catch (e) {
        console.warn("[BattleView] Failed to publish audio track:", e);
      }

      try {
        if (videoTrack) {
          await room.localParticipant.publishTrack(videoTrack, { name: "video" });
          videoPublished = true;
          logBattleRTC("LOCAL_MEDIA", { videoPublished: true });
        }
      } catch (e) {
        console.warn("[BattleView] Failed to publish video track:", e);
      }

      audioPublishedRef.current = audioPublished;
      videoPublishedRef.current = videoPublished;
      hasPublishedTracksRef.current = audioPublished || videoPublished;

      return { audioPublished, videoPublished };
    },
    []
  );

  // ==========================================================================
  // CONNECT BATTLE ROOM
  // ==========================================================================

  const connectBattleRoom = useCallback(
    async (roomName: string, role: "publisher" | "viewer"): Promise<Room | null> => {
      if (battleJoinInFlightRef.current) {
        if (import.meta.env.DEV)
          console.log("[BattleView] Battle join already in flight, skipping");
        return null;
      }

      battleJoinInFlightRef.current = true;
      isConnectingRef.current = true;
      setConnectionStatus("connecting");

      try {
        const tokenBody: any = {
          room: roomName,
          roomName,
          userId: effectiveUserId,
          identity: effectiveUserId,
          name: role === "publisher" ? "Broadcaster" : "Viewer",
          role,
          isHost: role === "publisher",
          canPublish: role === "publisher",
          canSubscribe: true,
          mode: role === "publisher" ? "broadcaster" : "audience",
        };

        const { data, error } = await supabase.functions.invoke("livekit-token", {
          body: tokenBody,
        });

        if (error) throw error;

        if (role === "publisher" && !validatePublisherToken(data, roomName, battleId)) {
          throw new Error("Invalid publisher token permissions");
        }

        const client = new Room();
        battleRoomRef.current = client;
        setLivekitRoom(client);

        const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
        if (!livekitUrl) {
          throw new Error("VITE_LIVEKIT_URL is not configured");
        }

        let connectAttempts = 0;
        let connected = false;

        while (connectAttempts < MAX_CONNECTION_RETRIES && !connected) {
          try {
            await client.connect(livekitUrl, data.token);
            connected = true;
          } catch (connectError: any) {
            connectAttempts++;
            console.warn(
              `[BattleView] Connection attempt ${connectAttempts} failed:`,
              connectError?.message || connectError
            );
            if (connectAttempts < MAX_CONNECTION_RETRIES) {
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * Math.pow(2, connectAttempts - 1))
              );
            }
          }
        }

        if (!connected) {
          throw new Error("All LiveKit connection attempts failed");
        }

        connectedBattleIdRef.current = battleId;
        setConnectionStatus("connected");
        isConnectingRef.current = false;

        logBattleRTC("CONNECTING", {
          battleId,
          battleRoomName: roomName,
          userId: effectiveUserId,
          originalStreamId: originalBroadcastRef.current?.streamId,
          originalRoomName: originalBroadcastRef.current?.roomName,
        });

        logBattleRTC("TOKEN", {
          participantType: data?.participantType,
          canPublish: data?.canPublish,
          isPublisher: data?.isPublisher,
        });

        return client;
      } catch (err: any) {
        console.error("[BattleView] Failed to connect battle room:", err);
        setConnectionStatus("failed");
        isConnectingRef.current = false;
        battleJoinInFlightRef.current = false;
        throw err;
      }
    },
    [battleId, effectiveUserId, validatePublisherToken]
  );

  // ==========================================================================
  // DISCONNECT BATTLE ROOM
  // ==========================================================================

  const disconnectBattleRoom = useCallback(async (updateReactState = true) => {
    const room = battleRoomRef.current;
    if (room && room.state === "connected") {
      try {
        const localParticipant = room.localParticipant;
        const tracks = Array.from(localParticipant.trackPublications.values());
        for (const pub of tracks) {
          try {
            if (pub.track) await localParticipant.unpublishTrack(pub.track);
          } catch (e) {
            // ignore
          }
        }
        room.disconnect();
      } catch (e) {
        console.warn("[BattleView] Cleanup disconnect error:", e);
      }
    }
    battleRoomRef.current = null;
    connectedBattleIdRef.current = null;
    isConnectingRef.current = false;
    battleJoinInFlightRef.current = false;
    hasPublishedTracksRef.current = false;
    audioPublishedRef.current = false;
    videoPublishedRef.current = false;
    publishedArenaReadyRef.current = false;

    if (updateReactState) {
      setLivekitRoom(null);
      setConnectionStatus("disconnected");
      setRemoteUsers([]);
      setArenaReady(false);
      setArenaReadyAtMs(null);
    }
  }, []);

  // ==========================================================================
  // JOIN BATTLE ARENA
  // ==========================================================================

  const joinBattleArena = useCallback(async () => {
    const battleData = battleViewStateRef.current.battle;
    if (!battleData?.id || !effectiveUserId) return;

    const roomName = `battle-${battleData.id}`;

    if (import.meta.env.DEV) {
      console.log("[BattleView] Joining battle arena:", roomName);
    }

    setBattlePhase("CONNECTING_ARENA");
    battlePhaseRef.current = "CONNECTING_ARENA";

    try {
      const role = isBroadcaster ? "publisher" : "viewer";
      const room = await connectBattleRoom(roomName, role);

      if (!room) return;

      const handleParticipantConnected = (participant: RemoteParticipant) => {
        setRemoteUsers((prev) => {
          if (prev.some((p) => p.identity === participant.identity)) return prev;
          return [...prev, participant];
        });
        bumpTrackRevision();
      };

      const handleParticipantDisconnected = (participant: RemoteParticipant) => {
        setRemoteUsers((prev) => prev.filter((p) => p.identity !== participant.identity));
      };

      const handleTrackSubscribed = () => {
        bumpTrackRevision();
      };

      const handleTrackUnsubscribed = () => {
        bumpTrackRevision();
      };

      const handleTrackPublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        publication.setSubscribed(true);
        bumpTrackRevision();
      };

      room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.on(RoomEvent.TrackPublished, handleTrackPublished);

      // Participants that joined before this client connected do not need to wait
      // for a future ParticipantConnected event. Seed them immediately so both
      // broadcaster boxes can resolve as soon as the room is connected.
      setRemoteUsers(Array.from(room.remoteParticipants.values()));
      bumpTrackRevision();

      if (isBroadcaster && battleData?.id && !hasRecordedBattleJoinedRef.current) {
        hasRecordedBattleJoinedRef.current = true;
        try {
          await recordBattleJoined(battleData.id, currentStreamId);
        } catch (err) {
          console.warn("[BattleView] Failed to record battle joined:", err);
        }
      }

      const localTracks = battleViewStateRef.current.effectiveLocalTracks;
      if (isBroadcaster && localTracks) {
        const publishResult = await publishBattleMedia(room, localTracks);

        if (publishResult.audioPublished) {
          cachedAudioTrackRef.current = localTracks[0];
          setBattleLocalAudioTrack(localTracks[0]);
          setIsMicEnabled(true);
        }
        if (publishResult.videoPublished) {
          cachedVideoTrackRef.current = localTracks[1];
          setBattleLocalVideoTrack(localTracks[1]);
          setIsCameraEnabled(true);
        }
      }

      setBattlePhase("WAITING_FOR_BOTH_HOST_TRACKS");
      battlePhaseRef.current = "WAITING_FOR_BOTH_HOST_TRACKS";

      logBattleLifecycle("ARENA_CONNECTED", {
        battleId: battleData.id,
        status: battleData.status,
      });
    } catch (err: any) {
      console.error("[BattleView] Failed to join battle arena:", err);
      toast.error("Couldn't connect to the battle.");
      setBattlePhase("IDLE");
      battlePhaseRef.current = "IDLE";
    } finally {
      battleJoinInFlightRef.current = false;
    }
  }, [
    battleId,
    effectiveUserId,
    isBroadcaster,
    currentStreamId,
    recordBattleJoined,
    connectBattleRoom,
    publishBattleMedia,
    validatePublisherToken,
  ]);

  // ==========================================================================
  // RETURN TO ORIGINAL BROADCAST
  // ==========================================================================

  const returnToOriginalBroadcast = useCallback(async () => {
    if (battleReturnInFlightRef.current) return;
    battleReturnInFlightRef.current = true;
    setShowResults(false);
    setShowRematchOption(false);

    const original = originalBroadcastRef.current;

    await disconnectBattleRoom();

    try {
      const returnChannel = getBattleBroadcastChannel();
      await returnChannel.send({
        type: "broadcast",
        event: "return_to_broadcast",
        payload: {
          challengerStreamId: challengerStream?.id,
          opponentStreamId: opponentStream?.id,
          challengerHostId: challengerStream?.user_id,
          opponentHostId: opponentStream?.user_id,
        },
      });
    } catch (e) {
      console.warn("[BattleView] Failed to broadcast return event:", e);
    }

    if (original) {
      navigate(`/stream/${original.streamId}`);
    } else if (currentStreamId) {
      navigate(`/stream/${currentStreamId}`);
    } else if (onReturnToStream) {
      onReturnToStream();
    } else {
      navigate("/");
    }

    battleReturnInFlightRef.current = false;
  }, [
    battleId,
    challengerStream?.id,
    challengerStream?.user_id,
    opponentStream?.id,
    opponentStream?.user_id,
    currentStreamId,
    navigate,
    onReturnToStream,
    disconnectBattleRoom,
  ]);

  // ── Channel diagnostics (dev only) ──
  useEffect(() => {
    logActiveChannels(`BattleView:mount:${battleId}`);
    return () => logActiveChannels(`BattleView:unmount:${battleId}`);
  }, [battleId]);

  // Battle-room lifecycle cleanup. A battle id change must never leave the old
  // LiveKit connection or publication flags alive.
  useEffect(() => {
    return () => {
      void disconnectBattleRoom(false);
    };
  }, [battleId, disconnectBattleRoom]);

  // DEBUG: Log battle state
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[BattleView] State:', {
      battleId,
      effectiveUserId,
      resolvedBattleRole,
      isBroadcaster,
    });
  }, [battleId, effectiveUserId, resolvedBattleRole, isBroadcaster]);

  // PHASE 5: Dev-only mount/unmount log to identify StrictMode double-mount vs real spam
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[BattleView] MOUNT battleId=', battleId);
      return () => console.log('[BattleView] UNMOUNT battleId=', battleId);
    }
    return;
  }, [battleId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Prefer tracks passed from BroadcastPage; fallback to PreflightStore when page refresh/race drops props.
  // Normalize: ensure we always have a tuple [audio, video] even if one is undefined
  const normalizeTracks = (tracks: any): [LocalAudioTrack | undefined, LocalVideoTrack | undefined] | null => {
    if (!tracks) return null;
    // Already a tuple
    if (Array.isArray(tracks)) {
      const audio = tracks[0] || undefined;
      const video = tracks[1] || undefined;
      if (!audio && !video) return null;
      return [audio, video];
    }
    const audio = tracks.audio ?? tracks.audioTrack;
    const video = tracks.video ?? tracks.videoTrack;
    if (!audio && !video) return null;
    return [audio, video];
  };
  const localTracksFromPreflight = normalizeTracks(passedLocalTracks)
    || normalizeTracks(PreflightStore.getLivekitTracks())
    || normalizeTracks(PreflightStore.getTracks())
    || null;

  // Mobile retry: if no tracks yet, retry PreflightStore after a short delay
  // This handles the race condition where BattleView mounts before PreflightStore is populated
  const [retryTracks, setRetryTracks] = useState<[LocalAudioTrack | undefined, LocalVideoTrack | undefined] | null>(null);
  useEffect(() => {
    if (localTracksFromPreflight) return;
    if (!isBroadcaster) return;
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      const tracks = normalizeTracks(PreflightStore.getLivekitTracks()) || normalizeTracks(PreflightStore.getTracks());
      if (tracks) {
        if (import.meta.env.DEV) console.log('[BattleView] Mobile retry: found PreflightStore tracks');
        setRetryTracks(tracks);
        clearInterval(interval);
        return;
      }
      if (attempts >= 6) {
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [localTracksFromPreflight, isBroadcaster]);

  const effectiveLocalTracks = localTracksFromPreflight || retryTracks;
  // REMOVED useBattleRoom hook - using legacy connection only to avoid conflicts
  // The legacy code uses room name: battle-{battleId}

  // Update mic/camera enabled state based on track availability
  useEffect(() => {
    if (battleLocalAudioTrack) {
      setIsMicEnabled(true);
    }
    if (battleLocalVideoTrack) {
      setIsCameraEnabled(true);
    }
  }, [battleLocalAudioTrack, battleLocalVideoTrack]);

  // Fetch crown info for both broadcasters
  useEffect(() => {
    const fetchCrownInfo = async () => {
      if (!challengerStream?.user_id || !opponentStream?.user_id) return;

      const { data: challengerProfile } = await supabase
        .from('user_profiles')
        .select('battle_crowns, battle_crown_streak')
        .eq('id', challengerStream.user_id)
        .maybeSingle();

      const { data: opponentProfile } = await supabase
        .from('user_profiles')
        .select('battle_crowns, battle_crown_streak')
        .eq('id', opponentStream.user_id)
        .maybeSingle();

      if (challengerProfile) {
        setChallengerCrownInfo({
          crowns: challengerProfile.battle_crowns || 0,
          streak: challengerProfile.battle_crown_streak || 0,
          hasStreak: (challengerProfile.battle_crown_streak || 0) >= 3,
        });
      }

      if (opponentProfile) {
        setOpponentCrownInfo({
          crowns: opponentProfile.battle_crowns || 0,
          streak: opponentProfile.battle_crown_streak || 0,
          hasStreak: (opponentProfile.battle_crown_streak || 0) >= 3,
        });
      }
    };

    fetchCrownInfo();
  }, [challengerStream?.user_id, opponentStream?.user_id]);

  // Refs holding the latest battle + local tracks so the connection effect can
  // read them WITHOUT being re-subscribed on every re-render / track churn.
  // Depending on local track object identity previously caused an infinite
  // connect/disconnect storm: BattleView re-created the LiveKit battle room on
  // every local-track identity change, which also prevented the opponent's
  // remote tracks from ever settling.
  const battleViewStateRef = useRef<{ battle: any; effectiveLocalTracks: [LocalAudioTrack | undefined, LocalVideoTrack | undefined] | null }>({ battle, effectiveLocalTracks });
  battleViewStateRef.current = { battle, effectiveLocalTracks };

  // LiveKit setup - delegate to joinBattleArena which is the single authoritative path
  useEffect(() => {
    const battle = battleViewStateRef.current.battle;
    if (!battle || !effectiveUserId) return;
    if (battle.status !== 'active' && battle.status !== 'starting') return;
    if (resolvedBattleRole === null) return;

    if (connectedBattleIdRef.current === battleId && battleRoomRef.current && battleRoomRef.current.state === 'connected') {
      return;
    }

    if (isConnectingRef.current) {
      return;
    }

    joinBattleArena();
  }, [battleId, effectiveUserId, battle?.id, battle?.status, isBroadcaster, resolvedBattleRole, joinBattleArena]);

  const [showMobileChat, setShowMobileChat] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });
  const [showMobileGiftTray, setShowMobileGiftTray] = useState(false);

  // Gift recipient state for battle mode
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
  const [giftStreamId, setGiftStreamId] = useState<string | null>(null);

  const handleGiftSelect = useCallback((uid: string, sourceStreamId: string) => {
    if (isBroadcaster) return;
    if (effectiveUserId && uid === effectiveUserId) return;
    setGiftRecipientId(uid);
    setGiftStreamId(sourceStreamId);
    if (isMobileViewport) {
      setShowMobileGiftTray(true);
    }
  }, [isBroadcaster, effectiveUserId, isMobileViewport]);

  const myStream = useMemo(() => {
    if (!participantInfo?.team) return null;
    if (participantInfo.team === 'challenger') return challengerStream;
    if (participantInfo.team === 'opponent') return opponentStream;
    return null;
  }, [participantInfo?.team, challengerStream, opponentStream]);

  // Persist a broadcaster seat (box) count change for a given team.
  // Used by BattleArena's broadcaster seat-management controls. Optimistically
  // updates local state, broadcasts box_count_changed (consumed in realtime),
  // and writes through to the DB via set_stream_box_count.
  const setTeamBoxCount = useCallback(async (team: 'challenger' | 'opponent', newCount: number) => {
    const targetStream = team === 'challenger' ? challengerStream : opponentStream;
    if (!targetStream) return;

    if (newCount < 1) {
      toast.warning('Cannot have less than 1 box.');
      return;
    }
    if (newCount > 6) {
      toast.warning('Maximum 6 boxes allowed.');
      return;
    }

    const prevStream = targetStream;
    if (team === 'challenger') {
      setChallengerStream({ ...targetStream, box_count: newCount });
    } else {
      setOpponentStream({ ...targetStream, box_count: newCount });
    }

    try {
      const broadcastChannel = supabase.channel(`stream:${targetStream.id}`);

      await new Promise<void>((resolve, reject) => {
        broadcastChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(new Error('Channel subscription failed'));
          }
        });
      });

      await broadcastChannel.send({
        type: 'broadcast',
        event: 'box_count_changed',
        payload: { box_count: newCount, stream_id: targetStream.id }
      });

      setTimeout(() => {
        supabase.removeChannel(broadcastChannel);
      }, 3000);
    } catch (broadcastErr) {
      console.warn('[BoxCount] Broadcast error (non-fatal):', broadcastErr);
    }

    const { error } = await supabase.rpc('set_stream_box_count', {
      p_stream_id: targetStream.id,
      p_new_box_count: newCount
    });

    if (error) {
      toast.error('Failed to update box count.');
      if (team === 'challenger') {
        setChallengerStream(prevStream);
      } else {
        setOpponentStream(prevStream);
      }
    } else {
      toast.success(team === 'challenger' ? 'Blue seat updated' : 'Red seat updated');
    }
  }, [challengerStream, opponentStream]);

   // Initialize battle
   useEffect(() => {
     const initBattle = async () => {
       try {
         if (connectionTimeoutRef.current) {
           clearTimeout(connectionTimeoutRef.current);
           connectionTimeoutRef.current = null;
         }
         setError(null);
         setLoading(true);
        // Set battle mode flag to hide TrollEngine during battles
        // FIX 7: Only set if not already set to avoid repeated updates
        if (!preflightSetInBattleRef.current && !PreflightStore.getInBattle()) {
          PreflightStore.setInBattle(true);
          preflightSetInBattleRef.current = true;
          if (import.meta.env.DEV) console.log('[BattleView] Set isInBattle = true');
        }
        
        // DEBUG: Log battleId and auth state before query
        const { data: { user: authUser } } = await supabase.auth.getUser();
        console.log('[BattleView] DEBUG initBattle', { battleId, authUserId: authUser?.id, authUserExists: !!authUser });

        // Verify battle_id format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!battleId || !uuidRegex.test(battleId)) {
          setError('Invalid battle ID');
          return;
        }

        // Retry DB query up to 3 times with short delays â€” handles race where battle row is being created
        let battleData: any = null;
        let battleError: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const result = await supabase.from('battles').select('*').eq('id', battleId).maybeSingle();
          battleData = result.data;
          battleError = result.error;
          if (battleData) break;
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }

        // Use a resolvedBattle local variable so later code doesn't accidentally
        // dereference `battleData` when it was null and we used a realtime fallback.
        let resolvedBattle: any = null;
        if (battleError || !battleData) {
          console.warn('[BattleView] battle query returned empty or error after retries', { battleId, battleData, battleError });
          // Fallback: prefer realtime state (handles viewers with RLS blocking DB reads)
          const realtimeCandidate = (battleRealtime as any)?.battle;
          if (realtimeCandidate) {
            console.log('[BattleView] Using immediate battleRealtime fallback for battle', battleId);
            setBattle(realtimeCandidate);
            resolvedBattle = realtimeCandidate;
          } else {
            // wait up to 3000ms for realtime to populate
            let found = false;
            const start = Date.now();
            while (!found && Date.now() - start < 3000) {
              // eslint-disable-next-line no-await-in-loop
              await new Promise((r) => setTimeout(r, 100));
              const candidate = (battleRealtime as any)?.battle;
              if (candidate) {
                console.log('[BattleView] Using delayed battleRealtime fallback for battle', battleId);
                setBattle(candidate);
                resolvedBattle = candidate;
                found = true;
                break;
              }
            }
            if (!found) {
              // last-resort: try window fallback populated for debugging
              const realtimeFallback = (typeof window !== 'undefined' && (window as any).__battleRealtimeFallback && (window as any).__battleRealtimeFallback[battleId]) || null;
              if (realtimeFallback) {
                console.log('[BattleView] Using window realtime fallback for battle', battleId);
                setBattle(realtimeFallback);
                resolvedBattle = realtimeFallback;
          } else {
            deferError('Battle not found');
            return;
          }
            }
          }
        } else {
          setBattle(battleData);
          resolvedBattle = battleData;
        }

        // From here on, use `resolvedBattle` (it will never be null)
        if (resolvedBattle?.status === 'ended') {
          setShowResults(true);
          setShowRematchOption(true);
        }

        const { data: streams, error: streamsError } = await supabase
          .from('streams')
          .select('*')
          .in('id', [resolvedBattle.challenger_stream_id, resolvedBattle.opponent_stream_id]);
            
        if (streamsError || !streams) {
          deferError('Failed to load battle streams: ' + (streamsError?.message || 'Unknown error'));
          return;
        }

        const cStream = streams.find(s => s.id === resolvedBattle.challenger_stream_id);
        const oStream = streams.find(s => s.id === resolvedBattle.opponent_stream_id);
            
        if (!cStream) {
          deferError('Challenger stream not found or not live.');
          return;
        }
        if (!oStream) {
          deferError('Opponent stream not found or not live.');
          return;
        }
              
         setChallengerStream(cStream);
         setOpponentStream(oStream);

         if (effectiveUserId) {
           const isChallenger = effectiveUserId === cStream.user_id;
           const isOpponent = effectiveUserId === oStream.user_id;
           if (isChallenger || isOpponent) {
             const stream = isChallenger ? cStream : oStream;
             originalBroadcastRef.current = {
               streamId: stream.id,
               roomName: stream.livekit_room_name || stream.id,
               userId: stream.user_id,
             };
             logBattleLifecycle("ORIGINAL_BROADCAST_PRESERVED", originalBroadcastRef.current);
           }
         }

         if (effectiveUserId) {
           const { data: pData, error: pError } = await supabase
             .from('battle_participants')
             .select('*')
             .eq('battle_id', battleId)
             .eq('user_id', effectiveUserId)
             .maybeSingle();
           if (pError) {
             console.error("Error fetching participant data", pError);
           }
           if (pData) {
             setParticipantInfo(pData);
           } else if (effectiveUserId === cStream.user_id) {
             setParticipantInfo({ role: 'host', team: 'challenger' });
           } else if (effectiveUserId === oStream.user_id) {
            setParticipantInfo({ role: 'host', team: 'opponent' });
          } else {
            setParticipantInfo({ role: 'viewer', team: null });
          }
        }

        const { data: participantData } = await supabase
          .from('battle_participants')
          .select('*, profile:user_profiles(id, username, avatar_url, troll_coins, trollmonds)')
          .eq('battle_id', battleId);
        setParticipantSnapshots((participantData as Array<{ user_id: string; role: 'host' | 'stage' | 'viewer' }>) || []);
        setBattleParticipants((participantData as any[]) || []);
      } catch (e) {
        console.error("[BattleView] Initialization error:", e);
        deferError('Failed to initialize battle');
      } finally {
        setLoading(false);
      }
    };
    initBattle();

    // Consolidated battle realtime: replaces 6 separate channels with 1
    // Channels removed: battle:${battleId}, battle_participants:${battleId},
    //   battle_arena:${battleId}, battle_stream_${challengerId},
    //   battle_stream_${opponentId}, battle-sync-gifts:${streamId} (×2)
    return () => {
      clearDeferredError();
      transitionToPhase('IDLE');
      // Clear battle mode flag when leaving battle
      PreflightStore.setInBattle(false);
      preflightSetInBattleRef.current = false;
      if (import.meta.env.DEV) console.log('[BattleView] Set isInBattle = false (cleanup)');
    };
  }, [battleId, transitionToPhase]);

  // Expose realtime battle state on window for debugging/fallback when DB reads fail
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__battleRealtimeFallback = (window as any).__battleRealtimeFallback || {};
    if (battleRealtime?.battle && battleId) {
      (window as any).__battleRealtimeFallback[battleId] = battleRealtime.battle;
    }
  }, [battleRealtime?.battle, battleId]);

  // Sync consolidated realtime state into BattleView state
  useEffect(() => {
    if (!battleRealtime.battle) return;
    clearDeferredError();
    setBattle((prev: any) => {
      // PHASE 2: Avoid unnecessary re-renders — only update if battle data actually changed
      if (!prev) return battleRealtime.battle;
      const keys = ['score_challenger', 'score_opponent', 'status', 'started_at', 'ends_at', 'winner_id', 'sudden_death'];
      const changed = keys.some((k) => (prev as any)[k] !== (battleRealtime.battle as any)[k]);
      return changed ? { ...prev, ...battleRealtime.battle } : prev;
    });
    if (battleRealtime.battle.status === 'ended') {
      setShowResults(true);
    }
  }, [battleRealtime.battle]);

  // If we previously set an immediate 'Battle not found' error, clear it when realtime data appears
  useEffect(() => {
    if (error === 'Battle not found' && (battleRealtime as any)?.battle) {
      console.log('[BattleView] Clearing "Battle not found" error due to realtime data', battleId);
      clearDeferredError();
      setError(null);
      setBattle((battleRealtime as any).battle);
    }
  }, [error, battleRealtime?.battle, battleId]);

  useEffect(() => {
    if (battleRealtime.participants.length > 0) {
      setParticipantSnapshots(battleRealtime.participants);
    }
  }, [battleRealtime.participants]);

  useEffect(() => {
    if (battleRealtime.arenaReady && !arenaReady) {
      setArenaReady(true);
      setArenaReadyAtMs(Date.now());
    }
  }, [battleRealtime.arenaReady]);

  // Pre-battle countdown: show match found overlay during 'starting' phase
  useEffect(() => {
    if (!battle || battle.status !== 'starting') {
      setPreBattleCountdown(null);
      return;
    }

    setPreBattleCountdown(3);

    const timer = setInterval(() => {
      setPreBattleCountdown((prev) => {
        if (prev === null || prev <= 1) {
          setPreBattleCountdown(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [battle?.id, battle?.status]);

  // Arena readiness check
  useEffect(() => {
    if (!battle || battle.status !== 'active' || arenaReady) return;

    const expectedHosts = participantSnapshots.filter((p) => p.role === 'host').map((p) => p.user_id);
    const expectedStages = participantSnapshots.filter((p) => p.role === 'stage').map((p) => p.user_id);

    const loaded = new Set<string>();
    // Current user is considered loaded if they're connected (don't need tracks for mobile)
    if (effectiveUserId) {
      loaded.add(String(effectiveUserId));
    }

    const findUserIdForIdentity = (identity: string): string | null => {
      if (!identity) return null;
      const direct = participantSnapshots.find((p) => p.user_id === identity);
      if (direct) return direct.user_id;
      if (userIdToLiveKitIdentity) {
        for (const [userId, mappedIdentity] of Object.entries(userIdToLiveKitIdentity)) {
          if (mappedIdentity === identity) return userId;
        }
      }
      return null;
    };

    for (const remoteUser of remoteUsers) {
      // Check if user has identity and is connected
      if (!remoteUser.identity) continue;

      const resolvedUserId = findUserIdForIdentity(remoteUser.identity);
      const snapshot = resolvedUserId
        ? participantSnapshots.find((p) => p.user_id === resolvedUserId)
        : null;

      // During connect churn, require host connection but do not hard-block on
      // media publication timing to avoid endless "SYNCING" for one side.
      if (snapshot?.role === 'host') {
        const videoPubs = getTrackPublications(remoteUser, 'video');
        const audioPubs = getTrackPublications(remoteUser, 'audio');
        const hasAnyPublication = Boolean(videoPubs.length || audioPubs.length);
        if (!hasAnyPublication && import.meta.env.DEV) {
          console.log('[BattleView] Host connected without media publications yet:', remoteUser.identity);
        }
      }

      loaded.add(String(resolvedUserId || remoteUser.identity));
    }

    const hostsReady = expectedHosts.length >= 2 && expectedHosts.every((id) => loaded.has(String(id)));
    const stagesReady = expectedStages.every((id) => loaded.has(String(id)));

    if (hostsReady && stagesReady) {
      const nowMs = Date.now();
      setArenaReadyAtMs(nowMs);
      setArenaReady(true);

      if (participantInfo?.role === 'host' && !publishedArenaReadyRef.current) {
        publishedArenaReadyRef.current = true;
        const publishChannel = supabase.channel(`battle_arena:${battleId}`);
        publishChannel.subscribe(async (status) => {
          if (status !== 'SUBSCRIBED') return;
          await publishChannel.send({
            type: 'broadcast',
            event: 'arena_ready',
            payload: { ready_at_ms: nowMs },
          });
          setTimeout(() => {
            supabase.removeChannel(publishChannel);
          }, 500);
        });
      }
    }
  }, [
    battle, arenaReady, participantSnapshots, remoteUsers, effectiveUserId,
    participantInfo?.role, battleId, userIdToLiveKitIdentity,
  ]);




  // Stream updates â€” kept as minimal postgres_changes on streams table
  // (these are per-stream, not per-battle, and are needed for box_count/seat changes)
  // Detect stream end during battle: opposite side wins, forfeiting user goes home
  useEffect(() => {
    if (!challengerStream?.id && !opponentStream?.id) return;
    const channels: ReturnType<typeof supabase.channel>[] = [];
    const streamEndedHandledRef = { challenger: false, opponent: false };

    const handleStreamEnded = async (endedStreamId: string, endedStreamUserId: string, userTeam: 'challenger' | 'opponent') => {
      if (battle?.status !== 'active' || streamEndedHandledRef[userTeam]) return;
      streamEndedHandledRef[userTeam] = true;

      const winnerStreamId = userTeam === 'challenger' ? opponentStream?.id : challengerStream?.id;
      if (!winnerStreamId) return;

      // Award crown to winner
      try {
        await supabase.rpc('end_battle_with_rewards', {
          p_battle_id: battleId,
          p_winner_stream_id: winnerStreamId,
        });
      } catch (e) {
        // Battle may already have been ended by forfeit_random_battle on the loser side.
        // That's OK — the broadcast below is what matters for routing users away from
        // the ended stream, so we intentionally continue instead of blocking here.
        if (import.meta.env.DEV) {
          console.warn('[BattleView] end_battle_with_rewards failed (likely already ended by forfeit):', e);
        }
      }

      const returnChannel = getBattleBroadcastChannel();
      await returnChannel.send({
        type: 'broadcast',
        event: 'return_to_broadcast',
        payload: {
          challengerStreamId: challengerStream?.id,
          opponentStreamId: opponentStream?.id,
          challengerHostId: challengerStream?.user_id,
          opponentHostId: opponentStream?.user_id,
          streamEnded: true,
          winnerStreamId,
        },
      });
      setTimeout(() => supabase.removeChannel(returnChannel), 2000);

      // Navigate forfeiting user to home
      if (userTeam === 'challenger' && participantInfo?.team === 'challenger') {
        navigate('/');
      } else if (userTeam === 'opponent' && participantInfo?.team === 'opponent') {
        navigate('/');
      }
    };

    if (challengerStream?.id) {
      const c = supabase.channel(`battle_stream_${challengerStream.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${challengerStream.id}` },
          (payload) => {
            const newStream = payload.new as Stream;
            setChallengerStream((prev) => prev ? { ...prev, ...newStream } : newStream);
            // Check if challenger stream ended during battle
            if (newStream.status !== 'live' && prevStreamLiveRef.current.challenger && battle?.status === 'active') {
              handleStreamEnded(challengerStream.id, challengerStream.user_id, 'challenger');
            }
            if (newStream.status === 'live') {
              prevStreamLiveRef.current.challenger = true;
            } else {
              prevStreamLiveRef.current.challenger = false;
            }
          }
        )
        .on('broadcast', { event: 'box_count_changed' }, (payload) => {
          const boxData = payload.payload;
          if (boxData && boxData.box_count !== undefined) {
            setChallengerStream((prev) => prev ? { ...prev, box_count: boxData.box_count } : prev);
          }
        })
        .subscribe();
      channels.push(c);
    }

    if (opponentStream?.id) {
      const c = supabase.channel(`battle_stream_${opponentStream.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${opponentStream.id}` },
          (payload) => {
            const newStream = payload.new as Stream;
            setOpponentStream((prev) => prev ? { ...prev, ...newStream } : newStream);
            // Check if opponent stream ended during battle
            if (newStream.status !== 'live' && prevStreamLiveRef.current.opponent && battle?.status === 'active') {
              handleStreamEnded(opponentStream.id, opponentStream.user_id, 'opponent');
            }
            if (newStream.status === 'live') {
              prevStreamLiveRef.current.opponent = true;
            } else {
              prevStreamLiveRef.current.opponent = false;
            }
          }
        )
        .on('broadcast', { event: 'box_count_changed' }, (payload) => {
          const boxData = payload.payload;
          if (boxData && boxData.box_count !== undefined) {
            setOpponentStream((prev) => prev ? { ...prev, box_count: boxData.box_count } : prev);
          }
        })
        .subscribe();
      channels.push(c);
    }

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [challengerStream?.id, opponentStream?.id, battle?.status, battleId]);

  // Fallback poll â€” 15s during active battle, 30s otherwise.
  // Score updates are handled in realtime via useBattleRealtime broadcasts,
  // so this is only a safety net. Keep it infrequent to avoid overwriting
  // optimistic/realtime score updates with stale DB data.
  useEffect(() => {
    if (!battleId) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('battles')
          .select('id, score_challenger, score_opponent, status, started_at, ends_at, winner_id, sudden_death')
          .eq('id', battleId)
          .maybeSingle();
        if (data) {
          setBattle((prev: any) => {
            if (!prev) return data;
            if (
              prev.score_challenger !== data.score_challenger ||
              prev.score_opponent !== data.score_opponent ||
              prev.status !== data.status ||
              prev.started_at !== data.started_at ||
              prev.ends_at !== data.ends_at
            ) {
              return { ...prev, ...data };
            }
            return prev;
          });
        }
      } catch {}
    }, battle?.status === 'active' ? 15000 : 30000);
    return () => clearInterval(interval);
  }, [battleId, battle?.status]);

  // Listen for optimistic score updates from the local gift sender.
  // This makes the score bar and jail bars update instantly for the
  // user who sent the gift, without waiting for any poll or broadcast.
  useEffect(() => {
    if (!battleId) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.battleId !== battleId) return;
      setBattle((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          score_challenger: detail.score_challenger ?? prev.score_challenger,
          score_opponent: detail.score_opponent ?? prev.score_opponent,
        };
      });
    };
    window.addEventListener('battle-score-optimistic', handler);
    return () => window.removeEventListener('battle-score-optimistic', handler);
  }, [battleId]);

  // Aggregate REAL gift coin value credited to each participant from realtime
  // gift_sent events. This is the authoritative per-recipient battle-point
  // contribution shown on mobile participant boxes. Crowns are never used.
  // The team total is still driven by the backend score_challenger/score_opponent.
  useEffect(() => {
    if (!battleId) return;
    const channel = supabase
      .channel(`battle-gift-agg:${battleId}`)
      .on('broadcast', { event: 'gift_sent' }, (payload: any) => {
        const d = payload?.payload?.d || payload?.payload || {};
        const receiverId = d.receiver_id || d.recipient_id;
        const amount =
          typeof d.amount === 'number'
            ? d.amount
            : typeof d.coin_value === 'number'
            ? d.coin_value
            : typeof d.quantity === 'number'
            ? d.quantity
            : 0;
        if (!receiverId || !amount) return;
        setParticipantContributions((prev) => ({
          ...prev,
          [receiverId]: (prev[receiverId] || 0) + amount,
        }));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [battleId]);


  // Timer Logic - 3 minutes with 10 second sudden death
  const [timeLeft, setTimeLeft] = useState<number>(180);
  const [isSuddenDeath, setIsSuddenDeath] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [showRematchOption, setShowRematchOption] = useState(false);

  const handleRematch = useCallback(async () => {
    if (!battle || !user) return;
    
    try {
      const myStreamId = participantInfo?.team === 'opponent' ? opponentStream?.id : challengerStream?.id;
      const { data, error: updateError } = await supabase.rpc('request_random_battle_rematch', {
        p_battle_id: battle.id,
        p_stream_id: myStreamId,
        p_broadcaster_id: user.id,
      });
      
      if (updateError) throw updateError;
      if (!data?.success) throw new Error(data?.message || 'Failed to start rematch');
      
      setTimeLeft(180);
      setIsSuddenDeath(false);
      setHasEnded(false);
      setShowRematchOption(false);
      setArenaReady(true);
      setArenaReadyAtMs(Date.now());
      
      toast.success('Rematch countdown started!');
    } catch (e) {
      console.error('Rematch error:', e);
      toast.error('Failed to start rematch');
    }
  }, [battle, challengerStream?.id, opponentStream?.id, participantInfo?.team, user]);

  const endBattle = useCallback(async (skipConfirmation = false, endReason: BattleEndReason = "manual") => {
    if (!battle || !user) return;
    
    if (!skipConfirmation && !confirm("Are you sure you want to end this battle?")) {
      return;
    }

    try {
      const isRandomQueueBattle = challengerStream?.battle_mode === 'random_queue' || opponentStream?.battle_mode === 'random_queue';
      const { data: endResult, error: endError } = isRandomQueueBattle
        ? await supabase.rpc('finish_random_battle', {
            p_battle_id: battle.id,
            p_end_reason: endReason === 'manual' ? 'timer_expired' : endReason,
          })
        : await supabase.rpc('end_battle_guarded', {
            p_battle_id: battle.id,
          });

      if (endError || !endResult?.success) {
        console.warn('[BattleView] end RPC failed, force-ending battle:', endResult?.message || endError?.message);
        
        await supabase
          .from('battles')
          .update({ 
            status: 'ended',
            ended_at: new Date().toISOString(),
            winner_stream_id: endResult?.winner_stream_id,
            winner_id: endResult?.winner_id
          })
          .eq('id', battle.id);
        
        await supabase
          .from('streams')
          .update({
            is_battle: false,
            battle_id: null,
            battle_mode: 'manual',
            battle_status: 'waiting',
          })
          .eq('battle_id', battle.id);
        
        setBattle((prev: any) => prev ? { ...prev, status: 'ended' } : prev);
        setShowResults(true);
        
        if (endResult?.winner_id === user?.id) {
          await recordBattleWon(battle.id, currentStreamId);
        } else if (endResult?.winner_id !== null) {
          await recordBattleLost(battle.id, currentStreamId);
        }
        
        try {
          await supabase.rpc('distribute_battle_winnings', { p_battle_id: battle.id });
        } catch (payoutErr) {
          console.warn('[BattleView] Payout failed after force-end:', payoutErr);
        }
        
        toast.success('Battle Ended!');
        return;
      }

      if (endResult?.winner_id === user?.id) {
        await recordBattleWon(battle.id, currentStreamId);
      } else if (endResult?.winner_id !== null) {
        await recordBattleLost(battle.id, currentStreamId);
      }

      const { error: payoutError } = await supabase.rpc('distribute_battle_winnings', { p_battle_id: battle.id });
      if (payoutError) toast.error("Battle ended but payout failed.");
      else toast.success(`Battle Ended! Winnings distributed.`);
    } catch (e) {
      console.error('[BattleView] endBattle error:', e);
      try {
        await supabase
          .from('battles')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', battle.id);
        await supabase
          .from('streams')
          .update({
            is_battle: false,
            battle_id: null,
            battle_mode: 'manual',
            battle_status: 'waiting',
          })
          .eq('battle_id', battle.id);
        setBattle((prev: any) => prev ? { ...prev, status: 'ended' } : prev);
        setShowResults(true);
        toast.success('Battle Ended!');
      } catch (fallbackErr) {
        console.error('[BattleView] Force-end fallback failed:', fallbackErr);
      }
    }
  }, [battle, user, challengerStream, opponentStream, recordBattleWon, recordBattleLost, currentStreamId]);

  const [leaveLoading, setLeaveLoading] = useState(false);

  const handleLeaveBattle = useCallback(async () => {
    if (!battle || !user) return;

    if (!confirm('Leave this battle and forfeit?')) {
      return;
    }

    setLeaveLoading(true);
    try {
      setBattle((prev: any) => prev ? { ...prev, status: 'ended' } : prev);
      setShowResults(true);

      const { data: leaveResult, error: leaveError } = await supabase.rpc('leave_battle', {
        p_battle_id: battle.id,
        p_user_id: user.id
      });

      if (leaveError || leaveResult?.success === false) {
        toast.error(leaveResult?.message || leaveError?.message || 'Failed to leave battle');
      } else {
        // CRITICAL: Only clear battle state from the forfeiting user's stream
        // The other broadcaster should remain in their broadcast
        // Use server-returned forfeiting_stream_id, or fallback to participant info
        let forfeitingStreamId = leaveResult?.forfeiting_stream_id;
        if (!forfeitingStreamId) {
          // Determine forfeiting stream from participant info
          const isChallengerTeam = participantInfo?.team === 'challenger';
          forfeitingStreamId = isChallengerTeam ? challengerStream?.id : opponentStream?.id;
        }
        try {
          if (forfeitingStreamId) {
            await supabase.from('streams').update({
              is_battle: false,
              battle_id: null
            }).eq('id', forfeitingStreamId);
            console.log('[BattleView] Cleared battle state from forfeiting stream:', forfeitingStreamId);
          }
        } catch (streamUpdateErr) {
          console.warn('[BattleView] Failed to update stream battle state:', streamUpdateErr);
        }
        
        // Award crowns to the winner (the other broadcaster)
        const winnerStreamId = leaveResult?.winner_stream_id;
        if (winnerStreamId) {
          try {
            const { data: rewardResult } = await supabase.rpc('end_battle_with_rewards', {
              p_battle_id: battle.id,
              p_winner_stream_id: winnerStreamId
            });
            
            if (rewardResult?.success && rewardResult?.crowns_awarded > 0) {
              toast.success(`Winner awarded ${rewardResult.crowns_awarded} crown(s)!`);
            }
          } catch (rewardErr) {
            console.warn('Crown award failed:', rewardErr);
          }
        }
        
        // Distribute winnings
        try {
          await supabase.rpc('distribute_battle_winnings', { p_battle_id: battle.id });
        } catch (payoutErr) {
          console.warn('Payout failed:', payoutErr);
        }
        
        // Update battle state with winner
        setBattle((prev: any) => {
          if (!prev) return prev;
          return { 
            ...prev, 
            status: 'ended', 
            winner_id: winnerStreamId,
            winner_stream_id: winnerStreamId
          };
        });
        
        // Show appropriate message based on who forfeited
        const isChallenger = participantInfo?.team === 'challenger';
        toast.success(isChallenger ? 'You forfeited. Opponent wins!' : 'You forfeited. Challenger wins!');
      }
      
      // FIX: Forfeiting broadcaster should return to their own stream, not the winner's stream
      // Navigate back to the forfeiting broadcaster's own stream so they can continue their broadcast
      // Use /stream/{streamId} route (not /live which redirects to /live)
      if (participantInfo?.team === 'challenger' && challengerStream?.id) {
        navigate(`/stream/${challengerStream.id}`);
      } else if (participantInfo?.team === 'opponent' && opponentStream?.id) {
        navigate(`/stream/${opponentStream.id}`);
      } else if (currentStreamId) {
        // Fallback to original stream
        navigate(`/stream/${currentStreamId}`);
      } else if (onReturnToStream) {
        // Fallback to callback if provided
        onReturnToStream();
      } else {
        // Last resort - navigate to home
        navigate('/');
      }
      
      // Do NOT stop local tracks - they belong to the broadcaster's main stream
      // The tracks should continue working when they return to their stream
      // But DO disconnect the battle room and unpublish battle tracks before navigating
      if (battleRoomRef.current && battleRoomRef.current.state === 'connected') {
        try {
          const localParticipant = battleRoomRef.current.localParticipant;
          const tracks = Array.from(localParticipant.trackPublications.values());
          for (const pub of tracks) {
            try {
              if (pub.track) await localParticipant.unpublishTrack(pub.track);
            } catch (e) {
              // ignore unpublish errors during cleanup
            }
          }
          battleRoomRef.current.disconnect();
        } catch (e) {
          console.warn('[BattleView] Cleanup disconnect error:', e);
        }
        battleRoomRef.current = null;
        connectedBattleIdRef.current = null;
        hasPublishedTracksRef.current = false;
      }
      
      // Just navigate back to the stream without stopping tracks
    } catch (e) {
      console.error(e);
      toast.error('Failed to leave battle');
      if (onReturnToStream) {
        onReturnToStream();
      } else {
        navigate('/');
      }
    } finally {
      setLeaveLoading(false);
    }
  }, [battle, user, battleLocalAudioTrack, battleLocalVideoTrack, livekitRoom, onReturnToStream, navigate, participantInfo?.team, challengerStream?.id, opponentStream?.id, currentStreamId]);

  // ==========================================================================
  // STATE MACHINE: Drive phase transitions from authoritative battle state
  // ==========================================================================

  useEffect(() => {
    if (!battle) return;

    switch (battle.status) {
      case 'active':
        if (battlePhaseRef.current === 'WAITING_FOR_BATTLE' || battlePhaseRef.current === 'INITIALIZING') {
          transitionToPhase('CONNECTING_ARENA');
          joinBattleArena();
        }
        break;
      case 'ended':
        transitionToPhase('ENDED');
        break;
      default:
        break;
    }
  }, [battle?.status, battle?.id, joinBattleArena, transitionToPhase]);

  // ==========================================================================
  // TIMER REFS
  // ==========================================================================
  const hasEndedRef = useRef(false);
  const endBattleRef = useRef(endBattle);
  const participantRoleRef = useRef(participantInfo?.role);
  endBattleRef.current = endBattle;
  participantRoleRef.current = participantInfo?.role;

  // Timer effect - server-authoritative from started_at/ends_at only.
  // Score and role changes do NOT restart this timer.
  useEffect(() => {
    if (!battle?.started_at || battle.status !== 'active') {
      if (battle?.status === 'ended') setHasEnded(true);
      return;
    }

    const interval = setInterval(() => {
      const nowMs = Date.now();
      const startMs = new Date(battle.started_at).getTime();
      const endMs = battle.ends_at
        ? new Date(battle.ends_at).getTime()
        : startMs + MAIN_BATTLE_DURATION_MS;
      const newTimeLeft = Math.max(0, Math.ceil((endMs - nowMs) / 1000));

      // Sudden Death is an authoritative DB state, not a local timer threshold.
      const isSDActive = battle.sudden_death === true;
      const displayTimeLeft = isSDActive ? newTimeLeft : newTimeLeft;
      const displaySuddenDeath = isSDActive;

      setTimeLeft(displayTimeLeft);
      setIsSuddenDeath(displaySuddenDeath);

      if (newTimeLeft <= 0 && !hasEndedRef.current) {
        hasEndedRef.current = true;
        setHasEnded(true);
        if (participantRoleRef.current === 'host') {
          setShowRematchOption(true);
        }
        void endBattleRef.current(true, displaySuddenDeath ? 'sudden_death' : 'timer_expired');
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [battle?.ends_at, battle?.started_at, battle?.status, battle?.sudden_death]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Handle troll opponent
  const handleTrollOpponent = async (targetStreamId: string) => {
    if (!battle || !user) return;

    try {
      const { data, error } = await supabase.rpc('troll_opponent', {
        p_battle_id: battle.id,
        p_troller_id: user.id,
        p_target_stream_id: targetStreamId
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data?.success) {
        toast.success(`Trolled opponent! Deducted ${data.deduction} coins`);
      } else {
        toast.error(data?.message || 'Troll failed');
      }
    } catch (e) {
      console.error('Troll error:', e);
      toast.error('Failed to troll opponent');
    }
  };

  const navigateBackToOwnBroadcast = useCallback(() => {
    const isChallengerHost = effectiveUserId && challengerStream?.user_id && effectiveUserId === challengerStream.user_id;
    const isOpponentHost = effectiveUserId && opponentStream?.user_id && effectiveUserId === opponentStream.user_id;

    if ((participantInfo?.team === 'challenger' || isChallengerHost) && challengerStream?.id) {
      navigate(`/stream/${challengerStream.id}`);
      return;
    }
    if ((participantInfo?.team === 'opponent' || isOpponentHost) && opponentStream?.id) {
      navigate(`/stream/${opponentStream.id}`);
      return;
    }
    if (currentStreamId) {
      navigate(`/stream/${currentStreamId}`);
      return;
    }
    if (onReturnToStream) {
      onReturnToStream();
      return;
    }
    navigate('/');
  }, [
    effectiveUserId,
    participantInfo?.team,
    challengerStream?.id,
    challengerStream?.user_id,
    opponentStream?.id,
    opponentStream?.user_id,
    currentStreamId,
    onReturnToStream,
    navigate,
  ]);

  // History-aware Back button: return to previous page when history is usable,
  // otherwise fall back to the broadcasts / city-center route. Does NOT trigger
  // battle cleanup early â€” cleanup runs on unmount via the existing effects.
  const handleBack = useCallback(() => {
    try {
      const state = window.history.state as { idx?: number } | null;
      if (window.history.length > 1 && state && typeof state.idx === 'number' && state.idx > 0) {
        navigate(-1);
        return;
      }
    } catch {
      /* fall through to default */
    }
    navigate('/broadcasts');
  }, [navigate]);

  // Navigate into another live battle (safe switch: BattleView remounts via key,
  // running full LiveKit / presence / subscription cleanup for the old battle).
  const handleSelectBattle = useCallback(
    (b: ActiveBattle) => {
      if (!b.challenger_stream_id) return;
      navigate(`/watch/${b.challenger_stream_id}`);
    },
    [navigate]
  );

  const handleNextBattle = useCallback(
    (dir: 1 | -1 = 1) => {
      if (activeBattles.length === 0) return;
      const idx = activeBattles.findIndex((b) => b.id === battleId);
      const nextIdx = idx === -1 ? 0 : (idx + dir + activeBattles.length) % activeBattles.length;
      const next = activeBattles[nextIdx];
      if (next && next.id !== battleId && next.challenger_stream_id) {
        navigate(`/watch/${next.challenger_stream_id}`);
      }
    },
    [activeBattles, battleId, navigate]
  );

  // Return to stream handler - returns each broadcaster to their own stream
  // Also broadcasts to all participants to return to their respective broadcasts
  const handleReturnToStream = useCallback(async () => {
    if (hasHandledReturnRef.current) return;
    hasHandledReturnRef.current = true;
    setShowResults(false);
    setShowRematchOption(false);

    // Only disconnect the battle LiveKit room and unpublish tracks
    // Do NOT stop/close local tracks - they belong to the broadcaster's main stream
    // and are shared with BroadcastPage. Closing them here would kill the camera.
    if (livekitRoom) {
      try {
        const localParticipant = livekitRoom.localParticipant;
        const tracks = Array.from(localParticipant.trackPublications.values());
        for (const pub of tracks) {
          try {
            if (pub.track) await localParticipant.unpublishTrack(pub.track);
          } catch (e) {
            // ignore unpublish errors during cleanup
          }
        }
        livekitRoom.disconnect();
      } catch (e) {
        console.warn('[BattleView] Cleanup disconnect error:', e);
      }
    }
    
    // Broadcast to all participants to return to their broadcasts
    try {
      const returnChannel = getBattleBroadcastChannel();
      await returnChannel.send({
        type: 'broadcast',
        event: 'return_to_broadcast',
        payload: {
          challengerStreamId: challengerStream?.id,
          opponentStreamId: opponentStream?.id,
          challengerHostId: challengerStream?.user_id,
          opponentHostId: opponentStream?.user_id
        }
      });
    } catch (e) {
      console.warn('[BattleView] Failed to broadcast return event:', e);
    }

    navigateBackToOwnBroadcast();
    onReturnToStream?.();
  }, [battleLocalAudioTrack, battleLocalVideoTrack, livekitRoom, battleId, challengerStream?.id, challengerStream?.user_id, opponentStream?.id, opponentStream?.user_id, navigateBackToOwnBroadcast, onReturnToStream]);

  // React to battle-level "return_to_broadcast" broadcast from either broadcaster.
  // When streamEnded is true, the user on the ended stream goes home, winner goes to broadcast
  useEffect(() => {
    if (!battleId) return;
    const ch = getBattleBroadcastChannel()
      .on('broadcast', { event: 'return_to_broadcast' }, (payload) => {
        if (hasHandledReturnRef.current) return;
        hasHandledReturnRef.current = true;
        setShowResults(false);
        setShowRematchOption(false);
        
        const data = payload.payload;
        const winnerStreamId = data?.winnerStreamId;
        
        if (data?.streamEnded) {
          const currentUserOnChallenger = participantInfo?.team === 'challenger';
          const currentUserOnOpponent = participantInfo?.team === 'opponent';
          
          if ((currentUserOnChallenger && winnerStreamId === opponentStream?.id) ||
              (currentUserOnOpponent && winnerStreamId === challengerStream?.id)) {
            navigate('/');
            onReturnToStream?.();
            return;
          }
          if (winnerStreamId) {
            navigate(`/stream/${winnerStreamId}`);
            onReturnToStream?.();
            return;
          }
          navigate('/');
          onReturnToStream?.();
        } else {
          navigateBackToOwnBroadcast();
          onReturnToStream?.();
        }
      })
      .subscribe();
    return () => {
      // Don't remove shared channel here; it may be reused by other code paths.
      // Supabase deduplicates by topic, so unsubscribing this listener is sufficient.
    };
  }, [battleId, navigateBackToOwnBroadcast, onReturnToStream, participantInfo?.team, opponentStream?.id, challengerStream?.id, navigate]);

  // Guarantee end screen appears whenever server battle row is ended.
  useEffect(() => {
    if (battle?.status === 'ended') {
      setShowResults(true);
    }
  }, [battle?.status]);

  // Auto-return after battle ends - show results briefly then return everyone
  // to their original broadcast. Broadcasters go to THEIR OWN original room,
  // not the opponent's room.
  useEffect(() => {
    if (showResults && battle?.status === 'ended') {
      const timer = setTimeout(() => {
        returnToOriginalBroadcast();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showResults, battle?.status, returnToOriginalBroadcast]);

  // ── DEBUG: User lookup logging (throttled, in useEffect to avoid render body side effects) ──
  const lastUserLookupLogRef = useRef(0);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const now = Date.now();
    if (now - lastUserLookupLogRef.current < 2000) return;
    lastUserLookupLogRef.current = now;
    console.log('[BattleView] User lookup - challenger stream:', challengerStream?.user_id?.substring(0, 8), '-> livekit identity:', challengerLiveKitIdentity);
    console.log('[BattleView] User lookup - opponent stream:', opponentStream?.user_id?.substring(0, 8), '-> livekit identity:', opponentLiveKitIdentity);
    console.log('[BattleView] Battle remoteUsers count:', remoteUsers?.length || 0);
    console.log('[BattleView] Local videoTrack:', !!battleLocalVideoTrack);
  }, [challengerLiveKitIdentity, opponentLiveKitIdentity, remoteUsers.length, battleLocalVideoTrack]);

  // Diagnostic logging: room participants and their video track SIDs
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (remoteUsers.length === 0) return;
    const trackMap: Record<string, string[]> = {};
    for (const u of remoteUsers) {
      const videoPubs = getTrackPublications(u, 'video');
      const sids = videoPubs.filter((p: any) => p.track).map((p: any) => p.track.sid || p.trackSid);
      trackMap[u.identity] = sids;
    }
    console.log('[BattleView] Room participant video track SIDs:', trackMap);
  }, [remoteUsers, battleTick, trackRevision]);

  const findRemoteByIdentity = (targetIdentity: string, expectedUserId?: string) => {
    if (!targetIdentity || !remoteUsers) return null;
    
    const normalizedTarget = String(targetIdentity).replace(/-/g, '').toLowerCase();
    
    return remoteUsers.find((u) => {
      const id = String(u.identity || '');
      const normalized = id.replace(/-/g, '').toLowerCase();
      
      // Strict identity match
      if (id === targetIdentity || normalized === normalizedTarget) {
        if (expectedUserId && u.metadata) {
          try {
            const metadata = typeof u.metadata === 'string' ? JSON.parse(u.metadata) : u.metadata;
            const metadataUserId = metadata.user_id || metadata.userId;
            if (metadataUserId && metadataUserId !== expectedUserId) {
              return false;
            }
          } catch {
            // ignore metadata parse errors
          }
        }
        return true;
      }
      
      // Match by metadata user_id if identity doesn't match
      if (expectedUserId && u.metadata) {
        try {
          const metadata = typeof u.metadata === 'string' ? JSON.parse(u.metadata) : u.metadata;
          const metadataUserId = metadata.user_id || metadata.userId;
          if (metadataUserId === expectedUserId) {
            return true;
          }
        } catch {
          // ignore
        }
      }
      
      return false;
    });
  };

  const resolveBoxUser = (streamUser: string | null | undefined, liveKitIdentity: string | undefined, isLocalBroadcaster: boolean) => {
    if (isLocalBroadcaster) {
      return { videoTrack: battleLocalVideoTrack, audioTrack: battleLocalAudioTrack, isLocal: true };
    }
    if (!streamUser || !liveKitIdentity) return null;
    return findRemoteByIdentity(liveKitIdentity, streamUser);
  };

  const isChallengerBroadcaster = challengerStream ? effectiveUserId === challengerStream.user_id : false;
  const isOpponentBroadcaster = opponentStream ? effectiveUserId === opponentStream.user_id : false;

  // Guard against both sides resolving to the LOCAL track. This happens when the
  // two battle streams belong to the same account (e.g. same-account testing, or
  // a self-match) — then effectiveUserId equals BOTH host ids and every box
  // would show the local camera. We only ever treat ONE side as local: the side
  // whose host id matches, preferring challenger when both match.
  const sameHostBothSides =
    !!challengerStream?.user_id &&
    challengerStream?.user_id === opponentStream?.user_id;
  const localIsChallenger = isChallengerBroadcaster;
  const localIsOpponent = isOpponentBroadcaster && !(sameHostBothSides && localIsChallenger);

  const challengerUser = resolveBoxUser(challengerStream?.user_id, challengerLiveKitIdentity, localIsChallenger);
  let opponentUser = resolveBoxUser(opponentStream?.user_id, opponentLiveKitIdentity, localIsOpponent);

  // Final safety net: never render the SAME participant/track in both boxes.
  // If the opponent resolved to the same identity as the challenger (identity
  // mapping churn, echoed local track, etc.), drop it so the box shows a
  // "waiting for opponent" state instead of duplicating the challenger.
  const challengerResolvedId =
    (challengerUser as any)?.identity ||
    (challengerUser && (challengerUser as any).isLocal ? `local:${effectiveUserId}` : null);
  const opponentResolvedId =
    (opponentUser as any)?.identity ||
    (opponentUser && (opponentUser as any).isLocal ? `local:${effectiveUserId}` : null);
  if (challengerResolvedId && opponentResolvedId && challengerResolvedId === opponentResolvedId) {
    console.warn('[BattleView] Prevented duplicate participant in both battle boxes:', challengerResolvedId);
    opponentUser = null;
  }

  if (import.meta.env.DEV) {
    const challengerIdentity = (challengerUser as any)?.identity;
    const opponentIdentity = (opponentUser as any)?.identity;
    if (challengerIdentity && opponentIdentity && challengerIdentity === opponentIdentity) {
      console.warn('[BattleView] ⚠️ SAME participant resolved for BOTH boxes:', challengerIdentity);
    }
  }

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const snapshot = JSON.stringify({
      battleId,
      challengerStreamUserId: challengerStream?.user_id,
      opponentStreamUserId: opponentStream?.user_id,
      challengerLiveKitIdentity,
      opponentLiveKitIdentity,
      challengerResolved: challengerUser ? (challengerUser as any).identity || 'local' : 'null',
      opponentResolved: opponentUser ? (opponentUser as any).identity || 'local' : 'null',
      remoteCount: remoteUsers?.length || 0,
    });

    if (lastBoxResolutionLogRef.current === snapshot) return;
    lastBoxResolutionLogRef.current = snapshot;

    console.log('[BattleView] Box resolution:', {
      battleId,
      challengerStreamUserId: challengerStream?.user_id?.substring(0, 8),
      opponentStreamUserId: opponentStream?.user_id?.substring(0, 8),
      challengerLiveKitIdentity,
      opponentLiveKitIdentity,
      challengerResolved: challengerUser ? (challengerUser as any).identity || 'local' : 'null',
      opponentResolved: opponentUser ? (opponentUser as any).identity || 'local' : 'null',
      remoteCount: remoteUsers?.length || 0,
    });
  }, [
    battleId,
    challengerStream?.user_id,
    opponentStream?.user_id,
    challengerLiveKitIdentity,
    opponentLiveKitIdentity,
    challengerUser,
    opponentUser,
    remoteUsers?.length,
  ]);

  // Desktop keyboard navigation to the next/previous live battle.
  // Switching battles navigates to the other battle's stream, which remounts
  // BattleView (keyed by battleId) â€” the existing unmount effects tear down the
  // LiveKit room, audience presence, and all realtime subscriptions safely.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const tag = (el?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || el?.isContentEditable) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextBattle(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNextBattle(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNextBattle]);

  // ── Derived scoring (POINTS, not crowns) ──────────────────────────────
  // Authoritative team point totals come from the backend battle row
  // (score_challenger / score_opponent). Crowns are a separate, non-winning
  // reward and must NEVER be used to decide the winner.
  const bluePoints = battle?.score_challenger || 0;
  const redPoints = battle?.score_opponent || 0;

  const blueTeam = useMemo(
    () => battleParticipants.filter((p: any) => p.team === 'challenger'),
    [battleParticipants]
  );
  const redTeam = useMemo(
    () => battleParticipants.filter((p: any) => p.team === 'opponent'),
    [battleParticipants]
  );

  const goBackToBroadcast = navigateBackToOwnBroadcast;
  const switchBattle = handleSelectBattle;
  const openGiftPicker = handleGiftSelect;
  const selectedGiftRecipient = giftRecipientId
    ? { id: giftRecipientId, streamId: giftStreamId || currentStreamId }
    : null;
  const setSelectedGiftRecipient = (r: { id: string; streamId: string } | null) => {
    setGiftRecipientId(r?.id ?? null);
    setGiftStreamId(r?.streamId ?? null);
    setShowMobileGiftTray(!!r);
  };

  const shareBroadcast = useCallback(() => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = `${challengerStream?.title || 'Blue'} vs ${opponentStream?.title || 'Red'} Battle`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() => toast.success('Battle link copied'))
        .catch(() => {});
    }
  }, [challengerStream?.title, opponentStream?.title]);

  const followBroadcaster = useCallback(async () => {
    const targetId = challengerStream?.user_id;
    if (!targetId) return;
    if (!user) {
      toast.info('Sign in to follow this streamer');
      navigate('/auth');
      return;
    }
    if (targetId === user.id) {
      toast.info("You can't follow yourself");
      return;
    }

    try {
      const { data: existing } = await supabase
        .from('user_follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', targetId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetId);
        if (!error) toast.success(`Unfollowed ${challengerStream?.title || 'streamer'}`);
      } else {
        const { error } = await supabase
          .from('user_follows')
          .insert({ follower_id: user.id, following_id: targetId });
        if (!error) toast.success(`Following ${challengerStream?.title || 'streamer'}`);
      }
    } catch {
      toast.error('Follow action failed');
    }
  }, [challengerStream?.user_id, challengerStream?.title, user, navigate]);

  // BattleChat manages its own input/send pipeline; exposed for interface parity.
  const sendMessage = useCallback(() => {}, []);

  return {
    // ── Shared battle controller contract ──
    battle,
    blueTeam,
    redTeam,
    bluePoints,
    redPoints,
    remainingTime: timeLeft,
    battleStatus: battle?.status,
    isSuddenDeath,
    messages: undefined,
    viewerCount: participantSnapshots?.length || 0,
    activeBattles,
    selectedGiftRecipient,
    setSelectedGiftRecipient,
    openGiftPicker,
    sendMessage,
    goBackToBroadcast,
    switchBattle,
    followBroadcaster,
    shareBroadcast,

    // ── Extra state/derived consumed by the layouts ──
    loading,
    error,
    showResults,
    showRematchOption,
    timeLeft,
    participantInfo,
    challengerStream,
    opponentStream,
    participantSnapshots,
    battleParticipants,
    participantContributions,
    battleLocalAudioTrack,
    battleLocalVideoTrack,
    isCameraEnabled,
    isMicEnabled,
    remoteUsers,
    trackRevision,
    challengerCrownInfo,
    opponentCrownInfo,
    connectionStatus,
    giftRecipientId,
    giftStreamId,
    currentStreamId,
    showMobileChat,
    setShowMobileChat,
    showMobileGiftTray,
    setShowMobileGiftTray,
    isMobileViewport,
    profile,
    userIdToLiveKitIdentity,
    effectiveUserId,
    isBroadcaster,
    isRandomBattle,
    resolvedBattleRole,
    challengerLiveKitIdentity,
    opponentLiveKitIdentity,
    touchStartRef,
    arenaReady,
    activeBattlesLoading,
    battleId,
    formatTime,
    preBattleCountdown,

    // ── Actions ──
    handleGiftSelect,
    setGiftRecipientId,
    setGiftStreamId,
    setTeamBoxCount,
    handleTrollOpponent,
    handleBack,
    handleSelectBattle,
    handleNextBattle,
    handleReturnToStream,
    handleRematch,
    handleLeaveBattle,
    leaveLoading,
    navigateBackToOwnBroadcast,
    onReturnToStream,
    onToggleCamera,
    onToggleMic,
  };
}

export type BattleViewController = ReturnType<typeof useBattleViewController>;

