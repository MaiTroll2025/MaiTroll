import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { PreflightStore, usePreflightStore } from '@/lib/preflightStore';
import requestBroadcastMediaAccess from '@/lib/media/requestBroadcastMediaAccess';
import { useStreamStore } from '@/lib/streamStore';
import { LocalAudioTrack, LocalVideoTrack, AudioPresets, VideoPresets, Room, Track } from 'livekit-client';
import { Video, VideoOff, Mic, MicOff, RefreshCw, Swords, Gamepad2, Monitor, Lock, Eye, EyeOff, Radio, ShieldCheck, Flame, Crown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useScreenShare, StreamMode, canScreenShare } from '../../hooks/useScreenShare';
import { DraggableCameraOverlay } from '../../components/broadcast/DraggableCameraOverlay';
import UniverseModeSetup from '../../components/broadcast/UniverseModeSetup';
import { toast } from 'sonner';
import { useBroadcastLockdown } from '@/hooks/useBroadcastLockdown';
import { useBroadcastViewerCap } from '@/hooks/useBroadcastViewerCap';
import { startBroadcastWithCapacityCheck } from '@/lib/streamCapacity';
import { generateUUID } from '../../lib/uuid';
import { RANDOM_BATTLE_ENABLED } from '../../config/featureFlags';
import { US_STATES, getStateName } from '../../config/usStates';
import type { BattleModeType } from '../../types/stateBattle';
import { getUserStateRPC, assignUserToState } from '../../services/stateBattleService';
import {
  BROADCAST_CATEGORIES,
  getCategoryConfig,
  requiresReligion,
  forceRearCamera,
  allowFrontCamera,
  getMaxBoxCount,
  AVAILABLE_RELIGIONS,
  BroadcastCategoryId,
  MAX_ADMIN_SEAT_COUNT,
  MIN_ADMIN_SEAT_COUNT,
  DEFAULT_SEAT_COUNT,
} from '../../config/broadcastCategories';


/* ============================================================================
 * 🛡️  LIVEKIT STREAMING INFRASTRUCTURE
 *
 * This file initializes LiveKit streams.
 * ============================================================================ */

type BroadcastStartStage =
  | 'validation'
  | 'stream row created'
  | 'requesting livekit token'
  | 'token response received'
  | 'token response normalized'
  | 'connecting LiveKit room'
  | 'LiveKit connected'
  | 'publishing LiveKit tracks'
  | 'start capacity reached'
  | 'stream live verification'
  | 'redirecting/opening broadcast room'

type NormalizedLiveKitToken = {
  token: string
  roomName: string
  participantIdentity: string
}

function broadcastStartLog(message: string, details?: Record<string, unknown>) {
  console.info(`[BroadcastStart] ${message}`, details || {})
}

function broadcastStartError(stage: BroadcastStartStage, details?: Record<string, unknown>) {
  console.error(`[BroadcastStart] FAILED at stage: ${stage}`, details || {})
}

function normalizeLiveKitTokenResponse(raw: any, expectedRoomName: string, expectedIdentity: string): NormalizedLiveKitToken {
  const token = raw?.token
  const roomName = raw?.roomName || raw?.room || raw?.livekit_room || expectedRoomName
  const participantIdentity = raw?.participantIdentity || raw?.identity || raw?.participantName || expectedIdentity

  if (!raw?.success && raw?.success !== undefined) {
    throw new Error(raw?.error || 'LiveKit token request failed')
  }
  if (!token || typeof token !== 'string') {
    throw new Error('LiveKit token response missing token')
  }
  if (!roomName || typeof roomName !== 'string') {
    throw new Error('LiveKit token response missing roomName')
  }
  if (!participantIdentity || typeof participantIdentity !== 'string') {
    throw new Error('LiveKit token response missing participantIdentity')
  }

  return { token, roomName, participantIdentity }
}

async function requestLiveKitToken(roomName: string, userId: string): Promise<NormalizedLiveKitToken> {
  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: {
      room: roomName,
      userId,
      identity: userId,
      role: 'publisher',
      isHost: true,
    },
  })

  if (error) {
    const statusCode = error?.status || error?.statusCode || error?.status_code || null
    const bodyText = error?.body || error?.message || JSON.stringify(error)
    throw new Error(`LiveKit token request failed${statusCode ? ` (${statusCode})` : ''}: ${bodyText}`)
  }

  broadcastStartLog('token response received', {
    status: 200,
    ok: true,
    preview: JSON.stringify(data || {}).slice(0, 180),
  })

  return normalizeLiveKitTokenResponse(data, roomName, userId)
}

