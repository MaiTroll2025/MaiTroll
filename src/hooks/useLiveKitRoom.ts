import { useState, useRef, useCallback, useEffect } from 'react';
import { Room, RoomEvent, VideoPresets, createLocalAudioTrack, createLocalVideoTrack } from 'livekit-client';
import type { LocalVideoTrack, LocalAudioTrack, RemoteParticipant, RemoteVideoTrack, RemoteAudioTrack } from 'livekit-client';
import { supabase } from '../lib/supabase';
import { getLiveKitRoomName } from '../lib/liveUtils';
import { toast } from 'sonner';
import { LIVEKIT_BETA_LIMITS, CAMERA_CAPTURE_OPTIONS, CAMERA_PUBLISH_OPTIONS } from '@/config/livekitBetaLimits';

/**
 * Unified hook for LiveKit rooms
 * 
 * @param config - Configuration object
 * @param config.roomId - Room/stream ID
 * @param config.roomType - Type of room: 'broadcast' | 'pod' | 'church' | 'talent' | 'utromail' | 'jail' | 'court' | 'election' | 'team_meeting'
 * @param config.role - 'publisher' | 'viewer'
 * @param config.audioOnly - Whether room is audio-only (pods)
 * @param config.publish - Whether user should publish (host/speaker/guest)
 * @param config.isAdmin - Whether user is admin (1080p) vs regular (720p)
 * @param config.onUserJoined - Callback when user joins
 * @param config.onUserLeft - Callback when user leaves
 * @param config.onError - Error callback
 */
export function useLiveKitRoom({
  roomId,
  roomType = 'broadcast',
  role = 'viewer',
  audioOnly = false,
  publish = false,
  isAdmin = false,
  userName,
  identity = '',
  initialAudioEnabled = true,
  onUserJoined,
  onUserLeft,
  onError
}) {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<RemoteParticipant[]>([]);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [lastJoinDebug, setLastJoinDebug] = useState<any>(null);

  // Helper to safely stringify values for logging without passing raw objects
  const safeStringify = (v: any) => {
    try {
      if (typeof v === 'string') return v
      return JSON.stringify(v)
    } catch {
      try { return String(v) } catch { return '[Unserializable]' }
    }
  }

   // Refs
    const roomRef = useRef<Room | null>(null);
    const joinedRef = useRef(false);
    const localUserIdRef = useRef<string | null>(null);
    const joiningRef = useRef(false); // Track joining state to prevent race conditions
    const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);
    const localVideoTrackRef = useRef<LocalVideoTrack | null>(null);
    const cameraToggleQueueRef = useRef<Promise<unknown>>(Promise.resolve());
    const microphoneToggleQueueRef = useRef<Promise<unknown>>(Promise.resolve());
    const prewarmedAudioTrackRef = useRef<LocalAudioTrack | null>(null);
    const prewarmedVideoTrackRef = useRef<LocalVideoTrack | null>(null);
    const prewarmCleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Track last failed join to prevent infinite retry loops
    const lastFailedJoinRef = useRef<{ roomId: string; userId: string; error: string; timestamp: number } | null>(null);
    // Track seat upgrade in progress to prevent clearing participants during the transition
    const isSeatUpgradingRef = useRef(false);

