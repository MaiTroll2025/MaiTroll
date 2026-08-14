import { useMemo, useState, useRef, useEffect, useCallback, memo, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LocalVideoTrack, LocalAudioTrack, RemoteParticipant, RemoteVideoTrack, RemoteAudioTrack, Track } from 'livekit-client';
import { StagePass, Stream } from '../../types/broadcast';
import { User, Users, Coins, Plus, Minus, MicOff, VideoOff, Gift, Gem, Crown, Swords, Shield, Palette, X, Circle, Cloud } from 'lucide-react';
import { cn } from '../../lib/utils';
import BroadcastHouseIcon from './BroadcastHouseIcon';

import { supabase } from '../../lib/supabase';
import { getBroadcastTheme } from '../../lib/broadcastThemes';
import ThemeEffectLayer from '../themes/ThemeEffectLayer';
import { useAuthStore } from '../../lib/store';
import { useStreamRealtime } from '../../hooks/useStreamRealtime';
import { useParticipantAttributes } from '../../hooks/useParticipantAttributes';
import { useStagePasses } from '../../hooks/useStagePasses';
import { useProfileFrameStore } from '@/stores/useProfileFrameStore';
import GiftAnimationLayer from '@/components/broadcast/GiftAnimationLayer';
import { getAllPersistentGifts, type PersistentGift } from '../../lib/persistentGiftStore';
import type { TrollToeMatch } from '../../types/trollToe';
import BroadcastTicker from './BroadcastTicker';
import SeatHeatBar from './SeatHeatBar';
import BroadcastStageLayout from './BroadcastStageLayout';
import { SeatSession } from '@/hooks/useStreamSeats';
import ProfileFrame from '@/components/profile/ProfileFrame';
import { useUserFrame } from '@/hooks/useUserFrame';
import UserMiniProfile from '@/components/user/UserMiniProfile';

function getVideoTrackFromRemoteParticipant(participant: any): RemoteVideoTrack | null {
  if (!participant) return null
  const directCandidates = [
    participant.videoTrack,
    participant.cameraTrack,
    participant.track,
    participant.video,
    participant.getTrackPublication?.(Track.Source.Camera)?.track,
    participant.getTrackPublication?.(Track.Kind.Video)?.track,
  ]
  for (const candidate of directCandidates) {
    if (candidate?.attach && (candidate?.kind === Track.Kind.Video || candidate?.mediaStreamTrack?.kind === 'video')) {
      return candidate as RemoteVideoTrack
    }
  }
  return null
}

 // Battle Timer Display Component - Shows 3 minute countdown for standalone battles

interface BattleState {
  active: boolean;
  battleId: string | null;
  hostId: string | null;
  challengerId: string | null;
  broadcasterScore: number;
  challengerScore: number;
  startedAt: Date | null;
  endsAt: Date | null;
  suddenDeath: boolean;
}

interface BattleSupporter {
  userId: string;
  team: 'broadcaster' | 'challenger';
}

interface BroadcastGridProps {
  stream: Stream;
  isHost: boolean;
  isModerator?: boolean;
  isOfficer?: boolean;
  streamStatus: Stream['status'];
  maxItems?: number;
  onGift: (userId: string) => void;
  onGiftAll: (ids: string[]) => void;
  mode?: 'viewer' | 'stage';
  seats?: Record<number, SeatSession>;
  onJoinSeat?: (index: number) => void;
  onKick?: (userId: string) => void;
  broadcasterProfile?: any;
  hideEmptySeats?: boolean;
  seatPriceOverride?: number;
  localTracks: [LocalAudioTrack | undefined, LocalVideoTrack | undefined];
  // Camera overlay track for gaming screen share mode
  cameraOverlayTrack?: LocalVideoTrack | null;
  remoteUsers: RemoteParticipant[];
  localUserId: string;
  toggleCamera: () => void;
  toggleMicrophone: () => void;
  flipCamera?: () => void;
  isCameraOn?: boolean;
  isMicOn?: boolean;
  cameraFacingMode?: 'user' | 'environment';
  // Mapping of user IDs to LiveKit identities for remote users
  userIdToLiveKitIdentity?: Record<string, string>;
  // Callback to get user box positions for gift animations
  onGetUserPositions?: (getPositions: () => Record<string, { top: number; left: number; width: number; height: number }>) => void;
  // Optional box count override (from useBoxCount hook for performance)
  boxCount?: number;
  // Battle mode props
  battleState?: BattleState;
  supporters?: Map<string, BattleSupporter>;
  onPickSide?: (team: 'broadcaster' | 'challenger') => void;
  joinWindowOpen?: boolean;
  userTeam?: 'broadcaster' | 'challenger' | null;
  remainingTime?: number;
  shouldShowSidePicker?: boolean;
  onBattleGift?: (team: 'broadcaster' | 'challenger', amount: number) => Promise<boolean>;
  // Standalone battle timer (when battle_id columns don't work)
  isBattleActive?: boolean;
  battleStartedAt?: Date | null;
  // Universal Battle props
  battleFormat?: '1v1' | '2v2' | '3v3' | '4v4' | '5v5';
  isUniversalBattle?: boolean;
  showTicker?: boolean;
  enableStreamSwipe?: boolean;
  canSwipe?: boolean;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  // Side orb controls (host-only, shown inside broadcaster box)
  onAddBox?: () => void;
  onRemoveBox?: () => void;
  onToggleRgb?: () => void;
  hasRgbEffect?: boolean;
  canEditBoxes?: boolean;
  // Broadcast mode (for hiding controls during game)
  broadcastMode?: 'normal' | 'game' | 'battle';
   // Troll Toe game overlays
   trollToeMatch?: TrollToeMatch | null;
   onTrollToeFog?: (boxIndex: number) => void;
   canTrollToeFog?: boolean;
   // Mobile viewer mode (disables interactions)
   isMobileViewer?: boolean;

    // Modal state callbacks (for lifting modal state to parent)
    onOpenUserAction?: (info: { userId: string; username?: string; role?: string; createdAt?: string }) => void;
    onOpenUserStats?: (info: { userId: string; username: string; trollCoins: number; trollmonds: number; licensePlate: string | null; isSeatUser: boolean; streamId?: string }) => void;
    onCloseUserStats?: () => void;
    onOpenHostStats?: () => void;
    onCloseHostStats?: () => void;
    onOpenModActions?: (target: { id: string; username: string; avatar_url?: string | null; role?: string | null; troll_role?: string | null; is_troll_officer?: boolean; is_lead_officer?: boolean; is_admin?: boolean }) => void;
    onCloseModActions?: () => void;
    // ─── Stage Pass / BroadcastStageLayout (host goes live) ───────────────────
    /** Stream ID needed to load stage passes via useStagePasses. */
    streamId?: string;
    /** Callback to open the stage-pass modal (broadcaster only). */
    onOpenPassModal?: () => void;
    onApproveStagePass?: (id: string) => void;
    onDenyStagePass?: (id: string) => void;
    onRemoveStageGuest?: (id: string) => void;
  }