async function markBroadcastStartFailed(streamId: string | null, stage: BroadcastStartStage, reason: unknown) {
  if (!streamId) return
  const shortReason = reason instanceof Error ? reason.message : String(reason || 'Unknown error')
  const { error } = await supabase
    .from('streams')
    .update({
      status: 'ended',
      is_live: false,
      ended_at: new Date().toISOString(),
      end_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', streamId)

  if (error) {
    console.error('[BroadcastStart] failed to mark stream ended after failed start', {
      streamId,
      stage,
      reason: shortReason,
      supabaseCode: error.code,
      supabaseMessage: error.message,
    })
  }
}

function getLiveKitRoomState(room: Room): string {
  return String((room as any).connectionState || (room as any).state || '').toLowerCase()
}

async function waitForLiveKitConnected(room: Room, timeoutMs = 5000): Promise<void> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const state = getLiveKitRoomState(room)
    if (state === 'connected') {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(`LiveKit room did not reach connected state before publishing tracks. Current state: ${getLiveKitRoomState(room) || 'unknown'}`)
}

async function publishSetupTracksToRoom(
  room: Room,
  tracks: [LocalAudioTrack | null, LocalVideoTrack | null],
  screenTrack: LocalVideoTrack | null | undefined,
  useScreenShare: boolean
) {
  if (!room || room.state !== 'connected') {
    console.warn('[SetupPage] Skipping publish because room is not connected', {
      state: room?.state,
      roomName: room?.name,
    })
    return
  }

  const [audioTrack, cameraTrack] = tracks
  const videoTrack = useScreenShare ? screenTrack || null : cameraTrack

  if (!audioTrack) {
    throw new Error('Microphone track is not ready')
  }

  if (!videoTrack) {
    throw new Error(useScreenShare ? 'Screen share track is not ready' : 'Camera track is not ready')
  }

  await waitForLiveKitConnected(room)

  const existingAudio = Array.from(room.localParticipant.audioTrackPublications.values()).some(
    (publication: any) => !!publication?.track
  )
  const existingVideo = Array.from(room.localParticipant.videoTrackPublications.values()).some(
    (publication: any) => publication?.track === videoTrack
  )

  if (!existingAudio) {
    await room.localParticipant.publishTrack(audioTrack)
    console.log('[SetupPage] Published audio track')
  } else {
    console.log('[SetupPage] Audio track already published')
  }

  if (!existingVideo) {
    await room.localParticipant.publishTrack(videoTrack)
    console.log('[SetupPage] Published video track')
  } else {
    console.log('[SetupPage] Video track already published')
  }
}




export default function SetupPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<BroadcastCategoryId>('general');
  const [loading, setLoading] = useState(false);
  const [broadcasterLimitInfo, setBroadcasterLimitInfo] = useState<{ current: number; max: number; canStart: boolean; unrestricted?: boolean; isStaffBypass?: boolean } | null>(null);
  const [seatCount, setSeatCount] = useState<number>(DEFAULT_SEAT_COUNT);
  const [smokeEventEnabled, setSmokeEventEnabled] = useState(false);
const [randomBattleQueueEnabled, setRandomBattleQueueEnabled] = useState(false);
  const [battleMode, setBattleMode] = useState<BattleModeType>('world');
  const [userState, setUserState] = useState<string | null>(null);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [isAssigningState, setIsAssigningState] = useState(false);
  // Broadcast lockdown check
  const { isLocked: isBroadcastLocked, canBroadcast, isAdmin: isUserAdmin } = useBroadcastLockdown();

  // Broadcast restrictions from control panel
  const { startCapEnabled, startCapMax, allRestrictionsDisabled, seatCap } = useBroadcastViewerCap();

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const fromQuery = params.get('category');
      if (fromQuery && (fromQuery in BROADCAST_CATEGORIES)) {
        setCategory(fromQuery as BroadcastCategoryId);
      }
    } catch {
      // ignore
    }
  }, [location.search]);

  useEffect(() => {
    if (!title.trim() && profile?.username) {
      setTitle(`${profile.username}'s Live`);
    }
  }, [profile?.username, title]);

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Load user's assigned state
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const loadState = async () => {
      try {
        const state = await getUserStateRPC(user.id);
        if (!cancelled) setUserState(state);
      } catch (err) {
        console.error('[SetupPage] Failed to load user state:', err);
      }
    };
    loadState();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Category-specific state
  const [selectedReligion, setSelectedReligion] = useState('');
  
  // Battle format state
  const [battleFormat, setBattleFormat] = useState<'1v1' | '2v2' | '3v3' | '4v4' | '5v5'>('4v4');
  const [universeBattleMode, setUniverseBattleMode] = useState<'multi' | 'troll'>('troll');
  const [selectedMultiBattleFormat, setSelectedMultiBattleFormat] = useState<'1v1' | '2v2' | '3v3' | '4v4'>('4v4');
  
  // Password protection state
  const [isProtected, setIsProtected] = useState(false);
  const [broadcastPassword, setBroadcastPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
   // Check if user can create protected broadcast (admin/staff or level >= 50)
   const canCreateProtected = profile && (
     profile.role === 'admin' || 
     profile.is_admin || 
     profile.is_troll_officer || 
     profile.is_lead_officer || 
     (profile.level !== undefined && profile.level >= 50)
   );
   
    // Celeb stream support — only approved celebrities can create Celeb Streams
    const isApprovedCeleb = !!(profile && profile.celeb_role === 'approved');
    const [isCelebStream, setIsCelebStream] = useState(() => {
     const params = new URLSearchParams(location.search);
     return params.get('type') === 'celeb_stream';
   });

   useEffect(() => {
     if (isCelebStream && !isApprovedCeleb) {
       const params = new URLSearchParams(location.search);
       params.delete('type');
       window.history.replaceState({}, '', `${location.pathname}?${params.toString()}`);
       setIsCelebStream(false);
     }
   }, [isApprovedCeleb, isCelebStream, location.search])

   // Determine if user is admin for quality settings (1080p admin, 720p regular)
   const isStreamAdmin = !!(profile && (
     profile.role === 'admin' || profile.is_admin ||
     profile.role === 'owner'
   ));
  
  // Pre-generate stream ID for token optimization
  const [streamId] = useState(() => generateUUID());
  // Pre-fetch LiveKit token in background once we have user
  const [prefetchedToken, setPrefetchedToken] = useState<string | null>(null);
   // Pre-fetch LiveKit token once user is available
  useEffect(() => {
    if (!user?.id || prefetchedToken) return;
    
    const prefetchToken = async () => {
      try {
        const roomName = streamId;
        const data = await requestLiveKitToken(roomName, user.id);
        if (data?.token) {
          console.log('[SetupPage] Token prefetched successfully');
          setPrefetchedToken(data.token);
          // Store in sessionStorage for BroadcastPage
          sessionStorage.setItem('tc_stream_token', data.token);
        }
      } catch (err) {
        console.warn('[SetupPage] Token prefetch error:', err);
      }
    };
    
    // OPTIMIZED: Prefetch token immediately for faster broadcast start
    const timeout = setTimeout(prefetchToken, 100);
    return () => clearTimeout(timeout);
  }, [user?.id, streamId, prefetchedToken]);

  // Track if we are navigating to broadcast to prevent cleanup
  const isStartingStream = useRef(false);
  // Track page visibility to prevent refresh on tab switch
  const isPageVisible = useRef(true);
  const isTabSwitching = useRef(false);

// LiveKit room state - created in SetupPage and passed to BroadcastPage
  const [livekitRoom, setLivekitRoom] = useState<Room | null>(null);
  const livekitRoomRef = useRef<Room | null>(null);
  const mountedRef = useRef(true);


  // Get category config
  const categoryConfig = getCategoryConfig(category);
  const categoryRequiresReligion = requiresReligion(category);
  const shouldForceRearCamera = forceRearCamera(category);
  const canUseFrontCamera = allowFrontCamera(category);


  // Media state - LiveKit tracks for preview
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [livekitTracks, setLivekitTracks] = useState<[LocalAudioTrack | null, LocalVideoTrack | null]>([null, null]);
  const livekitTracksRef = useRef<[LocalAudioTrack | null, LocalVideoTrack | null]>([null, null]);
  const setLivekitTracksState = (tracks: [LocalAudioTrack | null, LocalVideoTrack | null]) => {
    livekitTracksRef.current = tracks;
    setLivekitTracks(tracks);
  };
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [hasRearCamera, setHasRearCamera] = useState(false);
  const [followerCount, setFollowerCount] = useState<number>(0);

  // Stream mode for gaming category (camera vs screen share)
  const screenShare = useScreenShare();
  const [cameraOverlayEnabled, setCameraOverlayEnabled] = useState(false);
  const cameraOverlayContainerRef = useRef<HTMLDivElement>(null);
  const [cameraOverlayStream, setCameraOverlayStream] = useState<MediaStream | null>(null);
  
  // Use global stream store for persistence across navigation
  const {
    screenTrack,
    setScreenTrack,
    screenAudioTrack,
    setScreenAudioTrack,
    cameraTrack,
    setCameraTrack,
    streamMode,
    setStreamMode,
    screenPreviewStream,
    setScreenPreviewStream,
    clearTracks,
    initializeTracks,
  } = useStreamStore();

  // Persist screen share state in sessionStorage for tab switch restoration
  useEffect(() => {
    if (screenTrack) {
      console.log('[SetupPage] Screen track active - storing state');
      sessionStorage.setItem('tc_screen_share_active', 'true');
      sessionStorage.setItem('tc_stream_mode', 'screen');
    } else {
      sessionStorage.removeItem('tc_screen_share_active');
      sessionStorage.setItem('tc_stream_mode', streamMode);
    }
    // Persist camera overlay enabled state
    if (cameraOverlayEnabled) {
      sessionStorage.setItem('tc_camera_overlay_enabled', 'true');
    } else {
      sessionStorage.removeItem('tc_camera_overlay_enabled');
    }
  }, [screenTrack, streamMode, cameraOverlayEnabled]);

  // Restore screen share state when returning from screen picker
  useEffect(() => {
    const wasScreenSharing = sessionStorage.getItem('tc_screen_share_active') === 'true';
    
    if (wasScreenSharing && streamMode === 'camera' && !screenTrack) {
      console.log('[SetupPage] Restoring screen share mode from session storage');
      // Only restore if there's a screen track in the store - this means we have an active screen share
      // that we need to restore. If no screen track, wait for it.
      if (useStreamStore.getState().screenTrack) {
        setStreamMode('screen');
        // Don't need to re-attach - the media acquisition effect will handle it
      }
    }
    // Restore camera overlay state
    const wasCameraOverlay = sessionStorage.getItem('tc_camera_overlay_enabled') === 'true';
    if (wasCameraOverlay && !cameraOverlayEnabled) {
      console.log('[SetupPage] Restoring camera overlay enabled from session storage');
      setCameraOverlayEnabled(true);
    }
  }, [screenTrack, streamMode, setStreamMode, cameraOverlayEnabled]);

   // Permission state - track if camera/mic permissions need to be requested
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const showPermissionPrompt = permissionStatus === 'prompt' || permissionStatus === 'unknown';
  const [showDriverTestModal, setShowDriverTestModal] = useState(false);
  const [inlineAgreementChecked, setInlineAgreementChecked] = useState(false);





  // Set stream mode based on category
  useEffect(() => {
    // Only reset to camera mode if NOT in screen share mode with an active screen track
    // This prevents resetting screen share mode when returning from screen picker
    const isScreenSharing = sessionStorage.getItem('tc_screen_share_active') === 'true';
    if (category !== 'gaming' && !(streamMode === 'screen' && screenTrack) && !isScreenSharing) {
      // Reset to camera mode for non-gaming categories
      setStreamMode('camera');
      setCameraOverlayEnabled(false);
    }
    // Note: For gaming, we don't auto-switch - let user choose between camera/screen
  }, [category, setStreamMode, screenTrack, streamMode]);

  // Manage camera overlay stream for gaming mode
  useEffect(() => {
    let overlayStream: MediaStream | null = null;

    const setupCameraOverlay = async () => {
      if (category === 'gaming' && streamMode === 'screen' && cameraOverlayEnabled) {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('navigator.mediaDevices unavailable');
          overlayStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: facingMode,
            },
            audio: false,
          });

          setCameraOverlayStream(overlayStream);

          // Attach to overlay container
          if (cameraOverlayContainerRef.current) {
            cameraOverlayContainerRef.current.innerHTML = '';
            const videoEl = document.createElement('video');
            videoEl.srcObject = overlayStream;
            videoEl.autoplay = true;
            videoEl.playsInline = true;
            videoEl.muted = true;
            videoEl.style.width = '100%';
            videoEl.style.height = '100%';
            videoEl.style.objectFit = 'cover';
            videoEl.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'none';
            cameraOverlayContainerRef.current.appendChild(videoEl);
          }

          console.log('[SetupPage] Camera overlay stream acquired');
        } catch (err: any) {
          console.error('[SetupPage] Failed to acquire camera overlay:', err);
          toast.error('Failed to access camera for overlay');
          setCameraOverlayEnabled(false);
        }
      }
    };

    const cleanupCameraOverlay = () => {
      if (cameraOverlayStream) {
        cameraOverlayStream.getTracks().forEach(t => t.stop());
        setCameraOverlayStream(null);
      }
      if (cameraOverlayContainerRef.current) {
        cameraOverlayContainerRef.current.innerHTML = '';
      }
    };

    if (category === 'gaming' && streamMode === 'screen' && cameraOverlayEnabled) {
      setupCameraOverlay();
    } else {
      cleanupCameraOverlay();
    }

    return () => {
      if (overlayStream) {
        overlayStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [category, streamMode, cameraOverlayEnabled, facingMode, cameraOverlayStream]);

  // Handle camera facing mode based on category
  useEffect(() => {
    if (shouldForceRearCamera) {
      setFacingMode('environment');
    } else if (!canUseFrontCamera) {
      // If front camera not allowed but we were on it, switch to rear
      if (facingMode === 'user') {
        setFacingMode('environment');
      }
    }
    }, [category, shouldForceRearCamera, canUseFrontCamera, facingMode]);

  // Effect to detect available cameras
  useEffect(() => {
     const enumerateCameras = async () => {
       try {
         if (!navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== 'function') {
           console.warn('[SetupPage] enumerateDevices not supported');
           return;
         }
         const devices = await navigator.mediaDevices.enumerateDevices();
         const videoDevices = devices.filter(device => device.kind === 'videoinput');
         setHasMultipleCameras(videoDevices.length > 1);
         setHasRearCamera(videoDevices.some(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')));
       } catch (err: any) {
         console.error('Error enumerating devices:', {
           name: err?.name,
           message: err?.message,
           code: err?.code,
           constraint: err?.constraint,
         });
         setHasMultipleCameras(false);
         setHasRearCamera(false);
       }
     };
    enumerateCameras();
  }, []); // Run once on mount

  // Fetch follower count for Trollmers eligibility
  useEffect(() => {
    async function fetchFollowerCount() {
      if (!user?.id) return;
      const { count } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);
      setFollowerCount(count || 0);
    }
    fetchFollowerCount();
  }, [user?.id]);

  // Check broadcaster limit from control panel settings
  useEffect(() => {
    async function checkBroadcasterLimit() {
      if (!user?.id) return;

      // If "Remove All Restrictions" is enabled, skip the cap entirely
      if (allRestrictionsDisabled) {
        setBroadcasterLimitInfo({
          current: 0,
          max: startCapMax,
          canStart: true,
          unrestricted: true,
        });
        return;
      }

      // Staff/admin roles bypass the cap entirely
      const p: any = profile;
      const isStaffOrAdmin =
        p?.role === 'admin' || p?.is_admin ||
        p?.role === 'superadmin' || p?.is_superadmin ||
        p?.role === 'lead_troll_officer' || p?.is_lead_officer ||
        p?.role === 'troll_officer' || p?.is_troll_officer ||
        p?.role === 'secretary' || p?.role === 'moderator' ||
        p?.role === 'agency_hr' || p?.role === 'agency_hr_manager' || p?.role === 'agency_leader';

      if (isStaffOrAdmin) {
        setBroadcasterLimitInfo({
          current: 0,
          max: startCapMax,
          canStart: true,
          unrestricted: true,
          isStaffBypass: true,
        });
        return;
      }

      const { count, error } = await supabase
        .from('streams')
        .select('*', { count: 'exact', head: true })
        .eq('is_live', true)
        .eq('status', 'live');

      if (error) {
        console.error('Error checking broadcaster limit:', error);
        return;
      }

      const currentCount = count || 0;
      const maxLimit = startCapMax;
      const canStart = currentCount < maxLimit;

      setBroadcasterLimitInfo({
        current: currentCount,
        max: maxLimit,
        canStart,
      });
    }
    checkBroadcasterLimit();
  }, [user?.id, startCapEnabled, startCapMax, allRestrictionsDisabled, profile]);

  // Check camera/mic permission state without prompting on mount
  useEffect(() => {
    const stored = localStorage.getItem('tc_camera_permissions_granted') === 'true';
    if (stored) {
      setPermissionStatus('granted');
      return;
    }

    // Try Permissions API without prompting, fallback to prompting only on user action
    try {
      if ((navigator as any).permissions && (navigator as any).permissions.query) {
        ;(navigator as any).permissions.query({ name: 'camera' }).then((p: any) => {
          if (p.state === 'granted') setPermissionStatus('granted')
          else if (p.state === 'denied') setPermissionStatus('denied')
          else setPermissionStatus('prompt')
        }).catch(() => setPermissionStatus('prompt'))
      } else {
        setPermissionStatus('prompt')
      }
    } catch (e) {
      setPermissionStatus('prompt')
    }
  }, []);


  // Request camera and microphone permissions
  const requestPermissions = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Camera/microphone is not available in this browser. Open the page in Safari on iOS.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      
      // Stop the test stream immediately - we just wanted the permission
      stream.getTracks().forEach(track => track.stop());
      
      // Store permission granted flag
      localStorage.setItem('tc_camera_permissions_granted', 'true');
      localStorage.setItem('tc_camera_permissions_timestamp', Date.now().toString());
      
      setPermissionStatus('granted');
      
      toast.success('Camera and microphone permissions granted!');
      
      // Trigger the media acquisition effect
      // The existing useEffect will pick up the permission change
    } catch (err: any) {
      console.error('Permission request failed:', {
        name: err?.name,
        message: err?.message,
        code: err?.code,
        constraint: err?.constraint,
      });
      
      if (err.name === 'NotAllowedError') {
        setPermissionStatus('denied');
        toast.error('Camera permission denied. Please allow access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        toast.error('No camera or microphone found. Please check your devices.');
      } else if (err.name === 'NotReadableError') {
        toast.error('Camera/microphone is already in use by another application.');
      } else if (err.name === 'OverconstrainedError') {
        toast.error('Browser cannot satisfy camera/microphone constraints. Try adjusting settings.');
      } else {
        toast.error('Could not access camera or microphone: ' + err.message);
      }
    }
  };

  // Helper to clear the video container - detaches any existing LiveKit elements
  const clearVideoContainer = () => {
    if (!videoContainerRef.current) return;

    // Remove any dynamically attached video elements, but keep the React-managed preview video
    const attachedElements = Array.from(videoContainerRef.current.querySelectorAll('video') as NodeListOf<HTMLVideoElement>);
    attachedElements.forEach(el => {
      if (el !== previewVideoRef.current) {
        el.remove();
      }
    });

    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    const videoEl = previewVideoRef.current;
    if (!videoEl) return;

    if (previewStream) {
      videoEl.srcObject = previewStream;
      videoEl.muted = true;
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.style.display = 'block';
      videoEl.style.backgroundColor = 'black';
      videoEl.style.width = '100%';
      videoEl.style.height = '100%';
      videoEl.style.objectFit = 'cover';
      videoEl.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'none';
      videoEl.play().catch(() => {
        // Autoplay may still be blocked in some contexts; muted should help.
      });
    } else {
      videoEl.srcObject = null;
    }
  }, [previewStream, facingMode]);

  // Attach a native browser video element for preview directly from a MediaStream
  const attachNativePreview = (stream: MediaStream, facing: 'user' | 'environment') => {
    setPreviewStream(stream);

    if (!videoContainerRef.current) return;

    // Clear any old attached previews or track-based elements before applying this native stream.
    clearVideoContainer();

    // If the React-managed preview video exists, it will handle the stream assignment.
    if (previewVideoRef.current) {
      return;
    }

    const videoEl = document.createElement('video');
    videoEl.srcObject = stream;
    videoEl.setAttribute('autoplay', '');
    videoEl.setAttribute('muted', '');
    videoEl.setAttribute('playsinline', '');
    videoEl.autoplay = true;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.preload = 'auto';
    videoEl.controls = false;
    videoEl.style.display = 'block';
    videoEl.style.backgroundColor = 'black';
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    videoEl.style.objectFit = 'cover';
    videoEl.style.transform = facing === 'user' ? 'scaleX(-1)' : 'none';

    videoContainerRef.current.appendChild(videoEl);
    videoEl.onloadedmetadata = () => {
      videoEl.play().catch(() => {
        // Autoplay may still be blocked in some contexts; muted should help.
      });
    };
    videoEl.onloadeddata = () => {
      videoEl.play().catch(() => {
        // Autoplay may still be blocked in some contexts; muted should help.
      });
    };
    videoEl.onerror = (event) => {
      console.error('[SetupPage] Native preview video error:', event);
    };
    videoEl.play().catch(() => {
      // Autoplay may still be blocked in some contexts; muted should help.
    });
  };

  // Attach video track to container using LiveKit's attach() method
  const attachVideoTrack = (videoTrack: LocalVideoTrack, facing: 'user' | 'environment') => {
    if (!videoContainerRef.current) return;
    
    // Clear previous preview first
    clearVideoContainer();
    
    try {
      const mediaElement = videoTrack.attach();
      mediaElement.setAttribute('autoplay', '');
      mediaElement.setAttribute('muted', '');
      mediaElement.setAttribute('playsinline', '');
      mediaElement.autoplay = true;
      mediaElement.muted = true;
      (mediaElement as any).playsInline = true;
      mediaElement.style.display = 'block';
      mediaElement.style.backgroundColor = 'black';
      mediaElement.style.width = '100%';
      mediaElement.style.height = '100%';
      mediaElement.style.objectFit = 'cover';
      mediaElement.style.transform = facing === 'user' ? 'scaleX(-1)' : 'none';

      videoContainerRef.current.appendChild(mediaElement);
      mediaElement.onloadedmetadata = () => {
        mediaElement.play().catch(() => {
          // Autoplay may still be blocked in some contexts; muted should help.
        });
      };
      mediaElement.onloadeddata = () => {
        mediaElement.play().catch(() => {
          // Autoplay may still be blocked in some contexts; muted should help.
        });
      };
      mediaElement.onerror = (event) => {
        console.error('[SetupPage] LiveKit attach video error:', event);
      };
      mediaElement.play().catch(() => {
        // Autoplay may still be blocked in some contexts; muted should help.
      });
    } catch (err) {
      console.warn('[SetupPage] LiveKit attach failed, falling back to native preview:', err);
      const stream = new MediaStream([(videoTrack as any).getMediaStreamTrack()]);
      attachNativePreview(stream, facing);
    }
  };

  // Detach video track from container using LiveKit's detach() method
  const detachVideoTrack = (videoTrack: LocalVideoTrack) => {
    if (!videoContainerRef.current) return;
    
    // LiveKit's detach() returns an array of HTMLVideoElements
    const mediaElements = videoTrack.detach();
    if (mediaElements && mediaElements.length > 0) {
      mediaElements.forEach(el => {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    }
  };

  // Acquire media stream using native browser API, then wrap in LiveKit tracks
  const acquireMediaStream = async (videoFacingMode: 'user' | 'environment', enableVideo: boolean): Promise<MediaStream | null> => {
    console.log('[acquireMediaStream] Attempting to acquire media stream...');

    // Check for getUserMedia support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errorMsg = 'getUserMedia not supported in this browser/context';
      console.error(`[acquireMediaStream] ${errorMsg}`);
      const isSecure = window.isSecureContext;

      if (!isSecure) {
         toast.error(
           <div className="flex flex-col gap-1">
             <span className="font-bold">Camera Blocked by Browser Security</span>
             <span className="text-xs">
               Browsers block camera access on HTTP (http://{window.location.host}).
               <br/><br/>
               <strong>FIX for Chrome/Edge:</strong>
               <br/>
               1. Go to <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>
               <br/>
               2. Add <code>http://{window.location.hostname}:5176</code>
               <br/>
               3. Enable & Relaunch
             </span>
           </div>,
           { duration: 10000 }
         );
      } else {
         toast.error('Camera access is not supported in this browser.');
      }
      return null;
    }

    try {
      // First get native media stream using browser API
      console.log('[acquireMediaStream] Getting native media stream...');
      
      const videoConstraints: MediaTrackConstraints = {
        facingMode: videoFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: enableVideo ? videoConstraints : false
      };

      let nativeStream: MediaStream;
        try {
          // Guard: navigator.mediaDevices may be undefined on iOS/in-app browsers
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('[acquireMediaStream] navigator.mediaDevices is unavailable (likely iOS without permissions-policy).');
            toast.error('Camera/microphone is not available in this browser. Open the page in Safari.');
            return null;
          }
          nativeStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err: any) {
        if (err.name === 'OverconstrainedError' || err.name === 'NotReadableError' || err.name === 'NotFoundError') {
          console.warn('[acquireMediaStream] Advanced video constraints failed, retrying with minimal constraints', err);
          nativeStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: enableVideo ? { facingMode: videoFacingMode } : false
          });
        } else {
          throw err;
        }
      }
      console.log('[acquireMediaStream] Native stream acquired');

       // Wrap audio track in LiveKit LocalAudioTrack
       let audioTrack: LocalAudioTrack | null = null;
       let videoTrack: LocalVideoTrack | null = null;

       const audioTracks = nativeStream.getAudioTracks();
       if (audioTracks.length > 0) {
         try {
            audioTrack = new LocalAudioTrack(audioTracks[0]);
            audioTrack.source = Track.Source.Microphone;
            console.log('[acquireMediaStream] Audio track wrapped in LiveKit');
         } catch (audioErr) {
           console.warn('[acquireMediaStream] Failed to wrap audio track:', audioErr);
         }
       }

       const videoTracks = nativeStream.getVideoTracks();
       if (videoTracks.length > 0) {
         try {
            videoTrack = new LocalVideoTrack(videoTracks[0]);
            videoTrack.source = Track.Source.Camera;
            console.log('[acquireMediaStream] Video track wrapped in LiveKit');
         } catch (videoErr) {
           console.warn('[acquireMediaStream] Failed to wrap video track:', videoErr);
         }
       }

       // Store LiveKit tracks for reuse in BroadcastPage
       setLivekitTracksState([audioTrack, videoTrack]);
       PreflightStore.setLivekitTracks([audioTrack, videoTrack]);
       PreflightStore.setLivekitRoom(null);
       setCameraTrack(videoTrack);
       console.log('[acquireMediaStream] LiveKit tracks stored locally for BroadcastPage');

       // Attach native preview element directly instead of relying on LiveKit attach.
       if (nativeStream.getVideoTracks().length > 0) {
        console.log('[acquireMediaStream] Attaching native preview to container');
        attachNativePreview(nativeStream, videoFacingMode);
      }
      
      console.log('[acquireMediaStream] MediaStream created:', {
        audioTracks: nativeStream.getAudioTracks().length,
        videoTracks: nativeStream.getVideoTracks().length
      });
      
      return nativeStream;
    } catch (err: any) {
      console.error('[acquireMediaStream] Error creating media stream:', err);
      if (err.name === 'NotReadableError') {
        toast.error('Device in use:\n\nClose any other apps or browser tabs that might be using your camera (FaceTime, Zoom, Teams, etc.), then try again.');
      } else {
        toast.error('Failed to access camera/microphone: ' + err.message);
      }
      return null;
    }
  };



  // Cleanup session storage when component unmounts (user leaves setup page)
  useEffect(() => {
    return () => {
      // Only clear if not starting stream and not in a tab switch
      // Tab switches are handled by the visibilitychange listener
      // Also check if screen share is active - if so, preserve state for when user returns from screen picker
      const isScreenSharing = sessionStorage.getItem('tc_screen_share_active') === 'true';
      if (!isStartingStream.current && !isTabSwitching.current && !isScreenSharing) {
        console.log('[SetupPage] Cleanup: Clearing session storage flags (actual page leave)');
        sessionStorage.removeItem('tc_setup_initialized');
        sessionStorage.removeItem('tc_tab_switching');
        sessionStorage.removeItem('tc_screen_share_active');
        sessionStorage.removeItem('tc_stream_mode');
        sessionStorage.removeItem('tc_camera_overlay_enabled');
      } else if (isScreenSharing) {
        console.log('[SetupPage] Cleanup: Preserving session storage (screen share in progress - user returning from picker)');
      } else {
        console.log('[SetupPage] Cleanup: Preserving session storage (tab switch or stream start)');
      }
    };
  }, []);

  // Track page visibility to prevent stream cleanup on tab switch
  useEffect(() => {
    const handleVisibilityChange = () => {
      const wasVisible = isPageVisible.current;
      isPageVisible.current = document.visibilityState === 'visible';
      
      console.log(`[SetupPage] Visibility changed: ${wasVisible ? 'visible' : 'hidden'} -> ${isPageVisible.current ? 'visible' : 'hidden'}`);
      
      // Track if this is a tab switch (was visible, now hidden, or vice versa)
      if (wasVisible !== isPageVisible.current) {
        isTabSwitching.current = true;
        // Store in sessionStorage to persist across the tab switch
        if (!isPageVisible.current) {
          sessionStorage.setItem('tc_tab_switching', 'true');
        }
        // Reset after a short delay
        setTimeout(() => {
          isTabSwitching.current = false;
        }, 500);
      }
      
      // When tab becomes visible again, don't re-acquire media if we already have it
      // This prevents screen share from being lost when switching tabs
      if (isPageVisible.current && wasVisible === false) {
        console.log('[SetupPage] Tab became visible - checking if stream needs restoration');
        
        // If we have a screen share track but lost the stream state, try to restore it
        if (streamMode === 'screen' && !stream && screenTrack) {
          console.log('[SetupPage] Screen share mode active but no stream - state may have been lost');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [streamMode, stream, screenTrack]);

  useEffect(() => {
    // Only acquire media if permissions have been granted
    if (showPermissionPrompt) {
      console.log('[SetupPage] Waiting for user to grant permissions.');
      return;
    }

    // Check sessionStorage for tab switch state (persists across tab visibility changes)
    const wasInitialized = sessionStorage.getItem('tc_setup_initialized') === 'true';
    const isReturningFromTabSwitch = sessionStorage.getItem('tc_tab_switching') === 'true';
    const isScreenSharing = sessionStorage.getItem('tc_screen_share_active') === 'true';
    
    // Skip re-initialization only when we have a valid stream or screen track to preserve.
    // Otherwise, if the page reloads or the stream was lost, we need to re-acquire media.
    const shouldSkipTabRestore = isReturningFromTabSwitch && !!stream;
    const shouldSkipScreenShareRestore = isScreenSharing && !!screenTrack;
    const shouldSkipScreenMode = streamMode === 'screen' && !!screenTrack;

    if (wasInitialized && (shouldSkipTabRestore || shouldSkipScreenShareRestore || shouldSkipScreenMode)) {
      console.log('[SetupPage] Returning from tab switch or screen share mode, skipping re-acquisition');
      sessionStorage.removeItem('tc_tab_switching');
      return;
    }

    if (isReturningFromTabSwitch) {
      console.log('[SetupPage] Returning from tab switch but no existing stream found, re-acquiring media');
      sessionStorage.removeItem('tc_tab_switching');
    }

    // Also skip if we have a screen share track (even if streamMode says camera - edge case)
    // This ensures we don't accidentally re-acquire camera when in screen share mode.
    if (screenTrack && !stream) {
      console.log('[SetupPage] Screen share track exists without native stream, skipping camera re-acquisition');
      return;
    }

    // Mark as initialized immediately to prevent duplicate runs
    sessionStorage.setItem('tc_setup_initialized', 'true');
    
    console.log('[SetupPage] Media acquisition useEffect triggered. facingMode:', facingMode, 'isVideoEnabled:', isVideoEnabled, 'wasInitialized:', wasInitialized);
    let currentLocalStream: MediaStream | null = null;
    const isMounted = { current: true };

    if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function') {
        navigator.mediaDevices.enumerateDevices().then(devices => {
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            setHasMultipleCameras(videoDevices.length > 1);
        }).catch((err: any) => {
            console.warn('[SetupPage] Failed to enumerate devices during media acquisition:', {
                name: err?.name,
                message: err?.message,
                code: err?.code,
            });
        });
    } else {
        console.warn('[SetupPage] enumerateDevices not supported during media acquisition');
    }

    async function getInitialMedia() {
      console.log('[SetupPage] getInitialMedia called. Existing stream state:', stream ? 'available' : 'not available');
      
      // Only use store streamMode (authoritative) - sessionStorage can be stale from previous sessions
      if (streamMode === 'screen' && screenTrack) {
        console.log('[SetupPage] Screen share mode active with track - attaching to preview');
        if (videoContainerRef.current) {
          clearVideoContainer();
          const mediaElement = screenTrack.attach();
          mediaElement.style.width = '100%';
          mediaElement.style.height = '100%';
          mediaElement.style.objectFit = 'contain';
          mediaElement.style.position = 'absolute';
          mediaElement.style.top = '0';
          mediaElement.style.left = '0';
          mediaElement.autoplay = true;
          mediaElement.playsInline = true;
          mediaElement.muted = true;
          videoContainerRef.current.appendChild(mediaElement);
          mediaElement.play().catch(() => {});
          console.log('[SetupPage] Screen track attached for preview');
        }
        return;
      }
      
      // For camera mode: Stop previous tracks if any
      if (stream && streamMode === 'camera') {
          console.log('[SetupPage] Stopping previous camera media tracks.');
          stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await acquireMediaStream(facingMode, isVideoEnabled);
      
      if (!isMounted.current) {
        console.log('[SetupPage] Component unmounted before media acquisition completed.');
        mediaStream?.getTracks().forEach(track => track.stop());
        return;
      }

      if (!mediaStream) {
        console.error('[SetupPage] getInitialMedia: Failed to acquire media stream.');
        return;
      }

      console.log('[SetupPage] getInitialMedia: Media stream successfully acquired, setting state.');
      currentLocalStream = mediaStream;
      setStream(mediaStream);
      setPreviewStream(mediaStream);

      // Note: Video preview is now handled by the React-managed preview video element.
      console.log('[SetupPage] Video playback handled by native preview element');
    }
    getInitialMedia();

      return () => {
       isMounted.current = false;
       
       const amStartingStream = isStartingStream.current || sessionStorage.getItem('tc_starting_stream') === 'true';
       const transferringToBroadcast = usePreflightStore.getState().transferringToBroadcast
       const isScreenSharing = sessionStorage.getItem('tc_screen_share_active') === 'true';
       console.log('[SetupPage] Cleanup: isStartingStream =', amStartingStream, ', transferringToBroadcast =', transferringToBroadcast, ', isScreenSharing =', isScreenSharing);
       
       if (transferringToBroadcast) {
         console.log('[SetupPage] Transfer in progress; preserving room and tracks');
         return
       }
       
       const tracks = livekitTracksRef.current
       if (tracks[1]) {
         console.log('[SetupPage] Cleanup: Detaching LiveKit video track');
         detachVideoTrack(tracks[1]);
       }
       
       if (currentLocalStream) {
         if (isTabSwitching.current || !isPageVisible.current || isScreenSharing) {
           console.log('[SetupPage] Cleanup: Tab switch or screen share picker - preserving media stream locally.');
         } else {
           console.log('[SetupPage] Cleanup: Cleaning up media stream on unmount (not starting stream).');
           currentLocalStream.getTracks().forEach(track => track.stop());
         }
       }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showPermissionPrompt]);

  // Toggle video - stop/start the track
  const toggleVideo = async () => {
    const newState = !isVideoEnabled;
    
    if (newState) {
      // Re-acquire video track
      const mediaStream = await acquireMediaStream(facingMode, true);
      if (mediaStream) {
        setStream(mediaStream);
      }
    } else {
      // Stop video track
      if (stream) {
        stream.getVideoTracks().forEach(track => track.stop());
      }
      setCameraTrack(null);
      setLivekitTracksState([livekitTracksRef.current[0], null]);
      PreflightStore.setLivekitTracks([livekitTracksRef.current[0], null]);
      // Clear video preview
      clearVideoContainer();
      setPreviewStream(null);
    }
    setIsVideoEnabled(newState);
  };

  // Toggle audio - stop/start the track
  const toggleAudio = async () => {
    const newState = !isAudioEnabled;
    
    if (!newState && stream) {
      // Stop audio track
      stream.getAudioTracks().forEach(track => track.stop());
      setLivekitTracksState([null, livekitTracksRef.current[1]]);
      PreflightStore.setLivekitTracks([null, livekitTracksRef.current[1]]);
    } else if (newState && !isAudioEnabled) {
      // Re-acquire audio
      const mediaStream = await acquireMediaStream(facingMode, isVideoEnabled);
      if (mediaStream) {
        setStream(mediaStream);
      }
    }
    setIsAudioEnabled(newState);
  };

  // Flip camera - properly recreate video track with new facing mode
  const flipCamera = async () => {
    if (!canUseFrontCamera && facingMode === 'environment') {
      toast.error('Front camera is not available for this category');
      return;
    }
    
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    
    // Recreate video track with new facing mode
    if (livekitTracks[1]) {
      try {
        console.log('[SetupPage] Recreating video track with facing mode:', newFacingMode);
        
        // Detach and close current video track
        detachVideoTrack(livekitTracks[1]);
        livekitTracks[1].stop();
        (livekitTracks[1] as any).close();
        
        // Get new video track using native browser API
        let newNativeStream: MediaStream;
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('navigator.mediaDevices unavailable');
          newNativeStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: newFacingMode,
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
        } catch (err: any) {
          console.warn('[SetupPage] Flip camera constraints failed, retrying with minimal constraints', err);
          if (!navigator.mediaDevices) throw err;
          newNativeStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: newFacingMode }
          });
        }
        
        const newVideoTracks = newNativeStream.getVideoTracks();
        if (newVideoTracks.length === 0) {
          throw new Error('No video track found');
        }
        
        // Wrap in LiveKit track
        const newVideoTrack = new LocalVideoTrack(newVideoTracks[0]);
        newVideoTrack.source = Track.Source.Camera;
        
        // Update state with new track
        setLivekitTracksState([livekitTracks[0], newVideoTrack]);
        PreflightStore.setLivekitTracks([livekitTracks[0], newVideoTrack]);
        setCameraTrack(newVideoTrack);
        
        // Store updated LiveKit tracks for BroadcastPage reuse
        // Update preview stream for state management
        const newStream = new MediaStream();
        if (livekitTracks[0]) {
          newStream.addTrack((livekitTracks[0] as any).getMediaStreamTrack());
        }
        newStream.addTrack((newVideoTrack as any).getMediaStreamTrack());
        setStream(newStream);
        
        // Attach preview using native browser video element
        attachNativePreview(newNativeStream, newFacingMode);
        
        console.log('[SetupPage] Video track recreated successfully');
      } catch (err) {
        console.error('[SetupPage] Failed to recreate video track:', err);
        toast.error('Failed to switch camera');
      }
    }
  };

  // Toggle screen sharing for gaming mode
  const toggleScreenShare = async () => {
    if (streamMode === 'screen') {
      // Switch back to camera mode - stop the screen track directly
      if (screenTrack) {
        screenTrack.stop();
        screenTrack.detach().forEach(el => el.remove());
      }
      setScreenTrack(null);
      setScreenPreviewStream(null);
      setStreamMode('camera');
      // Re-acquire camera stream
      const mediaStream = await acquireMediaStream(facingMode, isVideoEnabled);
      if (mediaStream) {
        setStream(mediaStream);
      }
      toast.info('Switched to camera mode');
    } else {
      // Show prompt for split screen requirement BEFORE opening the screen picker
      // This is critical: if user doesn't have split screen, they lose the SetupPage state
      const confirmed = window.confirm(
        'IMPORTANT: To keep your stream settings:\n\n' +
        '1. Open Split Screen view (drag this window to the left half of your screen)\n' +
        '2. Open the window/app you want to share on the right side\n' +
        '3. Then select the window from the picker\n\n' +
        'If you close this window while selecting, your settings will be lost!\n\n' +
        'Click OK to continue with screen selection, or Cancel to set up split screen first.'
      );
      
      if (!confirmed) {
        return;
      }

      // Call getDisplayMedia FIRST while user gesture is still active
      // Browsers require getDisplayMedia to be called synchronously from a click handler
      let displayStream: MediaStream;
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          throw new Error('Screen sharing is not supported in this browser.');
        }
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 60, max: 60 },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true // Capture system audio
        });
      } catch (err: any) {
        // User cancelled the picker - not an error
        if (err.name !== 'NotAllowedError') {
          console.error('[toggleScreenShare] getDisplayMedia failed:', err);
          toast.error('Failed to start screen sharing');
        }
        return;
      }

      // Check if we got system audio - if not, try to get it separately
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.log('[toggleScreenShare] No system audio from getDisplayMedia, trying getUserMedia for system audio');
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('navigator.mediaDevices unavailable');
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            }
          });
          const systemAudioTrack = audioStream.getAudioTracks()[0];
          if (systemAudioTrack) {
            displayStream.addTrack(systemAudioTrack);
            console.log('[toggleScreenShare] Added system audio track');
          }
        } catch (audioErr) {
          console.warn('[toggleScreenShare] Could not get system audio:', audioErr);
        }
      } else {
        console.log('[toggleScreenShare] Got system audio from getDisplayMedia');
      }

      // User selected a screen - now stop camera and set up screen share
      if (stream) {
        console.log('[toggleScreenShare] Stopping camera stream before screen share');
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }

      if (livekitTracks[1]) {
        detachVideoTrack(livekitTracks[1]);
      }

      // Create LiveKit track from the display stream
      const displayVideoTrack = displayStream.getVideoTracks()[0];
      const displayAudioTrack = displayStream.getAudioTracks()[0];
      
      const videoTrack = new LocalVideoTrack(displayVideoTrack, {
        name: 'screen-share'
      } as any);
      videoTrack.source = Track.Source.ScreenShare;

      // Also create audio track for system audio
      let audioTrack: LocalAudioTrack | null = null;
      if (displayAudioTrack) {
        audioTrack = new LocalAudioTrack(displayAudioTrack, {
          name: 'screen-share-audio'
        } as any);
        audioTrack.source = Track.Source.ScreenShareAudio;
        console.log('[toggleScreenShare] Created audio track from display stream');
      }

      setScreenTrack(videoTrack);
      setScreenAudioTrack(audioTrack); // Store the audio track
      setStreamMode('screen');

      // Attach screen share track to preview
      if (videoContainerRef.current) {
        clearVideoContainer();
        const mediaElement = videoTrack.attach();
        mediaElement.style.width = '100%';
        mediaElement.style.height = '100%';
        mediaElement.style.objectFit = 'contain';
        mediaElement.style.position = 'absolute';
        mediaElement.style.top = '0';
        mediaElement.style.left = '0';
        mediaElement.autoplay = true;
        (mediaElement as any).playsInline = true;
        mediaElement.muted = true;
        videoContainerRef.current.appendChild(mediaElement);
        // Ensure playback starts - some browsers require explicit play()
        mediaElement.play().catch(() => {
          // autoplay may still be blocked in some contexts, but muted should handle it
        });
        console.log('[SetupPage] Screen track attached for preview');
      }

      toast.success('Screen sharing started!');

      // Listen for user stopping share via browser UI
      displayStream.getVideoTracks()[0].onended = () => {
        console.log('[SetupPage] Screen share ended by user via browser UI');
        setScreenTrack(null);
        setScreenPreviewStream(null);
        setStreamMode('camera');
        videoTrack.stop();
        clearVideoContainer();
        acquireMediaStream(facingMode, isVideoEnabled).then(mediaStream => {
          if (mediaStream) {
            setStream(mediaStream);
          }
        });
        toast.info('Screen sharing ended');
      };
    }
  };

  // Helper functions to check category access
  const canAccessTCNN = () => {
    const p: any = profile
    const isNewsCaster = (p as any)?.is_news_caster || (p as any)?.is_chief_news_caster;
    const isAdmin = p?.role === 'admin' || p?.is_admin ||
      p?.role === 'superadmin' || p?.is_superadmin;
    // Check if they have restricted roles
    const isRestrictedRole = p?.is_troll_officer || (p as any)?.is_lead_troll_officer ||
      p?.role === 'troll_officer' || p?.role === 'lead_troll_officer';

    return (isNewsCaster || isAdmin) && !isRestrictedRole;
  };

  const canAccessElections = () => {
    const allowedRoles = ['admin', 'secretary', 'lead_troll_officer', 'troll_officer'];
    return profile?.role && allowedRoles.includes(profile.role);
  };