// Module-level: tracks failed joins across component remounts (e.g. ErrorBoundary recovery).
// Key = `${roomId}:${userId}`, Value = { error, timestamp }
const failedJoinCache = new Map<string, { error: string; timestamp: number }>();

  // Get LiveKit credentials from environment
  const getLiveKitUrl = () => import.meta.env.VITE_LIVEKIT_URL;
  const getLiveKitApiKey = () => import.meta.env.VITE_LIVEKIT_API_KEY;
  
  // Check if LiveKit is configured
  const isLiveKitConfigured = !!getLiveKitUrl() && !!getLiveKitApiKey();

  // Fetch LiveKit token via edge function with retry and timeout
  // mode: 'broadcaster' | 'audience' | 'seat-publisher' | 'battle-watch'
  const fetchToken = useCallback(async (roomName: string, userId: string, userName?: string, isPublisherOverride?: boolean, metadataOverride?: string, mode?: string) => {
    const MAX_RETRIES = 2
    const RETRY_DELAYS = [1000, 2000]
    const REQUEST_TIMEOUT = 15000

    const getEdgeFunctionsUrl = () => {
      const explicit = import.meta.env.VITE_EDGE_FUNCTIONS_URL
      if (explicit && explicit.trim()) return explicit.trim()
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      return supabaseUrl ? `${supabaseUrl}/functions/v1` : ''
    }

    const fetchWithTimeout = async (url: string, options: RequestInit & { timeout?: number } = {}) => {
      const { timeout = REQUEST_TIMEOUT, ...fetchOptions } = options
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        })
        return response
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw new Error(`LiveKit token request timed out after ${timeout}ms`)
        }
        throw err
      } finally {
        clearTimeout(timeoutId)
      }
    }

    const attemptFetch = async (attempt: number): Promise<string> => {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt - 1] || 1000))
      }

      // Determine publish permission from explicit mode or override parameter.
      // Broadcaster and seat-publisher get canPublish: true.
      // Audience, battle-watch, and default get canPublish: false.
      const canPublish = mode === 'broadcaster' || mode === 'seat-publisher' || (mode === undefined && (isPublisherOverride === true || publish === true));
      const requestBody: Record<string, any> = {
        room: roomName,
        roomName,
        identity: identity || userId,
        name: userName || 'User',
        role: canPublish ? 'publisher' : 'audience',
        isHost: canPublish && roomType === 'pod' ? true: undefined,
        canPublish,
        canSubscribe: true,
        mode: mode || (canPublish ? 'publisher' : 'audience'),
      };
      if (metadataOverride) {
        requestBody.metadata = metadataOverride;
      }

      const requestDetails = {
        roomName,
        userId,
        role: canPublish ? 'publisher' : 'audience',
        canPublish,
        canSubscribe: true,
        mode: mode || (canPublish ? 'publisher' : 'audience'),
        isHost: canPublish && roomType === 'pod',
        attempt,
      };

      try {
        const { data, error: tokenError } = await supabase.functions.invoke('livekit-token', {
          body: requestBody,
        });

        if (tokenError) {
          const statusCode = tokenError?.status || tokenError?.statusCode || tokenError?.status_code || null;
          const bodyText = tokenError?.body || tokenError?.message || JSON.stringify(tokenError);
          console.error(`[useLiveKitRoom] Error fetching token via Supabase functions.invoke (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${statusCode} ${safeStringify(bodyText)} ${safeStringify(requestDetails)}`);
          throw new Error(`LiveKit audience token failed: ${statusCode ? statusCode + ' ' : ''}${String(bodyText)}`);
        }

        if (!data?.token) {
          console.error(`[useLiveKitRoom] No token in response from edge function (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${safeStringify(data)} ${safeStringify(requestDetails)}`);
          throw new Error(`LiveKit token response missing token: ${JSON.stringify(data)}`);
        }

        return data.token
      } catch (err: any) {
        console.warn(`[useLiveKitRoom] Token fetch attempt ${attempt + 1} failed:`, err?.message || String(err), requestDetails)

        if (attempt < MAX_RETRIES) {
          return attemptFetch(attempt + 1)
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error(`LiveKit token fetch failed and Supabase env is not configured: ${err?.message || String(err)}`);
        }

        const edgeFunctionsUrl = getEdgeFunctionsUrl()
        const tokenUrl = edgeFunctionsUrl
          ? `${edgeFunctionsUrl}/livekit-token`
          : `${supabaseUrl}/functions/v1/livekit-token`

        const { data: sessionData } = await supabase.auth.getSession();
        const authToken = sessionData?.session?.access_token || supabaseAnonKey;
        const response = await fetchWithTimeout(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(requestBody),
          timeout: REQUEST_TIMEOUT,
        });

        const responseText = await response.text();
        let parsed;
        try {
          parsed = JSON.parse(responseText);
        } catch (parseErr) {
          console.error(`[useLiveKitRoom] Failed parsing fallback token response (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${safeStringify(parseErr)} ${safeStringify(responseText)}`);
          throw new Error(`LiveKit token fallback response parse failed: ${parseErr?.message || String(parseErr)}`);
        }

        if (!response.ok) {
          console.error(`[useLiveKitRoom] Fallback token request failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${response.status} ${safeStringify(parsed)}`);
          throw new Error(`LiveKit token fallback request failed (${response.status}): ${parsed?.error || JSON.stringify(parsed)}`);
        }

        if (!parsed?.token) {
          console.error(`[useLiveKitRoom] Fallback token response missing token (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${safeStringify(parsed)}`);
          throw new Error(`LiveKit token fallback response missing token: ${JSON.stringify(parsed)}`);
        }

        console.log('[useLiveKitRoom] Got token via fallback fetch, room:', roomName, 'attempt:', attempt + 1);
        return parsed.token
      }
    }

    try {
      return await attemptFetch(0)
    } catch (err: any) {
      const rootMessage = err?.message || String(err) || 'Unknown token fetch error'
      console.error(`[useLiveKitRoom] Token fetch failed after all retries for room ${roomName}: ${rootMessage}`)
      throw new Error(`LiveKit token fetch failed: ${rootMessage}`)
    }
  }, [publish, roomType, identity]);

  // Resolve video preset — beta cap is always 720p regardless of admin status
  const videoPreset = VideoPresets.h720;

