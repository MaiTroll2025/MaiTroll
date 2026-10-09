import { useState, useRef, useCallback, useEffect } from 'react';
import { StreamVideoClient, type Call } from '@stream-io/video-client';
import type { StreamVideoParticipant } from '@stream-io/video-client';
import { supabase } from '../lib/supabase';

export interface UseGetStreamRoomOptions {
  roomId: string;
  roomType?: 'broadcast' | 'town_meeting' | 'battle';
  role?: 'publisher' | 'viewer';
  audioOnly?: boolean;
  publish?: boolean;
  userName?: string;
  identity?: string;
  initialAudioEnabled?: boolean;
  onUserJoined?: (participant: StreamVideoParticipant) => void;
  onUserLeft?: (participant: StreamVideoParticipant) => void;
  onError?: (error: string) => void;
}

export function useGetStreamRoom({
  roomId,
  roomType: _roomType = 'broadcast',
  role: _role = 'viewer',
  audioOnly = false,
  publish = false,
  userName,
  identity = '',
  initialAudioEnabled = true,
  onUserJoined,
  onUserLeft,
  onError,
}: UseGetStreamRoomOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<StreamVideoParticipant[]>([]);
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const clientRef = useRef<StreamVideoClient | null>(null);
  const callRef = useRef<Call | null>(null);
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);
  const localUserIdRef = useRef<string | null>(null);
  const callSubscriptionsRef = useRef<Array<{ unsubscribe: () => void }>>([]);
  const getEdgeFunctionsUrl = () => {
    const explicit = import.meta.env.VITE_EDGE_FUNCTIONS_URL;
    if (explicit && explicit.trim()) return explicit.trim();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return supabaseUrl ? `${supabaseUrl}/functions/v1` : '';
  };

  const fetchWithTimeout = async (url: string, options: RequestInit & { timeout?: number } = {}) => {
    const { timeout = 15000, ...fetchOptions } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      return response;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`GetStream token request timed out after ${timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const fetchToken = useCallback(async (roomName: string, userId: string, userName?: string, isPublisherOverride?: boolean, metadataOverride?: string, mode?: string) => {
    const MAX_RETRIES = 2;
    const RETRY_DELAYS = [1000, 2000];
    const REQUEST_TIMEOUT = 15000;

    const attemptFetch = async (attempt: number): Promise<{ token: string; callId: string; userId: string }> => {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt - 1] || 1000));
      }

      const canPublish = mode === 'broadcaster' || mode === 'seat-publisher' || (mode === undefined && (isPublisherOverride === true || publish === true));
      const requestBody: Record<string, any> = {
        room: roomName,
        roomName,
        identity: identity || userId,
        name: userName || 'User',
        role: canPublish ? 'publisher' : 'audience',
        canPublish,
        canSubscribe: true,
        mode: mode || (canPublish ? 'publisher' : 'audience'),
      };
      if (metadataOverride) {
        requestBody.metadata = metadataOverride;
      }

      try {
        const { data, error: tokenError } = await supabase.functions.invoke('getstream-token', {
          body: requestBody,
        });

        if (tokenError) {
          const statusCode = tokenError?.status || tokenError?.statusCode || tokenError?.status_code || null;
          const bodyText = tokenError?.body || tokenError?.message || JSON.stringify(tokenError);
          console.error(`[useGetStreamRoom] Error fetching token (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${statusCode} ${bodyText}`);
          throw new Error(`GetStream token failed: ${statusCode ? statusCode + ' ' : ''}${String(bodyText)}`);
        }

        if (!data?.token) {
          console.error(`[useGetStreamRoom] No token in response (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, data);
          throw new Error(`GetStream token response missing token: ${JSON.stringify(data)}`);
        }

        return {
          token: data.token,
          callId: data.callId || roomName,
          userId: data.userId || userId,
        };
      } catch (err: any) {
        console.warn(`[useGetStreamRoom] Token fetch attempt ${attempt + 1} failed:`, err?.message || String(err));

        if (attempt < MAX_RETRIES) {
          return attemptFetch(attempt + 1);
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error(`GetStream token fetch failed and Supabase env is not configured: ${err?.message || String(err)}`);
        }

        const edgeFunctionsUrl = getEdgeFunctionsUrl();
        const tokenUrl = edgeFunctionsUrl
          ? `${edgeFunctionsUrl}/getstream-token`
          : `${supabaseUrl}/functions/v1/getstream-token`;

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
          console.error(`[useGetStreamRoom] Failed parsing fallback token response:`, parseErr);
          throw new Error(`GetStream token fallback response parse failed: ${parseErr?.message || String(parseErr)}`);
        }

        if (!response.ok) {
          console.error(`[useGetStreamRoom] Fallback token request failed: ${response.status}`, parsed);
          throw new Error(`GetStream token fallback request failed (${response.status}): ${parsed?.error || JSON.stringify(parsed)}`);
        }

        if (!parsed?.token) {
          console.error(`[useGetStreamRoom] Fallback token response missing token:`, parsed);
          throw new Error(`GetStream token fallback response missing token: ${JSON.stringify(parsed)}`);
        }

        console.log('[useGetStreamRoom] Got token via fallback fetch, room:', roomName, 'attempt:', attempt + 1);
        return {
          token: parsed.token,
          callId: parsed.callId || roomName,
          userId: parsed.userId || userId,
        };
      }
    };

    try {
      return await attemptFetch(0);
    } catch (err: any) {
      const rootMessage = err?.message || String(err) || 'Unknown token fetch error';
      console.error(`[useGetStreamRoom] Token fetch failed after all retries for room ${roomName}: ${rootMessage}`);
      throw new Error(`GetStream token fetch failed: ${rootMessage}`);
    }
  }, [publish, identity]);

  const initializeClient = useCallback(async (userId: string, userToken: string) => {
    const apiKey = import.meta.env.VITE_GETSTREAM_API_KEY;
    if (!apiKey) {
      throw new Error('Missing VITE_GETSTREAM_API_KEY environment variable');
    }

    if (!clientRef.current) {
      clientRef.current = StreamVideoClient.getOrCreateInstance({
        apiKey,
        user: { id: userId },
        token: userToken,
      });
    }
  }, []);

  const connectToCall = useCallback(async (callId: string, userId: string, userToken: string) => {
    if (!clientRef.current) {
      await initializeClient(userId, userToken);
    }

    const client = clientRef.current!;
    const call = client.call('default', callId);
    callRef.current = call;

    const remoteSubscription = call.state.remoteParticipants$.subscribe((participants) => {
      setRemoteUsers((previous) => {
        const previousByUserId = new Map(previous.map((participant) => [participant.userId, participant]));
        const nextByUserId = new Map(participants.map((participant) => [participant.userId, participant]));

        participants.forEach((participant) => {
          if (!previousByUserId.has(participant.userId)) onUserJoined?.(participant);
        });
        previous.forEach((participant) => {
          if (!nextByUserId.has(participant.userId)) onUserLeft?.(participant);
        });

        return participants.map((participant) => ({ ...participant }));
      });
    });
    const localSubscription = call.state.localParticipant$.subscribe((participant) => {
      const audioTrack = participant?.audioStream?.getAudioTracks()[0] || null;
      const videoTrack = participant?.videoStream?.getVideoTracks()[0] || null;
      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);
      setIsPublishing(Boolean(audioTrack || videoTrack));
    });
    callSubscriptionsRef.current = [remoteSubscription, localSubscription];

    await call.join({ create: true });
    setIsConnected(true);
    return call;
  }, [initializeClient, onUserJoined, onUserLeft]);

  const joinAsPublisher = useCallback(async (userId: string, tokenOverride?: string | null) => {
    if (joinedRef.current) {
      console.warn('[useGetStreamRoom] Join prevented: already joined');
      return callRef.current;
    }

    if (joiningRef.current) {
      console.warn('[useGetStreamRoom] Join prevented: already joining');
      let attempts = 0;
      while (joiningRef.current && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      return callRef.current;
    }

    if (!roomId || !userId) {
      console.warn('[useGetStreamRoom] Join prevented: missing params');
      return;
    }

    joiningRef.current = true;
    setIsJoining(true);
    setError(null);
    localUserIdRef.current = userId;

    try {
      const roomName = roomId;
      const { token, callId, userId: tokenUserId } = tokenOverride
        ? { token: tokenOverride, callId: roomName, userId }
        : await fetchToken(roomName, userId, userName, true, undefined, 'broadcaster');

      await initializeClient(tokenUserId, token);
      const call = await connectToCall(callId, tokenUserId, token);

      if (!audioOnly) await call.camera.enable();
      if (initialAudioEnabled) await call.microphone.enable();
      setIsPublishing(true);

      joinedRef.current = true;
      setIsConnected(true);
      setIsJoining(false);
      joiningRef.current = false;

      return call;
    } catch (err: any) {
      console.error('[useGetStreamRoom] Error joining as publisher:', err);
      setError(err?.message || 'Failed to join room');
      setIsJoining(false);
      joiningRef.current = false;
      onError?.(err?.message || 'Failed to join room');
      throw err;
    }
  }, [roomId, fetchToken, initializeClient, connectToCall, onError, userName, audioOnly, initialAudioEnabled]);

  const joinAsAudience = useCallback(async (userIdOrParam: string | { userId?: string; streamId?: string; roomName?: string; viewerIdentity?: string; publishCapable?: boolean }) => {
    let userId: string;
    let providedStreamId: string | undefined;
    let providedRoomName: string | undefined;
    let publishCapable = false;

    if (typeof userIdOrParam === 'string') {
      userId = userIdOrParam;
    } else {
      userId = userIdOrParam.userId || userIdOrParam.viewerIdentity || '';
      providedStreamId = userIdOrParam.streamId;
      providedRoomName = userIdOrParam.roomName;
      publishCapable = !!userIdOrParam.publishCapable;
    }

    if (joinedRef.current) {
      const currentCall = callRef.current;
      if (publishCapable && currentCall) {
        try {
          await currentCall.leave();
        } catch {
          // ignore
        }
        joinedRef.current = false;
        callRef.current = null;
      } else {
        return currentCall;
      }
    }

    if (joiningRef.current) {
      console.log('[useGetStreamRoom] Join prevented: already joining');
      return callRef.current;
    }

    if (!roomId || !userId) {
      console.warn('[useGetStreamRoom] Join prevented: missing params');
      return;
    }

    joiningRef.current = true;
    setIsJoining(true);
    setError(null);
    localUserIdRef.current = userId;

    try {
      const roomName = providedRoomName || roomId;
      const { token, callId, userId: tokenUserId } = await fetchToken(
        roomName,
        userId,
        userName,
        publishCapable,
        providedStreamId ? JSON.stringify({ streamId: providedStreamId }) : undefined,
        publishCapable ? 'seat-publisher' : 'audience'
      );

      await initializeClient(tokenUserId, token);
      const call = await connectToCall(callId, tokenUserId, token);

      if (publishCapable) {
        if (!audioOnly) await call.camera.enable();
        if (initialAudioEnabled) await call.microphone.enable();
        setIsPublishing(true);
      }

      joinedRef.current = true;
      setIsConnected(true);
      setIsJoining(false);
      joiningRef.current = false;

      return call;
    } catch (err: any) {
      console.error('[useGetStreamRoom] Error joining as audience:', err);
      const rootMessage = err?.message || 'Failed to join room';
      setError(rootMessage);
      setIsJoining(false);
      joiningRef.current = false;
      onError?.(rootMessage);
      return rootMessage;
    }
  }, [roomId, fetchToken, initializeClient, connectToCall, onError, userName, audioOnly, initialAudioEnabled]);

  const leaveRoom = useCallback(async () => {
    try {
      callSubscriptionsRef.current.forEach((subscription) => subscription.unsubscribe());
      callSubscriptionsRef.current = [];

      if (callRef.current) {
        await callRef.current.leave();
        callRef.current = null;
      }

      if (clientRef.current) {
        await clientRef.current.disconnectUser();
        clientRef.current = null;
      }

      joinedRef.current = false;
      joiningRef.current = false;
      localUserIdRef.current = null;
      setIsConnected(false);
      setIsPublishing(false);
      setRemoteUsers([]);
      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
    } catch (err) {
      console.error('[useGetStreamRoom] Error leaving room:', err);
      joinedRef.current = false;
      joiningRef.current = false;
      callRef.current = null;
      callSubscriptionsRef.current.forEach((subscription) => subscription.unsubscribe());
      callSubscriptionsRef.current = [];
      clientRef.current = null;
      setIsConnected(false);
      setIsPublishing(false);
    }
  }, []);

  const setCameraEnabled = useCallback(async (enabled: boolean) => {
    if (audioOnly) return false;

    const call = callRef.current;
    if (!call) return false;

    try {
      if (enabled) {
        await call.camera.enable();
      } else {
        await call.camera.disable();
      }
      return true;
    } catch (err) {
      console.error('[useGetStreamRoom] Error toggling camera:', err);
      return false;
    }
  }, [audioOnly]);

  const setMicrophoneEnabled = useCallback(async (enabled: boolean) => {
    const call = callRef.current;
    if (!call) return false;

    try {
      if (enabled) {
        await call.microphone.enable();
      } else {
        await call.microphone.disable();
      }
      return true;
    } catch (err) {
      console.error('[useGetStreamRoom] Error toggling microphone:', err);
      return false;
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    const call = callRef.current;
    if (!call || audioOnly) return false;

    const isEnabled = localVideoTrack?.enabled ?? false;
    return setCameraEnabled(!isEnabled);
  }, [audioOnly, localVideoTrack, setCameraEnabled]);

  const toggleMicrophone = useCallback(async () => {
    const call = callRef.current;
    if (!call) return false;

    const isEnabled = localAudioTrack?.enabled ?? false;
    return setMicrophoneEnabled(!isEnabled);
  }, [localAudioTrack, setMicrophoneEnabled]);

  const disconnect = useCallback(async () => {
    await leaveRoom();
  }, [leaveRoom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (joinedRef.current) {
        leaveRoom();
      }
    };
  }, [leaveRoom]);

  return {
    isConnected,
    isPublishing,
    isJoining,
    remoteUsers,
    localVideoTrack,
    localAudioTrack,
    error,
    joinAsPublisher,
    joinAsAudience,
    leaveRoom,
    setCameraEnabled,
    setMicrophoneEnabled,
    toggleCamera,
    toggleMicrophone,
    disconnect,
    call: callRef.current,
    client: clientRef.current,
  };
}