function LiveKitVideoPlayer({
  videoTrack,
  isLocal = false,
  isScreenShare: isScreenShareProp = false,
  themeUrl,
  isCEO = false,
  isRgbEnabled = false,
  broadcasterProfile = null,
}: {
  videoTrack: LocalVideoTrack | RemoteVideoTrack | undefined;
  isLocal?: boolean;
  isScreenShare?: boolean;
  themeUrl?: string | null;
  isCEO?: boolean;
  isRgbEnabled?: boolean;
  broadcasterProfile?: any;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const previousTrackRef = useRef<LocalVideoTrack | RemoteVideoTrack | null>(null);
  const mediaTrack = videoTrack?.mediaStreamTrack;
  const trackLabel = mediaTrack?.label?.toLowerCase() || '';
  const trackName = (videoTrack as any)?.name || '';
  const settings = mediaTrack ? (mediaTrack.getSettings?.() || {}) : {};
  const isScreenShare = isScreenShareProp || (!!videoTrack && (
    trackName === 'screen-share' ||
    trackLabel.includes('screen') ||
    trackLabel.includes('display') ||
    trackLabel.includes('window') ||
    !!(settings as any).displaySurface
  ));

  if (videoTrack && import.meta.env.DEV) {
    if (import.meta.env.DEV) console.debug('[LiveKitVideoPlayer] Track info:', {
      trackName,
      trackLabel,
      displaySurface: (settings as any).displaySurface,
      isScreenShare,
      isScreenShareProp,
      isLocal
    });
  }

  const attachVideoElement = useCallback((track: LocalVideoTrack | RemoteVideoTrack) => {
    if (!containerRef.current) return false;

    try {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.debug('[LiveKitVideoPlayer] Attaching video track:', {
          trackId: (track as any).trackId,
          trackName: (track as any).name,
          isLocal,
          isScreenShare
        });
      }

      // Detach previous element if it exists
      if (videoElementRef.current) {
        try {
          const previousTrack = previousTrackRef.current;
          if (previousTrack && previousTrack !== track) {
            previousTrack.detach();
          }
        } catch (e) {
          console.warn('[LiveKitVideoPlayer] Error detaching previous track:', e);
        }
        videoElementRef.current = null;
      }

      // Clear container
      containerRef.current.innerHTML = '';

      // Attach the track to create a video element
      const videoElement = track.attach() as HTMLVideoElement;
      
      // Configure video element for proper display
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.objectFit = 'contain';
      videoElement.style.position = 'absolute';
      videoElement.style.top = '0';
      videoElement.style.left = '0';
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      
      // Ensure muted for local video to avoid feedback
      if (isLocal) {
        videoElement.muted = true;
      }
      
      containerRef.current.appendChild(videoElement);
      videoElementRef.current = videoElement;
      
      // Mirror only local participant video (self-preview). Remote viewers get unmirrored video.
      const shouldMirror = isLocal && !isScreenShare && (settings as any).facingMode !== 'environment';
      if (containerRef.current) {
        containerRef.current.style.transform = shouldMirror ? 'scaleX(-1)' : '';
      }

      if (import.meta.env.DEV) if (import.meta.env.DEV) console.debug('[LiveKitVideoPlayer] Video track attached successfully');
      return true;
    } catch (err) {
      console.error('[LiveKitVideoPlayer] Failed to attach video track:', err);
      return false;
    }
  }, [isLocal, isScreenShare]);

  useEffect(() => {
    // Cleanup function to detach track when component unmounts or track changes
    const cleanup = () => {
      if (videoElementRef.current) {
        try {
          const track = videoElementRef.current.srcObject;
          if (track) {
            if (import.meta.env.DEV) console.debug('[LiveKitVideoPlayer] Detaching track on cleanup');
            // We don't call track.detach() here to avoid interfering with LiveKit's track management
          }
          videoElementRef.current = null;
        } catch (e) {
          console.warn('[LiveKitVideoPlayer] Error during cleanup:', e);
        }
      }
      
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };

    // If no video track, cleanup and show fallback
    if (!videoTrack) {
      if (import.meta.env.DEV) console.debug('[LiveKitVideoPlayer] No video track, cleaning up');
      cleanup();
      return;
    }

    // If track hasn't changed, skip re-attachment
    if (previousTrackRef.current === videoTrack && videoElementRef.current) {
      if (import.meta.env.DEV) console.debug('[LiveKitVideoPlayer] Track unchanged, skipping re-attachment');
      return;
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      const success = attachVideoElement(videoTrack);
      if (success) {
        previousTrackRef.current = videoTrack;
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      // Don't cleanup immediately on track change to avoid visual glitches
      // Let the new track take over
    };
  }, [videoTrack, attachVideoElement]);

  // Periodically check if video is playing and retry if needed
  useEffect(() => {
    if (!videoTrack || !videoElementRef.current) return;

    const checkVideoPlaying = () => {
      const video = videoElementRef.current;
      if (!video) return;

      const isPlaying = !!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2);
      
      if (!isPlaying && video.srcObject) {
        if (import.meta.env.DEV) console.debug('[LiveKitVideoPlayer] Video not playing, attempting to resume...');
        video.play().catch(e => {
          if (import.meta.env.DEV) console.debug('[LiveKitVideoPlayer] Could not resume video:', e);
        });
      }
    };

    const interval = setInterval(checkVideoPlaying, 2000);
    return () => clearInterval(interval);
  }, [videoTrack]);


  // For CEO users, show theme background when camera is off (disabled when RGB is enabled)
  // IMPORTANT: Never show theme background inside broadcast boxes - theme is only for page frame
  // Broadcasters and participants should see generic camera-off placeholder, never the theme
  const isCEOUser = false; // Disabled: theme should never show inside video players
  const showThemeBackground = false; // Disabled: never show inside broadcast boxes

  // Get broadcast theme for fallback styling
  const broadcastTheme = getBroadcastTheme(themeUrl, 'General Chat'); // Assume General Chat for CEO theme

  // For CEO theme, create a proper CEO background with text and crown
  const backgroundStyle = showThemeBackground ? {
    background: `
      radial-gradient(circle at center, #1a1a1a 0%, #000000 100%),
      linear-gradient(135deg, #FFD700 0%, #B8860B 50%, #FFD700 100%)
    `,
    backgroundSize: 'cover',
    position: 'relative'
  } : {};

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden"
      style={{
        minWidth: '100%',
        minHeight: '100%',
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        backgroundColor: showThemeBackground ? 'transparent' : '#000000',
        background: showThemeBackground ? backgroundStyle.background : 'none',
        backgroundSize: showThemeBackground ? 'cover' : 'auto',
        backgroundPosition: showThemeBackground ? 'center' : 'auto',
        backgroundRepeat: showThemeBackground ? 'no-repeat' : 'auto',
      }}
    >
      {/* CEO Background Content */}
      {showThemeBackground && broadcastTheme && (
        <div className={cn("absolute inset-0 flex flex-col items-center justify-center text-white", broadcastTheme.fallbackCardClassName)}>
          {/* Crown */}
          <div className="mb-4 text-6xl animate-pulse">👑</div>

          {/* CEO OF MAI Text */}
          <div className="text-center mb-8">
            <div className="text-3xl md:text-4xl font-bold text-yellow-400 mb-2 drop-shadow-lg">
              CEO OF MAI
            </div>
            <div className="text-xl md:text-2xl font-semibold text-yellow-300 drop-shadow-md">
              {broadcasterProfile?.username?.toUpperCase() || 'CEO'}
            </div>
          </div>

          {/* LIVE Badge */}
          <div className="bg-red-600 text-white px-4 py-2 rounded-full font-bold text-lg animate-pulse shadow-lg">
            🔴 LIVE
          </div>

          {/* Decorative Elements */}
          <div className="absolute top-4 left-4 text-yellow-400 text-2xl">✨</div>
          <div className="absolute top-4 right-4 text-yellow-400 text-2xl">✨</div>
          <div className="absolute bottom-4 left-4 text-yellow-400 text-2xl">💎</div>
          <div className="absolute bottom-4 right-4 text-yellow-400 text-2xl">💎</div>
        </div>
      )}
    </div>
  );
}

const LiveKitAudioPlayer = memo(({ audioTrack }: { audioTrack: LocalAudioTrack | RemoteAudioTrack }) => {
  const audioRef = useRef<HTMLDivElement>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Defensive: ensure we have a valid track
    if (!audioTrack) {
      if (import.meta.env.DEV) console.debug('[LiveKitAudioPlayer] No audio track');
      return;
    }

    try {
      // LiveKit uses attach() instead of play() for audio
      const audioElement = audioTrack.attach();
      audioElementRef.current = audioElement;
      document.body.appendChild(audioElement);
      if (import.meta.env.DEV) console.debug('[LiveKitAudioPlayer] Audio attached');
    } catch (err) {
      console.error('[LiveKitAudioPlayer] Failed to attach audio:', err);
    }

    return () => {
      try {
        if (audioElementRef.current) {
          audioTrack.detach();
          audioElementRef.current = null;
        }
      } catch (err) {
        console.warn('[LiveKitAudioPlayer] Error stopping audio:', err);
      }
    };
  }, [audioTrack]);

  return <div ref={audioRef}></div>;
});

LiveKitAudioPlayer.displayName = 'LiveKitAudioPlayer';