// Create local tracks based on room type
  const createLocalTracks = useCallback(async () => {
    try {
// Audio track - always create for publishers
       const audioTrack = await createLocalAudioTrack();
         setLocalAudioTrack(audioTrack);
         localAudioTrackRef.current = audioTrack;

       let videoTrack: LocalVideoTrack | null = null

// Video track - only create if not audio-only room
        if (!audioOnly && roomType !== 'pod') {
          try {
            const { createLocalVideoTrack } = await import('livekit-client');
            const track = await createLocalVideoTrack({
              ...videoPreset,
              facingMode: 'user'
            });

            // Validate actual outgoing track settings against beta caps
            const mediaStreamTrack = track.mediaStreamTrack;
            if (mediaStreamTrack) {
              const settings = mediaStreamTrack.getSettings();
              const exceedsWidth = settings.width && settings.width > LIVEKIT_BETA_LIMITS.camera.maxWidth;
              const exceedsHeight = settings.height && settings.height > LIVEKIT_BETA_LIMITS.camera.maxHeight;
              const exceedsFps = settings.frameRate && settings.frameRate > LIVEKIT_BETA_LIMITS.camera.maxFrameRate;

              if (exceedsWidth || exceedsHeight || exceedsFps) {
                console.warn('[useLiveKitRoom] Camera track exceeds beta caps, reapplying constraints:', settings);
                try {
                  track.stop();
                } catch { /* ignore cleanup errors */ }

                const constrainedTrack = await createLocalVideoTrack({
                  ...videoPreset,
                  facingMode: 'user',
                  resolution: {
                    width: LIVEKIT_BETA_LIMITS.camera.maxWidth,
                    height: LIVEKIT_BETA_LIMITS.camera.maxHeight,
                  },
                  frameRate: LIVEKIT_BETA_LIMITS.camera.maxFrameRate,
                });

                const recheck = constrainedTrack.mediaStreamTrack;
                if (recheck) {
                  const recheckSettings = recheck.getSettings();
                  const stillExceeds =
                    (recheckSettings.width && recheckSettings.width > LIVEKIT_BETA_LIMITS.camera.maxWidth) ||
                    (recheckSettings.height && recheckSettings.height > LIVEKIT_BETA_LIMITS.camera.maxHeight) ||
                    (recheckSettings.frameRate && recheckSettings.frameRate > LIVEKIT_BETA_LIMITS.camera.maxFrameRate);

                  if (stillExceeds) {
                    try { constrainedTrack.stop(); } catch { /* ignore */ }
                    setError('Camera device exceeds maximum allowed resolution (1280x720@30fps). Please use a compliant camera.');
                    toast.error('Camera configuration error: device exceeds beta quality limits');
                    return { audioTrack, videoTrack: null };
                  }
                }

                videoTrack = constrainedTrack;
              } else {
                videoTrack = track;
              }
            } else {
              videoTrack = track;
            }

            setLocalVideoTrack(videoTrack);
           localVideoTrackRef.current = videoTrack;
         } catch (videoErr) {
           console.warn('[useLiveKitRoom] Could not create video track:', videoErr);
         }
       }

       return { audioTrack, videoTrack };
     } catch (err) {
       console.error(`[useLiveKitRoom] Error creating local tracks: ${safeStringify(err)}`);
       throw err;
     }
   }, [audioOnly, roomType]);

  const getPublicationCount = (participant: any) => {
    const publications =
      participant?.trackPublications ||
      participant?.tracks ||
      participant?.trackPublicationMap ||
      null;

    if (!publications) return 0;
    if (typeof publications.size === 'number') return publications.size;
    if (Array.isArray(publications)) return publications.length;
    if (typeof publications === 'object') return Object.keys(publications).length;
    return 0;
  };

  const getParticipantIdentity = (participant: any) => {
    return (
      participant?.identity ||
      participant?.sid ||
      participant?.name ||
      'unknown-participant'
    );
  };

  const participantMatches = (item: any, participant: any) => {
    if (!item || !participant) return false;
    const sid = participant?.sid;
    const identity = participant?.identity;
    if (sid && item?.sid === sid) return true;
    if (identity && item?.identity === identity) return true;
    return false;
  };

  const replaceOrAppendParticipant = (prev: RemoteParticipant[], participant: RemoteParticipant) => {
    const sid = participant?.sid || null;
    const identity = participant?.identity || null;
    const exists = prev.some((item: any) => participantMatches(item, participant));
    if (!exists) {
      return [...prev, participant];
    }
    return prev.map((item: any) => participantMatches(item, participant) ? participant : item);
  };

  // Normalize various error shapes into a predictable object for logging
  const normalizeLiveKitError = (err: unknown) => {
    try {
      if (err instanceof Error) {
        return {
          name: err.name,
          message: err.message,
          stack: err.stack,
          cause: (err as any).cause,
        };
      }

      if (typeof err === 'object' && err !== null) {
        const e: any = err as any;
        // Avoid attaching the full raw object (may contain circular LiveKit refs).
        // Provide a shallow summary instead to aid debugging without causing serialization recursion.
        let rawSummary: any = null;
        try {
          rawSummary = {
            keys: Object.keys(e).slice(0, 20),
            message: e.message || e.error || undefined,
            status: e.status || undefined,
            code: e.code || undefined,
          };
        } catch {
          rawSummary = String(e);
        }

        return {
          message: e.message || e.error_description || e.error || 'Unknown object error',
          status: e.status,
          code: e.code,
          details: e.details,
          hint: e.hint,
          rawSummary,
        };
      }

      return { message: String(err) };
    } catch (e) {
      return { message: String(err) };
    }
  };

  // Safe serializer to ensure errors are logged as plain objects
  const serializeError = (err: unknown) => {
    // Depth-limited, circular-safe serializer to avoid RangeError: Maximum call stack size exceeded
    if (err instanceof Error) {
      return {
        name: err.name,
        message: err.message,
        stack: err.stack,
        cause: (err as any).cause,
      };
    }

    const maxDepth = 4;
    const seen = new WeakSet();
    const cloneSafe = (value: any, depth = 0): any => {
      if (value === null) return null;
      if (typeof value !== 'object') return value;
      if (seen.has(value)) return '[Circular]';
      if (depth >= maxDepth) return '[Truncated]';
      seen.add(value);
      if (Array.isArray(value)) return value.map(v => cloneSafe(v, depth + 1));
      const out: any = {};
      for (const k of Object.keys(value)) {
        try {
          out[k] = cloneSafe(value[k], depth + 1);
        } catch {
          out[k] = '[Unserializable]';
        }
      }
      return out;
    };

    if (typeof err === 'object' && err !== null) {
      try {
        return cloneSafe(err, 0);
      } catch {
        return { message: String(err) };
      }
    }

    return { message: String(err) };
  };

  // Handle participant joined
  const handleParticipantJoined = useCallback((participant: RemoteParticipant) => {
    const identity = getParticipantIdentity(participant);

    console.log('[useLiveKitRoom] Participant connected:', {
      identity,
      sid: participant?.sid,
      publicationCount: getPublicationCount(participant),
    });

    setRemoteUsers(prev => replaceOrAppendParticipant(prev, participant));

    onUserJoined?.(participant);
  }, [onUserJoined]);

  // Handle participant left
  const handleParticipantLeft = useCallback((participant: RemoteParticipant) => {
    const identity = participant?.identity || null;
    const sid = participant?.sid || null;

    console.log('[useLiveKitRoom] Participant disconnected:', {
      identity,
      sid,
      publicationCount: getPublicationCount(participant),
    });

    setRemoteUsers(prev =>
      prev.filter((item: any) => {
        const matchBySid = sid && item?.sid === sid;
        const matchByIdentity = identity && item?.identity === identity;
        return !(matchBySid || matchByIdentity);
      })
    );

    onUserLeft?.(participant);
  }, [onUserLeft]);

  // Handle track subscribed — with race-condition guard.
  // LiveKit can fire trackSubscribed after participantDisconnected, reconnect,
  // remount, or stale PWA state. We verify the participant exists in both our
  // local state AND the actual LiveKit room before attaching the track.
  const handleTrackSubscribed = useCallback(
    (track: RemoteVideoTrack | RemoteAudioTrack, publication, participant: RemoteParticipant) => {
      const participantSid = participant?.sid || null;
      const participantIdentity = participant?.identity || null;
      const trackSid = track?.sid || publication?.trackSid || publication?.sid || null;
      const kind = track?.kind || publication?.kind || null;

      if (!participantSid && !participantIdentity) {
        console.warn('[useLiveKitRoom] Ignoring late track for missing participant', {
          participantSid,
          participantIdentity,
          trackSid,
          kind,
        });
        return;
      }

      const trackInfo = {
        participantIdentity,
        participantSid,
        trackSid,
        kind,
        source: publication?.source || null,
      };

      // Check local state first
      setRemoteUsers(prev => {
        const exists = prev.some((item: any) => participantMatches(item, participant));
        if (!exists) {
          // Participant not in local state — check the actual LiveKit room.
          // This handles the race where trackSubscribed fires before
          // participantConnected or after a reconnect.
          const room = roomRef.current;
          if (room?.remoteParticipants) {
            const roomParticipant = participantIdentity
              ? room.remoteParticipants.get(participantIdentity)
              : null;
            const roomBySid = !roomParticipant && participantSid
              ? Array.from(room.remoteParticipants.values()).find(
                  (p: any) => p?.sid === participantSid,
                )
              : null;
            const resolvedParticipant = roomParticipant || roomBySid;
            if (resolvedParticipant) {
              // Participant exists in room but not yet in local state — add it.
              // Use the room's participant object for consistency.
              if (import.meta.env.DEV) {
                console.warn('[useLiveKitRoom] Recovered missing participant from room', trackInfo);
              }
              return [...prev, resolvedParticipant as RemoteParticipant];
            }
          }

          // Genuinely missing — log and skip (no throw, no error).
          console.warn('[useLiveKitRoom] Ignoring late track for missing participant', trackInfo);
          return prev;
        }

        return prev.map((item: any) => participantMatches(item, participant) ? participant : item);
      });

      // Double-update to ensure React re-renders when LiveKit mutates the
      // same participant object reference (important for mobile/PWA).
      window.requestAnimationFrame(() => {
        setRemoteUsers(prev => {
          const exists = prev.some((item: any) => participantMatches(item, participant));
          if (!exists) {
            return prev;
          }
          return prev.map((item: any) => participantMatches(item, participant) ? participant : item);
        });
      });
    },
    []
  );

  // Handle track unsubscribed — idempotent, safe for missing participants.
  // Mirrors handleTrackSubscribed guards: verifies participant exists in local
  // state AND the actual LiveKit room before updating. Handles late/missed
  // unsub events from reconnects, stale PWA state, and race conditions.
  const handleTrackUnsubscribed = useCallback(
    (_track: RemoteVideoTrack | RemoteAudioTrack, publication, participant: RemoteParticipant) => {
      const identity = participant?.identity || null;
      const sid = participant?.sid || null;
      const trackSid = publication?.trackSid || publication?.sid || null;
      const kind = publication?.kind || null;

      if (!identity && !sid) {
        // Nothing to match on — skip silently
        return;
      }

      const logInfo = {
        participantIdentity: identity,
        participantSid: sid,
        trackSid,
        kind,
        source: publication?.source || null,
      };

      // Check local state first — if participant exists, update in place.
      setRemoteUsers(prev => {
        const exists = prev.some((item: any) => participantMatches(item, participant));
        if (exists) {
          console.log('[useLiveKitRoom] Track unsubscribed:', logInfo);
          return prev.map((item: any) => participantMatches(item, participant) ? participant : item);
        }

        // Participant not in local state — check the actual LiveKit room.
        // This handles the race where trackUnsubscribed fires after a reconnect
        // or when the participant was already removed from local state.
        const room = roomRef.current;
        if (room?.remoteParticipants) {
          const roomParticipant = identity
            ? room.remoteParticipants.get(identity)
            : null;
          const roomBySid = !roomParticipant && sid
            ? Array.from(room.remoteParticipants.values()).find(
                (p: any) => p?.sid === sid,
              )
            : null;
          const resolvedParticipant = roomParticipant || roomBySid;
          if (resolvedParticipant) {
            // Participant exists in room — update with the latest reference
            // so track detachment is reflected in the UI.
            if (import.meta.env.DEV) {
              console.log('[useLiveKitRoom] Track unsubscribed: recovered participant from room', logInfo);
            }
            return prev.map((item: any) =>
              participantMatches(item, resolvedParticipant) ? resolvedParticipant : item
            );
          }
        }

        // Genuinely missing from both local state and room — the unsub event
        // arrived after the participant was already removed. Safe to ignore.
        if (import.meta.env.DEV) {
          console.log('[useLiveKitRoom] Track unsubscribed: participant already removed, skipping', logInfo);
        }
        return prev;
      });

      // Double-update via rAF to ensure React re-renders when LiveKit mutates
      // the same participant object reference (important for mobile/PWA).
      window.requestAnimationFrame(() => {
        setRemoteUsers(prev => {
          const exists = prev.some((item: any) => participantMatches(item, participant));
          if (!exists) {
            return prev;
          }
          return prev.map((item: any) => participantMatches(item, participant) ? participant : item);
        });
      });
    },
    []
  );

  // Join LiveKit as publisher
  const joinAsPublisher = useCallback(async (userId: string, tokenOverride?: string | null) => {
    // Guard: prevent multiple simultaneous connection attempts
    if (joinedRef.current) {
      console.warn('[useLiveKitRoom] Join prevented: already joined');
      return roomRef.current;
    }

    if (joiningRef.current) {
      console.warn('[useLiveKitRoom] Join prevented: already joining');
      let attempts = 0;
      while (joiningRef.current && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      return roomRef.current;
    }

    if (!roomId || !userId) {
      console.warn('[useLiveKitRoom] Join prevented: missing params');
      return;
    }

    joiningRef.current = true;
    setIsJoining(true);
    setError(null);
    localUserIdRef.current = userId;

    const isMobileDevice = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    let room: Room | null = null;
    let audioTrack: LocalAudioTrack | null = null;
    let videoTrack: LocalVideoTrack | null = null;

    try {
      room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          ...videoPreset,
          facingMode: 'user',
          frameRate: isMobileDevice ? { ideal: 24, max: 30 } : undefined
        },
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      roomRef.current = room;

room.on(RoomEvent.ParticipantConnected, handleParticipantJoined);
       room.on(RoomEvent.ParticipantDisconnected, handleParticipantLeft);
       room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
       room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
        room.on(RoomEvent.Disconnected, () => {
          console.log('[useLiveKitRoom] Room disconnected');
          joinedRef.current = false;
          joiningRef.current = false;
          setIsConnected(false);
          setIsPublishing(false);
        });
      room.on(RoomEvent.Reconnecting, () => {
        console.log('[useLiveKitRoom] Room reconnecting...');
      });
      room.on(RoomEvent.Reconnected, () => {
        console.log('[useLiveKitRoom] Room reconnected');
        joinedRef.current = true;
        setIsConnected(true);
      });
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        console.log('[useLiveKitRoom] Connection state changed:', state);
        if (state === 'disconnected') {
          joinedRef.current = false;
          setIsConnected(false);
        }
      });

      const roomName = getLiveKitRoomName(roomId);
      const token = tokenOverride || await fetchToken(roomName, userId, userName, true, undefined, 'broadcaster');
      const url = getLiveKitUrl();
      const apiKey = getLiveKitApiKey();

      if (!url || !apiKey) {
        console.error(`[useLiveKitRoom] Missing LiveKit config: hasUrl=${!!url} hasApiKey=${!!apiKey}`);
        throw new Error(`Missing LiveKit env vars: VITE_LIVEKIT_URL=${url ? 'set' : 'MISSING'}, VITE_LIVEKIT_API_KEY=${apiKey ? 'set' : 'MISSING'}`);
      }

      if (!token) {
        throw new Error('Failed to get LiveKit token from server');
      }

      audioTrack = prewarmedAudioTrackRef.current || await createLocalAudioTrack();
      prewarmedAudioTrackRef.current = null;
      if (!initialAudioEnabled) {
        await audioTrack.mute();
      }

      if (!audioOnly) {
        if (prewarmedVideoTrackRef.current) {
          videoTrack = prewarmedVideoTrackRef.current;
          prewarmedVideoTrackRef.current = null;
        } else {
          const { createLocalVideoTrack } = await import('livekit-client');
          videoTrack = await createLocalVideoTrack({
            ...videoPreset,
            facingMode: 'user'
          });
        }
      }

      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);
      localAudioTrackRef.current = audioTrack;
      localVideoTrackRef.current = videoTrack;

      await room.connect(url, token);
      await waitForRoomConnected(room, 10000);

      await room.localParticipant.publishTrack(audioTrack);
      if (videoTrack) {
        await room.localParticipant.publishTrack(videoTrack);
      }

      // Small delay to ensure tracks are fully published before marking connected
      await new Promise(resolve => setTimeout(resolve, 500));

      setIsConnected(true);
      setIsPublishing(true);

      const existingParticipants = room.remoteParticipants ? Array.from(room.remoteParticipants.values()) : [];
      console.log('[useLiveKitRoom] Existing participants after connect:', existingParticipants.map((p: any) => ({
        identity: p.identity,
        hasAudio: !!p.audioTrack,
        audioTrackSid: p.audioTrack?.sid
      })));
      setRemoteUsers(existingParticipants);

      joinedRef.current = true;
      setIsJoining(false);
      joiningRef.current = false;

      return room;
    } catch (err: any) {
      console.error(`[useLiveKitRoom] Error joining as publisher: ${safeStringify(err)}`);

      if (audioTrack) {
        try {
          audioTrack.stop();
        } catch (stopErr) {
          console.warn('[useLiveKitRoom] Failed to stop audio track on join error:', stopErr);
        }
      }

      if (videoTrack) {
        try {
          videoTrack.stop();
        } catch (stopErr) {
          console.warn('[useLiveKitRoom] Failed to stop video track on join error:', stopErr);
        }
      }

      if (room) {
        try {
          await room.disconnect();
        } catch (disconnectErr) {
          console.warn('[useLiveKitRoom] Failed to disconnect room after publish error:', disconnectErr);
        }
      }

      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
      localAudioTrackRef.current = null;
      localVideoTrackRef.current = null;
      prewarmedAudioTrackRef.current = null;
      prewarmedVideoTrackRef.current = null;
      joinedRef.current = false;
      setIsConnected(false);
      setIsPublishing(false);
      setError(err?.message || 'Failed to join room');
      setIsJoining(false);
      joiningRef.current = false;
      onError?.(err);
      throw err;
    }
  }, [roomId, videoPreset, fetchToken, handleParticipantJoined, handleParticipantLeft, handleTrackSubscribed, handleTrackUnsubscribed, onError, userName, identity, audioOnly, initialAudioEnabled]);

  // Join as viewer (LiveKit)
  const joinAsAudience = useCallback(async (userIdOrParam: string | { userId?: string; streamId?: string; roomName?: string; viewerIdentity?: string; publishCapable?: boolean }) => {
    // Support legacy string signature and object signature
    let userId: string
    let providedStreamId: string | undefined
    let providedRoomName: string | undefined
    let publishCapable = false
    if (typeof userIdOrParam === 'string') {
      userId = userIdOrParam
    } else {
      userId = userIdOrParam.userId || userIdOrParam.viewerIdentity || ''
      providedStreamId = userIdOrParam.streamId
      providedRoomName = userIdOrParam.roomName
      publishCapable = !!userIdOrParam.publishCapable
    }
    // Guard: prevent multiple simultaneous connection attempts
    if (joinedRef.current) {
      if (import.meta.env.DEV) console.log('[useLiveKitRoom] Join prevented: already joined', { roomId, userId });
      return roomRef.current;
    }

    if (joiningRef.current) {
      if (import.meta.env.DEV) console.log('[useLiveKitRoom] Join prevented: already joining', { roomId, userId });
      // Wait for existing join to complete
      let attempts = 0;
      while (joiningRef.current && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      return roomRef.current;
    }

    // Guard: if the same room+user failed recently (within 60s), don't retry.
    // Checks both the instance ref and the module-level cache (survives remounts).
    // This prevents infinite retry loops when the token or network is the issue.
    const effectiveStreamKey = providedStreamId || roomId || '';
    const joinCacheKey = `${effectiveStreamKey}:${userId}`;
    const cachedFailure = failedJoinCache.get(joinCacheKey);
    const instanceFailure = lastFailedJoinRef.current;
    const now = Date.now();
    if (cachedFailure && (now - cachedFailure.timestamp < 60000)) {
      if (import.meta.env.DEV) console.log('[useLiveKitRoom] Join prevented: recent cached failure', {
        roomId: effectiveStreamKey, userId, lastError: cachedFailure.error,
      });
      return roomRef.current;
    }
    if (instanceFailure
        && instanceFailure.roomId === (effectiveStreamKey || roomId)
        && instanceFailure.userId === userId
        && (now - instanceFailure.timestamp < 60000)) {
      if (import.meta.env.DEV) console.log('[useLiveKitRoom] Join prevented: recent instance failure', {
        roomId: effectiveStreamKey, userId, lastError: instanceFailure.error,
      });
      return roomRef.current;
    }

    if (!roomId || !userId) {
      if (import.meta.env.DEV) console.warn('[useLiveKitRoom] Join prevented: missing params', { roomId, userId });
      return;
    }

    joiningRef.current = true;
    setIsJoining(true);
    setError(null);
    localUserIdRef.current = userId;

    try {
      const room = new Room({
        adaptiveStream: true,
        dynacast: true
      });

      roomRef.current = room;

      // Set up event listeners
      room.on(RoomEvent.ParticipantConnected, handleParticipantJoined);
      room.on(RoomEvent.ParticipantDisconnected, handleParticipantLeft);
      room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      
// Handle disconnection events to reset state
      room.on(RoomEvent.Disconnected, () => {
        console.log('[useLiveKitRoom] Room disconnected');
        joinedRef.current = false;
        joiningRef.current = false;
        setIsConnected(false);
        setIsPublishing(false);
      });

      // Handle reconnection events
      room.on(RoomEvent.Reconnecting, () => {
        console.log('[useLiveKitRoom] Room reconnecting...');
      });

      room.on(RoomEvent.Reconnected, () => {
        console.log('[useLiveKitRoom] Room reconnected');
        joinedRef.current = true;
        setIsConnected(true);
      });

      // Handle connection state changes
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        console.log('[useLiveKitRoom] Connection state changed:', state);
        if (state === 'disconnected') {
          joinedRef.current = false;
          setIsConnected(false);
        }
      });

      // Get token — audience mode: canPublish false, canSubscribe true
      // Ensure we consistently compute the LiveKit room name
      const roomName = providedRoomName || roomId || getLiveKitRoomName(undefined, providedStreamId || roomId);

      if (import.meta.env.DEV) {
        const pre = {
            streamId: providedStreamId || roomId,
            roomName,
            userId,
            identity,
            mode: 'audience',
          };
        console.log('[useLiveKitRoom] joinAsAudience request params (pre-token):', pre);
        setLastJoinDebug((prev: any) => ({ ...(prev || {}), pre }));
      }

      const token = await fetchToken(roomName, userId, userName, publishCapable, providedStreamId ? JSON.stringify({ streamId: providedStreamId }) : undefined, publishCapable ? 'seat-publisher' : 'audience');
      const url = getLiveKitUrl();
      const apiKey = getLiveKitApiKey();

      if (import.meta.env.DEV) {
        const post = {
            streamId: providedStreamId || roomId,
            roomName,
            identity,
            hasToken: Boolean(token),
            livekitUrl: url,
          };
        console.log('[useLiveKitRoom] Audience join attempt', post);
        setLastJoinDebug((prev: any) => ({ ...(prev || {}), post }));
      }

      if (!url || !apiKey) {
        console.error(`[useLiveKitRoom] Missing LiveKit config: hasUrl=${!!url} hasApiKey=${!!apiKey}`);
        throw new Error(`Missing LiveKit env vars: VITE_LIVEKIT_URL=${url ? 'set' : 'MISSING'}, VITE_LIVEKIT_API_KEY=${apiKey ? 'set' : 'MISSING'}`);
      }
      
      if (!token) {
        throw new Error('Failed to get LiveKit token from server');
      }

      // Connect to room
      await room.connect(url, token);
      await waitForRoomConnected(room, 10000);

       // Get existing participants - guard against undefined
       const existingParticipants = room.remoteParticipants ? Array.from(room.remoteParticipants.values()) : [];
       console.log('[useLiveKitRoom] Existing participants after connect:', existingParticipants.map((p: any) => ({
         identity: p.identity,
         hasAudio: !!p.audioTrack,
         audioTrackSid: p.audioTrack?.sid
       })));
       setRemoteUsers(existingParticipants);

      joinedRef.current = true;
      setIsConnected(true);
      setIsJoining(false);
      joiningRef.current = false;

      if (import.meta.env.DEV) {
        console.log('[useLiveKitRoom] joinAsAudience connected:', {
          roomName: room.name,
          identity,
          remoteParticipantCount: existingParticipants.length,
          remoteIdentities: existingParticipants.map((p: any) => p.identity),
        });
      }

      return room;
    } catch (err: any) {
      const safeError = serializeError(err);
      const normalized = normalizeLiveKitError(err);
      const rootMessage = normalized?.message || safeError?.message || 'Unknown LiveKit audience join failure';

      const effectiveStreamId = providedStreamId || roomId;
      const effectiveRoomName = providedRoomName || roomId || getLiveKitRoomName(undefined, providedStreamId || roomId);
      const errorPayload = {
        streamId: effectiveStreamId,
        roomName: effectiveRoomName,
        viewerIdentity: identity,
        livekitUrl: getLiveKitUrl() ? 'present' : 'missing',
        error: safeError,
        normalized,
      };
      const warnPayload = {
        message: rootMessage,
        streamId: effectiveStreamId,
        viewerIdentity: identity,
        livekitUrl: getLiveKitUrl() ? 'present' : 'missing',
      };
      console.warn('[useLiveKitRoom] Error joining as audience', warnPayload);
      setLastJoinDebug((prev: any) => ({ ...(prev || {}), error: errorPayload }));

      const isGetUserMediaError = String(normalized?.message || '').includes('getUserMedia');

      // Record failure cache to prevent tight retry loops
      lastFailedJoinRef.current = { roomId: effectiveStreamKey || '', userId, error: rootMessage, timestamp: Date.now() };
      failedJoinCache.set(`${effectiveStreamKey}:${userId}`, { error: rootMessage, timestamp: Date.now() });
      if (failedJoinCache.size > 100) {
        const cutoff = Date.now() - 120000;
        for (const [key, val] of failedJoinCache) {
          if (val.timestamp < cutoff) failedJoinCache.delete(key);
        }
      }

      // Reset state
      joinedRef.current = false;
      setIsConnected(false);
      setIsPublishing(false);
      setError(rootMessage);
      setIsJoining(false);
      joiningRef.current = false;

      // Notify component with a simple string message only
      try {
        onError?.(rootMessage);
      } catch (e) {
        console.warn('[useLiveKitRoom] onError handler threw:', safeStringify(e));
      }

      // For getUserMedia errors we may want to tolerate them if room connected
      if (isGetUserMediaError) {
        console.warn('[useLiveKitRoom] Ignoring getUserMedia error - connection may still work');
        if (roomRef.current && !joinedRef.current) {
          joinedRef.current = true;
          setIsConnected(true);
          setIsJoining(false);
          joiningRef.current = false;
          return roomRef.current;
        }
      }
      // Do not re-throw; return the root message to allow callers to display the failure reason.
      return rootMessage;
    }
  }, [roomId, identity, fetchToken, handleParticipantJoined, handleParticipantLeft, handleTrackSubscribed, handleTrackUnsubscribed, onError, userName]);

  const stopUnusedPrewarmedTracks = useCallback(() => {
    if (prewarmCleanupTimerRef.current) {
      clearTimeout(prewarmCleanupTimerRef.current)
      prewarmCleanupTimerRef.current = null
    }

    if (prewarmedAudioTrackRef.current) {
      try { prewarmedAudioTrackRef.current.stop() } catch {}
      prewarmedAudioTrackRef.current = null
    }

    if (prewarmedVideoTrackRef.current) {
      try { prewarmedVideoTrackRef.current.stop() } catch {}
      prewarmedVideoTrackRef.current = null
    }

    setLocalAudioTrack(null)
    setLocalVideoTrack(null)
  }, [])

   const publishLocalTracks = useCallback(async () => {
      const room = roomRef.current
      if (!room || room.state !== 'connected') {
        return
      }

      let audioTrack = localAudioTrackRef.current
      let videoTrack = localVideoTrackRef.current

      if (!audioTrack) {
        audioTrack = await createLocalAudioTrack()
        localAudioTrackRef.current = audioTrack
        setLocalAudioTrack(audioTrack)
      }

      if (!videoTrack && !audioOnly) {
        const { createLocalVideoTrack: createVideo } = await import('livekit-client')
        videoTrack = await createVideo({ ...videoPreset, facingMode: 'user' })
        localVideoTrackRef.current = videoTrack
        setLocalVideoTrack(videoTrack)
      }

      await room.localParticipant.publishTrack(audioTrack)
      if (videoTrack) {
        await room.localParticipant.publishTrack(videoTrack)
      }

      setIsPublishing(true)
    }, [audioOnly, videoPreset])

  // Unpublish only local camera/mic tracks. Does NOT disconnect the room.
  // Used when a viewer leaves a seat — broadcaster tracks stay subscribed.
  const unpublishLocalTracks = useCallback(async () => {
    const room = roomRef.current
    if (!room) return

    try {
      const audioTrack = localAudioTrackRef.current
      const videoTrack = localVideoTrackRef.current

      if (audioTrack) {
        try { await room.localParticipant.unpublishTrack(audioTrack) } catch {}
        try { audioTrack.stop() } catch {}
        localAudioTrackRef.current = null
        setLocalAudioTrack(null)
      }

      if (videoTrack) {
        try { await room.localParticipant.unpublishTrack(videoTrack) } catch {}
        try { videoTrack.stop() } catch {}
        localVideoTrackRef.current = null
        setLocalVideoTrack(null)
      }

      setIsPublishing(false)

    } catch (err) {
      console.error(`[useLiveKitRoom] unpublishLocalTracks error: ${safeStringify(err)}`)
    }
  }, [])

  const prewarmPublisherTracks = useCallback(async () => {
    if (prewarmCleanupTimerRef.current) {
      clearTimeout(prewarmCleanupTimerRef.current)
      prewarmCleanupTimerRef.current = null
    }

    if (prewarmedAudioTrackRef.current && prewarmedVideoTrackRef.current) {
      setLocalAudioTrack(prewarmedAudioTrackRef.current)
      setLocalVideoTrack(prewarmedVideoTrackRef.current)
      return {
        audioTrack: prewarmedAudioTrackRef.current,
        videoTrack: prewarmedVideoTrackRef.current,
      }
    }

    const audioTrack = await createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    })

    let videoTrack: LocalVideoTrack | null = null
    if (!audioOnly && roomType !== 'pod') {
      try {
        videoTrack = await createLocalVideoTrack({
          ...videoPreset,
          facingMode: 'user',
        })
      } catch (err) {

      }
    }

    prewarmedAudioTrackRef.current = audioTrack
    prewarmedVideoTrackRef.current = videoTrack

    setLocalAudioTrack(audioTrack)
    setLocalVideoTrack(videoTrack)

    return { audioTrack, videoTrack }
  }, [audioOnly, roomType, videoPreset])

