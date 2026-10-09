import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

// Agora SDK is lazy-loaded to avoid bundling 2MB+ for all users
// Types are imported at the bottom of the file for type-checking only
let AgoraRTC: any = null;
async function loadAgoraRTC() {
  if (!AgoraRTC) {
    AgoraRTC = await import('agora-rtc-sdk-ng');
  }
  return AgoraRTC;
}

// Type-only import (erased at compile time, no bundle impact)
type IAgoraRTCClient = import('agora-rtc-sdk-ng').IAgoraRTCClient;
type IAgoraRTCRemoteUser = import('agora-rtc-sdk-ng').IAgoraRTCRemoteUser;
type ICameraVideoTrack = import('agora-rtc-sdk-ng').ICameraVideoTrack;
type IMicrophoneAudioTrack = import('agora-rtc-sdk-ng').IMicrophoneAudioTrack;
type UID = import('agora-rtc-sdk-ng').UID;

const MAX_JOIN_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 3000, 5000];

function isRetryableJoinError(err: any): boolean {
  if (!err) return false;
  const message = String(err?.message || err || '').toLowerCase();
  const status = err?.status ?? err?.code;
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) return true;
  if (status === 502 || status === 503 || status === 504) return true;
  if (message.includes('internal server error')) return true;
  return false;
}