const BroadcastGridComponent = function BroadcastGrid({
  stream,
  isHost,
  isModerator,
  isOfficer,
  maxItems,
  onGift,
  onGiftAll: _onGiftAll,
  mode: _mode = 'stage',
  seats = {},
  onJoinSeat,
  onKick,
  broadcasterProfile,
  hideEmptySeats = false,
  seatPriceOverride,
  localTracks,
  cameraOverlayTrack,
  remoteUsers,
  localUserId,
  toggleCamera,
  toggleMicrophone,
  flipCamera,
  isCameraOn,
  isMicOn,
  cameraFacingMode = 'user',
  userIdToLiveKitIdentity = {},
  onGetUserPositions,
  streamStatus,
  boxCount: boxCountProp,
  battleState,
  supporters = new Map(),
  onPickSide,
  joinWindowOpen = false,
  userTeam,
  remainingTime = 0,
  shouldShowSidePicker = false,
  onBattleGift,
  battleFormat,
  isBattleActive = false,
  battleStartedAt = null,
  isUniversalBattle,
  enableStreamSwipe = false,
  canSwipe = true,
  onSwipeUp,
  onSwipeDown,
  onAddBox,
  onRemoveBox,
  onToggleRgb,
  hasRgbEffect = false,
  canEditBoxes = false,
   broadcastMode = 'normal',
   trollToeMatch = null,
   onTrollToeFog,
   canTrollToeFog = false,
   showTicker = false,
    isMobileViewer = false,
    // Modal handlers
    onOpenUserAction,
    onOpenUserStats,
    onCloseUserStats,
    onOpenHostStats,
    onCloseHostStats,
    onOpenModActions,
    onCloseModActions,
    onOpenPassModal,
  }: BroadcastGridProps) {
   const renderCountRef = useRef(0);
   renderCountRef.current += 1;
   if (import.meta.env.DEV) console.debug('[BroadcastGrid] render count', renderCountRef.current);
   const gridDebug = (window as any).DEBUG_COUNTERS
   if (gridDebug) {
     gridDebug.broadcastGridRenderCount = (gridDebug.broadcastGridRenderCount || 0) + 1
   }

const { profile } = useAuthStore();
const stagePassesHook = useStagePasses(streamStatus === 'live' ? stream.id : undefined);

  // Mini profile popup state
  const [miniProfile, setMiniProfile] = useState<{ userId: string; username: string; avatarUrl: string } | null>(null);

  // Frame cache for seat users (populated via effect)
  const frameCacheRef = useRef<Map<string, import('@/config/profileFrames').ProfileFrame | null>>(new Map())
  const [, forceUpdate] = useState(0)
  const catalog = useProfileFrameStore((s: any) => s.catalog)
  const seatAssignments = useMemo(() => Object.values(seats || {}), [seats])

  // Fetch frames for all seated users
  useEffect(() => {
    const userIds = seatAssignments.map((s: any) => s?.user_id).filter(Boolean) as string[]
    if (userIds.length === 0) return
    let cancelled = false
    supabase
      .from('user_profile_frames')
      .select('user_id, frame_id')
      .in('user_id', userIds)
      .eq('is_equipped', true)
      .then(({ data }) => {
        if (cancelled) return
        const newCache = new Map<string, import('@/config/profileFrames').ProfileFrame | null>()
        for (const row of data || []) {
          const frame = catalog.find((f: any) => f.id === (row as any).frame_id)
          if (frame) newCache.set((row as any).user_id, frame)
        }
        frameCacheRef.current = newCache
        forceUpdate((n: number) => n + 1)
      })
    return () => { cancelled = true }
  }, [seatAssignments, catalog])

  const liveStagePasses = useMemo(() => {
    return stagePassesHook.stagePasses
      .filter((pass: StagePass) => pass.status === 'approved' || pass.status === 'live')
      .sort((a, b) => (a.stage_index || 0) - (b.stage_index || 0))
  }, [stagePassesHook.stagePasses]);

  const stageGuestVideoNodes = useMemo(() => {
    const nodes: Record<string, ReactNode> = {};

    liveStagePasses.forEach((pass) => {
      const userId = pass.user_id;
      if (!userId) return;

      const { videoTrack, isScreenShare } = getParticipantAndTracks(userId);
      if (!videoTrack) return;

      nodes[userId] = (
        <LiveKitVideoPlayer
          videoTrack={videoTrack}
          isLocal={false}
          isScreenShare={isScreenShare}
          themeUrl={stream.broadcast_theme_slug}
          isRgbEnabled={!!stream.has_rgb_effect}
          broadcasterProfile={broadcasterProfile}
        />
      );
    });

    return nodes;
  }, [
    liveStagePasses,
    stream.broadcast_theme_slug,
    stream.has_rgb_effect,
    broadcasterProfile,
    localTracks,
    remoteUsers,
    userIdToLiveKitIdentity,
  ]);

  const stageGuestMicCam = useMemo(() => {
    const mapping: Record<string, { micOn: boolean; camOn: boolean }> = {};

    liveStagePasses.forEach((pass) => {
      const userId = pass.user_id;
      if (!userId) return;

      const { audioTrack, videoTrack } = getParticipantAndTracks(userId);
      mapping[userId] = {
        micOn: !!audioTrack,
        camOn: !!videoTrack,
      };
    });

    return mapping;
  }, [liveStagePasses, localTracks, remoteUsers, userIdToLiveKitIdentity]);

    // seatUserIds for license plate lookup and other seat user checks
    const seatUserIds = useMemo(() => {
      const set = new Set<string>();
      if (stream.user_id) set.add(stream.user_id);
      Object.values(seats).forEach((seat) => {
        if (seat?.user_id) set.add(seat.user_id);
        if (seat?.guest_id) set.add(seat.guest_id);
      });
      return Array.from(set);
    }, [stream.user_id, seats]);

    // seatParticipantIdsKey for dependency arrays
    const seatParticipantIdsKey = seatUserIds.join('|');

     // User stats modal state (now managed via props)
     const [licensePlates, setLicensePlates] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!stream?.id || seatUserIds.length === 0) {
      setLicensePlates({});
      return;
    }

    const fetchLicensePlates = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, license_plate')
          .in('id', seatUserIds);

        if (error) {
          throw error;
        }

        const plateMap: Record<string, string | null> = {};
        (data || []).forEach((row: any) => {
          plateMap[row.id] = row.license_plate || null;
        });
        setLicensePlates(plateMap);
      } catch (err) {
        console.error('[BroadcastGrid] Error fetching license plates:', err);
      }
    };

    fetchLicensePlates();
  }, [stream?.id, seatUserIds.join('|')]);

  const boxRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [persistentGifts, setPersistentGifts] = useState<Map<string, PersistentGift[]>>(new Map());
  const [userReceivedGifts, setUserReceivedGifts] = useState<Record<string, number>>({});
  const touchStartYRef = useRef<number | null>(null);
  const touchCurrentYRef = useRef<number | null>(null);
  const swipeLockedRef = useRef(false);

  // Update persistent gifts periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setPersistentGifts(getAllPersistentGifts());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch received gifts only when the stream starts or the seat roster changes.
  useEffect(() => {
    if (!stream?.id || !seats) return;

    const fetchUserGifts = async () => {
      // Get all user IDs currently in seats (both user_id and guest_id)
      const userIdsInStream: string[] = [];
      console.log('[BroadcastLifecycle] Scanning participants for gift history');
      Object.values(seats).forEach((seat) => {
        if (seat?.user_id) userIdsInStream.push(seat.user_id);
        if (seat?.guest_id) userIdsInStream.push(seat.guest_id);
      });
      
      // Also include host
      if (stream.user_id && !userIdsInStream.includes(stream.user_id)) {
        userIdsInStream.push(stream.user_id);
      }

      if (userIdsInStream.length === 0) return;

      try {
        // Fetch gifts from gift_ledger for this stream
        const { data: giftData } = await supabase
          .from('gift_ledger')
          .select('receiver_id, amount')
          .eq('stream_id', stream.id)
          .eq('status', 'processed')
          .in('receiver_id', userIdsInStream);

        if (giftData) {
          // Sum gifts per user
          const giftsByUser: Record<string, number> = {};
          giftData.forEach((gift: { receiver_id: string; amount: number }) => {
            giftsByUser[gift.receiver_id] = (giftsByUser[gift.receiver_id] || 0) + (gift.amount || 0);
          });
          setUserReceivedGifts(giftsByUser);
        }
      } catch (err) {
        console.error('[BroadcastGrid] Error fetching user gifts:', err);
      }
    };

    fetchUserGifts();
  }, [stream?.id, stream?.status, stream?.user_id, seatParticipantIdsKey]);

  // Expose positions when callback is provided
  const getPositionsRef = useRef<() => Record<string, { top: number; left: number; width: number; height: number }>>(() => ({}));
  
  useEffect(() => {
    if (onGetUserPositions) {
      // Store the callback that calculates positions from DOM refs
      getPositionsRef.current = () => {
        const positions: Record<string, { top: number; left: number; width: number; height: number }> = {};
        Object.entries(boxRefs.current).forEach(([seatIndexKey, el]) => {
          const seatIndex = Number(seatIndexKey);
          const seat = seats?.[seatIndex];
          const userId = seat?.user_id || seat?.guest_id || (seatIndex === 0 ? stream.user_id : undefined);
          if (el && userId) {
            const rect = el.getBoundingClientRect();
            positions[userId] = {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            };
          }
        });
        return positions;
      };
      // Also pass the function to the callback so parent can call it
      onGetUserPositions(getPositionsRef.current);
    }
  }, [onGetUserPositions, seats, stream.user_id]);

  // Update positions when seats or user change
  useEffect(() => {
    // Trigger position update after render
    const timeoutId = setTimeout(() => {
      if (getPositionsRef.current) {
        getPositionsRef.current();
      }
    }, 100);
     return () => clearTimeout(timeoutId);
   }, [seats, stream.user_id, stream.box_count]);

   // Real-time mic mute updates
   useStreamRealtime(stream?.id, {
     onParticipant: (event) => {
       const { user_id, mic_muted } = (event.new || {}) as any;
       if (!user_id || mic_muted === undefined) return;
       if (import.meta.env.DEV) console.debug('[BroadcastGrid] Participant mic_muted changed:', user_id, mic_muted);

       const participant = remoteUsers?.find(u => u.identity === user_id);
       participant?.audioTrackPublications?.forEach((pub: any) => {
         if (!pub.track) return;
         try {
           pub.track.enabled = !mic_muted;
         } catch (err) {
           console.error('[BroadcastGrid] Failed to update participant audio:', err);
         }
       });
     },
   });

   // Deduplicate user IDs (prevents redundant attribute lookups)
  // Also include guest_ids for guests
  const userIds = useMemo(() => {
    const set = new Set<string>();
    if (stream.user_id) set.add(stream.user_id); // Always include host
    Object.values(seats).forEach((seat) => {
      if (seat?.user_id) set.add(seat.user_id);
      if (seat?.guest_id) set.add(seat.guest_id); // Add guest IDs
    });
    return Array.from(set);
  }, [stream.user_id, seats]);

  const attributes = useParticipantAttributes(userIds, stream.id);

  const getParticipantAndTracks = (userId: string | undefined, hostUserId?: string) => {
    if (!userId) return { participant: undefined, videoTrack: undefined, audioTrack: undefined, isLocal: false };

    let participant: RemoteParticipant | undefined;
    let videoTrack: LocalVideoTrack | RemoteVideoTrack | undefined;
    let audioTrack: LocalAudioTrack | RemoteAudioTrack | undefined;
    let isLocal = false;

    if (userId === localUserId) {
      // Local user - use the localTracks from props
      isLocal = true;
      // Handle null localTracks
      audioTrack = localTracks?.[0];
      videoTrack = localTracks?.[1];
      if (import.meta.env.DEV) console.debug('[BroadcastGrid] Local user tracks for', userId?.substring(0, 8), ':', {
        hasVideoTrack: !!videoTrack,
        hasAudioTrack: !!audioTrack,
        localTracksLength: localTracks?.length ?? 0,
        localTracks0: localTracks?.[0]?.constructor?.name,
        localTracks1: localTracks?.[1]?.constructor?.name,
        videoTrackId: (videoTrack as any)?.getTrackId?.(),
        videoEnabled: (videoTrack as any)?.enabled,
      });
      // For local participant, we create a dummy participant object
      participant = {
        identity: localUserId,
        videoTrack,
        audioTrack,
      } as unknown as RemoteParticipant;
    } else {
      // Remote user - find in remoteUsers (which are RemoteParticipants)
      // Handle null/undefined remoteUsers
      if (!remoteUsers || !Array.isArray(remoteUsers)) {
        if (import.meta.env.DEV) console.debug('[BroadcastGrid] No remoteUsers available or not an array');
        return { participant: undefined, videoTrack: undefined, audioTrack: undefined, isLocal: false };
      }
      
      const liveKitIdentity = userIdToLiveKitIdentity?.[userId] || userId;
      const normalizedUserId = userId.replace(/-/g, '').toLowerCase();
      const normalizedLiveKitIdentity = liveKitIdentity.replace(/-/g, '').toLowerCase();
      const normalizedUserIdShort = normalizedUserId.substring(0, 8);
      const normalizedLiveKitIdentityShort = normalizedLiveKitIdentity.substring(0, 8);
      const prefixedViewerId = `viewer-${userId.substring(0, 12)}`;

      const hostIdShort = hostUserId ? hostUserId.replace(/-/g, '').toLowerCase().substring(0, 8) : ''

      participant = remoteUsers.find((u) => {
        const identityStr = String(u.identity || '');
        const normalizedIdentity = identityStr.replace(/-/g, '').toLowerCase();
        const normUid = identityStr.replace(/^viewer-/, '').toLowerCase()
        if (hostUserId && (identityStr === hostUserId || normUid === hostUserId || normUid.startsWith(hostIdShort))) return false

        if (identityStr === userId) return true;
        if (identityStr === liveKitIdentity) return true;
        if (identityStr === prefixedViewerId) return true;
        if (normalizedIdentity === normalizedUserId) return true;
        if (normalizedIdentity === normalizedLiveKitIdentity) return true;
        if (normalizedIdentity.startsWith(normalizedUserIdShort)) return true;
        if (normalizedIdentity.startsWith(normalizedLiveKitIdentityShort)) return true;
        if (normalizedIdentity.includes(normalizedUserIdShort)) return true;
        if (normalizedIdentity.includes(normalizedLiveKitIdentityShort)) return true;
        if (normalizedIdentity.endsWith(normalizedUserIdShort)) return true;
        if (normalizedIdentity.endsWith(normalizedLiveKitIdentityShort)) return true;
        if (normalizedUserId.startsWith(normalizedIdentity.substring(0, 8))) return true;
        if (normalizedLiveKitIdentity.startsWith(normalizedIdentity.substring(0, 8))) return true;
        return false;
      });

      if (participant) {
        // Get tracks from the LiveKit participant
        // LiveKit participants have trackPublications - use type assertion
        const videoPubs = (participant.videoTrackPublications as unknown as Map<string, { track?: RemoteVideoTrack; isSubscribed?: boolean }>) || new Map();
        const audioPubs = (participant.audioTrackPublications as unknown as Map<string, { track?: RemoteAudioTrack; isSubscribed?: boolean }>) || new Map();
        
        // Also check trackPublications directly on the participant
        // In LiveKit, tracks may be available even if isSubscribed isn't set yet
        const allVideoPubs = participant.trackPublications ? 
          Array.from((participant.trackPublications as any).values()) : [];
        const allAudioPubs = participant.trackPublications ? 
          Array.from((participant.trackPublications as any).values()) : [];
        
        // First try the standard way, prioritizing screen-share tracks
        let videoPub = Array.from(videoPubs?.values() || []).find(p => p.track && p.isSubscribed) ||
                       Array.from((participant.trackPublications as any)?.values() || []).find((p: any) => p.track && p.kind === 'video');
        
        let audioPub = Array.from(audioPubs?.values() || []).find(p => p.track && p.isSubscribed) ||
                       Array.from((participant.trackPublications as any)?.values() || []).find((p: any) => p.track && p.kind === 'audio');

        // If not found, try getting any track regardless of subscription status
        // Still prioritize screen-share
        if (!videoPub) {
          videoPub = Array.from(videoPubs?.values() || []).find(p => p.track && p.trackName === 'screen-share');
        }
        if (!videoPub) {
          videoPub = Array.from(videoPubs?.values() || []).find(p => p.track);
        }
        if (!audioPub) {
          audioPub = Array.from(audioPubs?.values() || []).find(p => p.track);
        }

        // Try from all trackPublications as fallback
        if (!videoPub) {
          videoPub = allVideoPubs.find((p: any) => p.track && p.trackName === 'screen-share' && p.kind === 'video');
        }
        if (!videoPub) {
          videoPub = allVideoPubs.find((p: any) => p.track && p.kind === 'video');
        }
        if (!audioPub) {
          audioPub = allAudioPubs.find((p: any) => p.track && p.kind === 'audio');
        }
        
        videoTrack = videoPub?.track;
        audioTrack = audioPub?.track;
        
        if (import.meta.env.DEV) console.debug('[BroadcastGrid] Remote user tracks:', {
          identity: participant.identity,
          hasVideoTrack: !!videoTrack,
          hasAudioTrack: !!audioTrack,
          videoTrackId: (videoTrack as any)?.getTrackId?.(),
          audioTrackId: (audioTrack as any)?.getTrackId?.(),
          videoPubsCount: videoPubs?.size || 0,
          allVideoPubsCount: allVideoPubs.length,
        });
      } else {
        const hostIdNorm = hostUserId ? hostUserId.replace(/-/g, '').toLowerCase() : ''
        const fallbackParticipant = remoteUsers.find((u: any) => {
          const identityStr = String(u?.identity || '')
          const normId = identityStr.replace(/-/g, '').toLowerCase()
          if (hostUserId && (identityStr === hostUserId || normId === hostIdNorm || normId.startsWith(hostIdNorm.substring(0, 8)))) return false
          return !!getVideoTrackFromRemoteParticipant(u)
        }) || null
        if (fallbackParticipant && !participant) {
          participant = fallbackParticipant
        }
        if (import.meta.env.DEV) console.debug('[BroadcastGrid] No participant found for userId:', userId?.substring(0, 8), 'remoteUsers count:', remoteUsers.length, 'fallback used:', !!fallbackParticipant);
      }
    }
    
    // Check if camera is on - for LiveKit, track exists means camera is on
    // For local users, check if track exists and is enabled
    const isMicOn = isLocal 
      ? (audioTrack ? (audioTrack as any).enabled !== false : false) 
      : !!audioTrack;
    const isCamOn = isLocal
      ? (videoTrack ? ((videoTrack as any).enabled === true || (videoTrack as any).enabled === undefined) : false)
      : !!videoTrack;

    // Detect screen share from track name or MediaStreamTrack label
    const mediaTrack = videoTrack?.mediaStreamTrack;
    const vTrackLabel = mediaTrack?.label?.toLowerCase() || '';
    const vTrackName = (videoTrack as any)?.name || '';
    const vSettings = mediaTrack ? (mediaTrack.getSettings?.() || {}) : {};
    const isScreenShare = !!videoTrack && (
      vTrackName === 'screen-share' ||
      vTrackLabel.includes('screen') ||
      vTrackLabel.includes('display') ||
      vTrackLabel.includes('window') ||
      !!(vSettings as any).displaySurface
    );

    const gridDebug = (window as any).DEBUG_COUNTERS
    if (gridDebug && participant?.identity) {
      const currentCount = gridDebug.participantTileRenderCount.get(participant.identity) || 0
      gridDebug.participantTileRenderCount.set(participant.identity, currentCount + 1)
    }

     if (isLocal) {
       if (import.meta.env.DEV) console.debug('[BroadcastGrid] Local track states:', { isMicOn, isCamOn, isScreenShare, vTrackName, vTrackLabel, videoTrackExists: !!videoTrack, audioTrackExists: !!audioTrack });
     }

    return { participant, videoTrack, audioTrack, isLocal, isMicOn, isCamOn, isScreenShare };
  };

  // Define at component level so it's accessible everywhere
  const isUniversalBattleActive = isUniversalBattle || stream.battle_mode === 'universal';
  
  // Troll Battle Universe Mode: Show 8 boxes (4 per side) - 4v4 format
  const isTrollBattleUniverseMode = isUniversalBattleActive && battleFormat === '4v4' && stream.battle_mode === 'troll';
  const trollBattleBoxCount = 8; // 4 per team

  // Calculate how many boxes we must render (never hide occupied seats)
  // Also count seats with guest_id as occupied (for guest users)
  const { effectiveBoxCount, boxes } = useMemo(() => {
    const seatKeys = Object.keys(seats);
    const occupiedSeatIndices = seatKeys
      .map(Number)
      .filter(idx => seats[idx]?.user_id || seats[idx]?.guest_id);
    const maxOccupiedSeatIndex = occupiedSeatIndices.length > 0 ? Math.max(...occupiedSeatIndices) : -1;
    const requiredBoxes = Math.max(1, maxOccupiedSeatIndex + 1); // 0-indexed

    // Use boxCount prop if provided (from useBoxCount hook), otherwise fall back to stream.box_count
    const streamBoxCount = Math.max(1, Number(boxCountProp !== undefined ? boxCountProp : (stream.box_count || 1)));

    // ALWAYS ensure we have enough boxes for all occupied seats PLUS the configured box_count
    // This ensures guests in higher seats are always visible
    const totalRequiredBoxes = Math.max(streamBoxCount, requiredBoxes);

    if (import.meta.env.DEV) console.debug('[BroadcastGrid] Box count calculation:', {
      streamBoxCount,
      requiredBoxes,
      totalRequiredBoxes,
      occupiedSeatIndices,
      maxOccupiedSeatIndex,
      localUserId: localUserId?.substring(0, 8),
      streamUserId: stream.user_id?.substring(0, 8),
      seatKeys: seatKeys.map(k => ({ key: k, userId: seats[Number(k)]?.user_id?.substring(0, 8) }))
    });

    const baseCount = totalRequiredBoxes;

    const HARD_CAP = 9; // 9 boxes for Troll Toe (3x3 grid)

    // Universal Battle: calculate required boxes based on format
    let battleRequiredBoxes = 0;
    if (isUniversalBattleActive && battleFormat) {
      const [teamSize] = battleFormat.split('v').map(Number);
      battleRequiredBoxes = teamSize * 2; // Both teams
    }

    let effectiveBoxCount: number;
    let boxes: number[];

    // Troll Battle Universe Mode (4v4): always use exactly 8 boxes
    if (isTrollBattleUniverseMode) {
      effectiveBoxCount = trollBattleBoxCount;
      boxes = Array.from({ length: trollBattleBoxCount }, (_, i) => i);
    } else if (hideEmptySeats) {
      // In hideEmptySeats mode, we only render active participants
      // Slot 0 (Host) is always included
      const activeIndices = [0];

      // Add ALL occupied seat indices (not just up to box_count)
      occupiedSeatIndices.forEach((index) => {
        if (!activeIndices.includes(index)) {
          activeIndices.push(index);
        }
      });

      // Sort indices to maintain order
      activeIndices.sort((a, b) => a - b);

      // Apply HARD_CAP just in case, though ideally we show all active
      const visibleIndices = activeIndices.slice(0, HARD_CAP);

      effectiveBoxCount = visibleIndices.length;
      boxes = visibleIndices;
    } else {
      // Standard mode: render boxes based on stream config, but NEVER hide occupied seats
      // For Universal Battle, also ensure we have enough boxes for the format
      const minBoxes = Math.max(baseCount, battleRequiredBoxes);
      effectiveBoxCount = Math.min(minBoxes, HARD_CAP);
      boxes = Array.from({ length: effectiveBoxCount }, (_, i) => i);
    }

    return { effectiveBoxCount, boxes };
  }, [seats, boxCountProp, stream.box_count, stream.battle_mode, isUniversalBattle, battleFormat, maxItems, hideEmptySeats, localUserId, stream.user_id, isTrollBattleUniverseMode, trollBattleBoxCount]);

  const enforceSquareOnMobile = effectiveBoxCount > 1;
  const isSingleBoxLayout = effectiveBoxCount === 1;

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!enableStreamSwipe || !canSwipe || e.touches.length !== 1) return;
    touchStartYRef.current = e.touches[0].clientY;
    touchCurrentYRef.current = e.touches[0].clientY;
    swipeLockedRef.current = false;
  }, [enableStreamSwipe, canSwipe]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!enableStreamSwipe || !canSwipe || touchStartYRef.current === null || swipeLockedRef.current) return;
    touchCurrentYRef.current = e.touches[0].clientY;
    const diffY = touchStartYRef.current - touchCurrentYRef.current;
    if (Math.abs(diffY) > 12) {
      e.preventDefault();
    }
  }, [enableStreamSwipe, canSwipe]);

  const handleTouchEnd = useCallback(() => {
    if (!enableStreamSwipe || !canSwipe || touchStartYRef.current === null || touchCurrentYRef.current === null || swipeLockedRef.current) {
      touchStartYRef.current = null;
      touchCurrentYRef.current = null;
      return;
    }

    const diffY = touchStartYRef.current - touchCurrentYRef.current;
    const threshold = 90;

    if (Math.abs(diffY) >= threshold) {
      swipeLockedRef.current = true;
      if (diffY > 0) {
        onSwipeUp?.();
      } else {
        onSwipeDown?.();
      }
    }

    touchStartYRef.current = null;
    touchCurrentYRef.current = null;
  }, [enableStreamSwipe, canSwipe, onSwipeDown, onSwipeUp]);

  // Troll Toe winning line calculation (must be at top level, not inside .map())
  const trollToeWinningBoxes = useMemo(() => {
    if (!trollToeMatch || trollToeMatch.phase !== 'ended') return null;
    const patterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const p of patterns) {
      const [a,b,c] = p;
      if (trollToeMatch.boxes[a].player && trollToeMatch.boxes[b].player && trollToeMatch.boxes[c].player &&
        trollToeMatch.boxes[a].player!.team === trollToeMatch.boxes[b].player!.team &&
        trollToeMatch.boxes[b].player!.team === trollToeMatch.boxes[c].player!.team) return p;
    }
    return null;
  }, [trollToeMatch?.phase, trollToeMatch?.boxes]);

  const universalTeamAScore = (stream as any).side_a_score ?? battleState?.broadcasterScore ?? 0;
  const universalTeamBScore = (stream as any).side_b_score ?? battleState?.challengerScore ?? 0;
  const universalBattleStatus = stream.battle_status ?? 'waiting';
  const battleStartTime = battleState?.startedAt?.getTime() ?? (stream.battle_start_time ? new Date(stream.battle_start_time).getTime() : null);
  const battleEndTime = battleState?.endsAt?.getTime() ?? (stream.battle_end_time ? new Date(stream.battle_end_time).getTime() : null);
  const universalBattleDurationMs = 180 * 1000;
  const inferredBattleEndTime = battleEndTime ?? (battleStartTime ? battleStartTime + universalBattleDurationMs : null);
  const streamRemainingTime = inferredBattleEndTime
    ? Math.max(0, Math.floor((inferredBattleEndTime - Date.now()) / 1000))
    : universalBattleStatus === 'active'
      ? universalBattleDurationMs / 1000
      : 0;
  const universalRemainingTime = streamRemainingTime > 0 ? streamRemainingTime : 0;
  const showUniversalBattleOverlay = isUniversalBattleActive && (battleState?.active || universalBattleStatus !== 'ended' || stream.is_battle);
   const showStandaloneBattleTimer = isBattleActive && !battleState?.active && !isUniversalBattleActive;
   
  if (import.meta.env.DEV) console.debug('[BroadcastGrid] universal battle debug', {
    isUniversalBattleActive,
    battleFormat,
    isTrollBattleUniverseMode,
    trollBattleBoxCount,
    universalBattleStatus,
    battleStartTime,
    battleEndTime,
    inferredBattleEndTime,
    streamRemainingTime,
    universalRemainingTime,
    showUniversalBattleOverlay,
    showStandaloneBattleTimer,
    streamBattleMode: stream.battle_mode,
    streamIsBattle: stream.is_battle,
    streamSideA: (stream as any).side_a_score,
    streamSideB: (stream as any).side_b_score,
  });

  // Get broadcast theme for styling the entire broadcast area
  const broadcastTheme = getBroadcastTheme(stream?.broadcast_theme_slug, stream?.category || '');

  return (
    <div className={cn('relative w-full h-full', broadcastTheme?.shellClassName)}>
      {/* Theme overlay - positioned behind grid content */}
      {broadcastTheme && <div className={cn('absolute inset-0 pointer-events-none z-0', broadcastTheme.overlayClassName)} />}
      {broadcastTheme && (
        <ThemeEffectLayer
          effectType={broadcastTheme.effectType}
          accentColor={broadcastTheme.accentColor}
        />
      )}

      {/* Mobile Profile Banner at top of grid */}
      {isMobileViewer && broadcasterProfile && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-white/10 p-3 flex items-center gap-3">
          <img
            src={broadcasterProfile.avatar_url || `https://ui-avatars.com/api/?name=${broadcasterProfile.username}&background=random`}
            alt={broadcasterProfile.username}
            className="w-10 h-10 rounded-full border border-white/20"
          />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-sm truncate">
              {broadcasterProfile.display_name || broadcasterProfile.username}
            </div>
            <div className="text-xs text-gray-300">
              {(stream.current_viewers ?? stream.viewer_count ?? 0).toLocaleString()} viewers
            </div>
          </div>
        </div>
      )}

      {/* Theme frame around the broadcast grid */}
      <div
        className={cn(
          'relative z-10 grid gap-2 w-full p-2 pb-20 min-w-0 overflow-hidden max-w-full h-full broadcast-theme-container',
          isSingleBoxLayout ? 'grid-cols-1 grid-rows-1 auto-rows-fr items-stretch content-stretch' : 'auto-rows-fr',
          // Universal Battle layouts - special grid for battle format
          isUniversalBattleActive && battleFormat === '1v1' && 'grid-cols-2 grid-rows-1',
          isUniversalBattleActive && battleFormat === '2v2' && 'grid-cols-2 grid-rows-2',
          isUniversalBattleActive && battleFormat === '3v3' && 'grid-cols-3 grid-rows-2',
          isUniversalBattleActive && battleFormat === '4v4' && 'grid-cols-4 grid-rows-2',
          // Standard layouts
          !isUniversalBattleActive && effectiveBoxCount === 1 && 'grid-cols-1 grid-rows-1',
          !isUniversalBattleActive && effectiveBoxCount === 2 && 'grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1',
          !isUniversalBattleActive && effectiveBoxCount === 3 && 'grid-cols-2 grid-rows-2',
          !isUniversalBattleActive && effectiveBoxCount === 4 && 'grid-cols-2 grid-rows-2',
          !isUniversalBattleActive && effectiveBoxCount === 5 && 'grid-cols-3 grid-rows-2',
          !isUniversalBattleActive && effectiveBoxCount === 6 && 'grid-cols-2 grid-rows-3 sm:grid-cols-3 sm:grid-rows-2',
          !isUniversalBattleActive && effectiveBoxCount === 7 && 'grid-cols-2 grid-rows-4 sm:grid-cols-3 sm:grid-rows-3',
          !isUniversalBattleActive && effectiveBoxCount === 8 && 'grid-cols-2 grid-rows-4 sm:grid-cols-3 sm:grid-rows-3',
          !isUniversalBattleActive && effectiveBoxCount === 9 && 'grid-cols-3 grid-rows-3',
          // Landscape seats so object-cover stops over-cropping the
          // broadcaster's landscape camera (matches SetupPage preview).
          '[&>*]:aspect-video'
        )}
        style={enableStreamSwipe && canSwipe ? { touchAction: 'pan-y' } : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
               {/* Ticker at top of grid */}
               {showTicker && (
                 <BroadcastTicker />
               )}
       
{/* Standalone Battle Timer (3 minutes) - Shows only when no score/timer overlay is already active */}
                {showStandaloneBattleTimer && (
                  <div className="absolute inset-x-0 top-1/2 z-40 flex flex-col items-center gap-2 -translate-y-1/2 px-2">
                    <div className="px-3 py-1 rounded-full font-bold text-sm bg-black/80 text-white border border-white/20">
                      {battleStartedAt ? `${Math.floor(((Date.now() - new Date(battleStartedAt).getTime()) / 1000) > 0 ? Math.max(0, 180 - Math.floor((Date.now() - new Date(battleStartedAt).getTime()) / 1000)) : 180 / 60)}:${(Math.max(0, 180 - Math.floor((Date.now() - new Date(battleStartedAt).getTime()) / 1000)) % 60).toString().padStart(2, '0')}` : '3:00'}
                    </div>
                  </div>
                )}
      {/* Universal Battle Score Display */}
      {showUniversalBattleOverlay && (
        <div className="absolute inset-x-0 top-1/2 z-40 flex flex-col items-center gap-2 -translate-y-1/2 px-2">
          <div className="flex items-center gap-4 bg-black/80 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 shadow-lg">
            <div className="flex flex-col items-center">
              <span className="text-red-400 text-xs font-bold uppercase">Team A</span>
              <span className="text-white font-bold text-lg">{universalTeamAScore}</span>
            </div>
            <div className="flex flex-col items-center px-2">
              <span className="text-zinc-400 text-xs uppercase">VS</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-blue-400 text-xs font-bold uppercase">Team B</span>
              <span className="text-white font-bold text-lg">{universalTeamBScore}</span>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full font-bold text-sm ${
            universalRemainingTime > 0 && universalRemainingTime <= 10
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-black/80 text-white border border-white/20'
          }`}>
            {universalRemainingTime > 0
              ? `${Math.floor(universalRemainingTime / 60)}:${(universalRemainingTime % 60).toString().padStart(2, '0')}`
              : 'BATTLE'}
          </div>
        </div>
      )}

        {/* Stage Pass layout — replaces box-grid when broadcaster goes live */}
        {(() => {
          const {
            stagePasses: spStagePasses,
            requestStagePass: spRequestPass,
            approveStagePass: spApprovePass,
            denyStagePass: spDenyPass,
            removeStageGuest: spRemoveGuest,
            refetch: spRefetch,
          } = stagePassesHook;

          if (streamStatus !== 'live') return null;

          const livePasses = liveStagePasses;

          // Who the broadcaster is
          const isLocalHost = stream.user_id === localUserId;
          const broadcasterUserId = isLocalHost ? localUserId : stream.user_id;

          const broadcasterTrackInfo = isLocalHost
            ? {
                isMicOn: !!(localTracks?.[0] && (localTracks[0] as any).enabled !== false),
                isCamOn: !!(localTracks?.[1] && ((localTracks[1] as any).enabled === true || (localTracks[1] as any).enabled === undefined)),
                isScreenShare: (() => {
                  const mt = localTracks?.[1]?.mediaStreamTrack;
                  const vName = (localTracks?.[1] as any)?.name || '';
                  const vLabel = mt?.label?.toLowerCase() || '';
                  const settings = mt?.getSettings?.() || {};
                  return (
                    vName === 'screen-share' ||
                    vLabel.includes('screen') ||
                    vLabel.includes('display') ||
                    vLabel.includes('window') ||
                    !!(settings as any).displaySurface
                  );
                })(),
                hasVideo: !!(localTracks?.[0] && localTracks?.[1]),
              }
            : getParticipantAndTracks(broadcasterUserId);

          const broadcasterProfileForLayout = broadcasterProfile
            ? {
                username: broadcasterProfile.username || stream.user_id || 'Broadcaster',
                avatar_url: broadcasterProfile.avatar_url || null,
              }
            : undefined;

          const currentUserPassStatus = stagePassesHook.currentUserStagePass?.status || null;
          const hasOpenPass = spStagePasses.some(
            (p: StagePass) => p.status === 'open',
          );

          return (
            <BroadcastStageLayout
              hostName={broadcasterProfileForLayout?.username || 'Broadcaster'}
              hostAvatarUrl={broadcasterProfileForLayout?.avatar_url}
              hostIsMicOn={broadcasterTrackInfo.isMicOn}
              hostIsCamOn={broadcasterTrackInfo.isCamOn}
              hostIsScreenSharing={broadcasterTrackInfo.isScreenShare}
              hostHasVideo={!!(broadcasterTrackInfo as any).hasVideo}
              hostVideoNode={
                (() => {
                  const videoTrack = isLocalHost
                    ? localTracks?.[1]
                    : getParticipantAndTracks(broadcasterUserId).videoTrack;
                  if (!videoTrack) return undefined;
                  return (
                    <LiveKitVideoPlayer
                      videoTrack={videoTrack}
                      isLocal={isLocalHost}
                      isScreenShare={broadcasterTrackInfo.isScreenShare}
                      themeUrl={stream.broadcast_theme_slug}
                      isRgbEnabled={!!stream.has_rgb_effect}
                      broadcasterProfile={broadcasterProfile}
                    />
                  );
                })()
              }
              livePasses={livePasses}
              guestMicCam={stageGuestMicCam}
              guestVideoNodes={stageGuestVideoNodes}
              coinBalance={profile?.troll_coins ?? broadcasterProfile?.troll_coins ?? 0}
              isHost={isHost}
              hasOpenPass={isHost ? Boolean(livePasses.length < 6) : hasOpenPass}
              currentUserPassStatus={
                isHost ? undefined : (currentUserPassStatus as string | null)
              }
              onRequestPass={
                isHost
                  ? undefined
                  : () => {
                      const openPass = spStagePasses.find(
                        (p: StagePass) => p.status === 'open',
                      );
                      if (openPass) {
                        void spRequestPass(openPass.id);
                      }
                    }
              }
              onOpenPassModal={isHost ? (onOpenPassModal as any) : (() => {})}
              onApproveStagePass={
                isHost
                  ? (id: string) => {
                      void spApprovePass(id);
                      void spRefetch?.();
                    }
                  : undefined
              }
              onDenyStagePass={
                isHost
                  ? (id: string) => {
                      void spDenyPass(id);
                      void spRefetch?.();
                    }
                  : undefined
              }
              onRemoveStageGuest={
                isHost
                  ? (id: string) => {
                      void spRemoveGuest(id);
                      void spRefetch?.();
                    }
                  : undefined
              }
            />
          );
        })()}

        {boxes.map((seatIndex) => {
          if (import.meta.env.DEV) {
            const debugCounters = (window as any).DEBUG_COUNTERS;
            if (debugCounters) {
              if (!debugCounters.seatTileRenderCount) {
                debugCounters.seatTileRenderCount = new Map<number, number>();
              }
              const currentSeatCount = debugCounters.seatTileRenderCount.get(seatIndex) || 0;
              debugCounters.seatTileRenderCount.set(seatIndex, currentSeatCount + 1);
            }
          }
          const seat = seats[seatIndex];
          // Use guest_id if user_id is null (for guest users)
          let userId = seat?.user_id || seat?.guest_id;

          // FORCE HOST INTO BOX 0
          if (seatIndex === 0) {
            userId = stream.user_id;
          }

          const isStreamHost = userId === stream.user_id;

          // Find participant + tracks
          const { participant, videoTrack, audioTrack, isLocal, isMicOn, isCamOn, isScreenShare } = getParticipantAndTracks(userId);

          // Debug logging for ALL users (local and remote)
          if (userId) {
            if (import.meta.env.DEV) console.debug(`[BroadcastGrid] User ${userId.substring(0, 8)}... (isLocal=${isLocal}):`, { 
              hasParticipant: !!participant, 
              hasVideoTrack: !!videoTrack, 
              hasAudioTrack: !!audioTrack, 
              isCamOn, 
              isMicOn,
              videoEnabled: (videoTrack as any)?.enabled,
              audioEnabled: (audioTrack as any)?.enabled,
              remoteUsersCount: remoteUsers?.length ?? 0 
            });
          }

          // Determine profile used for visuals
          let displayProfile = seat?.user_profile;
          if (seatIndex === 0 && isStreamHost && broadcasterProfile) {
            displayProfile = broadcasterProfile;
          }

          // Use real-time attributes if available
          const userAttrs = userId ? attributes[userId] : null;

          // Troll Toe box state for this seat
          const trollToeBox = trollToeMatch ? trollToeMatch.boxes[seatIndex] : null;

          const baseBoxClass = 'relative bg-black/50 rounded-xl overflow-hidden border border-white/10 transition-all duration-300 min-w-0 h-full cursor-pointer';

          const hasGold =
            !!displayProfile?.is_gold || userAttrs?.activePerks?.includes('perk_gold_username' as any);

          const hasRgbProfile =
            (!!displayProfile?.rgb_username_expires_at &&
              new Date(displayProfile.rgb_username_expires_at) > new Date()) ||
            userAttrs?.activePerks?.includes('perk_rgb_username' as any);

          const hasStreamRgb = !!stream.has_rgb_effect;

          // Battle mode team highlighting
          const userSupporter = userId ? supporters.get(userId) : null;
          const isBroadcasterSide = userSupporter?.team === 'broadcaster' || (seatIndex === 0 && isStreamHost);
          const isChallengerSide = userSupporter?.team === 'challenger';

          const boxClass = cn(
            baseBoxClass,
            broadcastTheme?.playerFrameClassName,
            hasGold && 'border-2 border-yellow-500 shadow-[0_0_15px_rgba(255,215,0,0.3)]',
            !hasGold && (hasRgbProfile || hasStreamRgb) && 'rgb-box',
            // Battle mode: Broadcaster=RED, Challenger=BLUE
            battleState?.active && isBroadcasterSide && 'border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]',
            battleState?.active && isChallengerSide && 'border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]',
            battleState?.suddenDeath && 'animate-pulse',
            // Universal Battle: Left side = Team A (RED), Right side = Team B (BLUE)
            isUniversalBattleActive && seatIndex < (effectiveBoxCount / 2) && 'border-2 border-red-500/50',
            isUniversalBattleActive && seatIndex >= (effectiveBoxCount / 2) && 'border-2 border-blue-500/50',
            // Troll Toe game team highlighting
            trollToeMatch && trollToeMatch.phase !== 'waiting' && trollToeMatch.phase !== 'ended' && trollToeBox?.player?.team === 'broadcaster' && 'border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]',
            trollToeMatch && trollToeMatch.phase !== 'waiting' && trollToeMatch.phase !== 'ended' && trollToeBox?.player?.team === 'challenger' && 'border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]',
            trollToeMatch && trollToeBox?.state === 'broken' && 'border-2 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]',
            trollToeMatch && trollToeMatch.phase === 'ended' && trollToeWinningBoxes?.includes(seatIndex) && 'ring-4 ring-yellow-400 animate-pulse'
          );

          // Get received gifts for this user
          const userGiftAmount = userId ? (userReceivedGifts[userId] || 0) : 0;

          return (
            <div
              key={`seat-${seatIndex}`}
              ref={(el) => {
                boxRefs.current[seatIndex] = el;
              }}
              className="contents"
            >
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
               className={cn(
boxClass,
                isSingleBoxLayout && 'h-full min-h-[min(60vw,22rem)] md:min-h-0',
              )}
               onClick={() => {
                 if (isStreamHost && seatIndex === 0 && isHost) {
                    onOpenHostStats?.();
                 } else if (userId) {
                    onOpenUserAction?.({
                      userId,
                      username: displayProfile?.username,
                      role: displayProfile?.role || displayProfile?.troll_role,
                      createdAt: displayProfile?.created_at
                    });
                 }
               }}
              role={userId ? 'button' : undefined}
              tabIndex={userId ? 0 : -1}
               onKeyDown={(e) => {
                 if (!userId) return;
                 if (e.key === 'Enter' || e.key === ' ') {
                    if (isStreamHost && seatIndex === 0) onOpenHostStats?.();
                    else onOpenUserAction?.({
                      userId,
                      username: displayProfile?.username,
                      role: displayProfile?.role || displayProfile?.troll_role,
                      createdAt: displayProfile?.created_at
                    });
                 }
               }}
            >
              {/* DEBUG: Red circle for broadcaster or Mai TrollAdmin - indicates component is rendering */}
              {(isStreamHost && seatIndex === 0) || displayProfile?.username === 'MaiTrollAdmin' && (
                <div 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-4 border-red-500 bg-red-500/20 z-30 pointer-events-none flex items-center justify-center"
                  title="Broadcaster Test Indicator"
                >
                  <span className="text-red-500 font-bold text-xs">{displayProfile?.username === 'MaiTrollAdmin' ? 'ADMIN' : 'HOST'}</span>
                </div>
              )}

               {/* Render Video if Participant Exists and Track is active */}
              {(() => {
                return null;
              })()}

              {/* Video rendering logic */}
              {(function renderVideo() {
                // Local user - always render video player (handles undefined track)
                if (userId === localUserId) {
                  return (
                    <>
                      <LiveKitVideoPlayer
                        videoTrack={videoTrack}
                        isLocal={true}
                        isScreenShare={isScreenShare}
                        themeUrl={stream.broadcast_theme_slug}
                        isCEO={broadcasterProfile?.username === 'ceo' || broadcasterProfile?.role === 'ceo' || broadcasterProfile?.role === 'admin' || broadcasterProfile?.role === 'superadmin' || broadcasterProfile?.role === 'owner'}
                        isRgbEnabled={!!stream.has_rgb_effect}
                        broadcasterProfile={broadcasterProfile}
                      />
                      {/* Camera Overlay for screen share */}
                      {cameraOverlayTrack && seatIndex === 0 && (
                        <div 
                          className="absolute z-30 cursor-move"
                          style={{ 
                            width: 120, 
                            height: 90, 
                            top: 8, 
                            left: 8,
                            borderRadius: 8,
                            overflow: 'hidden',
                            border: '2px solid rgba(255,255,255,0.3)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                          }}
                        >
                          <LiveKitVideoPlayer
                            videoTrack={cameraOverlayTrack}
                            isLocal={true}
                            isScreenShare={false}
                            broadcasterProfile={broadcasterProfile}
                          />
                        </div>
                      )}
                    </>
                  );
                }
                
                // Remote users with video track and camera on
                if (videoTrack && isCamOn) {
                  return (
                    <LiveKitVideoPlayer
                      videoTrack={videoTrack}
                      isLocal={false}
                      isScreenShare={isScreenShare}
                      broadcasterProfile={broadcasterProfile}
                    />
                  );
                }
                
                // Remote users who exist but have camera off or no track
                if (participant) {
                  const seatUserFrame = userId ? frameCacheRef.current.get(userId) ?? null : null
                  return (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90">
                      <div
                        className="relative cursor-pointer"
                        style={{ overflow: 'visible' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (userId && displayProfile?.username) {
                            setMiniProfile({ userId, username: displayProfile.username, avatarUrl: displayProfile.avatar_url || '' })
                          }
                        }}
                      >
                        {displayProfile?.avatar_url ? (
                          <div className="w-14 h-14 md:w-18 md:h-18" style={{ overflow: 'visible' }}>
                            <ProfileFrame
                              frame={seatUserFrame}
                              avatarUrl={displayProfile.avatar_url}
                              username={displayProfile.username || 'User'}
                              size="sm"
                            />
                          </div>
                        ) : (
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayProfile?.username || 'User')}&background=random`}
                            alt={displayProfile?.username}
                            className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-white/20"
                          />
                        )}
                        {!isMicOn && (
                          <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1">
                            <MicOff size={12} className="text-white" />
                          </div>
                        )}
                      </div>
                      <span className="mt-2 text-[11px] md:text-xs text-zinc-400 flex items-center gap-1">
                        <VideoOff size={10} className="md:w-[10px] md:h-[10px]" />
                        Camera Off
                      </span>
                    </div>
                  );
                }
                
                // Users who don't have a participant yet (joining/left)
                if (!participant && streamStatus !== 'ended') {
                  return (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/90">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center">
                          <Users size={14} className="text-white/50" />
                        </div>
                        {seatIndex === 0 ? (
                          <span className="text-[10px] text-white/50">{`You're`} on stage</span>
                        ) : (
                          <span className="text-[10px] text-white/50">Seat #{seatIndex + 1}</span>
                        )}
                      </div>
                    </div>
                  );
                }
                
                return null;
              })()}

              {audioTrack && !isLocal && <LiveKitAudioPlayer audioTrack={audioTrack} />}

              {/* Per-box gift animation layer (plays gifts sent to this user) */}
              {userId && (
                <div className="absolute inset-0 pointer-events-none z-30">
                  <GiftAnimationLayer streamId={stream.id} recipientUserId={String(userId)} className="" />
                </div>
              )}

          {/* Empty Seat */}
          {!userId && (
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Show Join button for everyone - allow all users to join boxes */}
                  {onJoinSeat && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (import.meta.env.DEV) console.debug('[BroadcastGrid] Join seat clicked:', seatIndex);
                        onJoinSeat(seatIndex);
                      }}
                      className="flex flex-col items-center text-zinc-400 hover:text-white active:scale-95 transition-all w-full h-full cursor-pointer"
                    >
                      <div className="p-3 rounded-full border-2 border-dashed border-zinc-500 hover:border-white mb-2 bg-zinc-900/50">
                        <Plus size={24} />
                      </div>
                      <span className="text-xs font-medium">Join Box {seatIndex + 1}</span>
                      {(() => {
                        // Get price for this specific seat - supports per-box pricing
                        const seatPrices = stream.seat_prices;
                        const price = seatPrices && seatPrices.length > seatIndex 
                          ? seatPrices[seatIndex] 
                          : (typeof seatPriceOverride === 'number' ? seatPriceOverride : stream.seat_price);
                        
                        if (price > 0) {
                          return (
                            <div className="flex items-center gap-1 bg-black/60 px-2 py-1 rounded-full mt-2 border border-yellow-500/30 transition-none">
                              <Coins size={12} className="text-yellow-500" />
                              <span className="text-xs font-bold text-yellow-400">
                                {price}
                              </span>
                            </div>
                          );
                        } else {
                          // Show "FREE" badge when price is 0
                           return (
                             <div className="flex items-center gap-1 bg-green-500/20 px-2 py-1 rounded-full mt-2 border border-green-500/30 transition-none">
                               <span className="text-[10px] font-bold text-green-400">FREE</span>
                             </div>
                           );
                         }
                        })()}
                      </button>
                    )}
                  </div>
                )}

              {seatIndex === 0 && isMobileViewer && broadcasterProfile && (
                <div className="absolute top-1 right-1 z-15 pointer-events-none">
                  <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md rounded-full px-2 py-1 border border-white/20">
                    <Crown size={10} className="text-amber-400" />
                    <span className="text-[10px] font-bold text-white">{broadcasterProfile.battle_crowns || 0}</span>
                    <Gem size={10} className="text-purple-400" />
                    <span className="text-[10px] font-bold text-white">{broadcasterProfile.trollmonds || 0}</span>
                    <Coins size={10} className="text-yellow-400" />
                    <span className="text-[10px] font-bold text-white">{(broadcasterProfile.troll_coins || 0).toLocaleString()}</span>
                  </div>
                </div>
              )}

               {/* Seat Heat Bar - only for occupied seats */}
               {userId && seatIndex !== undefined && (
                 <div className="absolute bottom-2 left-3 right-3 z-10 pointer-events-none">
                   <SeatHeatBar
                     userId={userId}
                     streamId={stream.id}
                     boxCount={boxCountProp}
                     isBroadcasterBox={seatIndex === 0}
                   />
                 </div>
               )}

                {/* Username and Coin Balance Display - at bottom of each occupied box */}
                {userId && displayProfile && (() => {
             const licensePlate = (displayProfile as any).license_plate || licensePlates[userId] || null;
             return (
               <div
                 className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 shadow-lg cursor-pointer pointer-events-auto hover:bg-black/80 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenUserStats?.({
                      userId,
                      username: displayProfile.username,
                      trollCoins: displayProfile.troll_coins || 0,
                      trollmonds: (((displayProfile as any).trollmonds || displayProfile.trollmonds_balance || 0) as number),
                      licensePlate: (displayProfile as any).license_plate || licensePlates[userId] || null,
                      isSeatUser: localUserId === stream.user_id || Object.values(seats || {}).some(s => s?.user_id === localUserId || s?.guest_id === localUserId),
                      streamId: stream?.id,
                    });
                  }}
                 role="button"
                 tabIndex={0}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' || e.key === ' ') {
                       e.stopPropagation();
                       onOpenUserStats?.({
                         userId,
                         username: displayProfile.username,
                         trollCoins: displayProfile.troll_coins || 0,
                         trollmonds: (((displayProfile as any).trollmonds || displayProfile.trollmonds_balance || 0) as number),
                         licensePlate: (displayProfile as any).license_plate || licensePlates[userId] || null,
                         isSeatUser: localUserId === stream.user_id || Object.values(seats || {}).some(s => s?.user_id === localUserId || s?.guest_id === localUserId),
                         streamId: stream?.id,
                       });
                     }
                   }}
               >