const handleStartStream = async () => {
    if (isBroadcastLocked && !canBroadcast()) {
      toast.error('Broadcasting is currently disabled by admin. No one can go live while lockdown is active.');
      return;
    }
    if (profile?.drivers_license_status === 'suspended') {
      toast.error('Your driver license is currently suspended. You cannot go live.');
      return;
    }
    if (!title.trim()) {
      toast.error('Please enter a stream title');
      return;
    }
    if (categoryRequiresReligion && !selectedReligion) {
      toast.error('Please select your religion');
      return;
    }
    if (category === 'election') {
      const allowedRoles = ['admin', 'secretary', 'lead_troll_officer', 'troll_officer'];
      if (!profile?.role || !allowedRoles.includes(profile.role)) {
        toast.error('President Elections category is only available to admins and officers');
        return;
      }
    }
    if (isProtected && broadcastPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    if (category === 'tcnn') {
      const isNewsCaster = (profile as any)?.is_news_caster || (profile as any)?.is_chief_news_caster;
      const isAdmin = profile?.role === 'admin' || profile?.is_admin ||
                       profile?.role === 'superadmin' || profile?.is_superadmin;
      const isRestrictedRole = profile?.is_troll_officer || (profile as any)?.is_lead_troll_troll_officer ||
                               profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer';
      if (!isNewsCaster && !isAdmin) {
        toast.error('TCNN category is only available to News Casters, Chief News Casters, and Admins');
        return;
      }
      if (isRestrictedRole && !isAdmin) {
        toast.error('Troll Officers cannot start TCNN broadcasts. Apply for News Caster role.');
        return;
      }
    }
    if (categoryConfig.requiresCamera && !isVideoEnabled) {
      toast.error(`Camera is required for ${categoryConfig.name}`);
      return;
    }
    if (!user) return;
    if (broadcasterLimitInfo && !broadcasterLimitInfo.canStart) {
      toast.error('All broadcasting slots are currently in use. Please try again later.');
      return;
    }
    if (!inlineAgreementChecked) {
      toast.error('You must agree to the Broadcast Agreement before starting.');
      return;
    }
    setInlineAgreementChecked(false);
    await handleConfirmedStreamStart();
  };

  const handleConfirmedStreamStart = async () => {
    if (!user) return;
    const agreementAcceptedAt = new Date().toISOString();

    let audioTrack: LocalAudioTrack | null = null;
    let videoTrack: LocalVideoTrack | null = null;

    try {
      const result = await requestBroadcastMediaAccess();
      if (result.status !== 'success') {
        if (result.status === 'insecure_context') {
          toast.error('Camera and microphone require HTTPS. Open Mai Troll from the secure website link.');
        } else if (result.status === 'unsupported_browser') {
          toast.error('This browser does not support camera/microphone broadcasting. Use Safari on iOS.');
        } else if (result.status === 'camera_denied' || result.status === 'microphone_denied') {
          setPermissionStatus('denied');
          toast.error('Camera or microphone is blocked. On iPhone/iPad, open Safari Website Settings for this site and set Camera and Microphone to Allow, then refresh.');
          setLoading(false);
          return;
        } else if (result.status === 'no_camera_found' || result.status === 'no_microphone_found') {
          toast.error('No camera or microphone was found on this device.');
          setLoading(false);
          return;
        } else if (result.status === 'device_in_use') {
          toast.error('Device in use:\n\nClose any other apps or browser tabs that might be using your camera (FaceTime, Zoom, Teams, etc.), then try again.');
          setLoading(false);
          return;
        } else {
          toast.error('Failed to access camera/microphone. Please check your device and permissions.');
          setLoading(false);
          return;
        }
      }

      // Success - we have a MediaStream. Wrap into LiveKit tracks and preserve in PreflightStore.
      const mediaStream = (result as any).stream;
      // Stop any existing preflight tracks to avoid duplicates
      try { if (livekitTracksRef.current[0]) livekitTracksRef.current[0]?.stop(); } catch(e) {}
      try { if (livekitTracksRef.current[1]) livekitTracksRef.current[1]?.stop(); } catch(e) {}

      try {
        const at = mediaStream.getAudioTracks();
        if (at.length > 0) {
          audioTrack = new LocalAudioTrack(at[0]);
          audioTrack.source = Track.Source.Microphone;
        }
      } catch (e) { console.warn('[SetupPage] Failed to create LocalAudioTrack from preflight stream', e); }
      try {
        const vt = mediaStream.getVideoTracks();
        if (vt.length > 0) {
          videoTrack = new LocalVideoTrack(vt[0]);
          videoTrack.source = Track.Source.Camera;
        }
      } catch (e) { console.warn('[SetupPage] Failed to create LocalVideoTrack from preflight stream', e); }

      setLivekitTracksState([audioTrack, videoTrack]);
      PreflightStore.setLivekitTracks([audioTrack, videoTrack]);
      setCameraTrack(videoTrack);
      setStream(mediaStream);
      if (mediaStream.getVideoTracks().length > 0) {
        attachNativePreview(mediaStream, facingMode);
      }
      if (import.meta.env.DEV) {
        console.info('[SetupPage] iOS media preflight checklist - test on:');
        console.info(' - iPhone Safari browser');
        console.info(' - iPhone PWA installed to home screen');
        console.info(' - iPad Safari');
        console.info(' - Android Chrome');
        console.info(' - Desktop Chrome');
      }
    } catch (err) {
      console.error('[SetupPage] requestBroadcastMediaAccess failed:', err);
      toast.error('Failed to request camera/microphone permissions: ' + (err?.message || String(err)));
      setLoading(false);
      return;
    }

    // All validations passed - now set isStartingStream and proceed
    isStartingStream.current = true;
    console.log('[SetupPage] Starting stream - isStartingStream set to true');

    // Clear session storage flags when starting stream
    sessionStorage.removeItem('tc_setup_initialized');
    sessionStorage.removeItem('tc_tab_switching');
    sessionStorage.removeItem('tc_screen_share_active');
    sessionStorage.removeItem('tc_stream_mode');

    setLoading(true);
    let createdStreamId: string | null = null;
    let failureStage: BroadcastStartStage = 'validation';
    try {
      broadcastStartLog('clicked', {
        userId: user.id,
        category,
        hasLiveKitUrl: !!import.meta.env.VITE_LIVEKIT_URL,
        hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
      });

      // LiveKit room name is the stream ID
      const roomName = streamId;
      if (!roomName) throw new Error('Missing generated room name');
      if (!import.meta.env.VITE_LIVEKIT_URL) throw new Error('VITE_LIVEKIT_URL is missing');
      
      console.log('[SetupPage] Stream config:', {
        roomName
      });

      const layoutMode = categoryConfig.layoutMode === 'debate' ? 'split' :
                       categoryConfig.layoutMode === 'classroom' ? 'grid' :
                       categoryConfig.layoutMode === 'spotlight' ? 'spotlight' : 'grid';

        // Build insert object with optional password protection
          const insertData: Record<string, unknown> = {
            id: streamId,
            user_id: user.id,
            broadcaster_id: user.id,
            streamer_id: user.id,
            owner_id: user.id,
            title,
            category,
            stream_type: isCelebStream ? 'celeb_stream' : 'standard',
            camera_ready: isVideoEnabled,
           status: 'starting',
           is_live: false,
           started_at: null,
            box_count: seatCount === 0 ? 1 : seatCount,
            seat_count: isCelebStream ? 0 : (seatCount === 0 ? 1 : seatCount),
           layout_mode: layoutMode,
           random_battle_queue_enabled: RANDOM_BATTLE_ENABLED && category === 'general' && battleMode === 'world' ? randomBattleQueueEnabled : false,
           random_battle_queued_at: null,
           state_battle_mode: RANDOM_BATTLE_ENABLED && category === 'general' && battleMode === 'state' && randomBattleQueueEnabled ? 'state' : 'none',
           state_battle_state_code: battleMode === 'state' ? userState : null,
livekit_room_name: roomName,
            agora_channel: roomName,
            broadcast_disclaimer_accepted: true,
            broadcast_disclaimer_accepted_at: agreementAcceptedAt,
             broadcast_disclaimer_user_id: user.id,
             ...(category === 'spiritual' && { selected_religion: selectedReligion }),
           ...(category === 'battle' && { 
             battle_format: universeBattleMode === 'multi' ? selectedMultiBattleFormat : '4v4',
             battle_mode: universeBattleMode === 'multi' ? 'universal' : 'troll',
             universe_mode: true,
             battle_status: 'waiting'
           }),
            ...(randomBattleQueueEnabled && RANDOM_BATTLE_ENABLED && category === 'general' ? { battle_mode: battleMode === 'state' ? 'random_queue' : 'random_queue' } : {}),
            ...(battleMode === 'state' && randomBattleQueueEnabled && category === 'general' ? { state_battle_mode: 'state' } : {}),
          };

      // Add password protection if enabled
      if (isProtected && broadcastPassword.length >= 4) {
        insertData.is_protected = true;
        // Hash password using PostgreSQL crypt - the password will be sent as plaintext
        // and hashed server-side (we need to call an RPC to hash it)
        const { data: hashData, error: hashError } = await supabase.rpc('crypt_password', {
          p_password: broadcastPassword
        });
        
        // If RPC fails, the stream creation will fail (which is the expected behavior)
        // Otherwise use the hashed password
        insertData.password_hash = hashError ? null : hashData;
      } else {
        insertData.is_protected = false;
        insertData.password_hash = null;
      }


      const { data, error } = await supabase
        .from('streams')
        .insert(insertData)
        .select()
        .maybeSingle();

        if (error) throw error;
        createdStreamId = data.id;
        failureStage = 'stream row created';
        broadcastStartLog('stream row created', { streamId: data.id, roomName });

        failureStage = 'requesting livekit token';
        broadcastStartLog('requesting livekit token', { streamId: data.id, roomName });
        const tokenData = await requestLiveKitToken(roomName, user.id);
        failureStage = 'token response normalized';
        broadcastStartLog('token response normalized', {
          streamId: data.id,
          roomName: tokenData.roomName,
          participantIdentity: tokenData.participantIdentity,
          hasToken: !!tokenData.token,
        });

        const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
        const room = new Room({
          audioCaptureOptions: { echoCancellation: true, noiseSuppression: true },
          videoCaptureOptions: { facingMode: 'user' },
          dynacast: true,
        } as any);

        failureStage = 'connecting LiveKit room';
        broadcastStartLog('connecting LiveKit room', { streamId: data.id, roomName: tokenData.roomName });
        await room.connect(livekitUrl, tokenData.token);
        failureStage = 'LiveKit connected';
        broadcastStartLog('LiveKit connected', { streamId: data.id, roomName: tokenData.roomName });

        livekitRoomRef.current = room;
        setLivekitRoom(room);
        PreflightStore.setLivekitRoom(room);

         const isScreenShareMode = category === 'gaming' && streamMode === 'screen' && !!screenTrack;
         failureStage = 'publishing LiveKit tracks';
         broadcastStartLog('publishing LiveKit tracks', {
           streamId: data.id,
           roomName: tokenData.roomName,
           isScreenShareMode,
           hasAudio: !!livekitTracksRef.current[0],
           hasCamera: !!livekitTracksRef.current[1],
           hasScreen: !!screenTrack,
          });
         await publishSetupTracksToRoom(room, livekitTracksRef.current, screenTrack, isScreenShareMode);

           // Authoritative start-capacity check. Counts currently active
           // broadcasts under a row lock and atomically transitions this owned
           // stream to live when allowed. Reconnecting to an already-live owned
           // stream returns allowed=true (reason 'already_live') and is NOT
           // blocked. This is the single source of truth for the start cap.
           const startCap = await startBroadcastWithCapacityCheck(data.id)
           if (!startCap.allowed) {
             console.warn('[SetupPage] Broadcast start rejected by capacity check:', startCap.reason, {
               active_broadcasts: startCap.active_broadcasts,
               start_cap: startCap.start_cap,
             })
             toast.error('The platform has reached its current live broadcast capacity. Please try starting your broadcast again shortly.')
             await markBroadcastStartFailed(data.id, 'start capacity reached', startCap.reason)
             setLoading(false)
             return
           }

            // Mark stream as live now that LiveKit is connected and tracks are published
            const { error: updateError } = await supabase
             .from('streams')
              .update({
                status: 'live',
                is_live: true,
                started_at: new Date().toISOString(),
                ...(randomBattleQueueEnabled && RANDOM_BATTLE_ENABLED && category === 'general' ? {
                 random_battle_queued_at: new Date().toISOString(),
                 battle_mode: 'random_queue',
                 ...(battleMode === 'state' ? {
                   state_battle_mode: 'state',
                   state_battle_state_code: userState,
                 } : {}),
               } : {}),
             })
             .eq('id', data.id);

            if (updateError) {
              console.error('[SetupPage] Failed to mark stream as live:', updateError);
              toast.error('Failed to start broadcast: ' + updateError.message);
              await markBroadcastStartFailed(data.id, 'stream live verification', updateError);
              setLoading(false);
              isStartingStream.current = false;
              return;
            }

            // Verify stream is queryable before navigating.
            // Handles DB replication delay where BroadcastPage could otherwise
            // mount and miss the newly-live row on first attempt.
            const verifyStream = async (): Promise<boolean> => {
              for (let attempt = 0; attempt < 5; attempt++) {
                const { data: verifyData } = await supabase
                  .from('streams')
                  .select('id, status')
                  .eq('id', data.id)
                  .maybeSingle();
                if (verifyData?.status === 'live') return true;
                await new Promise((resolve) => setTimeout(resolve, 400));
              }
              return false;
            };

            const streamVerified = await verifyStream();
            if (!streamVerified) {
              console.warn('[SetupPage] Stream not queryable after live update, navigating with fallback');
            }

        // Create smoke event if enabled
        if (smokeEventEnabled) {
          try {
            await supabase.rpc('start_smoke_event', {
              p_stream_id: data.id,
              p_seat_count: seatCount,
            });
            console.log('[SetupPage] Smoke event created for stream:', data.id);
          } catch (smokeErr) {
            console.warn('[SetupPage] Failed to create smoke event:', smokeErr);
            // Don't fail the stream start if smoke event creation fails
          }
        }

        console.log('[SetupPage] Stream marked as live in database');
        broadcastStartLog('stream live verification', { streamId: data.id, status: 'live' });

        // Stream is now created, LiveKit is connected, tracks are published, and DB is updated.
        // Proceed to broadcast room.

       // No delay - navigate immediately after LiveKit connection is established and stream metadata is persisted.

      // Ensure video state reflects actual track state before storing
       const publishedAudioTrack = livekitTracksRef.current[0] ?? audioTrack
       const publishedVideoTrack = livekitTracksRef.current[1] ?? videoTrack
       const hasVideoTrack = publishedVideoTrack !== null
       const videoTrackEnabled = publishedVideoTrack ? true : false
       const actualVideoEnabled = isVideoEnabled && hasVideoTrack

       console.log('[SetupPage] Storing track enabled states:', {
         isVideoEnabled,
         isAudioEnabled,
         hasVideoTrack,
         videoTrackEnabled,
         actualVideoEnabled
       })

       // Store the actual state, not just the toggle state
       PreflightStore.setTrackEnabledStates(actualVideoEnabled, isAudioEnabled)
       // CRITICAL: Keep LiveKit tracks in PreflightStore for BroadcastPage to reuse
       // Do NOT clear them here - they are valid and should be reused
       console.log('[SetupPage] Preserving tracks in PreflightStore:', {
         hasAudio: !!publishedAudioTrack,
         hasVideo: !!publishedVideoTrack
       })
       sessionStorage.setItem('tc_camera_facing_mode', facingMode)
       sessionStorage.setItem('tc_video_enabled', isVideoEnabled ? 'true' : 'false')
       sessionStorage.setItem('tc_audio_enabled', isAudioEnabled ? 'true' : 'false')

       // CRITICAL: Ensure tracks exist before navigating to BroadcastPage
       // If tracks are null, we need to wait for them or create them
       // For gaming screen share mode, we only need audio (screen track is separate)
       PreflightStore.setScreenShareMode(!!isScreenShareMode)
       if (isScreenShareMode && screenTrack) {
         PreflightStore.setScreenTrack(screenTrack)
       }

         // Ensure required preflight tracks exist before streaming.
         const tracksHaveAudio = !!livekitTracksRef.current[0] || !!audioTrack || (PreflightStore.getLivekitTracks?.()?.[0] ?? null)
         const tracksHaveVideo = !!livekitTracksRef.current[1] || !!videoTrack || (PreflightStore.getLivekitTracks?.()?.[1] ?? null)


       if (isScreenShareMode) {
         // Screen share mode - only audio track required, screen track handled separately
         if (!tracksHaveAudio) {
           console.warn('[SetupPage] Audio track missing - attempting to recreate (screen share mode)')
           toast.info('Preparing microphone...')

           if (
             !mountedRef.current ||
             !room ||
             room.state !== 'connected'
           ) {
             return
           }

           // Try to recreate tracks using the existing native capture flow
           const mediaStream = await acquireMediaStream(facingMode, true)
           if (!mediaStream) {
             toast.error('Camera/microphone permission is required to go live. Please allow access and try again.')
             await markBroadcastStartFailed(data.id, 'validation', 'Failed to acquire microphone for screen share mode')
             setLoading(false)
             isStartingStream.current = false
             return
           }

           const [audioAfter, videoAfter] = livekitTracksRef.current
           PreflightStore.setLivekitTracks([audioAfter, videoAfter])

           if (!audioAfter) {
             toast.error('Microphone not ready. Please wait a moment and try again.')
             await markBroadcastStartFailed(data.id, 'validation', 'Audio track still not ready for screen share mode')
             setLoading(false)
             isStartingStream.current = false
             return
           }
         }
       } else {
         // Normal mode - require both audio + video
         if (!tracksHaveAudio || !tracksHaveVideo) {
           console.warn('[SetupPage] Required tracks missing - attempting to recreate (normal mode)', {
             tracksHaveAudio,
             tracksHaveVideo,
           })

           toast.info('Preparing camera and microphone...')

           if (
             !mountedRef.current ||
             !room ||
             room.state !== 'connected'
           ) {
             return
           }

           // Try bounded retries: acquireMediaStream should set PreflightStore.setLivekitTracks synchronously (after async getUserMedia)
           const MAX_RETRIES = 10
           const RETRY_DELAY_MS = 250

           let attempt = 0
           let audioOk = !!livekitTracksRef.current[0]
           let videoOk = !!livekitTracksRef.current[1]

           while (attempt < MAX_RETRIES && (!audioOk || !videoOk)) {
             attempt += 1

             if (
               !mountedRef.current ||
               !room ||
               room.state !== 'connected'
             ) {
               return
             }

             // Recreate tracks (native capture path)
             const mediaStream = await acquireMediaStream(facingMode, true)
             if (!mediaStream) break

             const [a, v] = livekitTracksRef.current
             audioOk = !!a
             videoOk = !!v

             if (!audioOk || !videoOk) {
               await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
             }
           }

           const finalAudioOk = !!livekitTracksRef.current[0]
           const finalVideoOk = !!livekitTracksRef.current[1]

           PreflightStore.setLivekitTracks([livekitTracksRef.current[0], livekitTracksRef.current[1]])

           if (!finalAudioOk || !finalVideoOk) {
             toast.error('Camera/microphone permission is required to go live. Please allow access and try again.')
             await markBroadcastStartFailed(data.id, 'validation', 'Tracks still not ready after retries')
             setLoading(false)
             isStartingStream.current = false
             return
           }
         }
       }


       console.log('[SetupPage] Tracks verified, storing for BroadcastPage:', {
         hasAudio: !!publishedAudioTrack,
         hasVideo: !!publishedVideoTrack
       })

       // LiveKit is already connected in SetupPage and stored in PreflightStore for BroadcastPage.
       console.log('[SetupPage] LiveKit connection ready - BroadcastPage will reuse existing room')

      // Preserve stream while the route transition happens
      sessionStorage.setItem('tc_starting_stream', 'true');
      if (smokeEventEnabled) {
        sessionStorage.setItem('tc_smoke_event_enabled', 'true');
      }
      failureStage = 'redirecting/opening broadcast room';
      broadcastStartLog('redirecting/opening broadcast room', { streamId: data.id, roomName });
      usePreflightStore.getState().setPreflightConnection({
        room,
        audioTrack: publishedAudioTrack ?? null,
        videoTrack: publishedVideoTrack ?? null,
        streamId: data.id,
        roomName,
      })

      // Also store a detailed transfer session in the legacy PreflightStore for
      // BroadcastPage to read the full ownership metadata.
      PreflightStore.setTransferSession({
        room,
        roomName,
        streamId: data.id,
        participantIdentity: tokenData.participantIdentity,
        cameraTrack: publishedVideoTrack,
        microphoneTrack: publishedAudioTrack,
        screenTrack: isScreenShareMode ? screenTrack : null,
        screenAudioTrack: isScreenShareMode ? (livekitTracksRef.current[0] ?? null) : null,
        mode: isScreenShareMode ? 'screen' : 'camera',
        cameraOverlayEnabled,
        transferredAt: Date.now(),
        ownership: 'broadcast-page',
        transitionInProgress: true,
      })

      // Navigate to broadcast page
      navigate(`/broadcast/${data.id}`);

      supabase.from('global_events').insert([
        { title: `${profile.username} just went live!`, icon: 'live', priority: 2 },
      ]).then(() => {}, () => {});
    } catch (err: any) {
      broadcastStartError(failureStage, {
        streamId: createdStreamId,
        message: err?.message || String(err),
        code: err?.code,
      });
      await markBroadcastStartFailed(createdStreamId, failureStage, err);
      toast.error(`Broadcast failed at ${failureStage}: ${err?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
      isStartingStream.current = false;
    }
  };





  
  // Render Religion Selector for Spiritual category
  const renderReligionSelector = () => {
    if (!categoryRequiresReligion) return null;
    
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Select Your Faith *
        </label>
        <select
          value={selectedReligion}
          onChange={(e) => setSelectedReligion(e.target.value)}
          className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-gray-300"
        >
          <option value="">Choose your religion...</option>
          {AVAILABLE_RELIGIONS.map(religion => (
            <option key={religion} value={religion}>{religion}</option>
          ))}
        </select>
        <p className="text-xs text-gray-500">
          You&apos;ll only be matched with broadcasters of the same faith
        </p>
      </div>
    );
  };

  // Render category-specific info
  const renderCategoryInfo = () => {
    switch (category) {
      case 'debate':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Debate</span>
            <p className="text-xs text-white">Split-screen layout with exactly 2 participants</p>
          </div>
        );
      case 'education':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">Education</span>
            <p className="text-xs text-white">Classroom layout — You&apos;re the Teacher, guests are Students</p>
          </div>
        );
      case 'fitness':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">Fitness</span>
            <p className="text-xs text-white">One-way broadcast — You&apos;re the Trainer</p>
          </div>
        );
      case 'irl':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400">IRL</span>
            <p className="text-xs text-white">Rear camera only for first-person streaming</p>
          </div>
        );
      case 'business':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">Business</span>
            <p className="text-xs text-white">Professional broadcast for business discussions</p>
          </div>
        );
      case 'spiritual':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Spiritual</span>
            <p className="text-xs text-white">Faith-based broadcast — select your religion</p>
          </div>
        );
      case 'tcnn':
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">TCNN</span>
            <p className="text-xs text-white">Official news broadcast — News Caster role required</p>
          </div>
        );
      case 'battle':
        return (
          <UniverseModeSetup
            onBattleStart={(mode, format) => {
              setUniverseBattleMode(mode);
              if (format) {
                setSelectedMultiBattleFormat(format);
              }
            }}
            disabled={false}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] text-white p-3 md:p-6 overflow-y-auto">
      <div className="max-w-5xl w-full mx-auto flex flex-col gap-3 py-4">

        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Radio size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Go Live</h1>
            </div>
          </div>
          {broadcasterLimitInfo && !broadcasterLimitInfo.unrestricted && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border",
              broadcasterLimitInfo.canStart ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-red-500/10 border-red-500/20 text-red-400"
            )}>
              {broadcasterLimitInfo.current}/{broadcasterLimitInfo.max} live now
            </div>
          )}
          {broadcasterLimitInfo?.unrestricted && broadcasterLimitInfo?.isStaffBypass && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
              Staff — No Cap
            </div>
          )}
          {broadcasterLimitInfo?.unrestricted && !broadcasterLimitInfo?.isStaffBypass && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
              No Restrictions
            </div>
          )}
        </div>

        {/* Main Grid: Camera + Quick Cards */}
        <div className="flex gap-3 flex-1 min-h-0" style={{ minHeight: '320px' }}>

          {/* Camera Preview Card - Large */}
          <div className="flex-[2.5] relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
            {showPermissionPrompt ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-6 text-center">
                <div className="w-14 h-14 bg-yellow-500/20 rounded-full flex items-center justify-center mb-3">
                  <Video size={28} className="text-yellow-400" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">Camera & Microphone Access Required</h3>
                <p className="text-[10px] text-gray-400 mb-3 max-w-xs">
                  We need permission to access your camera and microphone for streaming.
                </p>
                {(permissionStatus as any) === 'denied' ? (
                  <div className="space-y-2">
                    <p className="text-[10px] text-red-400">
                      Permission denied. Enable access in browser settings.
                    </p>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={requestPermissions}
                    className="px-5 py-2.5 bg-gradient-to-r from-yellow-400 to-amber-600 text-black font-bold text-xs rounded-xl hover:from-yellow-300 hover:to-amber-500 transition-all transform active:scale-95"
                  >
                    Allow Camera & Microphone
                  </button>
                )}
              </div>
            ) : (
              <div
                ref={videoContainerRef}
                className="absolute inset-0 w-full h-full overflow-hidden bg-black"
                style={{ zIndex: 1 }}
              >
                {streamMode !== 'screen' && (
                  <video
                    ref={previewVideoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    muted
                    playsInline
                    autoPlay
                  />
                )}
              </div>
            )}

            {/* Preview badge */}
            <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur px-2.5 py-1 rounded-full text-[9px] text-white font-bold border border-white/10 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" /> PREVIEW
            </div>

            {/* Draggable Camera Overlay for Gaming + Screen Share */}
            {category === 'gaming' && streamMode === 'screen' && cameraOverlayEnabled && (
              <DraggableCameraOverlay
                videoRef={cameraOverlayContainerRef}
                isVideoEnabled={cameraOverlayStream !== null}
                isAudioEnabled={isAudioEnabled}
                onToggleVideo={() => {
                  if (cameraOverlayStream) {
                    cameraOverlayStream.getTracks().forEach(t => t.stop());
                    setCameraOverlayStream(null);
                    if (cameraOverlayContainerRef.current) {
                      cameraOverlayContainerRef.current.innerHTML = '';
                    }
                  } else {
                    setCameraOverlayEnabled(false);
                    setTimeout(() => setCameraOverlayEnabled(true), 50);
                  }
                }}
                onToggleAudio={toggleAudio}
                onFlipCamera={hasMultipleCameras ? () => {
                  const newMode = facingMode === 'user' ? 'environment' : 'user';
                  setFacingMode(newMode);
                } : undefined}
                hasMultipleCameras={hasMultipleCameras}
                onClose={() => {
                  if (cameraOverlayStream) {
                    cameraOverlayStream.getTracks().forEach(t => t.stop());
                    setCameraOverlayStream(null);
                  }
                  if (cameraOverlayContainerRef.current) {
                    cameraOverlayContainerRef.current.innerHTML = '';
                  }
                  setCameraOverlayEnabled(false);
                }}
              />
            )}

            {/* Media controls overlay */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-black/50 backdrop-blur-md px-5 py-2 rounded-full border border-white/10">
              <button
                type="button"
                onClick={toggleVideo}
                className={`p-2.5 rounded-full transition-colors ${isVideoEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600/80'}`}
                title={categoryConfig.requiresCamera && !isVideoEnabled ? 'Camera required' : 'Toggle camera'}
              >
                {isVideoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
              </button>
              <button
                type="button"
                onClick={toggleAudio}
                className={`p-2.5 rounded-full transition-colors ${isAudioEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600/80'}`}
              >
                {isAudioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
              </button>
              {hasMultipleCameras && canUseFrontCamera && (
                <button
                  type="button"
                  onClick={flipCamera}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  title="Flip Camera"
                >
                  <RefreshCw size={18} />
                </button>
              )}
              {category === 'gaming' && screenShare.isSupported && (
                <button
                  type="button"
                  onClick={toggleScreenShare}
                  className={`p-2.5 rounded-full transition-colors ${streamMode === 'screen' ? 'bg-purple-500/80 hover:bg-purple-600/80' : 'bg-white/10 hover:bg-white/20'}`}
                  title={streamMode === 'screen' ? 'Stop Screen Share' : 'Share Screen'}
                >
                  {streamMode === 'screen' ? <Monitor size={18} /> : <Gamepad2 size={18} />}
                </button>
              )}
              {shouldForceRearCamera && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-pink-500/80 px-2.5 py-0.5 rounded-full text-[9px] whitespace-nowrap">
                  Rear Camera Only
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Quick Setting Cards */}
          <div className="flex-1 flex flex-col gap-2.5 min-w-0" style={{ minWidth: '160px' }}>

            {/* Password Protection Card */}
            {canCreateProtected && (
              <div className="flex-1 bg-zinc-900/80 rounded-xl border border-white/10 p-3 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 mb-2">
                  <Lock size={13} className="text-purple-400" />
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Lock</span>
                </div>
                <p className="text-[9px] text-slate-500 mb-2">Password-protect your stream</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsProtected(!isProtected);
                    if (!isProtected) setBroadcastPassword('');
                  }}
                  className={cn(
                    "w-full py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                    isProtected
                      ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
                      : "bg-white/5 border-white/10 text-slate-500 hover:text-white hover:bg-white/10"
                  )}
                >
                  {isProtected ? 'ON' : 'OFF'}
                </button>
              </div>
            )}

            {/* Follower Count Card */}
            <div className="flex-1 bg-zinc-900/80 rounded-xl border border-white/10 p-3 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Followers</span>
              </div>
              <div className="flex items-end gap-1">
                <span className={cn(
                  "text-xl font-black",
                  followerCount >= 1 ? "text-emerald-400" : "text-red-400"
                )}>{followerCount}</span>
                <span className="text-[10px] text-slate-600 mb-1">/ 1 min</span>
              </div>
              <div className="w-full bg-gray-700/50 rounded-full h-1.5 mt-1">
                <div
                  className={cn("h-1.5 rounded-full transition-all", followerCount >= 1 ? "bg-emerald-500" : "bg-red-500")}
                  style={{ width: `${Math.min(followerCount * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Admin-Only: Seat Count Selector (hidden for Celeb Streams) */}
            {isStreamAdmin && !isCelebStream && (() => {
              const effectiveMaxSeats = seatCap.enabled ? Math.min(MAX_ADMIN_SEAT_COUNT, seatCap.max) : MAX_ADMIN_SEAT_COUNT;
              return (
                <div className="flex-1 bg-zinc-900/80 rounded-xl border border-amber-500/20 p-3 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Seats</span>
                    {seatCap.enabled && (
                      <span className="text-[8px] font-bold text-amber-400/60 bg-amber-500/10 px-1.5 py-0.5 rounded-full">CAP {effectiveMaxSeats}</span>
                    )}
                    <span className="text-[8px] font-bold text-amber-400/60 bg-amber-500/10 px-1.5 py-0.5 rounded-full">ADMIN</span>
                  </div>
                  <p className="text-[9px] text-slate-500 mb-2">Total boxes (broadcaster = box 1)</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSeatCount(Math.max(MIN_ADMIN_SEAT_COUNT, seatCount - 1))}
                      disabled={seatCount <= MIN_ADMIN_SEAT_COUNT}
                      className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white font-bold text-sm flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      -
                    </button>
                    <div className="flex-1 text-center">
                      <span className="text-2xl font-black text-amber-400">{Math.min(seatCount, effectiveMaxSeats)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSeatCount(Math.min(effectiveMaxSeats, seatCount + 1))}
                      disabled={seatCount >= effectiveMaxSeats}
                      className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white font-bold text-sm flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <select
                    value={Math.min(seatCount, effectiveMaxSeats)}
                    onChange={(e) => setSeatCount(Number(e.target.value))}
                    className="mt-2 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm font-bold text-amber-300 focus:outline-none focus:border-amber-500/50 appearance-none cursor-pointer"
                  >
                    {Array.from({ length: effectiveMaxSeats }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n} className="bg-zinc-900 text-white">
                        {n} {n === 1 ? 'seat' : 'seats'}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })()}

            

            {/* State Selection Dropdown Modal */}
            {showStateDropdown && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="bg-zinc-900 border border-fuchsia-500/30 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      🏛️ Select Your State
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowStateDropdown(false)}
                      className="text-slate-400 hover:text-white transition-colors text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-3">
                    Choose the state you represent. This determines which state earns points when you win battles.
                  </p>
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-white/10 bg-black/30">
                    {US_STATES.map((s) => (
                      <button
                        key={s.code}
                        type="button"
                        disabled={isAssigningState}
                        onClick={async () => {
                          if (!user?.id) return;
                          setIsAssigningState(true);
                          try {
                            await assignUserToState(user.id, s.code);
                            setUserState(s.code);
                            setShowStateDropdown(false);
                            toast.success(`You now represent ${s.name}!`);
                          } catch (err) {
                            toast.error('Failed to assign state');
                          } finally {
                            setIsAssigningState(false);
                          }
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-[11px] transition-colors border-b border-white/5 last:border-b-0",
                          userState === s.code
                            ? "bg-fuchsia-500/20 text-fuchsia-200 font-bold"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Category Info Card */}
            {category !== 'general' && (
              <div className={cn(
                "flex-1 rounded-xl border p-3",
                category === 'gaming' ? "bg-amber-500/10 border-amber-500/25" :
                category === 'debate' ? "bg-blue-500/10 border-blue-500/25" :
                category === 'education' ? "bg-green-500/10 border-green-500/25" :
                category === 'fitness' ? "bg-orange-500/10 border-orange-500/25" :
                category === 'irl' ? "bg-pink-500/10 border-pink-500/25" :
                category === 'spiritual' ? "bg-purple-500/10 border-purple-500/25" :
                category === 'tcnn' ? "bg-red-500/10 border-red-500/25" :
                category === 'battle' ? "bg-red-500/10 border-red-500/25" :
                "bg-white/5 border-white/15"
              )}>
                {renderCategoryInfo()}
              </div>
            )}
          </div>
        </div>

        {/* Password Input (when protected) */}
        {isProtected && canCreateProtected && (
          <div className="bg-zinc-900/80 rounded-xl border border-purple-500/20 p-3">
            <label className="block text-[10px] font-medium text-purple-300 mb-1.5">Enter Password (min 4 characters)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={broadcastPassword}
                onChange={(e) => setBroadcastPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {broadcastPassword.length > 0 && broadcastPassword.length < 4 && (
              <p className="text-[10px] text-red-400 mt-1">Password must be at least 4 characters</p>
            )}
          </div>
        )}

        {/* Religion Selector */}
        {renderReligionSelector()}

        {/* Permission Warning */}
        {showPermissionPrompt && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
            <p className="text-amber-300 text-xs">
              Camera and microphone permissions are required to start streaming.
            </p>
          </div>
        )}

        {/* Broadcast Agreement */}
        <div className="bg-zinc-900/80 rounded-2xl border border-amber-500/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={16} className="text-amber-400" />
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Broadcast Agreement</span>
          </div>
          <div className="max-h-40 overflow-y-auto rounded-xl bg-zinc-800/60 border border-zinc-700 p-3 mb-3 text-xs text-zinc-300 leading-relaxed space-y-2">
            <p>
              By starting a broadcast, I confirm that I am at least 18 years old and will comply with all applicable laws in my jurisdiction. I understand that I am solely responsible for the content I create, stream, share, or display on Mai Troll.
            </p>
            <p>
              I agree not to broadcast illegal activity, sell or promote controlled substances, threaten or harm others, share non-consensual content, or violate Mai Troll's Terms of Service or Community Guidelines.
            </p>
            <p>
              I further acknowledge that I am of legal age in my jurisdiction to consume any products, substances, beverages, or other items that may be displayed or consumed during my broadcast, and that any such activity is conducted at my own responsibility and in compliance with local laws.
            </p>
            <p>
              Mai Troll reserves the right to remove content, suspend broadcasts, restrict features, or terminate accounts that violate these rules.
            </p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={inlineAgreementChecked}
                onChange={(e) => setInlineAgreementChecked(e.target.checked)}
                className="sr-only peer"
              />
              <div className={cn(
                'w-5 h-5 rounded border-2 transition-all',
                inlineAgreementChecked
                  ? 'bg-amber-500 border-amber-500'
                  : 'bg-zinc-800 border-zinc-600 group-hover:border-zinc-500'
              )}>
                {inlineAgreementChecked && (
                  <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-xs text-zinc-300 leading-snug">
              I am 18 years of age or older and agree to the Broadcast Agreement, Terms of Service, and Community Guidelines.
            </span>
          </label>
        </div>

        {/* Bottom Row: Title + Category + Go Live */}
        <div className="bg-zinc-900/80 rounded-2xl border border-white/10 p-4 flex flex-col md:flex-row items-stretch md:items-end gap-3">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-400 mb-1">Stream Title</label>
              <input
                type="text"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter stream title"
                className="w-full bg-zinc-900/80 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-400 mb-1">Category</label>
               <select
                 name="category"
                 value={category}
                 onChange={(e) => {
                   const selectedCategory = e.target.value as BroadcastCategoryId;
                   if (selectedCategory === 'battle') {
                     toast.error('Universal Battle is currently under construction');
                     return;
                   }
                   setCategory(selectedCategory);
                 }}
                 className="w-full bg-zinc-900/80 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
>
                  {Object.values(BROADCAST_CATEGORIES)
                    .filter((cat) => {
                      // Gaming has its own dedicated setup page
                      if (cat.id === 'gaming') return false;
                      // Hide TCNN and President Elections from regular users
                      if (cat.id === 'tcnn' || cat.id === 'election') {
                        return isUserAdmin || profile?.role === 'secretary' ||
                               (profile as any)?.is_lead_troll_officer || profile?.is_troll_officer ||
                               (profile as any)?.is_news_caster || (profile as any)?.is_chief_news_caster;
                      }
                      return true;
                    })
                    .map((cat) => (
                      <option key={cat.id} value={cat.id} disabled={cat.id === 'battle'} className={cat.id === 'battle' ? 'text-gray-500' : ''}>
                        {cat.icon} {cat.name}{cat.id === 'battle' ? ' (Under Construction)' : ''}
</option>
                    ))}
                </select>
             </div>
          </div>

             {/* Smoke Event Toggle (admin only) */}
             {isStreamAdmin && (
               <div className="shrink-0">
                 <button
                   type="button"
                   onClick={() => setSmokeEventEnabled(!smokeEventEnabled)}
                   className={cn(
                     "w-full md:w-auto px-4 py-2.5 rounded-xl text-xs font-bold transition-all border",
                     smokeEventEnabled
                       ? "bg-purple-600/20 border-purple-500/50 text-purple-300"
                       : "bg-white/5 border-white/10 text-slate-500 hover:text-white hover:bg-white/10"
                   )}
                 >
                   <span className="flex items-center gap-2">
                     <Flame size={14} />
                     Smoke Event {smokeEventEnabled ? 'ON' : 'OFF'}
                   </span>
                 </button>
               </div>
             )}

              {/* Celeb Stream Toggle (approved celebs only) */}
              {isApprovedCeleb && (
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsCelebStream(!isCelebStream)}
                    className={cn(
                      "w-full md:w-auto px-4 py-2.5 rounded-xl text-xs font-bold transition-all border",
                      isCelebStream
                        ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-black border-yellow-400/50 shadow-[0_4px_12px_rgba(251,191,36,0.3)]"
                        : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Crown size={14} />
                      Celeb Stream {isCelebStream ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>
              )}

              {/* Start Broadcast Button */}
             <div className="shrink-0">
               <button
                 type="button"
                 onClick={handleStartStream}
                 disabled={
                   loading ||
                   !title.trim() ||
                   (categoryRequiresReligion && !selectedReligion) ||
                   (shouldForceRearCamera && !hasRearCamera) ||
                   showPermissionPrompt ||
                   (broadcasterLimitInfo && !broadcasterLimitInfo.canStart) ||
                   (isBroadcastLocked && !canBroadcast())
                 }
                 className="w-full md:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold text-sm hover:from-amber-300 hover:to-orange-400 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 whitespace-nowrap"
               >
                 {loading ? (
                   <span className="flex items-center gap-2">
                     <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></span>
                     Starting...
                   </span>
                 ) : showPermissionPrompt ? (
                   'Grant Permissions'
                 ) : (isBroadcastLocked && !canBroadcast()) ? (
                   'Broadcast Locked'
                  ) : (broadcasterLimitInfo && !broadcasterLimitInfo.canStart) ? (
                    'Slots Full'
                  ) : (
                   <>
                     <Radio size={16} />
                     Start Broadcast
                   </>
                 )}
               </button>
             </div>
         </div>

        {shouldForceRearCamera && !hasRearCamera && (
          <p className="text-red-400 text-xs text-center">A rear camera is required for this category but none was detected.</p>
        )}
      </div>
    </div>
  );
}

