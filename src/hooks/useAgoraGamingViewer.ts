import { useState, useRef, useCallback, useEffect } from 'react';
import AgoraRTC, {
  IAgoraRTCClient,
  IRemoteAudioTrack,
  IRemoteVideoTrack,
  UID,
} from 'agora-rtc-sdk-ng';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

/**
 * useAgoraGamingViewer
 *
 * Viewer-side hook for watching HytroGaming screen-share streams via Agora.
 *
 * Track identification strategy (explicit UID-based):
 *   - Broadcaster publishes screen share on UID = hash(channelName)
 *   - Broadcaster publishes camera on UID = hash(channelName + "-camera")
 *   - Viewer knows the channel name, so it can pre-compute both expected UIDs
 *   - Any video track from the camera UID → camera overlay
 *   - Any other video track → screen share (main)
 */

export interface AgoraGamingViewerState {
  isConnecting: boolean;
  isConnected: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  remoteVideoTrack: IRemoteVideoTrack | null;
  remoteCameraTrack: IRemoteVideoTrack | null;
  remoteAudioTrack: IRemoteAudioTrack | null;          // Track C: Microphone audio
  remoteScreenAudioTrack: IRemoteAudioTrack | null;  // Track D: Screen share / game audio
  error: string | null;
}

export interface AgoraGamingViewerActions {
  join: (channelName: string, userId: string, streamId: string) => Promise<void>;
  leave: () => Promise<void>;
}

/** Deterministic string → UID hash matching the broadcaster's getUserUid() */
function hashToUid(str: string): UID {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 4294967295;
}