<div className="flex items-center gap-2">
                   {seatIndex !== 0 && (
                     <>
                       <span className="text-xs font-bold text-white truncate max-w-[120px]">
                         {displayProfile.username}
                       </span>
                        {((displayProfile as any).is_broadofficer || (displayProfile as any).is_broadcast_officer || (displayProfile as any).is_troll_officer || (displayProfile as any).is_lead_officer) && (
                          <Shield size={12} className="text-cyan-300" />
                        )}
                        {(displayProfile as any).role === 'attorney' || (displayProfile as any).is_attorney ? <span className="text-[10px] font-bold text-violet-300">ATTORNEY</span> : null}
                        {(displayProfile as any).role === 'prosecutor' || (displayProfile as any).is_prosecutor ? <span className="text-[10px] font-bold text-red-300">PROSECUTOR</span> : null}
                        {(displayProfile as any).role === 'judge' || (displayProfile as any).is_judge ? <span className="text-[10px] font-bold text-amber-300">JUDGE</span> : null}
                        {(displayProfile as any).role === 'ceo_assistant' || (displayProfile as any).is_ceo_assistant ? <span className="text-[10px] font-bold text-emerald-300">CEO ASST</span> : null}
                        {(displayProfile as any).role === 'noah_assistant' || (displayProfile as any).is_noah_assistant ? <span className="text-[10px] font-bold text-sky-300">NOAH ASST</span> : null}
                        {(displayProfile as any).role === 'journalist' || (displayProfile as any).is_journalist ? <span className="text-[10px] font-bold text-blue-300">JOURNALIST</span> : null}
                        {(displayProfile as any).role === 'tcnn_news_caster' || (displayProfile as any).is_news_caster ? <span className="text-[10px] font-bold text-cyan-300">NEWS CASTER</span> : null}
                        {(displayProfile as any).role === 'tcnn_chief_news_caster' || (displayProfile as any).is_chief_news_caster ? <span className="text-[10px] font-bold text-yellow-300">CHIEF NEWS</span> : null}
                        {(displayProfile as any).role === 'auctioneer' || (displayProfile as any).is_auctioneer ? <span className="text-[10px] font-bold text-green-300">AUCTIONEER</span> : null}
                        {(displayProfile as any).role === 'pastor' || (displayProfile as any).is_pastor ? <span className="text-[10px] font-bold text-pink-300">PASTOR</span> : null}
                        {(displayProfile as any).role === 'secretary' || (displayProfile as any).is_secretary ? <span className="text-[10px] font-bold text-pink-300">SECRETARY</span> : null}
                       {licensePlate && (
                         <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-100 bg-white/10 px-2 py-0.5 rounded-full">
                           {licensePlate}
                         </span>
                       )}
                     </>
                   )}
                 </div>