export function useAgoraRoom({
  channelName,
  userId,
  userName: _userName = 'User',
  role = 'publisher',
  onUserJoined,
  onUserLeft,
  onError
}: {
  channelName: string;
  userId: string;
  userName?: string;
  role?: 'publisher' | 'subscriber';
  onUserJoined?: (user: IAgoraRTCRemoteUser) => void;
  onUserLeft?: (user: IAgoraRTCRemoteUser) => void;
  onError?: (error: string) => void;
}) {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // Refs
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);
  const isMountedRef = useRef(true);
  const videoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const retryAbortedRef = useRef(false);
  const joinAbortRef = useRef(false);

  // Get Agora app ID
  const getAgoraAppId = useCallback(() => import.meta.env.VITE_AGORA_APP_ID, []);

  const debugAgora = (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.log(...args)
    }
  }

  // Initialize Agora client (lazy-loads SDK on first call)
  const _initAgoraClient = useCallback(async () => {
    try {
      const appId = getAgoraAppId();
      if (!appId) {
        throw new Error('VITE_AGORA_APP_ID not configured');
      }

      debugAgora('🔧 Initializing Agora client');

      // Lazy-load Agora SDK (~2MB) only when needed
      const Agora = await loadAgoraRTC();

      // Create client
      const client = Agora.createClient({ mode: 'rtc', codec: 'vp8' });

      // Event handlers
      client.on('user-joined', (user) => {
        debugAgora('👤 User joined:', user.uid);
        setRemoteUsers(prev => [...prev, user]);
        onUserJoined?.(user);
      });

      client.on('user-left', (user) => {
        debugAgora('👤 User left:', user.uid);
        setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        onUserLeft?.(user);
      });

      client.on('user-published', async (user, mediaType) => {
        debugAgora('📢 User published:', user.uid, mediaType);
        await client.subscribe(user, mediaType);
      });

      client.on('user-unpublished', (user, mediaType) => {
        debugAgora('🔇 User unpublished:', user.uid, mediaType);
      });

      client.on('connection-state-change', (curState, revState) => {
        debugAgora('🔌 Connection state:', curState, '(was', revState + ')');
      });

      clientRef.current = client;
      return client;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to initialize Agora client';
      console.error('❌ Agora initialization error:', errMsg);
      setError(errMsg);
      onError?.(errMsg);
      throw err;
    }
  }, [getAgoraAppId, onError, onUserJoined, onUserLeft]);

  // Fetch Agora token
  const fetchAgoraToken = useCallback(async (channel: string, uid: UID) => {
    try {
      debugAgora('🎫 Fetching Agora token for channel:', channel, 'uid:', uid);

      const { data, error: tokenError } = await supabase.functions.invoke('agora-token', {
        body: {
          channel,
          userId: uid.toString(),
          tokenType: 'rtc',
          role
        }
      });

      if (tokenError) {
        console.error('❌ Token fetch error response:', tokenError);
        throw new Error(`Token error: ${tokenError.message}`);
      }

      if (!data) {
        console.error('❌ No data in token response');
        throw new Error('No data in token response');
      }

      if (!data?.token) {
        console.error('❌ No token in response, data:', data);
        throw new Error('No token in response: ' + JSON.stringify(data));
      }

      debugAgora('✅ Agora token received, length:', data.token.length);
      return data.token;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch Agora token';
      console.error('❌ Token fetch error:', errMsg, err);
      throw err;
    }
  }, [role]);

  // Convert user ID to numeric UID
  const getUserUid = (uid: string): UID => {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = (hash << 5) - hash + uid.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 4294967295;
  };

  const cleanClientAfterFailure = useCallback(async () => {
    try {
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
        videoTrackRef.current.close();
        videoTrackRef.current = null;
      }
      if (audioTrackRef.current) {
        audioTrackRef.current.stop();
        audioTrackRef.current.close();
        audioTrackRef.current = null;
      }
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }
    } catch (e) {
      debugAgora('Cleanup after failed join:', e);
    }
  }, []);

  // Join channel with retry only for network/5xx errors
  const joinChannel = useCallback(async () => {
    if (joiningRef.current || joinedRef.current) return;

    joiningRef.current = true;
    joinAbortRef.current = false;
    setIsJoining(true);
    setError(null);

    try {
      const appId = getAgoraAppId();
      if (!appId) {
        throw new Error('Agora App ID not configured');
      }

      const uid = getUserUid(userId);

      let lastError: any = null;
      for (let attempt = 0; attempt < MAX_JOIN_RETRIES; attempt++) {
        if (joinAbortRef.current || retryAbortedRef.current) {
          debugAgora('Join aborted before attempt', attempt);
          break;
        }

        await cleanClientAfterFailure();

        try {
          debugAgora(`📍 Join attempt ${attempt + 1}/${MAX_JOIN_RETRIES}`);

          const Agora = await loadAgoraRTC();
          const client = Agora.createClient({ mode: 'rtc', codec: 'vp8' });

          client.on('user-joined', (user) => {
            debugAgora('👤 User joined:', user.uid);
            setRemoteUsers(prev => [...prev, user]);
            onUserJoined?.(user);
          });

          client.on('user-left', (user) => {
            debugAgora('👤 User left:', user.uid);
            setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
            onUserLeft?.(user);
          });

          client.on('user-published', async (user, mediaType) => {
            debugAgora('📢 User published:', user.uid, mediaType);
            await client.subscribe(user, mediaType);
          });

          client.on('user-unpublished', (user, mediaType) => {
            debugAgora('🔇 User unpublished:', user.uid, mediaType);
          });

          client.on('connection-state-change', (curState, revState) => {
            debugAgora('🔌 Connection state:', curState, '(was', revState + ')');
          });

          clientRef.current = client;

          const token = await fetchAgoraToken(channelName, uid);
          const joinPromise = client.join(appId, channelName, token, uid);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Join timeout - connection took too long')), 15000)
          );

          await Promise.race([joinPromise, timeoutPromise]);
          joinedRef.current = true;

          if (isMountedRef.current) {
            setIsConnected(true);
            setIsJoining(false);
            joiningRef.current = false;
          }

          if (role === 'publisher') {
            debugAgora('🎬 Creating local tracks for publisher');

            const videoTrack = await Agora.createCameraVideoTrack({
              encoderConfig: {
                width: 1280,
                height: 720,
                frameRate: 30,
                bitrate: 1500,
              },
            });
            const audioTrack = await Agora.createMicrophoneAudioTrack({
              encoderConfig: 'speech_standard',
              AEC: true,
              ANS: true,
              AGC: true,
            });

            await client.publish([videoTrack, audioTrack]);

            videoTrackRef.current = videoTrack;
            audioTrackRef.current = audioTrack;
            setLocalVideoTrack(videoTrack);
            setLocalAudioTrack(audioTrack);
            setIsPublishing(true);

            debugAgora('✅ Published local tracks');
          }

          debugAgora('✅ Joined Agora channel');
          return;
        } catch (err) {
          lastError = err;
          const shouldRetry = isRetryableJoinError(err);
          if (!shouldRetry || attempt === MAX_JOIN_RETRIES - 1 || joinAbortRef.current || retryAbortedRef.current) {
            throw err;
          }
          debugAgora(`⚠️ Join attempt ${attempt + 1} failed, retrying in ${RETRY_DELAYS_MS[attempt]}ms...`, err);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
        }
      }

      throw lastError || new Error('Join aborted');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to join channel';
      console.error('❌ Join error:', errMsg, err);
      await cleanClientAfterFailure();
      joinedRef.current = false;
      if (isMountedRef.current) {
        setError(errMsg);
        setIsJoining(false);
      }
      joiningRef.current = false;
      onError?.(errMsg);
      toast.error('Meeting connection failed: ' + errMsg);
    }
  }, [getAgoraAppId, userId, cleanClientAfterFailure, fetchAgoraToken, channelName, role, onUserJoined, onUserLeft, onError]);

  // Leave channel
  const leaveChannel = useCallback(async () => {
    joinAbortRef.current = true;
    retryAbortedRef.current = true;
    joiningRef.current = false;

    try {
      debugAgora('👋 Leaving Agora channel');
      await cleanClientAfterFailure();

      setIsConnected(false);
      setIsPublishing(false);
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      setRemoteUsers([]);
      joinedRef.current = false;

      debugAgora('✅ Left Agora channel');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to leave channel';
      console.error('❌ Leave error:', errMsg);
      setError(errMsg);
    }
  }, [cleanClientAfterFailure]); // No dependencies - uses refs instead

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    try {
      if (!videoTrackRef.current) return;
      await videoTrackRef.current.setEnabled(!videoTrackRef.current.enabled);
      debugAgora('📹 Camera:', videoTrackRef.current.enabled ? 'on' : 'off');
    } catch (err) {
      console.error('❌ Toggle camera error:', err);
    }
  }, []);

  // Toggle microphone
  const toggleMicrophone = useCallback(async () => {
    try {
      if (!audioTrackRef.current) return;
      await audioTrackRef.current.setEnabled(!audioTrackRef.current.enabled);
      debugAgora('🎤 Microphone:', audioTrackRef.current.enabled ? 'on' : 'off');
    } catch (err) {
      console.error('❌ Toggle microphone error:', err);
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      leaveChannel();
    };
  }, [leaveChannel]);

  return {
    isConnected,
    isPublishing,
    remoteUsers,
    localVideoTrack,
    localAudioTrack,
    error,
    isJoining,
    joinChannel,
    leaveChannel,
    toggleCamera,
    toggleMicrophone
  };
}



