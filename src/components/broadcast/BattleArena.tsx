import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { Room, LocalAudioTrack, LocalVideoTrack, RemoteParticipant, RemoteTrack, RemoteVideoTrack, RemoteAudioTrack, RemoteTrackPublication, RoomEvent, Track } from 'livekit-client';

import { supabase } from '../../lib/supabase';
import { Stream } from '../../types/broadcast';
import { useAuthStore } from '../../lib/store';
import { PreflightStore } from '../../lib/preflightStore';
import { Loader2, Coins, User, MicOff, VideoOff, Mic, Video, Plus, Minus, Crown, Flame, Skull, X, Gift } from 'lucide-react';
import { useCoins } from '../../lib/hooks/useCoins';
import useTrollFamilyActivity from '../../hooks/useTrollFamilyActivity';
import { useBattleRealtime } from '../../hooks/useBattleRealtime';
import { logActiveChannels } from '../../lib/realtimeChannelDiagnostics';
import { useIsMobile } from '../../hooks/useIsMobile';
import FeedTheTroll from '../feed-the-troll/FeedTheTroll';
import BattleChat from './BattleChat';
import MuteHandler from './MuteHandler';
import GiftTray from './GiftTray';
import ActiveBattlesPanel, { useActiveBattles, ActiveBattle } from './battle/ActiveBattlesPanel';
import BattleScoreboard from './battle/BattleScoreboard';
import BattleBottomBar from './battle/BattleBottomBar';
import BattleActivityFeed from './battle/BattleActivityFeed';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { BattleSounds } from '../../lib/battleSounds';
import { useJailTime } from '../../hooks/useJailTime';
import JailBarOverlay from './JailBarOverlay';

// --- Safe Helper Functions ---
export function safeValues<T>(mapLike: Map<any, T> | undefined | null): T[] {
  if (!mapLike || typeof mapLike.values !== 'function') return [];
  try {
    return Array.from(mapLike.values());
  } catch (e) {
    console.warn('[BattleView] safeValues failed:', e);
    return [];
  }
}

export function safeObjectValues<T>(obj: Record<string, T> | undefined | null): T[] {
  if (!obj || typeof obj !== 'object') return [];
  try {
    return Object.values(obj);
  } catch (e) {
    console.warn('[BattleView] safeObjectValues failed:', e);
    return [];
  }
}

// --- Logging Helpers ---
const logBroadcastLifecycle = (message: string, data?: any) => {
  console.log(`[BroadcastLifecycle] ${message}`, data || '');
};

const logRealtime = (message: string, data?: any) => {
  console.log(`[Realtime] ${message}`, data || '');
};

const logParticipants = (message: string, data?: any) => {
  console.log(`[Participants] ${message}`, data || '');
};

const logRTC = (message: string, data?: any) => {
  console.log(`[RTC] ${message}`, data || '');
};

// --- Sub-components for the new architecture ---



const BattleAudioTrackPlayer = ({
  audioTrack,
  label,
}: {
  audioTrack: LocalAudioTrack | RemoteAudioTrack;
  label: string;
}) => {
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  useEffect(() => {
    if (!audioTrack) return;

    let audioElement: HTMLAudioElement | null = null;
    let mounted = true;

    const tryPlay = (reason: string) => {
      if (!audioElement || !mounted) return;
      audioElement.play().then(() => {
        if (import.meta.env.DEV) {
          console.log('[BattleAudio] Audio element playing', { label, reason });
        }
        setAudioEnabled(true);
        setAudioBlocked(false);
      }).catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('[BattleAudio] Audio play blocked', { label, reason, err: String(err) });
        }
        setAudioBlocked(true);
        setAudioEnabled(false);
      });
    };

    const unlockAudio = () => {
      setAudioBlocked(false);
      tryPlay('user-interaction');
    };

    try {
      audioElement = audioTrack.attach() as HTMLAudioElement;
      audioElement.autoplay = true;
      audioElement.muted = false;
      audioElement.volume = 1;
      (audioElement as any).playsInline = true;
      audioElement.setAttribute('playsinline', 'true');
      audioElement.setAttribute('webkit-playsinline', 'true');
      audioElement.style.display = 'none';
      document.body.appendChild(audioElement);

      if (import.meta.env.DEV) {
        console.log('[BattleAudio] Remote audio attached', {
          label,
          trackSid: (audioTrack as any)?.sid,
          enabled: (audioTrack as any)?.enabled,
        });
      }

      tryPlay('initial');
      document.addEventListener('pointerdown', unlockAudio, { once: true });
      document.addEventListener('touchstart', unlockAudio, { once: true });
      document.addEventListener('keydown', unlockAudio, { once: true });
    } catch (err) {
      console.error('[BattleAudio] Failed to attach remote audio track:', label, err);
    }

    return () => {
      mounted = false;
      document.removeEventListener('pointerdown', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      if (audioElement) {
        try {
          audioTrack.detach(audioElement);
        } catch (err) {
          console.warn('[BattleAudio] Failed detaching remote audio element:', err);
        }
        try {
          audioElement.remove();
        } catch (_err) {}
      }
    };
  }, [audioTrack, label]);

  // Mobile audio unlock button
  if (audioBlocked) {
    return (
      <button
        onClick={() => {
          setAudioBlocked(false);
          // Trigger audio unlock
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          if (audioContext.state === 'suspended') {
            audioContext.resume();
          }
        }}
        className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white px-4 py-2 rounded-full font-bold shadow-lg border border-purple-400/50 md:hidden"
      >
        ðŸ”Š Tap to enable battle audio
      </button>
    );
  }

  return null;
};

const BattleAudioRenderer = ({
  entries,
}: {
  entries: Array<{ key: string; label: string; audioTrack: LocalAudioTrack | RemoteAudioTrack }>;
}) => {
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    return () => {
      for (const entry of entriesRef.current) {
        try {
          entry.audioTrack.detach();
        } catch (e) {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[BattleAudio] Renderer entries updated', {
        count: entries.length,
        entries: entries.map((e) => ({ key: e.key, label: e.label, trackSid: (e.audioTrack as any)?.sid })),
      });
    }
  }, [entries]);

  return (
    <>
      {entries.map((entry) => (
        <BattleAudioTrackPlayer
          key={entry.key}
          audioTrack={entry.audioTrack}
          label={entry.label}
        />
      ))}
    </>
  );
};

export interface BattleParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  videoTrack?: LocalVideoTrack | RemoteVideoTrack;
  audioTrack?: LocalAudioTrack | RemoteAudioTrack;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  metadata: any;
  role?: 'host' | 'stage' | 'viewer';
  team?: 'challenger' | 'opponent';
  sourceStreamId?: string;
  seatIndex?: number;
  profile?: any;
  trollCoins?: number;
  trollmonds?: number;
}

export interface CrownInfo {
  crowns: number;
  streak: number;
  hasStreak: boolean;
}

export const safeParseMetadata = (raw: unknown, context: string): Record<string, any> => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`[BattleView] Failed to parse metadata for ${context}:`, raw, e);
      return {};
    }
  }
  return {};
};

export const getTrackPublications = (
  participant: RemoteParticipant,
  kind: 'video' | 'audio'
): RemoteTrackPublication[] => {
  const sourceMaps = kind === 'video'
    ? [
        (participant as any).videoTrackPublications,
        (participant as any).videoTracks,
      ]
    : [
        (participant as any).audioTrackPublications,
        (participant as any).audioTracks,
      ];

  for (const mapLike of sourceMaps) {
    if (!mapLike?.values) continue;

    const entries = safeValues(mapLike) as any[];
    if (entries.length === 0) continue;

    const normalized = entries.map((entry) => {
      if (entry && typeof entry.track === 'undefined' && typeof entry.attach === 'function') {
        return {
          track: entry,
          isSubscribed: (entry as any).isSubscribed ?? true,
          kind: (entry as any).kind,
          source: (entry as any).source,
          // FIX 4: Support both sid and trackSid to handle undefined sid cases
          sid: (entry as any).sid ?? (entry as any).trackSid ?? '',
          trackSid: (entry as any).sid ?? (entry as any).trackSid ?? '',
        };
      }
      return entry;
    }) as RemoteTrackPublication[];

    return normalized.filter((p) => (kind === 'video' ? p.kind === Track.Kind.Video : p.kind === Track.Kind.Audio));
  }

  const all = safeValues((participant as any).trackPublications) as RemoteTrackPublication[];

  // FIX 4: More robust filtering that handles both kind and track.kind
  return all.filter((p) => {
    if (kind === 'video') {
      return p.kind === Track.Kind.Video || p.track?.kind === Track.Kind.Video;
    }
    return p.kind === Track.Kind.Audio || p.track?.kind === Track.Kind.Audio;
  });
};

// Extended props for BattleParticipantTile.
// Battle rule:
// - publishers (host/stage) render LiveKit tracks
// - viewers also render LiveKit tracks only
// - the tile itself must stay clickable for gifts/mod actions
interface BattleParticipantTileProps extends BattleParticipant {
  side: 'challenger' | 'opponent';
  crownInfo?: CrownInfo;
  isSuddenDeath?: boolean;
  onTroll?: () => void;
  canTroll?: boolean;
  onTileClick?: () => void;
  isSingleHost?: boolean;
  /** State battle: state code to display (e.g. "CA") */
  stateCode?: string | null;
  /** State battle: state name to display (e.g. "California") */
  stateName?: string | null;
  /** State battle: total battle points for this state */
  statePoints?: number | null;
  /** Whether this is a state battle */
  isStateBattle?: boolean;
  /** Callback to toggle camera for this participant */
  onToggleCamera?: () => void;
  /** Callback to toggle mic for this participant */
  onToggleMic?: () => void;
  /** Whether camera toggle is available */
  canToggleCamera?: boolean;
  /** Whether mic toggle is available */
  canToggleMic?: boolean;
}

export const BattleVideoRenderer = ({
  videoTrack,
  isHost = false,
}: {
  videoTrack?: LocalVideoTrack | RemoteVideoTrack;
  isHost?: boolean;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoTrack || !containerRef.current) return;
    const currentTrackId = videoTrack.sid || (videoTrack as any).id;
    if (currentTrackId && videoRef.current) {
      return;
    }
    const existingVideoElement = containerRef.current.querySelector('video');
    if (existingVideoElement) {
      try {
        if (videoRef.current) {
          videoTrack.detach(videoRef.current);
        }
      } catch (e) {
        console.warn('[BattleVideoRenderer] Failed to detach existing video element:', e);
      }
      existingVideoElement.remove();
      videoRef.current = null;
    }
    try {
      const videoElement = videoTrack.attach() as HTMLVideoElement;
      videoRef.current = videoElement;
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.objectFit = 'cover';
      videoElement.style.display = 'block';
      videoElement.style.backgroundColor = 'black';
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement.controls = false;
      (videoElement as any).disablePictureInPicture = true;
      videoElement.muted = true;
      containerRef.current.appendChild(videoElement);
      const mediaTrack = videoTrack?.mediaStreamTrack;
      const trackSettings = mediaTrack ? (mediaTrack.getSettings?.() || {}) : {};
      const isFrontCamera = (trackSettings as any).facingMode !== 'environment';
      if (containerRef.current) {
        containerRef.current.style.transform = isFrontCamera ? 'scaleX(-1)' : '';
      }
    } catch (err) {
      console.error('[BattleVideoRenderer] attach() threw error:', err);
    }
  }, [videoTrack]);

  if (!videoTrack) {
    if (isHost) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-2 text-white/70">
            <VideoOff size={32} className="animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">Reconnecting...</span>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-0 object-cover overflow-hidden"
      style={{ minWidth: '100%', minHeight: '100%' }}
    />
  );
};