<div className="flex items-center gap-2">
                   <BroadcastHouseIcon 
                     broadcasterId={userId} 
                     size="sm" 
                     showStatus={false} 
                     interactive={!isHost && !isMobileViewer}
                     broadcasterProfile={displayProfile}
                   />
                   <div 
                     className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                     onClick={(e) => {
                       e.stopPropagation();
                       if (!isHost && !isMobileViewer && onOpenUserStats) {
                         onOpenUserStats({
                           userId,
                           username: displayProfile.username,
                           trollCoins: displayProfile.troll_coins || 0,
                           trollmonds: (((displayProfile as any).trollmonds || displayProfile.trollmonds_balance || 0) as number),
                           licensePlate: (displayProfile as any).license_plate || licensePlates[userId] || null,
                           isSeatUser: localUserId === stream.user_id || Object.values(seats || {}).some(s => s?.user_id === localUserId || s?.guest_id === localUserId),
                           streamId: stream?.id,
                         });
                       }
                     }}
                     role="button"
                     tabIndex={0}
                   >
                     <Gem size={12} className="text-purple-400" />
                     <span className="text-xs font-bold text-purple-300">
                       {(((displayProfile as any).trollmonds || displayProfile.trollmonds_balance || 0) as number).toLocaleString()}
                     </span>
                     <Coins size={12} className="text-yellow-400" />
                     <span className="text-xs font-bold text-yellow-400">
                       {(displayProfile.troll_coins || 0).toLocaleString()}
                     </span>
                   </div>
                 </div>
              </div>
            );
          })()}

               {/* Persistent Gifts Badge */}
              {userId && persistentGifts.get(userId) && persistentGifts.get(userId)!.length > 0 && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1">
                  {persistentGifts.get(userId)!.slice(0, 3).map((gift, idx) => (
                    <motion.div
                      key={`${gift.giftId}-${gift.expiresAt}-${idx}`}
                      initial={{ scale: 0, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0, y: 20 }}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-full font-bold text-xs shadow-lg",
                        gift.amount >= 10000 
                          ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-black"
                          : gift.amount >= 5000
                          ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                          : "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                      )}
                    >
                      <span>{gift.giftIcon}</span>
                      <span>x{gift.amount >= 1000 ? Math.floor(gift.amount / 1000) : 1}</span>
                    </motion.div>
                  ))}
                  {persistentGifts.get(userId)!.length > 3 && (
                    <div className="text-xs text-yellow-400 font-bold">
                      +{persistentGifts.get(userId)!.length - 3} more
                    </div>
                  )}
                </div>
              )}


              {/* Host-only side orbs inside broadcaster box (box 0) - hide for universal battle, battle and game mode */}
              {seatIndex === 0 && isHost && canEditBoxes && !isUniversalBattleActive && !battleState?.active && broadcastMode !== 'game' && (
                <div className="absolute left-2 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddBox?.(); }}
                    disabled={!onAddBox}
                    className="flex items-center gap-1.5 rounded-full px-2 py-1 backdrop-blur-xl border-2 border-white text-white hover:bg-white/20 disabled:opacity-40"
                    title="Add broadcast box"
                    aria-label="Add broadcast box"
                  >
                    <Plus size={14} />
                    <span className="text-[10px] font-bold">Add</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveBox?.(); }}
                    disabled={!onRemoveBox}
                    className="flex items-center gap-1.5 rounded-full px-2 py-1 backdrop-blur-xl border-2 border-white text-white hover:bg-white/20 disabled:opacity-40"
                    title="Deduct broadcast box"
                    aria-label="Deduct broadcast box"
                  >
                    <Minus size={14} />
                    <span className="text-[10px] font-bold">Deduct</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleRgb?.(); }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2 py-1 backdrop-blur-xl border-2 transition-all",
                      hasRgbEffect
                        ? "bg-purple-500/20 border-purple-400 text-purple-400"
                        : "border-white text-white hover:bg-white/20"
                    )}
                    title={hasRgbEffect ? 'Turn off RGB border' : 'Turn on RGB border'}
                    aria-label={hasRgbEffect ? 'Turn off RGB border' : 'Turn on RGB border'}
                  >
                    <Palette size={14} />
                    <span className="text-[10px] font-bold">RGB</span>
                  </button>
                  <div className="rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center px-2 py-1">
                    <span className="text-[10px] font-black text-white">{boxCountProp}</span>
                  </div>
                </div>
               )}
             </motion.div>
             </div>
           );
         })}

        {/* Battle Side Picker Overlay - for viewers not on a team yet */}
       {(joinWindowOpen || (!userTeam && battleState && battleState.active)) && shouldShowSidePicker && onPickSide && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-white/20 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl">
            <Swords className="w-12 h-12 text-yellow-500" />
            <h3 className="text-xl font-bold text-white">Pick a Side!</h3>
            <p className="text-zinc-400 text-sm text-center">Choose who to support in this battle</p>
            <div className="flex gap-4">
              <button
                onClick={() => onPickSide('broadcaster')}
                className={cn(
                  "px-6 py-3 rounded-xl font-bold transition-all",
                  userTeam === 'broadcaster'
                    ? "bg-blue-600 text-white"
                    : "bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/40"
                )}
              >
                <Shield className="w-5 h-5 inline mr-2" />
                Broadcaster
              </button>
              <button
                onClick={() => onPickSide('challenger')}
                className={cn(
                  "px-6 py-3 rounded-xl font-bold transition-all",
                  userTeam === 'challenger'
                    ? "bg-red-600 text-white"
                    : "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/40"
                )}
              >
                <Swords className="w-5 h-5 inline mr-2" />
                Challenger
              </button>
            </div>
          </div>
        </div>
       )}

       {/* Troll Battle Universe Mode - 4v4 Grid Overlay */}
       {isTrollBattleUniverseMode && isHost && (
         <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
           {/* Left Team (4 boxes) - stacked vertically */}
           <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 w-[160px]">
             {[0, 1, 2, 3].map((seatIndex) => {
               const seat = seats[seatIndex + 1]; // Offset by 1 since host is at 0
               const userId = seat?.user_id || seat?.guest_id;
               const isOccupied = seat?.user_id || seat?.guest_id;
               
               return (
                 <div key={`troll-left-${seatIndex}`} className="relative">
                   <div className={cn(
                      "w-full aspect-video rounded-xl border-2 bg-black/60 backdrop-blur-sm overflow-hidden transition-all duration-200",
                      !isOccupied && "border-dashed border-purple-500/30 bg-black/30",
                     isOccupied && "border-solid border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                   )}>
                     {isOccupied ? (
                       userId === localUserId ? (
                         <LiveKitVideoPlayer
                           videoTrack={localTracks[1]}
                           isLocal={true}
                           isScreenShare={false}
                           broadcasterProfile={broadcasterProfile}
                         />
                       ) : (
                         <LiveKitVideoPlayer
                           videoTrack={getParticipantAndTracks(userId).videoTrack}
                           isLocal={false}
                           isScreenShare={false}
                            broadcasterProfile={(getParticipantAndTracks(userId) as any).profile}
                         />
                       )
                     ) : (
                       <div className="h-full w-full flex items-center justify-center">
                         <span className="text-purple-400/50 text-xs">Empty</span>
                       </div>
                     )}
                   </div>
                   {/* Remove button - only for host */}
                   {isOccupied && onKick && (
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         if (seat?.user_id) {
                           onKick(seat.user_id);
                         }
                       }}
                       className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center hover:bg-red-600 shadow-lg z-10 pointer-events-auto"
                       title="Remove from seat"
                     >
                       ×
                     </button>
                   )}
                   <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[8px] text-purple-400/60 whitespace-nowrap">
                     Seat {seatIndex + 1}
                   </span>
                 </div>
               );
             })}
           </div>

           {/* Right Team (4 boxes) - stacked vertically */}
           <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 w-[160px]">
             {[4, 5, 6, 7].map((seatIndex) => {
               const seat = seats[seatIndex];
               const userId = seat?.user_id || seat?.guest_id;
               const isOccupied = seat?.user_id || seat?.guest_id;
               
               return (
                 <div key={`troll-right-${seatIndex}`} className="relative">
                   <div className={cn(
                      "w-full aspect-video rounded-xl border-2 bg-black/60 backdrop-blur-sm overflow-hidden transition-all duration-200",
                      !isOccupied && "border-dashed border-blue-500/30 bg-black/30",
                     isOccupied && "border-solid border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                   )}>
                     {isOccupied ? (
                       userId === localUserId ? (
                         <LiveKitVideoPlayer
                           videoTrack={localTracks[1]}
                           isLocal={true}
                           isScreenShare={false}
                           broadcasterProfile={broadcasterProfile}
                         />
                       ) : (
                         <LiveKitVideoPlayer
                           videoTrack={getParticipantAndTracks(userId).videoTrack}
                           isLocal={false}
                           isScreenShare={false}
                            broadcasterProfile={(getParticipantAndTracks(userId) as any).profile}
                         />
                       )
                     ) : (
                       <div className="h-full w-full flex items-center justify-center">
                         <span className="text-blue-400/50 text-xs">Empty</span>
                       </div>
                     )}
                   </div>
                   {/* Remove button - only for host */}
                   {isOccupied && onKick && (
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         if (seat?.user_id) {
                           onKick(seat.user_id);
                         }
                       }}
                       className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center hover:bg-red-600 shadow-lg z-10 pointer-events-auto"
                       title="Remove from seat"
                     >
                       ×
                     </button>
                   )}
                   <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[8px] text-blue-400/60 whitespace-nowrap">
                     Seat {seatIndex + 1}
                   </span>
                 </div>
               );
             })}
           </div>
         </div>
       )}

       {miniProfile && (
         <UserMiniProfile
           userId={miniProfile.userId}
           username={miniProfile.username}
           avatarUrl={miniProfile.avatarUrl}
           onClose={() => setMiniProfile(null)}
         />
       )}
    </div>
  </div>
  );
}