// Leave room
    const leaveRoom = useCallback(async () => {
     try {
       const audioTrack = localAudioTrackRef.current
       const videoTrack = localVideoTrackRef.current

       if (audioTrack) {
         audioTrack.stop()
         localAudioTrackRef.current = null
         setLocalAudioTrack(null)
       }

       if (videoTrack) {
         videoTrack.stop()
         localVideoTrackRef.current = null
         setLocalVideoTrack(null)
       }

         if (roomRef.current) {
          try {
            roomRef.current.off(RoomEvent.ParticipantConnected, handleParticipantJoined)
            roomRef.current.off(RoomEvent.ParticipantDisconnected, handleParticipantLeft)
            roomRef.current.off(RoomEvent.TrackSubscribed, handleTrackSubscribed)
            roomRef.current.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
          } catch {
            // ignore if handlers were never attached
          }
          await roomRef.current.disconnect()
          roomRef.current = null
        }

       joinedRef.current = false
       joiningRef.current = false
       localUserIdRef.current = null
       setIsConnected(false)
       setIsPublishing(false)
     } catch (err) {
       console.error(`[useLiveKitRoom] Error leaving room: ${safeStringify(err)}`)
       joinedRef.current = false
       joiningRef.current = false
       roomRef.current = null
       setIsConnected(false)
       setIsPublishing(false)
     }
   }, [])

  const setCameraEnabled = useCallback(async (enabled: boolean) => {
    if (audioOnly || roomType === 'pod') return false

    const room = roomRef.current
    const participant = room?.localParticipant
    if (!room || !participant) return false

    const runCameraToggle = async () => {
      const currentParticipant = roomRef.current?.localParticipant
      if (!currentParticipant) {
        setLocalVideoTrack(null)
        return false
      }

      let track = localVideoTrackRef.current

      if (!track || track.mediaStreamTrack?.readyState === 'ended') {
        if (!enabled) {
          setLocalVideoTrack(null)
          return true
        }

        const { createLocalVideoTrack } = await import('livekit-client')
        track = await createLocalVideoTrack({
          ...videoPreset,
          facingMode: 'user',
        })
        localVideoTrackRef.current = track
      }

      const isPublished = Array.from(currentParticipant.videoTrackPublications.values())
        .some((pub) => pub.track === track)

      if (enabled) {
        if (track.isMuted) {
          await track.unmute()
        }

        if (!isPublished) {
          await currentParticipant.publishTrack(track)
        }

        setLocalVideoTrack(track)
        return true
      }

      if (isPublished) {
        await currentParticipant.unpublishTrack(track)
      }

      if (!track.isMuted) {
        await track.mute()
      }

      setLocalVideoTrack(null)
      return true
    }

    const previous = cameraToggleQueueRef.current.catch(() => {})
    const next = previous
      .then(runCameraToggle, runCameraToggle)
      .catch((err) => {
        console.error(`[useLiveKitRoom] Error setting camera enabled: ${safeStringify(err)}`)
        return false
      })
      .finally(() => {
        if (cameraToggleQueueRef.current === previous) {
          cameraToggleQueueRef.current = Promise.resolve()
        }
      })

    cameraToggleQueueRef.current = next
    return next
  }, [audioOnly, roomType, safeStringify, videoPreset])

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    const participant = roomRef.current?.localParticipant
    const track = localVideoTrackRef.current

    if (!participant || !track) return false

    const isPublished = Array.from(participant.videoTrackPublications.values())
      .some((pub) => pub.track === track)
    const isEnabled = isPublished && !track.isMuted

    return setCameraEnabled(!isEnabled)
  }, [setCameraEnabled])

  // Set mic enabled/disabled (for walkie-talkie integration)
  const setMicEnabled = useCallback(async (enabled: boolean) => {
    const runMicrophoneToggle = async () => {
      let track = localAudioTrackRef.current

      if (!track || track.mediaStreamTrack?.readyState === 'ended') {
        if (!enabled) {
          setLocalAudioTrack(null)
          return true
        }

        track = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        })
        localAudioTrackRef.current = track
      }

      if (enabled) {
        if (track.isMuted) {
          await track.unmute()
        }
      } else if (!track.isMuted) {
        await track.mute()
      }

      setLocalAudioTrack(track)
      return true
    }

    const previous = microphoneToggleQueueRef.current.catch(() => {})
    const next = previous
      .then(runMicrophoneToggle, runMicrophoneToggle)
      .catch((err) => {
        console.error(`[useLiveKitRoom] Error setting mic enabled: ${safeStringify(err)}`)
        return false
      })
      .finally(() => {
        if (microphoneToggleQueueRef.current === previous) {
          microphoneToggleQueueRef.current = Promise.resolve()
        }
      })

    microphoneToggleQueueRef.current = next
    return next
  }, [safeStringify])

  // Toggle microphone - with error handling to prevent disconnects
  const toggleMicrophone = useCallback(async () => {
    const track = localAudioTrackRef.current
    if (!track) return false

    const isEnabled = !track.isMuted
    return setMicEnabled(!isEnabled)
  }, [setMicEnabled])