const BattleParticipantTile = ({
  identity,
  name,
  isLocal,
  videoTrack,
  isMicrophoneEnabled,
  isCameraEnabled,
  metadata,
  role,
  side,
  crownInfo,
  isSuddenDeath,
  onTroll,
  canTroll,
  onTileClick,
  isSingleHost = false,
  stateCode = null,
  stateName = null,
  statePoints = null,
  isStateBattle = false,
  onToggleCamera,
  onToggleMic,
  canToggleCamera = false,
  canToggleMic = false,
}: BattleParticipantTileProps) => {
  const isHost = role === 'host' || metadata?.role === 'host';
  const micMuted = !isMicrophoneEnabled;

  const handleTileClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onTileClick) return;
    if ((e.target as HTMLElement).closest('button')) return;
    onTileClick();
  };

  const handleTileKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onTileClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTileClick();
    }
  };

  const lastTileLogRef = useRef(0);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const now = Date.now();
    if (now - lastTileLogRef.current < 3000) return;
    lastTileLogRef.current = now;
    console.log('[BattleParticipantTile] Rendering:', {
      identity,
      name,
      isHost,
      isSingleHost,
      hasLiveKitVideo: !!videoTrack,
      side,
      isLocal,
      videoTrackSid: videoTrack?.sid,
    });
  }, [identity, isSingleHost, isHost, name, side, videoTrack]);

  const containerClass = isSingleHost
    ? `relative w-full aspect-video md:h-full min-h-0 rounded-2xl overflow-hidden bg-black transition-all duration-300`
    : `relative w-full aspect-video md:aspect-video md:h-full min-h-0 rounded-2xl overflow-hidden border-2 transition-all duration-300 ${side === 'challenger' ? 'border-emerald-400/70 shadow-[0_0_22px_rgba(16,185,129,0.24)]' : 'border-fuchsia-500/60 shadow-[0_0_22px_rgba(192,38,211,0.24)]'} bg-black`;

  return (
    <div
      className={cn(containerClass, onTileClick ? 'cursor-pointer touch-manipulation active:scale-[0.99]' : '')}
      onClick={handleTileClick}
      onKeyDown={handleTileKeyDown}
      role={onTileClick ? 'button' : undefined}
      tabIndex={onTileClick ? 0 : undefined}
    >
      {/* Video or Avatar.
          Critical: the actual video layer is pointer-events-none so mobile taps hit the tile.
          Video is rendered through LiveKit track attachment only. */}
      <div className="absolute inset-0 pointer-events-none">
        <BattleVideoRenderer
          videoTrack={videoTrack}
          isHost={isHost}
        />
      </div>

      {isHost && crownInfo && crownInfo.crowns > 0 && (
        <div className="absolute -top-1 -right-1 z-20 pointer-events-none">
          <div className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold shadow-lg',
            crownInfo.hasStreak
              ? 'bg-gradient-to-r from-yellow-300 to-amber-500 text-black animate-pulse'
              : 'bg-gradient-to-r from-amber-500 to-yellow-600 text-black'
          )}>
            <Crown size={12} className="fill-black" />
            <span>{crownInfo.crowns}</span>
            {crownInfo.hasStreak && <Flame size={12} className="ml-0.5 fill-black" />}
          </div>
        </div>
      )}

      {isHost && crownInfo?.hasStreak && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <motion.div
            initial={{ scale: 0, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1"
          >
            <Flame size={12} className="fill-white" />
            <span>{crownInfo.streak} WIN STREAK!</span>
          </motion.div>
        </div>
      )}

      {isHost && isSuddenDeath && canTroll && onTroll && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            onTroll();
          }}
          className="absolute bottom-2 right-2 z-30 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white p-2 rounded-full shadow-lg border-2 border-white/20"
          title="Troll Opponent"
        >
          <Skull size={18} />
        </motion.button>
      )}

      <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-20 pointer-events-none">
        <div className={cn(
          'flex items-center gap-2 backdrop-blur-md px-2 py-1 rounded-full border',
          isHost ? 'bg-cyan-400/15 border-cyan-300/40' : 'bg-black/60 border-white/10'
        )}>
          <span className={cn('text-xs font-bold', isHost ? 'text-cyan-200' : 'text-white')}>
            {name || 'Anonymous'}
          </span>
          {isHost && (
            <span className="text-[8px] bg-gradient-to-r from-cyan-300 to-fuchsia-300 text-black px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              HOST
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
           {/* Camera toggle button â€” show for current user (self-toggle) or remote participants */}
           {canToggleCamera && onToggleCamera && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleCamera(); }}
              className={cn(
                "p-1.5 rounded-full shadow-lg pointer-events-auto",
                isCameraEnabled ? "bg-green-500/80 hover:bg-green-500" : "bg-red-500/80 hover:bg-red-500"
              )}
              title={isCameraEnabled ? "Camera ON" : "Camera OFF"}
            >
              {isCameraEnabled ? <Video size={12} className="text-white" /> : <VideoOff size={12} className="text-white" />}
            </button>
          )}

           {/* Mic toggle button â€” show for current user (self-toggle) or remote participants */}
           {canToggleMic && onToggleMic && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleMic(); }}
              className={cn(
                "p-1.5 rounded-full shadow-lg pointer-events-auto",
                isMicrophoneEnabled ? "bg-green-500/80 hover:bg-green-500" : "bg-red-500/80 hover:bg-red-500"
              )}
              title={isMicrophoneEnabled ? "Mic ON" : "Mic OFF"}
            >
              {isMicrophoneEnabled ? <Mic size={12} className="text-white" /> : <MicOff size={12} className="text-white" />}
            </button>
          )}

          {micMuted && (
            <div className="bg-red-500 p-1.5 rounded-full shadow-lg">
              <MicOff size={12} className="text-white" />
            </div>
          )}
        </div>
      </div>

      {onTileClick && (
        <div className={cn(
          "absolute bottom-2 left-2 z-20 pointer-events-none rounded-full border border-white/10 bg-black/55 px-2 py-1 text-[10px] font-bold text-white/80 backdrop-blur-md",
          isHost && "bottom-2 right-2 left-auto border-purple-400/30 bg-purple-500/20 text-purple-200 px-3 py-1.5 text-xs"
        )}>
          {isHost ? "Tap to gift" : "Tap for actions"}
        </div>
      )}

      {/* State battle: show state name + points at bottom middle of broadcaster box */}
      {isStateBattle && stateCode && stateName && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-md border whitespace-nowrap",
            side === 'challenger'
              ? "bg-emerald-950/80 border-emerald-400/40 text-emerald-200"
              : "bg-fuchsia-950/80 border-fuchsia-400/40 text-fuchsia-200"
          )}>
            <span>ðŸ›ï¸</span>
            <span>{stateName}</span>
            {statePoints !== null && statePoints !== undefined && (
              <span className="ml-1 opacity-70">â€¢ {statePoints.toLocaleString()} pts</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * JailTimeHostTile â€” Wraps a host BattleParticipantTile with the JAIL TIME
 * overlay when that side is losing. Used inside BattleArena render.
 */
const JailTimeHostTile = ({
  children,
  side,
  isLosing,
  onJailLock,
  onJailUnlock,
  broadcasterId,
  streamId,
  battleId,
  battleResult,
}: {
  children: React.ReactNode;
  side: 'challenger' | 'opponent';
  isLosing: boolean;
  onJailLock?: () => void;
  onJailUnlock?: () => void;
  broadcasterId?: string;
  streamId?: string;
  battleId?: string | null;
  battleResult?: 'win' | 'lose' | 'tie' | null;
}) => {
  return (
    <div className="relative w-full h-full">
      {children}
      {broadcasterId && (
        <FeedTheTroll
          broadcasterId={broadcasterId}
          streamId={streamId}
          battleMode
          battleId={battleId}
          battleResult={battleResult}
          positionKey="battle"
        />
      )}
      {isLosing && (
        <JailBarOverlay
          side={side}
          isLosing={true}
          onBarsLocked={onJailLock}
          onBarsFreed={onJailUnlock}
          showWarningLights={true}
          showTextBanner={true}
        />
      )}
    </div>
  );
};

/**
 * The main split arena component
 */
interface BattleArenaProps {
  onGift: (uid: string, sourceStreamId: string) => void;
  battleId: string;
  localAudioTrack: LocalAudioTrack | null;
  localVideoTrack: LocalVideoTrack | null;
  localIsCameraEnabled?: boolean;
  localIsMicEnabled?: boolean;
  remoteUsers: RemoteParticipant[];
  challengerStreamId: string;
  opponentStreamId: string;
  challengerHostId: string;
  opponentHostId: string;
  challengerHostName?: string;
  opponentHostName?: string;
  challengerBoxCount?: number;
  opponentBoxCount?: number;
  challengerCrownInfo?: CrownInfo;
  opponentCrownInfo?: CrownInfo;
  challengerScore?: number;
  opponentScore?: number;
  isSuddenDeath?: boolean;
  onTrollOpponent?: (targetStreamId: string) => void;
  canTroll?: boolean;
  currentUserTeam?: 'challenger' | 'opponent' | null;
  userIdToLiveKitIdentity?: Record<string, string>;
  currentUserProfile?: any;
  onOpenStaffActions?: (participant: BattleParticipant) => void;
  trackRevision: number;
  currentUserId?: string | null;
  isBroadcaster?: boolean;
  timeLeft?: number;
  battleStatus?: string;
  /** Enable JAIL TIME overlay effect (default: true for random battles) */
  jailTimeEnabled?: boolean;
  /** Enable JAIL TIME sound effects */
  jailTimeSoundEnabled?: boolean;
  /** Enable JAIL TIME ambient background audio */
  jailTimeAmbientEnabled?: boolean;
  /** State battle: challenger state code (e.g. "CA") */
  challengerStateCode?: string | null;
  /** State battle: challenger state name (e.g. "California") */
  challengerStateName?: string | null;
  /** State battle: challenger state total battle points */
  challengerStatePoints?: number | null;
  /** State battle: opponent state code */
  opponentStateCode?: string | null;
  /** State battle: opponent state name */
  opponentStateName?: string | null;
  /** State battle: opponent state total battle points */
  opponentStatePoints?: number | null;
  /** Whether this is a state battle */
  isStateBattle?: boolean;
  /** Callback to toggle camera for current user */
  onToggleCamera?: () => void;
  /** Callback to toggle mic for current user */
  onToggleMic?: () => void;
  /** Callback to persist a broadcaster seat (box) count change for a team */
  onChangeBoxCount?: (team: 'challenger' | 'opponent', newCount: number) => void;
}

const BattleArena = ({
  onGift,
  battleId,
  localAudioTrack,
  localVideoTrack,
  localIsCameraEnabled,
  localIsMicEnabled,
  remoteUsers,
  trackRevision,
  challengerStreamId,
  opponentStreamId,
  challengerHostId,
  opponentHostId,
  challengerHostName,
  opponentHostName,
  challengerBoxCount = 1,
  opponentBoxCount = 1,
  challengerCrownInfo,
  opponentCrownInfo,
  challengerScore = 0,
  opponentScore = 0,
  isSuddenDeath = false,
  onTrollOpponent,
  canTroll = false,
  currentUserTeam,
  userIdToLiveKitIdentity,
  currentUserProfile,
  onOpenStaffActions,
  currentUserId,
  isBroadcaster = false,
  timeLeft,
  battleStatus,
  jailTimeEnabled = true,
  jailTimeSoundEnabled = true,
  jailTimeAmbientEnabled = true,
  challengerStateCode = null,
  challengerStateName = null,
  challengerStatePoints = null,
  opponentStateCode = null,
  opponentStateName = null,
  opponentStatePoints = null,
  isStateBattle = false,
  onToggleCamera,
  onToggleMic,
  onChangeBoxCount,
}: BattleArenaProps) => {
  const { user } = useAuthStore();

  // â”€â”€ JAIL TIME effect â”€â”€
  const battleActive = battleStatus === 'active' || battleStatus === 'starting' || battleStatus === 'ready';
  const {
    challengerLosing,
    opponentLosing,
    onChallengerJailLock,
    onChallengerJailUnlock,
    onOpponentJailLock,
    onOpponentJailUnlock,
  } = useJailTime({
    challengerScore,
    opponentScore,
    battleActive: battleActive && jailTimeEnabled !== false,
    soundEnabled: jailTimeSoundEnabled !== false,
    ambientEnabled: jailTimeAmbientEnabled !== false,
  });

  // Derived battle result per side (drives winning/losing troll animations).
  const battleResult: 'win' | 'lose' | 'tie' | null =
    battleStatus === 'completed'
      ? challengerScore === opponentScore
        ? 'tie'
        : challengerScore > opponentScore
          ? 'win'
          : 'lose'
      : null;

  const lastKnownTrackRef = useRef<Record<string, { video?: RemoteVideoTrack; audio?: RemoteAudioTrack }>>({});
  const [preBattleCountdown, setPreBattleCountdown] = useState<number | null>(null);
  const [cameraCheckResults, setCameraCheckResults] = useState<Record<string, { hasParticipant: boolean; hasPublication: boolean; hasSubscription: boolean; hasVideo: boolean }>>({});
  const [battleParticipants, setBattleParticipants] = useState<BattleParticipant[]>([]);
  const [isMobileLayout, setIsMobileLayout] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsMobileLayout(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobileViewport = isMobileLayout;

  // Pre-battle camera check: when battle is starting/ready, verify both sides have cameras
  useEffect(() => {
    if (battleStatus !== 'starting' && battleStatus !== 'ready') {
      setPreBattleCountdown(null);
      setCameraCheckResults({});
      return;
    }

    const checkCameras = () => {
      const results: Record<string, { hasParticipant: boolean; hasPublication: boolean; hasSubscription: boolean; hasVideo: boolean }> = {};

      for (const side of ['challenger', 'opponent'] as const) {
        const hostId = side === 'challenger' ? challengerHostId : opponentHostId;
        const liveKitIdentity = userIdToLiveKitIdentity?.[hostId] || hostId;
        const normalizedIdentity = String(liveKitIdentity || '').replace(/-/g, '').toLowerCase();

        const participant = remoteUsers.find((u) => {
          const id = String(u.identity || '');
          const normalized = id.replace(/-/g, '').toLowerCase();
          return (
            id === liveKitIdentity ||
            normalized === normalizedIdentity ||
            normalized.startsWith(normalizedIdentity.substring(0, 8)) ||
            normalizedIdentity.startsWith(normalized.substring(0, 8))
          );
        });

        if (!participant) {
          results[side] = { hasParticipant: false, hasPublication: false, hasSubscription: false, hasVideo: false };
          continue;
        }

        const videoPubs = getTrackPublications(participant, 'video');
        const cameraPub = videoPubs.find(p => p.source === Track.Source.Camera);
        const hasPublication = !!cameraPub;
        const hasSubscription = cameraPub?.isSubscribed ?? false;
        const hasVideo = !!cameraPub?.track;

        results[side] = { hasParticipant: true, hasPublication, hasSubscription, hasVideo };
      }

      setCameraCheckResults(results);

      // Start 3-second countdown if not already running
      setPreBattleCountdown((prev) => {
        if (prev !== null) return prev; // Already counting down
        return 3;
      });
    };

    checkCameras();
  }, [battleStatus, remoteUsers, challengerHostId, opponentHostId, userIdToLiveKitIdentity]);

  // Countdown timer effect
  useEffect(() => {
    if (preBattleCountdown === null) return;
    if (preBattleCountdown <= 0) {
      setPreBattleCountdown(null);
      return;
    }

    const timer = setTimeout(() => {
      setPreBattleCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [preBattleCountdown]);

  const STAFF_ROLES = useMemo(() => new Set([
    'admin',
    'owner',
    'ceo',
    'moderator',
    'lead_troll_officer',
    'troll_officer',
    'staff',
  ]), []);

  const isStaffProfile = useCallback((profile: any) => {
    const role = String(profile?.role || profile?.account_type || '').toLowerCase();
    return STAFF_ROLES.has(role) || profile?.is_admin === true || profile?.is_staff === true || profile?.is_moderator === true;
  }, [STAFF_ROLES]);

  // Helper to get username from participant (checks profile join first)
  const getUsername = (participant: any, fallback = 'Anonymous'): string => {
    return participant?.profile?.username || participant?.username || fallback;
  };

  // Track last remote users identities and trackRevision to avoid redundant re-fetches
  const lastRemoteIdentitiesRef = useRef<string>('');
  const lastTrackRevisionRef = useRef<number>(-1);
  
  // Stable identity signature for participant loading dependencies
  const participantIdentitySignature = useMemo(() => {
    const ids = remoteUsers.map(u => u?.identity || '').sort();
    return `${battleId}|${trackRevision}|${ids.join(',')}`;
  }, [battleId, trackRevision, remoteUsers]);

  const participantLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const participantAbortControllerRef = useRef<AbortController | null>(null);
  const lastParticipantSignatureRef = useRef<string>('');
  const participantFetchIdRef = useRef(0);

  const getSupabaseParticipant = async (userId: string, signal?: AbortSignal) => {
    const { data, error } = await supabase
      .from('battle_participants')
      .select('*, profile:user_profiles(id, username, avatar_url, troll_coins, trollmonds)')
      .eq('battle_id', battleId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) console.error(`Failed to fetch battle_participant for user ${userId}:`, error);
    if (import.meta.env.DEV) {
      console.log('[BattleArena] getSupabaseParticipant for', userId, ':', data);
    }
    return data;
  };

  const getSupabaseParticipantsBatched = async (userIds: string[], signal?: AbortSignal) => {
    if (userIds.length === 0) return {} as Record<string, any>;
    const { data, error } = await supabase
      .from('battle_participants')
      .select('*, profile:user_profiles(id, username, avatar_url, troll_coins, trollmonds)')
      .eq('battle_id', battleId)
      .in('user_id', userIds);
    if (error) console.error('Failed to batch fetch battle_participants:', error);
    const map: Record<string, any> = {};
    for (const row of data || []) {
      if (row?.user_id) map[row.user_id] = row;
    }
    return map;
  };

  useEffect(() => {
    const fetchParticipantData = async (signal?: AbortSignal) => {
        try {
          const participantsData: BattleParticipant[] = [];

          // First, fetch ALL battle participants from database to ensure slots are shown
          // even before LiveKit connections are established
          const { data: allParticipants } = await supabase
            .from('battle_participants')
            .select('*, profile:user_profiles(id, username, avatar_url, troll_coins, trollmonds)')
            .eq('battle_id', battleId);

          // Add database participants even if they're not in LiveKit yet
          if (allParticipants) {
            for (const dbParticipant of allParticipants) {
              // Skip null entries or if we already have this participant
              if (!dbParticipant) continue;
              if (participantsData.some(p => p.identity === dbParticipant.user_id)) continue;
              
              const metadata = safeParseMetadata(dbParticipant.metadata, `db participant ${dbParticipant.user_id}`);
              
              // Determine team from host IDs if not set
              let team: 'challenger' | 'opponent' | null = dbParticipant.team;
              if (!team) {
                if (dbParticipant.user_id === challengerHostId) {
                  team = 'challenger';
                } else if (dbParticipant.user_id === opponentHostId) {
                  team = 'opponent';
                }
              }
              
              // Get username from profile if available (joined via profile:user_profiles)
              const getUsername = (participant: any): string => {
                return participant?.profile?.username || participant?.username || 'Anonymous';
              };
              
              participantsData.push({
                identity: dbParticipant.user_id,
                name: getUsername(dbParticipant),
                isLocal: false, // Database participants aren't local until they connect
                videoTrack: undefined,
                audioTrack: undefined,
                isMicrophoneEnabled: false,
                isCameraEnabled: false,
                metadata: metadata,
                role: dbParticipant.role,
                team: team,
                sourceStreamId: metadata.sourceStreamId,
                seatIndex: metadata.seatIndex,
                profile: dbParticipant.profile,
                trollCoins: dbParticipant.profile?.troll_coins || 0,
                trollmonds: dbParticipant.profile?.trollmonds || 0,
              });
            }
          }

         
          // Helper to find LiveKit identity for a user ID
          const findLiveKitIdentity = (userId: string): string => {
            if (userIdToLiveKitIdentity?.[userId]) {
              return userIdToLiveKitIdentity[userId];
            }
            // Fallback to userId identity used by battle publishers.
            return userId;
          };

          // Helper to find RemoteParticipant by LiveKit identity
          const findRemoteParticipant = (liveKitIdentity: string): RemoteParticipant | undefined => {
            const normalizedTarget = String(liveKitIdentity || '').replace(/-/g, '').toLowerCase();
            return remoteUsers.find((u) => {
              const id = String(u.identity || '');
              const normalized = id.replace(/-/g, '').toLowerCase();
              return (
                id === liveKitIdentity ||
                normalized === normalizedTarget
              );
            });
          };

          // Local participant
          if (user) {
            const localSupabaseParticipant = await getSupabaseParticipant(user.id);
            const localMetadata = safeParseMetadata(localSupabaseParticipant?.metadata, `local user ${user.id}`);
            // Get username from profile if available (joined via profile:user_profiles)
            const getUsername = (participant: any): string => {
              return participant?.profile?.username || participant?.username || 'You';
            };
            
            // Determine the local user's team and role
            let localTeam: 'challenger' | 'opponent' | null = localSupabaseParticipant?.team;
            let localRole: 'host' | 'stage' | 'viewer' = localSupabaseParticipant?.role;
            
            // If not set from database, infer from stream ownership
            if (!localTeam) {
              if (user.id === challengerHostId) {
                localTeam = 'challenger';
              } else if (user.id === opponentHostId) {
                localTeam = 'opponent';
              }
            }
            
            // If broadcaster, they should be host
            if (isBroadcaster && !localRole) {
              localRole = 'host';
            }
            
            participantsData.push({
              identity: user.id,
              name: getUsername(localSupabaseParticipant) || user.user_metadata?.username || 'You',
              isLocal: true,
              videoTrack: localVideoTrack,
              audioTrack: localAudioTrack,
              // Use explicitly passed enabled state, fallback to track-based detection via mediaStreamTrack
              isMicrophoneEnabled: localIsMicEnabled ?? (localAudioTrack?.mediaStreamTrack?.enabled ?? false),
              // Be more lenient with camera check - use explicit state if available, otherwise check track
              isCameraEnabled: localIsCameraEnabled ?? !!localVideoTrack,
              metadata: localMetadata,
              role: localRole,
              team: localTeam,
              sourceStreamId: localMetadata.sourceStreamId,
              seatIndex: localMetadata.seatIndex,
              profile: localSupabaseParticipant?.profile,
              trollCoins: localSupabaseParticipant?.profile?.troll_coins || 0,
              trollmonds: localSupabaseParticipant?.profile?.trollmonds || 0,
            });
          }

          // Collect all user IDs that need DB lookup (remote users + local user)
          const userIdsToFetch = new Set<string>();
          for (const remoteUser of remoteUsers) {
            if (!remoteUser?.identity) continue;
            const remoteIdentity = String(remoteUser.identity);
            let matchedUserId: string | null = null;
            
            if (userIdToLiveKitIdentity) {
              for (const [userId, identity] of Object.entries(userIdToLiveKitIdentity)) {
                if (identity === remoteIdentity) {
                  matchedUserId = userId;
                  break;
                }
              }
            }
            
            if (!matchedUserId) {
              matchedUserId = remoteIdentity;
            }
            
            if (matchedUserId) {
              userIdsToFetch.add(matchedUserId);
            }
          }
          if (user) userIdsToFetch.add(user.id);

          // Batch fetch all participants in one query
          const batchedParticipants = await getSupabaseParticipantsBatched(Array.from(userIdsToFetch), signal);

          // Remote participants - use mapping to identify which team each belongs to
          for (const remoteUser of remoteUsers) {
            if (signal?.aborted) return;
            try {
            if (!remoteUser?.identity) {
              console.log('[BattleArena] Skipping remote participant with missing identity');
              continue;
            }
            const remoteIdentity = String(remoteUser.identity);
            const normalizeId = (v: string | null | undefined) => String(v || '').replace(/-/g, '').toLowerCase();
            const remoteIdentityNorm = normalizeId(remoteIdentity);
            const challengerIdentityGuess = normalizeId(userIdToLiveKitIdentity?.[challengerHostId] || challengerHostId);
            const opponentIdentityGuess = normalizeId(userIdToLiveKitIdentity?.[opponentHostId] || opponentHostId);

            // Try to match remote user to a team using the LiveKit identity mapping
            let matchedUserId: string | null = null;
            let matchedTeam: 'challenger' | 'opponent' | null = null;
            
            if (userIdToLiveKitIdentity) {
              // Find which user ID has this LiveKit identity
              for (const [userId, identity] of Object.entries(userIdToLiveKitIdentity)) {
                if (identity === remoteIdentity) {
                  matchedUserId = userId;
                  // Determine team based on which stream this user owns
                  if (userId === challengerHostId) {
                    matchedTeam = 'challenger';
                  } else if (userId === opponentHostId) {
                    matchedTeam = 'opponent';
                  }
                  break;
                }
              }
            }

            // If we didn't find a match via mapping, fall back to batched result or identity direct
            if (!matchedUserId) {
              const batchedMatch = batchedParticipants[remoteIdentity];
              if (batchedMatch) {
                matchedUserId = remoteIdentity;
                matchedTeam = batchedMatch.team;
              }
            }

            // Final fallback for viewer/mobile: infer host identity only when mapping is stale/missing.
            // Use STRICT matching to prevent the same remote participant being assigned to both teams.
            if (!matchedUserId) {
              const challengerExact = remoteIdentityNorm === challengerIdentityGuess;
              const opponentExact = remoteIdentityNorm === opponentIdentityGuess;
              if (challengerExact && !opponentExact) {
                matchedUserId = challengerHostId;
                matchedTeam = 'challenger';
              } else if (opponentExact && !challengerExact) {
                matchedUserId = opponentHostId;
                matchedTeam = 'opponent';
              } else if (challengerExact && opponentExact) {
                matchedUserId = challengerHostId;
                matchedTeam = 'challenger';
              }
            }

            // If we still don't have a match, skip this participant
            if (!matchedUserId) {
              console.log('[BattleArena] Skipping unmatched remote participant:', remoteUser.identity);
              continue;
            }

            // Get participant data from batched results
            const remoteSupabaseParticipant = batchedParticipants[matchedUserId] || null;
            const remoteMetadata = safeParseMetadata(remoteSupabaseParticipant?.metadata, `remote user ${remoteIdentity}`);
            // Use team from database if not set from mapping
            if (!matchedTeam && remoteSupabaseParticipant?.team) {
              matchedTeam = remoteSupabaseParticipant.team;
            }

            // FIX #1: Correct Track Extraction - use publications with isSubscribed check
            // Use proper source mapping - check publication.source against Track.Source enum
            // Also handle case where videoTracks/audioTracks might be undefined
            const videoPublications = getTrackPublications(remoteUser, 'video');
            const audioPublications = getTrackPublications(remoteUser, 'audio');

            // Log ALL publication details for debugging
            videoPublications.forEach(p => {
              console.log('[BattleArena] Video publication:', {
                trackSid: p.trackSid,
                source: p.source,
                isSubscribed: p.isSubscribed,
                trackKind: p.kind,
                hasTrack: !!p.track,
                trackSidFromTrack: p.track?.sid,
                // Use Track.Source enum for proper comparison
                isCamera: p.source === Track.Source.Camera,
                isScreen: p.source === Track.Source.ScreenShare,
              });
            });

            audioPublications.forEach(p => {
              console.log('[BattleArena] Audio publication:', {
                trackSid: p.trackSid,
                source: p.source,
                isSubscribed: p.isSubscribed,
                trackKind: p.kind,
                hasTrack: !!p.track,
                trackSidFromTrack: p.track?.sid,
                isMic: p.source === Track.Source.Microphone,
              });
            });

            // Enhanced mobile track detection - more aggressive fallbacks for mobile devices
            // Mobile devices may have delayed subscription or different track handling
            const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            // Find subscribed tracks - prefer Camera source for video, Microphone for audio
            // On mobile, be more lenient with subscription status
            let videoPub = videoPublications.find(p => p.isSubscribed && p.track && p.source === Track.Source.Camera);
            if (!videoPub && isMobileDevice) {
              // Mobile fallback: try any camera track, even if not subscribed yet
              videoPub = videoPublications.find(p => p.track && p.source === Track.Source.Camera) ||
                        videoPublications.find(p => p.track);
            }
            if (!videoPub) {
              // Standard fallback
              videoPub = videoPublications.find(p => p.isSubscribed && p.track);
            }

            let audioPub = audioPublications.find(p => p.isSubscribed && p.track && p.source === Track.Source.Microphone);
            if (!audioPub && isMobileDevice) {
              // Mobile fallback: try any microphone track, even if not subscribed yet
              audioPub = audioPublications.find(p => p.track && p.source === Track.Source.Microphone) ||
                        audioPublications.find(p => p.track);
            }
            if (!audioPub) {
              // Standard fallback
              audioPub = audioPublications.find(p => p.isSubscribed && p.track);
            }

            // Additional mobile-specific track detection
            if (!videoPub && isMobileDevice) {
              // Try to find tracks that might be in the process of subscribing
              const allVideoPubs: RemoteTrackPublication[] = remoteUser.trackPublications ?
                Array.from((remoteUser.trackPublications as Map<string, RemoteTrackPublication>).values()) : [];
              videoPub = allVideoPubs.find(p => p.track && p.kind === Track.Kind.Video && p.source === Track.Source.Camera) ||
                        allVideoPubs.find(p => p.track && p.kind === Track.Kind.Video);
            }

            if (!audioPub && isMobileDevice) {
              const allAudioPubs: RemoteTrackPublication[] = remoteUser.trackPublications ?
                Array.from((remoteUser.trackPublications as Map<string, RemoteTrackPublication>).values()) : [];
              audioPub = allAudioPubs.find(p => p.track && p.kind === Track.Kind.Audio && p.source === Track.Source.Microphone) ||
                        allAudioPubs.find(p => p.track && p.kind === Track.Kind.Audio);
            }
            
            // Log what we found
            console.log('[BattleArena] Selected video publication:', {
              found: !!videoPub,
              trackSid: videoPub?.trackSid,
              hasTrack: !!videoPub?.track,
              trackSidFromTrack: videoPub?.track?.sid,
            });
            console.log('[BattleArena] Selected audio publication:', {
              found: !!audioPub,
              trackSid: audioPub?.trackSid,
              hasTrack: !!audioPub?.track,
              trackSidFromTrack: audioPub?.track?.sid,
            });
            
            const cacheKey = matchedUserId;
            const cached = lastKnownTrackRef.current[cacheKey] || {};
            const resolvedVideoTrack = (videoPub?.track as RemoteVideoTrack | undefined) || cached.video;
            const resolvedAudioTrack = (audioPub?.track as RemoteAudioTrack | undefined) || cached.audio;

            if (videoPub?.track || audioPub?.track) {
              lastKnownTrackRef.current[cacheKey] = {
                video: (videoPub?.track as RemoteVideoTrack | undefined) || cached.video,
                audio: (audioPub?.track as RemoteAudioTrack | undefined) || cached.audio,
              };
            }

            // Keep previously known tracks during reconnect churn so tiles don't disappear instantly.
            const hasVideoTrack = !!resolvedVideoTrack;
            const hasAudioTrack = !!resolvedAudioTrack;

            console.log('[BattleArena] Adding participant to list:', {
              matchedUserId,
              matchedTeam,
              hasVideoTrack,
              hasAudioTrack,
              resolvedVideoTrackSid: resolvedVideoTrack?.sid,
              resolvedAudioTrackSid: resolvedAudioTrack?.sid,
            });
            
            // Update existing participant or add new one
            const existingIdx = participantsData.findIndex(p => p.identity === matchedUserId);
            // Get username from profile join
            const remoteName = remoteSupabaseParticipant?.profile?.username || remoteSupabaseParticipant?.username || `User ${remoteIdentity.slice(0, 8)}`;
            const participantData = {
              identity: matchedUserId || remoteIdentity,
              name: remoteName,
              isLocal: false,
              videoTrack: resolvedVideoTrack,
              audioTrack: resolvedAudioTrack,
              isMicrophoneEnabled: hasAudioTrack,
              isCameraEnabled: hasVideoTrack,
              metadata: remoteMetadata,
              role: remoteSupabaseParticipant?.role || (matchedTeam ? 'host' : 'stage'),
              team: matchedTeam || remoteSupabaseParticipant?.team || null,
              sourceStreamId: remoteMetadata.sourceStreamId,
              seatIndex: remoteMetadata.seatIndex,
              profile: remoteSupabaseParticipant?.profile,
              trollCoins: remoteSupabaseParticipant?.profile?.troll_coins || 0,
              trollmonds: remoteSupabaseParticipant?.profile?.trollmonds || 0,
            };
            
            if (existingIdx >= 0) {
              participantsData[existingIdx] = participantData;
            } else {
              participantsData.push(participantData);
            }
            } catch (participantError) {
              console.error('[BattleArena] Failed processing remote participant:', remoteUser?.identity, participantError);
            }
          }

      // Ensure both host slots can still render video even if participant lookup/mapping misses.
      const ensureHostFallback = (
        hostUserId: string,
        team: 'challenger' | 'opponent',
        label: string
      ) => {
        const hostAlreadyPresent = participantsData.some(
          (p) => p.role === 'host' && p.team === team && (!!p.videoTrack || !!p.audioTrack)
        );
        if (hostAlreadyPresent) return;

        const liveKitIdentity = userIdToLiveKitIdentity?.[hostUserId] || hostUserId;
        const normalizedIdentity = String(liveKitIdentity || '').replace(/-/g, '').toLowerCase();
        const remote = remoteUsers.find((u) => {
          const id = String(u.identity || '');
          const normalized = id.replace(/-/g, '').toLowerCase();
          return (
            id === liveKitIdentity ||
            normalized === normalizedIdentity
          );
        });
        if (!remote) return;

        const videoPub = getTrackPublications(remote, 'video').find((p) => p.isSubscribed && p.track)
            || getTrackPublications(remote, 'video').find((p) => p.track);
        const audioPub = getTrackPublications(remote, 'audio').find((p) => p.isSubscribed && p.track)
            || getTrackPublications(remote, 'audio').find((p) => p.track);

        console.log('[BattleArena] ensureHostFallback found tracks:', {
          team,
          label,
          hostUserId,
          liveKitIdentity,
          hasVideo: !!videoPub?.track,
          hasAudio: !!audioPub?.track,
          videoPubTrackSid: videoPub?.track?.sid,
          audioPubTrackSid: audioPub?.track?.sid,
        });

        participantsData.push({
          identity: hostUserId,
          name: label,
          isLocal: false,
          videoTrack: videoPub?.track as RemoteVideoTrack | undefined,
          audioTrack: audioPub?.track as RemoteAudioTrack | undefined,
          isMicrophoneEnabled: !!audioPub?.track,
          isCameraEnabled: !!videoPub?.track,
          metadata: {},
          role: 'host',
          team,
          sourceStreamId: undefined,
          seatIndex: 0,
        });
      };

      ensureHostFallback(challengerHostId, 'challenger', 'Challenger');
      ensureHostFallback(opponentHostId, 'opponent', 'Opponent');

      // Last-resort viewer fallback:
      // when identity mapping fails on some mobile viewer sessions, bind remaining remote
      // participants to missing host slots by order so broadcaster feeds still render.
      const hasChallengerHost = participantsData.some(
        (p) => p.role === 'host' && p.team === 'challenger' && (!!p.videoTrack || !!p.audioTrack)
      );
      const hasOpponentHost = participantsData.some(
        (p) => p.role === 'host' && p.team === 'opponent' && (!!p.videoTrack || !!p.audioTrack)
      );

      if ((!hasChallengerHost || !hasOpponentHost) && remoteUsers.length > 0) {
        const usedIdentities = new Set(participantsData.map((p) => p.identity));
        const remainingRemotes = remoteUsers.filter((u) => u?.identity && !usedIdentities.has(String(u.identity)));

        const buildHostFromRemote = (
          remote: RemoteParticipant,
          hostUserId: string,
          team: 'challenger' | 'opponent',
          label: string
        ) => {
          const videoPub = getTrackPublications(remote, 'video').find((p) => p.isSubscribed && p.track)
            || getTrackPublications(remote, 'video').find((p) => p.track);
          const audioPub = getTrackPublications(remote, 'audio').find((p) => p.isSubscribed && p.track)
            || getTrackPublications(remote, 'audio').find((p) => p.track);

          participantsData.push({
            identity: hostUserId,
            name: label,
            isLocal: false,
            videoTrack: videoPub?.track as RemoteVideoTrack | undefined,
            audioTrack: audioPub?.track as RemoteAudioTrack | undefined,
            isMicrophoneEnabled: !!audioPub?.track,
            isCameraEnabled: !!videoPub?.track,
            metadata: {},
            role: 'host',
            team,
            sourceStreamId: undefined,
            seatIndex: 0,
          });
        };

        if (!hasChallengerHost && remainingRemotes[0]) {
          buildHostFromRemote(remainingRemotes[0], challengerHostId, 'challenger', 'Challenger');
        }
        if (!hasOpponentHost && remainingRemotes[1]) {
          buildHostFromRemote(remainingRemotes[1], opponentHostId, 'opponent', 'Opponent');
        }

        // ULTRA-FALLBACK: If still no hosts with tracks, assign ANY remote user with video to the missing slots
        // This handles cases where identity mapping completely fails on mobile
        const finalChallengerHost = participantsData.find(p => p.role === 'host' && p.team === 'challenger' && p.videoTrack);
        const finalOpponentHost = participantsData.find(p => p.role === 'host' && p.team === 'opponent' && p.videoTrack);

        const assignedRemoteIdentities = new Set<string>();
        for (const p of participantsData) {
          if (p.videoTrack && (p as any).__remoteIdentity) {
            assignedRemoteIdentities.add((p as any).__remoteIdentity);
          }
        }

        if (!finalChallengerHost) {
          const anyRemoteWithVideo = remoteUsers.find(u => {
            const pubs = getTrackPublications(u, 'video');
            return pubs.some(p => p.track) && !assignedRemoteIdentities.has(u.identity);
          });
          if (anyRemoteWithVideo) {
            const p = anyRemoteWithVideo;
            const videoPub = getTrackPublications(p, 'video').find((pb: any) => pb.track);
            const audioPub = getTrackPublications(p, 'audio').find((pb: any) => pb.track);
            participantsData.push({
              identity: p.identity,
              name: p.name || 'User',
              isLocal: false,
              videoTrack: videoPub?.track as RemoteVideoTrack | undefined,
              audioTrack: audioPub?.track as RemoteAudioTrack | undefined,
              isMicrophoneEnabled: !!audioPub?.track,
              isCameraEnabled: !!videoPub?.track,
              metadata: {},
              role: 'host',
              team: 'challenger',
              sourceStreamId: undefined,
              seatIndex: 0,
            } as any);
            assignedRemoteIdentities.add(p.identity);
            console.log('[BattleArena] ULTRA-FALLBACK: Assigned remote user to challenger slot', p.identity?.substring(0, 8));
          }
        }

        if (!finalOpponentHost) {
          const anyRemoteWithVideo = remoteUsers.find(u => {
            const pubs = getTrackPublications(u, 'video');
            return pubs.some(p => p.track) && !assignedRemoteIdentities.has(u.identity);
          });
          if (anyRemoteWithVideo) {
            const p = anyRemoteWithVideo;
            const videoPub = getTrackPublications(p, 'video').find((pb: any) => pb.track);
            const audioPub = getTrackPublications(p, 'audio').find((pb: any) => pb.track);
            participantsData.push({
              identity: p.identity,
              name: p.name || 'User',
              isLocal: false,
              videoTrack: videoPub?.track as RemoteVideoTrack | undefined,
              audioTrack: audioPub?.track as RemoteAudioTrack | undefined,
              isMicrophoneEnabled: !!audioPub?.track,
              isCameraEnabled: !!videoPub?.track,
              metadata: {},
              role: 'host',
              team: 'opponent',
              sourceStreamId: undefined,
              seatIndex: 0,
            } as any);
            console.log('[BattleArena] ULTRA-FALLBACK: Assigned remote user to opponent slot', p.identity?.substring(0, 8));
          }
        }
      }

      setBattleParticipants(participantsData);
        } catch (e) {
          console.error('[BattleArena] fetchParticipantData failed:', e);
        }
      };

    fetchParticipantData();

    if (participantLoadTimerRef.current) {
      clearTimeout(participantLoadTimerRef.current);
    }
    participantLoadTimerRef.current = setTimeout(async () => {
      if (participantAbortControllerRef.current?.signal.aborted) return;
      try {
        await fetchParticipantData(participantAbortControllerRef.current?.signal);
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
        console.error('[BattleArena] fetchParticipantData failed:', e);
      } finally {
        if (participantLoadTimerRef.current) {
          clearTimeout(participantLoadTimerRef.current);
          participantLoadTimerRef.current = null;
        }
      }
    }, 150);

    return () => {
      if (participantLoadTimerRef.current) {
        clearTimeout(participantLoadTimerRef.current);
        participantLoadTimerRef.current = null;
      }
      if (participantAbortControllerRef.current) {
        participantAbortControllerRef.current.abort();
        participantAbortControllerRef.current = null;
      }
    };
  }, [participantIdentitySignature, battleId, challengerHostId, opponentHostId, userIdToLiveKitIdentity]);

  const categorized = useMemo(() => {
    const teams = {
      challenger: { host: null as BattleParticipant | null, guests: [] as BattleParticipant[], boxCount: Math.max(1, Math.min(challengerBoxCount, 6)) },
      opponent: { host: null as BattleParticipant | null, guests: [] as BattleParticipant[], boxCount: Math.max(1, Math.min(opponentBoxCount, 6)) }
    };

    const normId = (v: string | null | undefined) => String(v || '').replace(/-/g, '').toLowerCase();
    const challengerHostNorm = normId(challengerHostId);
    const opponentHostNorm = normId(opponentHostId);

    // Pick the single best host per team. A candidate is "better" when it has a
    // real video/audio track. We anchor selection to the host user id so the
    // opponent box can NEVER be filled with the challenger's (or the local
    // user's) track just because identity mapping was missing.
    const pickBetterHost = (current: BattleParticipant | null, next: BattleParticipant) => {
      if (!current) return next;
      const score = (p: BattleParticipant) => (p.videoTrack ? 2 : 0) + (p.audioTrack ? 1 : 0);
      return score(next) > score(current) ? next : current;
    };

    battleParticipants.forEach(p => {
      if (p.role !== 'host') {
        if ((p.team === 'challenger' || p.team === 'opponent') && p.role === 'stage') {
          teams[p.team].guests.push(p);
        }
        return;
      }

      // Determine the host's true team by matching its identity to a host id.
      // Fall back to the participant's declared team only if identity is
      // inconclusive. This prevents cross-assignment.
      const pid = normId(p.identity);
      let team: 'challenger' | 'opponent' | null = null;
      if (pid && pid === challengerHostNorm && challengerHostNorm !== opponentHostNorm) {
        team = 'challenger';
      } else if (pid && pid === opponentHostNorm && challengerHostNorm !== opponentHostNorm) {
        team = 'opponent';
      } else if (p.team === 'challenger' || p.team === 'opponent') {
        team = p.team;
      }
      if (!team) return;

      teams[team].host = pickBetterHost(teams[team].host, p);
    });

    // Collision guard: if both host slots somehow reference the same underlying
    // participant/track (identity churn or an echoed local track), keep it only
    // on the side whose host id it matches and clear the other so we never show
    // one broadcaster in both boxes.
    const cHost = teams.challenger.host;
    const oHost = teams.opponent.host;
    if (cHost && oHost) {
      const sameIdentity = cHost.identity && oHost.identity && normId(cHost.identity) === normId(oHost.identity);
      const sameTrack = cHost.videoTrack && oHost.videoTrack && cHost.videoTrack === oHost.videoTrack;
      if (sameIdentity || sameTrack) {
        const belongsToOpponent = normId(oHost.identity) === opponentHostNorm && opponentHostNorm !== challengerHostNorm;
        if (belongsToOpponent) {
          teams.challenger.host = null;
        } else {
          teams.opponent.host = null;
        }
        console.warn('[BattleArena] Cleared duplicate host from a battle box to prevent showing one broadcaster in both slots');
      }
    }

    const sortBySeat = (a: BattleParticipant, b: BattleParticipant) => {
      return (a.seatIndex || 0) - (b.seatIndex || 0);
    };
    
    teams.challenger.guests.sort(sortBySeat);
    teams.opponent.guests.sort(sortBySeat);

    return teams;
  }, [battleParticipants, challengerBoxCount, opponentBoxCount, challengerHostId, opponentHostId]);

  // â”€â”€ Seat management (broadcaster add / remove seats) â”€â”€
  // Empty seats are NOT rendered by default â€” only the broadcaster boxes show
  // until seats are explicitly added by a broadcaster (box_count) or occupied
  // by a guest participant. This implements the "only broadcasters shown unless
  // seats are added" rule.
  const isAdminProfile = isStaffProfile(currentUserProfile);
  const canManageTeamSeats = useCallback((team: 'challenger' | 'opponent') => {
    const hostId = team === 'challenger' ? challengerHostId : opponentHostId;
    if (currentUserId && currentUserId === hostId) return true;
    if (isAdminProfile) return true;
    return false;
  }, [currentUserId, challengerHostId, opponentHostId, isAdminProfile]);

  const [seatSaving, setSeatSaving] = useState<{ challenger?: boolean; opponent?: boolean }>({});
  const handleAddSeat = async (team: 'challenger' | 'opponent') => {
    if (seatSaving[team] || !onChangeBoxCount) return;
    const cur = team === 'challenger' ? challengerBoxCount : opponentBoxCount;
    const next = Math.min(3, (cur || 1) + 1);
    if (next === (cur || 1)) return;
    setSeatSaving((s) => ({ ...s, [team]: true }));
    try {
      await onChangeBoxCount(team, next);
    } finally {
      setSeatSaving((s) => ({ ...s, [team]: false }));
    }
  };
  const handleRemoveSeat = async (team: 'challenger' | 'opponent') => {
    if (seatSaving[team] || !onChangeBoxCount) return;
    const cur = team === 'challenger' ? challengerBoxCount : opponentBoxCount;
    const next = Math.max(1, (cur || 1) - 1);
    if (next === (cur || 1)) return;
    setSeatSaving((s) => ({ ...s, [team]: true }));
    try {
      await onChangeBoxCount(team, next);
    } finally {
      setSeatSaving((s) => ({ ...s, [team]: false }));
    }
  };

  const TeamSeatControls = ({ team }: { team: 'challenger' | 'opponent' }) => {
    if (!canManageTeamSeats(team)) return null;
    const boxCount = (team === 'challenger' ? challengerBoxCount : opponentBoxCount) || 1;
    const saving = seatSaving[team];
    const battleLive = battleStatus === 'active' || battleStatus === 'starting' || battleStatus === 'ready';
    if (!battleLive) return null;
    return (
      <div className="flex items-center gap-2 self-start pointer-events-auto">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
          {team === 'challenger' ? 'Blue' : 'Red'} Seats: {boxCount}
        </span>
        {boxCount > 1 && (
          <button
            type="button"
            disabled={saving}
            onClick={() => handleRemoveSeat(team)}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/80 transition hover:bg-red-500/30 disabled:opacity-50"
            title={`Remove a ${team} seat`}
          >
            <Minus size={14} />
          </button>
        )}
        {boxCount < 3 && (
          <button
            type="button"
            disabled={saving}
            onClick={() => handleAddSeat(team)}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/80 transition hover:bg-purple-500/40 disabled:opacity-50"
            title={`Add a ${team} seat`}
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    );
  };

  const handleGiftClick = (p: BattleParticipant) => {
    if (isBroadcaster) return;
    if (currentUserId && p.identity === currentUserId) return;
    const resolvedStreamId =
      p.sourceStreamId ||
      (p.team === 'challenger' ? challengerStreamId : p.team === 'opponent' ? opponentStreamId : '');
    if (!resolvedStreamId || !p.identity) return;
    onGift(p.identity, resolvedStreamId);
  };

  const handleParticipantBoxClick = (participant: BattleParticipant) => {
    if (!participant?.identity) return;

    const resolvedStreamId =
      participant.sourceStreamId ||
      (participant.team === 'challenger'
        ? challengerStreamId
        : participant.team === 'opponent'
          ? opponentStreamId
          : '');

    if (isStaffProfile(currentUserProfile)) {
      if (onOpenStaffActions) {
        onOpenStaffActions({ ...participant, sourceStreamId: resolvedStreamId || participant.sourceStreamId });
        return;
      }

      window.dispatchEvent(new CustomEvent('MaiTroll:open-user-actions', {
        detail: {
          userId: participant.identity,
          username: participant.name,
          streamId: resolvedStreamId,
          battleId,
          role: participant.role,
          team: participant.team,
          source: 'battle_box',
        },
      }));
      return;
    }

    handleGiftClick({ ...participant, sourceStreamId: resolvedStreamId || participant.sourceStreamId });
  };

  const handleSideGiftClick = (team: 'challenger' | 'opponent') => {
    if (isBroadcaster) return;
    const streamId = team === 'challenger' ? challengerStreamId : opponentStreamId;
    const hostId = team === 'challenger' ? challengerHostId : opponentHostId;
    if (!streamId || !hostId) return;
    onGift(hostId, streamId);
  };

  const handleTrollClick = (team: 'challenger' | 'opponent') => {
    if (!onTrollOpponent) return;
    const targetStreamId = team === 'challenger' ? challengerStreamId : opponentStreamId;
    onTrollOpponent(targetStreamId);
  };

  // Generate slots for each team.
  // IMPORTANT: empty seats are NOT rendered by default â€” only the broadcaster
  // box (host) shows until seats are explicitly added by a broadcaster
  // (box_count beyond the number of occupied guests) or occupied by a guest.
  type SlotDef = { type: 'host' | 'guest'; participant?: BattleParticipant | null; index?: number; added?: boolean };
  const buildSlots = (
    teamData: { host: BattleParticipant | null; guests: BattleParticipant[]; boxCount: number },
    boxCountProp: number
  ): SlotDef[] => {
    const cap = Math.max(1, Math.min(boxCountProp || 1, 6));
    const guests = teamData.guests || [];
    const slots: SlotDef[] = [];
    slots.push({ type: 'host', participant: teamData.host || null });
    // Render occupied guest positions first, then any empty seats the
    // broadcaster explicitly added (box_count beyond occupied guests).
    const addedEmptySeats = Math.max(0, (cap - 1) - guests.length);
    for (let i = 0; i < guests.length; i++) {
      slots.push({ type: 'guest', participant: guests[i], index: i + 1 });
    }
    for (let j = 0; j < addedEmptySeats; j++) {
      slots.push({ type: 'guest', participant: null, index: guests.length + j + 1, added: true });
    }
    return slots;
  };

  const challengerSlots = useMemo(
    () => buildSlots(categorized.challenger, challengerBoxCount),
    [categorized.challenger.host, categorized.challenger.guests, challengerBoxCount]
  );

  const opponentSlots = useMemo(
    () => buildSlots(categorized.opponent, opponentBoxCount),
    [categorized.opponent.host, categorized.opponent.guests, opponentBoxCount]
  );

  const remoteAudioEntries = useMemo(() => {
    const unique = new Map<string, { label: string; audioTrack: LocalAudioTrack | RemoteAudioTrack }>();
    for (const participant of battleParticipants) {
      if (participant.isLocal || !participant.audioTrack) continue;
      const track = participant.audioTrack as LocalAudioTrack | RemoteAudioTrack;
      const trackSid = String((track as any)?.sid || (track as any)?.mediaStreamTrack?.id || 'audio');
      const key = `${participant.identity}:${trackSid}`;
      if (!unique.has(key)) {
        unique.set(key, {
          label: `${participant.team || 'viewer'}:${participant.name || participant.identity}`,
          audioTrack: track,
        });
      }
    }
    return Array.from(unique.entries()).map(([key, value]) => ({
      key,
      label: value.label,
      audioTrack: value.audioTrack,
    }));
  }, [battleParticipants]);

  // DEBUG: Log slot counts to diagnose single-host scenarios (throttled)
  const lastDebugLogRef = useRef(0);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const now = Date.now();
    if (now - lastDebugLogRef.current < 2000) return;
    lastDebugLogRef.current = now;
    console.log('[BattleArena] Remote users for track lookup:', {
      remoteUsersCount: remoteUsers.length,
      challengerHostId,
      opponentHostId,
      userIdToLiveKitIdentity,
      remoteUsersIdentities: remoteUsers.map(u => u?.identity?.substring(0, 12)),
    });
    console.log('[BattleArena] Slot counts:', {
      challengerSlots: challengerSlots.length,
      opponentSlots: opponentSlots.length,
      challengerGuests: categorized.challenger.guests.length,
      opponentGuests: categorized.opponent.guests.length,
      battleParticipantsCount: battleParticipants.length,
      challengeHostTrack: !!battleParticipants.find(p => p.team === 'challenger' && p.role === 'host')?.videoTrack,
      opponentHostTrack: !!battleParticipants.find(p => p.team === 'opponent' && p.role === 'host')?.videoTrack,
    });
  }, [remoteUsers.length, challengerHostId, opponentHostId, userIdToLiveKitIdentity, challengerSlots.length, opponentSlots.length, categorized.challenger.guests.length, categorized.opponent.guests.length, battleParticipants.length]);

  // Determine if a side has only the host (no guests) - for single-host styling
  const challengerIsSingleHost = challengerSlots.length === 1 && challengerSlots[0]?.type === 'host';
  const opponentIsSingleHost = opponentSlots.length === 1 && opponentSlots[0]?.type === 'host';
  const isSingleHostBattle = challengerIsSingleHost && opponentIsSingleHost;

  const battleLeadTeam = challengerScore > opponentScore
    ? 'challenger'
    : opponentScore > challengerScore
      ? 'opponent'
      : 'tie';

  const challengerGlowClass = battleLeadTeam === 'challenger'
    ? 'border-2 border-emerald-500/90 shadow-[0_0_30px_rgba(16,185,129,0.45)]'
    : 'border-2 border-emerald-500/20';
  const opponentGlowClass = battleLeadTeam === 'opponent'
    ? 'border-2 border-fuchsia-500/90 shadow-[0_0_30px_rgba(192,38,211,0.45)]'
    : 'border-2 border-fuchsia-500/20';
  const vsGlowClass = battleLeadTeam === 'challenger'
    ? 'text-emerald-300 drop-shadow-[0_0_20px_rgba(16,185,129,0.85)]'
    : battleLeadTeam === 'opponent'
      ? 'text-fuchsia-300 drop-shadow-[0_0_20px_rgba(192,38,211,0.85)]'
      : 'text-white/90 drop-shadow-[0_0_12px_rgba(255,255,255,0.45)]';

  // Mobile-optimized grid layout: horizontal layout for mobile, vertical split for desktop
  const getGridClass = (totalSlots: number) => {
    // Mobile: Always use horizontal layout (2 columns) for both sides
    // Desktop: Use existing vertical split logic
    if (isMobileViewport) {
      // On mobile, each side shows its own grid independently
      // Host + guests for each team in a row
      // Use square aspect ratio for mobile battle arena
      if (totalSlots === 1) return 'grid-cols-1';
      if (totalSlots === 2) return 'grid-cols-2';
      if (totalSlots === 3) return 'grid-cols-3';
      if (totalSlots <= 4) return 'grid-cols-2';
      if (totalSlots <= 6) return 'grid-cols-3';
      return 'grid-cols-3';
    }
    // Desktop layout
    if (totalSlots === 1) return 'grid-cols-1 grid-rows-1';
    if (totalSlots === 2) return 'grid-cols-1 grid-rows-2';
    if (totalSlots === 3) return 'grid-cols-1 grid-rows-3';
    if (totalSlots === 4) return 'grid-cols-2 grid-rows-2';
    if (totalSlots === 5) return 'grid-cols-1 grid-rows-5 md:grid-cols-2 md:grid-rows-3';
    if (totalSlots === 6) return 'grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2';
    return 'grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2';
  };

return (
    <div className={cn(
      "w-full h-full min-h-0 overflow-hidden p-2 md:p-4 gap-2 md:gap-4",
      isMobileViewport && isSingleHostBattle ? "flex flex-col" : "flex"
    )}>
      {/* Mobile Layout: vertical split for single-host battles, horizontal for multi-host */}
      {(() => {
        if (isMobileViewport) {
          if (isSingleHostBattle) {
            return (
              <>
          {/* Challenger Side - Top */}
          <div className={cn(
            'flex-none w-full flex flex-col gap-1 overflow-hidden rounded-3xl p-1',
            challengerGlowClass
          )} style={{ height: 'calc((100% - 4.5rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)) / 2)' }}>
            <div className="grid gap-1 grid-cols-1 w-full h-full">
              {challengerSlots.map((slot, idx) => (
                <div key={`challenger-slot-${idx}`} className="min-h-0 h-full">
                  {slot.type === 'host' ? (
                    <div
                      className={cn(
                        "transform transition-transform hover:scale-[1.02] h-full",
                        !slot.participant && "opacity-50"
                      )}
                    >
                      {slot.participant ? (
                        <JailTimeHostTile side="challenger" isLosing={challengerLosing} onJailLock={onChallengerJailLock} onJailUnlock={onChallengerJailUnlock} broadcasterId={challengerHostId} streamId={challengerStreamId} battleId={battleId} battleResult={battleResult === 'tie' ? 'tie' : battleResult === 'win' ? 'win' : battleResult === 'lose' ? 'lose' : null}>
                          <BattleParticipantTile
                            {...slot.participant}
                            side="challenger"
                            crownInfo={challengerCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'opponent'}
                            onTroll={() => handleTrollClick('challenger')}
                            onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                            isSingleHost={true}
                          />
                        </JailTimeHostTile>
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border-2 border-purple-500/30 bg-black/40 flex flex-col items-center justify-center">
                          <User className="text-purple-500/50" size={48} />
                          <span className="text-purple-500/50 text-sm mt-2">Waiting for challenger...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "transform transition-transform hover:scale-[1.02] h-full",
                        !slot.participant && "opacity-50"
                      )}
                    >
                      {slot.participant ? (
                        <BattleParticipantTile
                          {...slot.participant}
                          side="challenger"
                          onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                        />
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border border-purple-500/20 bg-black/20 flex flex-col items-center justify-center">
                          <User className="text-purple-500/30" size={24} />
                          <span className="text-purple-500/30 text-xs mt-1">Empty</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Center: VS + Score + Timer */}
          <div className="flex-none flex items-center justify-center gap-3 h-16 px-2">
            {/* Challenger score */}
            <div className="flex-1 flex flex-col items-end">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 truncate max-w-full">{challengerHostName || 'Challenger'}</span>
              <span className="font-mono text-lg font-black leading-none text-purple-400">{challengerScore.toLocaleString()}</span>
            </div>

            {/* Center VS + Timer */}
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
              <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/60',
                vsGlowClass
              )}>
                <span className="text-xs font-black uppercase tracking-wider">VS</span>
              </div>
              <div className={cn(
                "font-mono text-xs font-bold leading-none",
                isSuddenDeath ? "text-red-500" : "text-white"
              )}>
                {battleStatus === 'ended' ? "ENDED" : timeLeft !== undefined ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : "3:00"}
              </div>
            </div>

            {/* Opponent score */}
            <div className="flex-1 flex flex-col items-start">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 truncate max-w-full">{opponentHostName || 'Opponent'}</span>
              <span className="font-mono text-lg font-black leading-none text-emerald-400">{opponentScore.toLocaleString()}</span>
            </div>
          </div>

          {/* Opponent Side - Bottom */}
          <div className={cn(
            'flex-none w-full flex flex-col gap-1 overflow-hidden rounded-3xl p-1',
            opponentGlowClass
          )} style={{ height: 'calc((100% - 4.5rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)) / 2)' }}>
            <div className="grid gap-1 grid-cols-1 w-full h-full">
              {opponentSlots.map((slot, idx) => (
                <div key={`opponent-slot-${idx}`} className="min-h-0 h-full">
                  {slot.type === 'host' ? (
                    <div
                      className={cn(
                        "transform transition-transform hover:scale-[1.02] h-full",
                        !slot.participant && "opacity-50"
                      )}
                    >
                      {slot.participant ? (
                        <JailTimeHostTile side="opponent" isLosing={opponentLosing} onJailLock={onOpponentJailLock} onJailUnlock={onOpponentJailUnlock} broadcasterId={opponentHostId} streamId={opponentStreamId} battleId={battleId} battleResult={battleResult === 'tie' ? 'tie' : battleResult === 'lose' ? 'win' : battleResult === 'win' ? 'lose' : null}>
                          <BattleParticipantTile
                            {...slot.participant}
                            side="opponent"
                            crownInfo={opponentCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'challenger'}
                            onTroll={() => handleTrollClick('opponent')}
                            onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                            isSingleHost={true}
                          />
                        </JailTimeHostTile>
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border-2 border-emerald-500/30 bg-black/40 flex flex-col items-center justify-center">
                          <User className="text-emerald-500/50" size={48} />
                          <span className="text-emerald-500/50 text-sm mt-2">Waiting for opponent...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "transform transition-transform hover:scale-[1.02] h-full",
                        !slot.participant && "opacity-50"
                      )}
                    >
                      {slot.participant ? (
                        <BattleParticipantTile
                          {...slot.participant}
                          side="opponent"
                          onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                        />
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border border-emerald-500/20 bg-black/20 flex flex-col items-center justify-center">
                          <User className="text-emerald-500/30" size={24} />
                          <span className="text-emerald-500/30 text-xs mt-1">Empty</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
            );
          }
          return (
        <div className="relative flex-1 min-h-0 h-full flex flex-col gap-1 overflow-hidden">
          {/* Challenger Side - top */}
          <div className={cn(
            'flex-none rounded-3xl border-2 p-1',
            challengerGlowClass
          )} style={{ height: 'calc((100% - 4.5rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)) / 2)' }}>
            <div className="grid gap-1 grid-cols-1 h-full">
              {challengerSlots.map((slot, idx) => (
                <div key={`challenger-slot-${idx}`} className="min-h-0 h-full">
                  {slot.type === 'host' ? (
                    <div className={cn(
                      "transform transition-transform hover:scale-[1.02] h-full",
                      !slot.participant && "opacity-50"
                    )}>
                      {slot.participant ? (
                        <JailTimeHostTile side="challenger" isLosing={challengerLosing} onJailLock={onChallengerJailLock} onJailUnlock={onChallengerJailUnlock} broadcasterId={challengerHostId} streamId={challengerStreamId} battleId={battleId} battleResult={battleResult === 'tie' ? 'tie' : battleResult === 'win' ? 'win' : battleResult === 'lose' ? 'lose' : null}>
                          <BattleParticipantTile
                            {...slot.participant}
                            side="challenger"
                            crownInfo={challengerCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'opponent'}
                            onTroll={() => handleTrollClick('challenger')}
                            onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                            isSingleHost={challengerIsSingleHost}
                          />
                        </JailTimeHostTile>
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border-2 border-purple-500/30 bg-black/40 flex flex-col items-center justify-center">
                          <User className="text-purple-500/50" size={48} />
                          <span className="text-purple-500/50 text-sm mt-2">Waiting for challenger...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={cn(
                      "transform transition-transform hover:scale-[1.02] h-full",
                      !slot.participant && "opacity-50"
                    )}>
                      {slot.participant ? (
                        <BattleParticipantTile
                          {...slot.participant}
                          side="challenger"
                          onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                        />
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border border-purple-500/20 bg-black/20 flex flex-col items-center justify-center">
                          <User className="text-purple-500/30" size={24} />
                          <span className="text-purple-500/30 text-xs mt-1">Empty</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Center: VS + Timer + Score */}
          <div className="flex-none flex items-center justify-center gap-2 h-16 px-2">
            {/* Challenger score */}
            <div className="flex-1 flex flex-col items-end">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 truncate max-w-full">{challengerHostName || 'Challenger'}</span>
              <span className="font-mono text-lg font-black leading-none text-purple-400">{challengerScore.toLocaleString()}</span>
            </div>

            {/* Center VS + Timer */}
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
              <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/60',
                vsGlowClass
              )}>
                <span className="text-xs font-black uppercase tracking-wider">VS</span>
              </div>
              <div className={cn(
                "font-mono text-xs font-bold leading-none",
                isSuddenDeath ? "text-red-500" : "text-white"
              )}>
                {battleStatus === 'ended' ? "ENDED" : timeLeft !== undefined ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : "3:00"}
              </div>
            </div>

            {/* Opponent score */}
            <div className="flex-1 flex flex-col items-start">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 truncate max-w-full">{opponentHostName || 'Opponent'}</span>
              <span className="font-mono text-lg font-black leading-none text-emerald-400">{opponentScore.toLocaleString()}</span>
            </div>
          </div>

          {/* Opponent Side - bottom */}
          <div className={cn(
            'flex-none rounded-3xl border-2 p-1',
            opponentGlowClass
          )} style={{ height: 'calc((100% - 4.5rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)) / 2)' }}>
            <div className="grid gap-1 grid-cols-1 h-full">
              {opponentSlots.map((slot, idx) => (
                <div key={`opponent-slot-${idx}`} className="min-h-0 h-full">
                  {slot.type === 'host' ? (
                    <div className={cn(
                      "transform transition-transform hover:scale-[1.02] h-full",
                      !slot.participant && "opacity-50"
                    )}>
                      {slot.participant ? (
                        <JailTimeHostTile side="opponent" isLosing={opponentLosing} onJailLock={onOpponentJailLock} onJailUnlock={onOpponentJailUnlock} broadcasterId={opponentHostId} streamId={opponentStreamId} battleId={battleId} battleResult={battleResult === 'tie' ? 'tie' : battleResult === 'lose' ? 'win' : battleResult === 'win' ? 'lose' : null}>
                          <BattleParticipantTile
                            {...slot.participant}
                            side="opponent"
                            crownInfo={opponentCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'challenger'}
                            onTroll={() => handleTrollClick('opponent')}
                            onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                            isSingleHost={opponentIsSingleHost}
                          />
                        </JailTimeHostTile>
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border-2 border-emerald-500/30 bg-black/40 flex flex-col items-center justify-center">
                          <User className="text-emerald-500/50" size={48} />
                          <span className="text-emerald-500/50 text-sm mt-2">Waiting for opponent...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={cn(
                      "transform transition-transform hover:scale-[1.02] h-full",
                      !slot.participant && "opacity-50"
                    )}>
                      {slot.participant ? (
                        <BattleParticipantTile
                          {...slot.participant}
                          side="opponent"
                          onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                        />
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border border-emerald-500/20 bg-black/20 flex flex-col items-center justify-center">
                          <User className="text-emerald-500/30" size={24} />
                          <span className="text-emerald-500/30 text-xs mt-1">Empty</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
            );
        }
        if (isSingleHostBattle) {
          return (
        /* Desktop Layout: Vertical split */
        <>
          {/* Challenger Side */}
          <div className="flex-1 min-h-0 h-full flex flex-col gap-2 md:gap-3 overflow-y-auto pr-1 scrollbar-hide">
            {!isBroadcaster && (
              <button
                onClick={() => handleSideGiftClick('challenger')}
                className="hidden md:inline-flex self-start relative z-20 pointer-events-auto touch-manipulation items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white border border-purple-400/50 shadow-lg shadow-purple-500/20 transition-all hover:scale-105"
               >
                 <Gift size={14} />
                 Gift Side A
               </button>
            )}
            
             {/* Unified Grid for Host + Guests */}
             <TeamSeatControls team="challenger" />
            <TeamSeatControls team="challenger" />
            <div className={`grid gap-2 ${getGridClass(challengerSlots.length)} h-full`}>
              {challengerSlots.map((slot, idx) => (
                <div key={`challenger-slot-${idx}`} className="min-h-0 h-full">
                  {slot.type === 'host' ? (
                    <div
                      className={cn(
                        "transform transition-transform hover:scale-[1.02] h-full",
                        !slot.participant && "opacity-50"
                      )}
                    >
                      {slot.participant ? (
                        <JailTimeHostTile side="challenger" isLosing={challengerLosing} onJailLock={onChallengerJailLock} onJailUnlock={onChallengerJailUnlock} broadcasterId={challengerHostId} streamId={challengerStreamId} battleId={battleId} battleResult={battleResult === 'tie' ? 'tie' : battleResult === 'win' ? 'win' : battleResult === 'lose' ? 'lose' : null}>
                          <BattleParticipantTile
                            {...slot.participant}
                            side="challenger"
                            crownInfo={challengerCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'opponent'}
                            onTroll={() => handleTrollClick('challenger')}
                            onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                            isSingleHost={challengerIsSingleHost}
                          />
                        </JailTimeHostTile>
                      ) : (
                        false ? (
                          <BattleParticipantTile
                            identity={challengerHostId}
                            name={challengerHostName || 'Challenger'}
                            isLocal={false}
                            isMicrophoneEnabled={true}
                            isCameraEnabled={true}
                            metadata={{ role: 'host' }}
                            role="host"
                            team="challenger"
                            sourceStreamId={challengerStreamId}
                            side="challenger"
                            crownInfo={challengerCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'opponent'}
                            onTroll={() => handleTrollClick('challenger')}
                            isSingleHost={challengerIsSingleHost}
                            onTileClick={() => handleParticipantBoxClick({
                              identity: challengerHostId,
                              name: challengerHostName || 'Challenger',
                              isLocal: false,
                              isMicrophoneEnabled: false,
                              isCameraEnabled: true,
                              metadata: { role: 'host' },
                              role: 'host',
                              team: 'challenger',
                              sourceStreamId: challengerStreamId,
                            })}
                            onToggleCamera={currentUserId === challengerHostId ? onToggleCamera : undefined}
                            onToggleMic={currentUserId === challengerHostId ? onToggleMic : undefined}
                            canToggleCamera={currentUserId === challengerHostId}
                            canToggleMic={currentUserId === challengerHostId}
                          />
                        ) : (
                          <div className="h-full min-h-0 rounded-2xl border-2 border-purple-500/30 bg-black/40 flex flex-col items-center justify-center">
                            <User className="text-purple-500/50" size={48} />
                            <span className="text-purple-500/50 text-sm mt-2">Waiting for challenger...</span>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "transform transition-transform hover:scale-[1.02] h-full",
                        !slot.participant && "opacity-50"
                      )}
                    >
                      {slot.participant ? (
                        <BattleParticipantTile
                          {...slot.participant}
                          side="challenger"
                          onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                        />
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border border-purple-500/20 bg-black/20 flex flex-col items-center justify-center">
                          <User className="text-purple-500/30" size={24} />
                          <span className="text-purple-500/30 text-xs mt-1">Empty</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Center: VS + Score + Timer */}
          <div className="flex-none w-24 flex flex-col items-center justify-center gap-1.5 px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
              {isSuddenDeath ? "SUDDEN DEATH" : "1v1 BATTLE"}
            </span>
            <div className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60',
              vsGlowClass
            )}>
              <span className="text-lg font-black uppercase tracking-[0.15em]">VS</span>
            </div>
            <div className={cn(
              "font-mono text-sm font-black leading-none",
              isSuddenDeath ? "text-red-500" : "text-white/70"
            )}>
              {battleStatus === 'ended' ? "ENDED" : timeLeft !== undefined ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : "3:00"}
            </div>
            <div className="flex items-center justify-between w-full">
              <span className="font-mono text-base font-black text-purple-400">{challengerScore.toLocaleString()}</span>
              <span className="text-[7px] font-bold text-white/30">Â·</span>
              <span className="font-mono text-base font-black text-emerald-400">{opponentScore.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-1 w-full">
              <span className="text-right text-[8px] font-bold uppercase tracking-wider text-purple-400 truncate">{challengerHostName || 'A'}</span>
              <span className="text-[7px] text-white/30">Â·</span>
              <span className="text-left text-[8px] font-bold uppercase tracking-wider text-emerald-400 truncate">{opponentHostName || 'B'}</span>
            </div>
          </div>

          {/* Opponent Side */}
          <div className="flex-1 min-h-0 h-full flex flex-col gap-2 md:gap-3 overflow-y-auto pl-1 scrollbar-hide">
            {!isBroadcaster && (
              <button
                onClick={() => handleSideGiftClick('opponent')}
                className="hidden md:inline-flex self-start relative z-20 pointer-events-auto touch-manipulation items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white border border-emerald-400/50 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
               >
                 <Gift size={14} />
                 Gift Side B
               </button>
            )}
            
             {/* Unified Grid for Host + Guests - match BroadcastGrid layout */}
             <TeamSeatControls team="opponent" />
            <TeamSeatControls team="opponent" />
            <div className={`grid gap-2 ${getGridClass(opponentSlots.length)} h-full`}>
              {opponentSlots.map((slot, idx) => (
                <div key={`opponent-slot-${idx}`} className="min-h-0 h-full">
                  {slot.type === 'host' ? (
                    <div
                      className={cn(
                        "transform transition-transform hover:scale-[1.02] h-full",
                        !slot.participant && "opacity-50"
                      )}
                    >
                      {slot.participant ? (
                        <JailTimeHostTile side="opponent" isLosing={opponentLosing} onJailLock={onOpponentJailLock} onJailUnlock={onOpponentJailUnlock} broadcasterId={opponentHostId} streamId={opponentStreamId} battleId={battleId} battleResult={battleResult === 'tie' ? 'tie' : battleResult === 'lose' ? 'win' : battleResult === 'win' ? 'lose' : null}>
                          <BattleParticipantTile
                            {...slot.participant}
                            side="opponent"
                            crownInfo={opponentCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'challenger'}
                            onTroll={() => handleTrollClick('opponent')}
                            onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                            isSingleHost={opponentIsSingleHost}
                          />
                        </JailTimeHostTile>
                      ) : (
                        false ? (
                          <BattleParticipantTile
                            identity={opponentHostId}
                            name={opponentHostName || 'Opponent'}
                            isLocal={false}
                            isMicrophoneEnabled={true}
                            isCameraEnabled={true}
                            metadata={{ role: 'host' }}
                            role="host"
                            team="opponent"
                            sourceStreamId={opponentStreamId}
                            side="opponent"
                            crownInfo={opponentCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'challenger'}
                            onTroll={() => handleTrollClick('opponent')}
                            isSingleHost={opponentIsSingleHost}
                            onTileClick={() => handleParticipantBoxClick({
                              identity: opponentHostId,
                              name: opponentHostName || 'Opponent',
                              isLocal: false,
                              isMicrophoneEnabled: false,
                              isCameraEnabled: true,
                              metadata: { role: 'host' },
                              role: 'host',
                              team: 'opponent',
                              sourceStreamId: opponentStreamId,
                            })}
                            onToggleCamera={currentUserId === opponentHostId ? onToggleCamera : undefined}
                            onToggleMic={currentUserId === opponentHostId ? onToggleMic : undefined}
                            canToggleCamera={currentUserId === opponentHostId}
                            canToggleMic={currentUserId === opponentHostId}
                          />
                        ) : (
                          <div className="h-full min-h-0 rounded-2xl border-2 border-emerald-500/30 bg-black/40 flex flex-col items-center justify-center">
                            <User className="text-emerald-500/50" size={48} />
                            <span className="text-emerald-500/50 text-sm mt-2">Waiting for opponent...</span>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "transform transition-transform hover:scale-[1.02] h-full",
                        !slot.participant && "opacity-50"
                      )}
                    >
                      {slot.participant ? (
                        <BattleParticipantTile
                          {...slot.participant}
                          side="opponent"
                          onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                        />
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border border-emerald-500/20 bg-black/20 flex flex-col items-center justify-center">
                          <User className="text-emerald-500/30" size={24} />
                          <span className="text-emerald-500/30 text-xs mt-1">Empty</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
          );
        }
        return (
        /* Desktop Layout: Random battle â€” side by side with score/timer/VS in center */
        <>
          {/* Challenger Side */}
          <div className="flex-1 min-h-0 h-full flex flex-col gap-2 md:gap-3 overflow-y-auto pr-1 scrollbar-hide">
            {!isBroadcaster && (
              <button
                onClick={() => handleSideGiftClick('challenger')}
                className="hidden md:inline-flex self-start relative z-20 pointer-events-auto touch-manipulation items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white border border-purple-400/50 shadow-lg shadow-purple-500/20 transition-all hover:scale-105"
               >
                 <Gift size={14} />
                 Gift Side A
               </button>
            )}
            <div className={`grid gap-2 ${getGridClass(challengerSlots.length)} h-full`}>
              {challengerSlots.map((slot, idx) => (
                <div key={`challenger-slot-${idx}`} className="min-h-0 h-full">
                  {slot.type === 'host' ? (
                    <div className={cn(
                      "transform transition-transform hover:scale-[1.02] h-full",
                      !slot.participant && "opacity-50"
                    )}>
                      {slot.participant ? (
                        <JailTimeHostTile side="challenger" isLosing={challengerLosing} onJailLock={onChallengerJailLock} onJailUnlock={onChallengerJailUnlock} broadcasterId={challengerHostId} streamId={challengerStreamId} battleId={battleId} battleResult={battleResult === 'tie' ? 'tie' : battleResult === 'win' ? 'win' : battleResult === 'lose' ? 'lose' : null}>
                          <BattleParticipantTile
                            {...slot.participant}
                            side="challenger"
                            crownInfo={challengerCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'opponent'}
                            onTroll={() => handleTrollClick('challenger')}
                            onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                            isSingleHost={challengerIsSingleHost}
                          />
                        </JailTimeHostTile>
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border-2 border-purple-500/30 bg-black/40 flex flex-col items-center justify-center">
                          <User className="text-purple-500/50" size={48} />
                          <span className="text-purple-500/50 text-sm mt-2">Waiting for challenger...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={cn(
                      "transform transition-transform hover:scale-[1.02] h-full",
                      !slot.participant && "opacity-50"
                    )}>
                      {slot.participant ? (
                        <BattleParticipantTile
                          {...slot.participant}
                          side="challenger"
                          onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                        />
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border border-purple-500/20 bg-black/20 flex flex-col items-center justify-center">
                          <User className="text-purple-500/30" size={24} />
                          <span className="text-purple-500/30 text-xs mt-1">Empty</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Center: VS + Score + Timer */}
          <div className="flex-none w-28 flex flex-col items-center justify-center gap-2 px-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40">
              {isSuddenDeath ? "SUDDEN DEATH" : `${challengerSlots.length}v${opponentSlots.length} BATTLE`}
            </span>
            <div className={cn(
              'flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-black/60',
              vsGlowClass
            )}>
              <span className="text-2xl font-black uppercase tracking-[0.2em]">VS</span>
            </div>
            <div className={cn(
              "font-mono text-lg font-black leading-none",
              isSuddenDeath ? "text-red-500" : "text-white"
            )}>
              {battleStatus === 'ended' ? "ENDED" : timeLeft !== undefined ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : "3:00"}
            </div>
            <div className="flex flex-col items-center gap-1 w-full">
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-lg font-black text-purple-400">{challengerScore.toLocaleString()}</span>
                <span className="text-[8px] font-bold text-white/30">SCORE</span>
                <span className="font-mono text-lg font-black text-emerald-400">{opponentScore.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-1 w-full">
                <span className="text-right text-[9px] font-bold uppercase tracking-wider text-purple-400 truncate">{challengerHostName || 'Player A'}</span>
                <span className="text-[8px] text-white/30">Â·</span>
                <span className="text-left text-[9px] font-bold uppercase tracking-wider text-emerald-400 truncate">{opponentHostName || 'Player B'}</span>
              </div>
            </div>
          </div>

          {/* Opponent Side */}
          <div className="flex-1 min-h-0 h-full flex flex-col gap-2 md:gap-3 overflow-y-auto pl-1 scrollbar-hide">
            {!isBroadcaster && (
              <button
                onClick={() => handleSideGiftClick('opponent')}
                className="hidden md:inline-flex self-start relative z-20 pointer-events-auto touch-manipulation items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white border border-emerald-400/50 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
               >
                 <Gift size={14} />
                 Gift Side B
               </button>
            )}
            <div className={`grid gap-2 ${getGridClass(opponentSlots.length)} h-full`}>
              {opponentSlots.map((slot, idx) => (
                <div key={`opponent-slot-${idx}`} className="min-h-0 h-full">
                  {slot.type === 'host' ? (
                    <div className={cn(
                      "transform transition-transform hover:scale-[1.02] h-full",
                      !slot.participant && "opacity-50"
                    )}>
                      {slot.participant ? (
                        <JailTimeHostTile side="opponent" isLosing={opponentLosing} onJailLock={onOpponentJailLock} onJailUnlock={onOpponentJailUnlock} broadcasterId={opponentHostId} streamId={opponentStreamId} battleId={battleId} battleResult={battleResult === 'tie' ? 'tie' : battleResult === 'lose' ? 'win' : battleResult === 'win' ? 'lose' : null}>
                          <BattleParticipantTile
                            {...slot.participant}
                            side="opponent"
                            crownInfo={opponentCrownInfo}
                            isSuddenDeath={isSuddenDeath}
                            canTroll={canTroll && currentUserTeam === 'challenger'}
                            onTroll={() => handleTrollClick('opponent')}
                            onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                            isSingleHost={opponentIsSingleHost}
                          />
                        </JailTimeHostTile>
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border-2 border-emerald-500/30 bg-black/40 flex flex-col items-center justify-center">
                          <User className="text-emerald-500/50" size={48} />
                          <span className="text-emerald-500/50 text-sm mt-2">Waiting for opponent...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={cn(
                      "transform transition-transform hover:scale-[1.02] h-full",
                      !slot.participant && "opacity-50"
                    )}>
                      {slot.participant ? (
                        <BattleParticipantTile
                          {...slot.participant}
                          side="opponent"
                          onTileClick={() => handleParticipantBoxClick(slot.participant!)}
                          onToggleCamera={slot.participant?.identity === currentUserId ? onToggleCamera : undefined}
                          onToggleMic={slot.participant?.identity === currentUserId ? onToggleMic : undefined}
                          canToggleCamera={slot.participant?.identity === currentUserId}
                          canToggleMic={slot.participant?.identity === currentUserId}
                        />
                      ) : (
                        <div className="h-full min-h-0 rounded-2xl border border-emerald-500/20 bg-black/20 flex flex-col items-center justify-center">
                          <User className="text-emerald-500/30" size={24} />
                          <span className="text-emerald-500/30 text-xs mt-1">Empty</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
        );
      })()}

      {/* Pre-battle countdown overlay */}
      {preBattleCountdown !== null && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <motion.div
            key={preBattleCountdown}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-6xl font-black text-white mb-4"
          >
            {preBattleCountdown}
          </motion.div>
          <div className="text-lg text-white/70 font-bold">Preparing battle cameras...</div>
          <div className="mt-4 flex gap-4 text-xs">
            <span className={cameraCheckResults.challenger?.hasVideo ? 'text-green-400' : 'text-red-400'}>
              Challenger: {cameraCheckResults.challenger?.hasVideo ? 'âœ… Camera ready' : 'âŒ No camera'}
            </span>
            <span className={cameraCheckResults.opponent?.hasVideo ? 'text-green-400' : 'text-red-400'}>
              Opponent: {cameraCheckResults.opponent?.hasVideo ? 'âœ… Camera ready' : 'âŒ No camera'}
            </span>
          </div>
        </div>
      )}

      {<BattleAudioRenderer entries={remoteAudioEntries} />}
    </div>
  );
};

export const MemoBattleArena = React.memo(BattleArena);

/** Connection status badge used by both desktop and mobile layouts. */
export function BattleConnectionStatus({
  connectionStatus,
}: {
  connectionStatus: "connecting" | "connected" | "disconnected" | "failed";
}) {
  if (connectionStatus === "connecting") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/50 rounded-full">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
        <span className="text-yellow-400 text-xs font-bold">Connecting...</span>
      </div>
    );
  } else if (connectionStatus === "failed") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/50 rounded-full">
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        <span className="text-red-400 text-xs font-bold">Connection Failed</span>
      </div>
    );
  } else if (connectionStatus === "disconnected") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/50 rounded-full">
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        <span className="text-red-400 text-xs font-bold">Disconnected</span>
      </div>
    );
  }
  return null;
}