export function useAgoraGamingViewer(): AgoraGamingViewerState & AgoraGamingViewerActions {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<IRemoteVideoTrack | null>(null);
  const [remoteCameraTrack, setRemoteCameraTrack] = useState<IRemoteVideoTrack | null>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] = useState<IRemoteAudioTrack | null>(null);
  const [remoteScreenAudioTrack, setRemoteScreenAudioTrack] = useState<IRemoteAudioTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);
  const mountedRef = useRef(true);
  const audioSubscribedRef = useRef(false);

  // Pre-computed expected UIDs — set when join() is called
  const expectedScreenUidRef = useRef<UID | null>(null);
  const expectedCameraUidRef = useRef<UID | null>(null);

  const getAgoraAppId = () => import.meta.env.VITE_AGORA_APP_ID;

  const debug = (...args: unknown[]) => {
    if (import.meta.env.DEV) console.log('[AgoraGamingViewer]', ...args);
  };

  const fetchToken = useCallback(async (channel: string, uid: UID, streamId: string): Promise<string> => {
    const { data, error: tokenError } = await supabase.functions.invoke('agora-token', {
      body: {
        channel,
        userId: uid.toString(),
        tokenType: 'rtc',
        role: 'subscriber',
        roomType: 'gaming',
        streamId,
      },
    });

    debug('fetchToken response', { channel, uid, tokenError, hasData: Boolean(data), tokenLen: data?.token?.length ?? 0 });

    if (tokenError) {
      debug('fetchToken error detail', tokenError);
      throw new Error(`Token error: ${tokenError.message}`);
    }
    if (!data?.token) {
      debug('fetchToken no token, data:', data);
      throw new Error('No token received');
    }

    return data.token;
  }, []);

  const join = useCallback(async (channelName: string, userId: string, streamId: string) => {
    if (joinedRef.current || joiningRef.current) return;

    joiningRef.current = true;

    // Pre-compute the expected UIDs for screen share and camera tracks.
    // The broadcaster uses: screen UID = hash(channelName), camera UID = hash(channelName + "-camera")
    expectedScreenUidRef.current = hashToUid(channelName);
    expectedCameraUidRef.current = hashToUid(`${channelName}-camera`);
    debug('Expected UIDs — screen:', expectedScreenUidRef.current, 'camera:', expectedCameraUidRef.current);

    setIsConnecting(true);
    setError(null);

    try {
      const appId = getAgoraAppId();
      if (!appId) throw new Error('VITE_AGORA_APP_ID not configured');

      debug('AGORA join details', { appId: Boolean(appId), channelName, userId });

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });


      // ── UID-based track identification ──
      // The broadcaster publishes:
      //   Screen share video on UID = hashToUid(channelName)
      //   Camera video on UID = hashToUid(channelName + "-camera")
      // We pre-computed these in expectedScreenUidRef / expectedCameraUidRef.

      const isCameraUid = (uid: UID): boolean => {
        return expectedCameraUidRef.current !== null && uid === expectedCameraUidRef.current;
      };

      const isScreenUid = (uid: UID): boolean => {
        return expectedScreenUidRef.current !== null && uid === expectedScreenUidRef.current;
      };

      // Handle remote user publishing (broadcaster shares screen + camera)
      client.on('user-published', async (user, mediaType) => {
        debug('Remote user published:', user.uid, mediaType, 'isCamera:', isCameraUid(user.uid), 'isScreen:', isScreenUid(user.uid));
        if (!joinedRef.current) {
          debug('Skipping subscribe — not joined');
          return;
        }
        try {
          await client.subscribe(user, mediaType);
          debug('Subscribed to', mediaType, 'from user', user.uid);

          if (mediaType === 'video') {
            const videoTrack = user.videoTrack;
            if (!videoTrack || !mountedRef.current) {
              debug('No video track available after subscribe');
              return;
            }

            if (isCameraUid(user.uid)) {
              // This is the broadcaster's camera (secondary Agora client)
              setRemoteCameraTrack(videoTrack);
              debug('Camera video track set from uid:', user.uid);
            } else {
              // Everything else is treated as screen share (primary Agora client)
              setRemoteVideoTrack(videoTrack);
              setHasVideo(true);
              debug('Screen share video track set from uid:', user.uid);
            }
          }

          if (mediaType === 'audio') {
            const audioTrack = user.audioTrack;
            if (audioTrack && mountedRef.current) {
              // The broadcaster may publish TWO audio tracks on the same UID:
              // 1. Microphone audio (Track C)
              // 2. Screen share / game audio (Track D)
              // First audio track = mic, second = screen audio
              if (!audioSubscribedRef.current) {
                audioSubscribedRef.current = true;
                setRemoteAudioTrack(audioTrack);
                setHasAudio(true);
                try {
                  const at = audioTrack as any;
                  if (at.play) at.play();
                } catch (e) { debug('Audio play failed:', e); }
                debug('Mic audio track set from uid:', user.uid);
              } else {
                setRemoteScreenAudioTrack(audioTrack);
                try {
                  const at = audioTrack as any;
                  if (at.play) at.play();
                } catch (e) { debug('Screen audio play failed:', e); }
                debug('Screen share audio track set from uid:', user.uid);
              }
            }
          }
        } catch (err) {
          console.error('[AgoraGamingViewer] Subscribe error:', err);
        }
      });

      client.on('user-unpublished', (user, mediaType) => {
        debug('Remote user unpublished:', user.uid, mediaType);
        if (mediaType === 'video' && mountedRef.current) {
          if (isCameraUid(user.uid)) {
            setRemoteCameraTrack(null);
            debug('Camera track cleared for uid:', user.uid);
          } else {
            setRemoteVideoTrack(null);
            setHasVideo(false);
            debug('Screen share track cleared for uid:', user.uid);
          }
        }
        if (mediaType === 'audio' && mountedRef.current) {
          setRemoteAudioTrack(null);
          setRemoteScreenAudioTrack(null);
          setHasAudio(false);
          audioSubscribedRef.current = false;
        }
      });

      client.on('user-joined', (user) => {
        debug('User joined:', user.uid, 'isCamera:', isCameraUid(user.uid), 'isScreen:', isScreenUid(user.uid));

        if (!joinedRef.current) return;
        (async () => {
          try {
            await client.subscribe(user, 'video');
            debug('user-joined auto-subscribe video for uid:', user.uid, 'hasTrack:', !!user.videoTrack);
          } catch (e) {
            debug('user-joined subscribe failed:', e);
          }
          try {
            await client.subscribe(user, 'audio');
          } catch (_e) {
            // ignore audio subscribe errors
          }
        })();
      });

      client.on('user-left', (user) => {
        debug('User left:', user.uid);
        if (mountedRef.current) {
          if (isCameraUid(user.uid)) {
            setRemoteCameraTrack(null);
          } else {
            setRemoteVideoTrack(null);
            setHasVideo(false);
          }
          // Check if any remote users remain
          const remoteUsers = client.remoteUsers || [];
          if (remoteUsers.length === 0) {
            setRemoteAudioTrack(null);
            setRemoteScreenAudioTrack(null);
            setHasAudio(false);
            audioSubscribedRef.current = false;
          }
        }
      });

      client.on('connection-state-change', (current, previous) => {
        debug('Connection state change:', current, previous);
        if (!mountedRef.current) return;
        if (current === 'FAILED' as any || current === 'DISCONNECTED' as any) {
          setError('Agora connection failed');
          setIsConnecting(false);
          joiningRef.current = false;
        }
      });

      clientRef.current = client;

      const uid = hashToUid(userId);
      debug('fetching agora token', { channelName, uid });
      const token = await fetchToken(channelName, uid, streamId);
      debug('fetched agora token', { channelName, uid, tokenLen: token?.length ?? 0 });
      const joinPromise = client.join(appId, channelName, token, uid);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Agora join timed out')), 15000),
      );

      await Promise.race([joinPromise, timeoutPromise]);
      joinedRef.current = true;

      if (mountedRef.current) {
        setIsConnected(true);
        setIsConnecting(false);
        joiningRef.current = false;
      }

      // Poll for remote video tracks every 2 seconds to catch any tracks
      // that were missed by user-published events (e.g. secondary camera client)
      const pollInterval = setInterval(() => {
        if (!mountedRef.current || !joinedRef.current) {
          clearInterval(pollInterval);
          return;
        }
        const remoteUsers = client.remoteUsers || [];
        for (const remoteUser of remoteUsers) {
          const uid = remoteUser.uid;
          const videoTrack = remoteUser.videoTrack;
          if (!videoTrack) continue;

          if (isCameraUid(uid)) {
            // This is the camera — update if not already set
            setRemoteCameraTrack(videoTrack);
            debug('Poll: camera track set from uid:', uid);
          } else {
            // Everything else is screen share
            setRemoteVideoTrack(videoTrack);
            setHasVideo(true);
            debug('Poll: screen share track set from uid:', uid);
          }
        }
      }, 2000);

      // Store interval ref for cleanup
      (client as any).__pollInterval = pollInterval;

      debug('Joined Agora channel as viewer:', channelName);
    } catch (err: any) {
      console.error('[AgoraGamingViewer] Join failed:', err);
      if (mountedRef.current) {
        setError(err?.message || 'Failed to connect to stream');
        setIsConnecting(false);
        joiningRef.current = false;
      }
      toast.error('Failed to connect to gaming stream');
    }
  }, [fetchToken]);

  const leave = useCallback(async () => {
    debug('Leaving Agora viewer channel...');

    // Always reset joining ref so a future join can proceed
    joiningRef.current = false;

    try {
      if (clientRef.current && joinedRef.current) {
        // Clear polling interval
        const pollInterval = (clientRef.current as any).__pollInterval;
        if (pollInterval) clearInterval(pollInterval);
        await clientRef.current.leave();
        joinedRef.current = false;
      }
    } catch (err) {
      console.warn('[AgoraGamingViewer] Leave error:', err);
    }

    // Also reset joinedRef in case we were mid-join
    joinedRef.current = false;

    if (mountedRef.current) {
      setIsConnected(false);
      setIsConnecting(false);
      setRemoteVideoTrack(null);
      setRemoteCameraTrack(null);
      setRemoteAudioTrack(null);
      setRemoteScreenAudioTrack(null);
      setHasVideo(false);
      setHasAudio(false);
      expectedScreenUidRef.current = null;
      expectedCameraUidRef.current = null;
      audioSubscribedRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (clientRef.current && joinedRef.current) {
        clientRef.current.leave().catch(() => {});
      }
    };
  }, []);

  return {
    isConnecting,
    isConnected,
    hasVideo,
    hasAudio,
    remoteVideoTrack,
    remoteCameraTrack,
    remoteAudioTrack,
    remoteScreenAudioTrack,
    error,
    join,
    leave,
  };
}