// Wait for room to be connected
    const waitForRoomConnected = useCallback(async (room: Room, timeoutMs = 5000) => {
      if (room.state === 'connected') {
        return true;
      }

      return new Promise<boolean>((resolve, reject) => {
        let resolved = false;
        const onConnected = () => {
          if (resolved) return;
          resolved = true;
          cleanup();
          resolve(true);
        };

        const onTimeout = () => {
          if (resolved) return;
          resolved = true;
          cleanup();
          reject(new Error(`LiveKit room not connected after ${timeoutMs}ms`));
        };

        const cleanup = () => {
          room.off(RoomEvent.Connected, onConnected);
          window.clearTimeout(timeoutId);
        };

        const timeoutId = window.setTimeout(onTimeout, timeoutMs);

        room.on(RoomEvent.Connected, onConnected);
      });
    }, []);

  // Get current mic state
  const getMicEnabled = useCallback(() => {
    const track = localAudioTrackRef.current;
    return track ? !track.isMuted : false;
  }, []);

// Cleanup on unmount
   useEffect(() => {
    return () => {
      try {
        const room = roomRef.current

        if (localAudioTrackRef.current) {
          localAudioTrackRef.current.stop()
          localAudioTrackRef.current = null
        }

        if (localVideoTrackRef.current) {
          localVideoTrackRef.current.stop()
          localVideoTrackRef.current = null
        }

        if (room) {
          room.disconnect()
        }
      } catch (err) {

      }

      roomRef.current = null
      joinedRef.current = false
      joiningRef.current = false
      localUserIdRef.current = null
    }
  }, [])

  return {
    // State
    isConnected,
    isPublishing,
    isJoining,
    remoteUsers,
    localVideoTrack,
    localAudioTrack,
    error,
    
    // Methods
    joinAsPublisher,
    joinAsAudience,
    leaveRoom,
    publishLocalTracks,
    unpublishLocalTracks,
    toggleCamera,
    toggleMicrophone,
    setMicEnabled,
    setCameraEnabled,
    getMicEnabled,
    prewarmPublisherTracks,
    stopUnusedPrewarmedTracks,
    
    // Room ref for external access
    room: roomRef.current
    ,
    // Debug
    lastJoinDebug
  };
}

export default useLiveKitRoom;