function getSeatSignature(seats?: Record<number, SeatSession>) {
  return Object.entries(seats || {})
    .map(([index, seat]) => `${index}:${seat?.user_id || ''}:${seat?.guest_id || ''}:${seat?.status || ''}`)
    .sort()
    .join('|');
}

function areBroadcastGridPropsEqual(prev: BroadcastGridProps, next: BroadcastGridProps) {
  return (
    prev.stream.id === next.stream.id &&
    prev.stream.user_id === next.stream.user_id &&
    prev.stream.status === next.stream.status &&
    prev.stream.box_count === next.stream.box_count &&
    prev.stream.broadcast_mode === next.stream.broadcast_mode &&
    prev.stream.battle_mode === next.stream.battle_mode &&
    prev.stream.is_battle === next.stream.is_battle &&
    prev.isHost === next.isHost &&
    prev.isModerator === next.isModerator &&
    prev.isOfficer === next.isOfficer &&
    prev.streamStatus === next.streamStatus &&
    prev.maxItems === next.maxItems &&
    prev.mode === next.mode &&
    prev.hideEmptySeats === next.hideEmptySeats &&
    prev.seatPriceOverride === next.seatPriceOverride &&
    prev.localTracks?.[0] === next.localTracks?.[0] &&
    prev.localTracks?.[1] === next.localTracks?.[1] &&
    prev.cameraOverlayTrack === next.cameraOverlayTrack &&
    prev.remoteUsers === next.remoteUsers &&
    prev.localUserId === next.localUserId &&
    prev.isCameraOn === next.isCameraOn &&
    prev.isMicOn === next.isMicOn &&
    prev.cameraFacingMode === next.cameraFacingMode &&
    prev.boxCount === next.boxCount &&
    prev.battleState === next.battleState &&
    prev.supporters === next.supporters &&
    prev.joinWindowOpen === next.joinWindowOpen &&
    prev.userTeam === next.userTeam &&
    prev.remainingTime === next.remainingTime &&
    prev.shouldShowSidePicker === next.shouldShowSidePicker &&
    prev.isBattleActive === next.isBattleActive &&
    prev.battleStartedAt === next.battleStartedAt &&
    prev.battleFormat === next.battleFormat &&
    prev.isUniversalBattle === next.isUniversalBattle &&
    prev.showTicker === next.showTicker &&
    prev.enableStreamSwipe === next.enableStreamSwipe &&
    prev.canSwipe === next.canSwipe &&
    prev.hasRgbEffect === next.hasRgbEffect &&
    prev.canEditBoxes === next.canEditBoxes &&
    prev.broadcastMode === next.broadcastMode &&
    prev.trollToeMatch === next.trollToeMatch &&
    prev.canTrollToeFog === next.canTrollToeFog &&
    prev.isMobileViewer === next.isMobileViewer &&
     prev.onGift === next.onGift &&
     prev.onGiftAll === next.onGiftAll &&
     prev.onJoinSeat === next.onJoinSeat &&
     prev.onKick === next.onKick &&
     prev.toggleCamera === next.toggleCamera &&
     prev.toggleMicrophone === next.toggleMicrophone &&
     prev.flipCamera === next.flipCamera &&
     prev.onGetUserPositions === next.onGetUserPositions &&
     prev.onPickSide === next.onPickSide &&
     prev.onBattleGift === next.onBattleGift &&
     prev.onSwipeUp === next.onSwipeUp &&
     prev.onSwipeDown === next.onSwipeDown &&
     prev.onAddBox === next.onAddBox &&
     prev.onRemoveBox === next.onRemoveBox &&
     prev.onToggleRgb === next.onToggleRgb &&
     prev.onTrollToeFog === next.onTrollToeFog &&
     prev.onOpenUserAction === next.onOpenUserAction &&
     prev.onOpenUserStats === next.onOpenUserStats &&
     prev.onCloseUserStats === next.onCloseUserStats &&
     prev.onOpenHostStats === next.onOpenHostStats &&
     prev.onCloseHostStats === next.onCloseHostStats &&
     prev.onOpenModActions === next.onOpenModActions &&
     prev.onCloseModActions === next.onCloseModActions &&
     getSeatSignature(prev.seats) === getSeatSignature(next.seats)
   );
 }

export default memo(BroadcastGridComponent, areBroadcastGridPropsEqual);
