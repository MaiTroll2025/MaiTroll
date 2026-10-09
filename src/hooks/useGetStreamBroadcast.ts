// src/hooks/useGetStreamBroadcast.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared GetStream.io session logic for the BROADCASTER experience.
// Mirrors useLiveBroadcast but uses GetStream.io instead of LiveKit.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { StreamVideoClient, type Call, type StreamVideoParticipant } from '@stream-io/video-client';
import { supabase } from '@/lib/supabase';

export interface GetStreamBroadcastSession {
  callRef: React.MutableRefObject<Call | null>;
  clientRef: React.MutableRefObject<StreamVideoClient | null>;
  localVideoTrack: MediaStreamTrack | null;
  localAudioTrack: MediaStreamTrack | null;
  cameraFacingMode: 'user' | 'environment';
  cameraEnabled: boolean;
  micEnabled: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  remoteParticipants: Map<string, StreamVideoParticipant>;
  connect: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleMicrophone: () => Promise<void>;
  flipCamera: () => Promise<void>;
  disconnect: () => void;
}

interface UseGetStreamBroadcastOptions {
  streamId: string;
  isHost: boolean;
  videoPreset?: { resolution: { width: number; height: number } };
  facingMode?: 'user' | 'environment';
  onConnected?: (call: Call) => void;
}

export function useGetStreamBroadcast({
  streamId,
  isHost: _isHost,
  facingMode = 'user',
  onConnected,
}: UseGetStreamBroadcastOptions): GetStreamBroadcastSession {
  const callRef = useRef<Call | null>(null);
  const clientRef = useRef<StreamVideoClient | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, StreamVideoParticipant>>(new Map());
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>(facingMode);

  const callSubscriptionsRef = useRef<Array<{ unsubscribe: () => void }>>([]);
  const currentCallIdRef = useRef<string | null>(null);

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

  const fetchToken = useCallback(async (roomName: string, userId: string, userName?: string) => {
    const MAX_RETRIES = 2;
    const RETRY_DELAYS = [1000, 2000];
    const REQUEST_TIMEOUT = 15000;

    const attemptFetch = async (attempt: number): Promise<{ token: string; callId: string; userId: string }> => {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt - 1] || 1000));
      }

      const requestBody: Record<string, any> = {
        room: roomName,
        roomName,
        identity: userId,
        name: userName || 'Broadcaster',
        role: 'publisher',
        canPublish: true,
        canSubscribe: true,
        mode: 'broadcaster',
      };

      try {
        const { data, error: tokenError } = await supabase.functions.invoke('getstream-token', {
          body: requestBody,
        });

        if (tokenError) {
          const statusCode = tokenError?.status || tokenError?.statusCode || tokenError?.status_code || null;
          const bodyText = tokenError?.body || tokenError?.message || JSON.stringify(tokenError);
          console.error(`[useGetStreamBroadcast] Error fetching token (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${statusCode} ${bodyText}`);
          throw new Error(`GetStream token failed: ${statusCode ? statusCode + ' ' : ''}${String(bodyText)}`);
        }

        if (!data?.token) {
          console.error(`[useGetStreamBroadcast] No token in response (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, data);
          throw new Error(`GetStream token response missing token: ${JSON.stringify(data)}`);
        }

        return {
          token: data.token,
          callId: data.callId || roomName,
          userId: data.userId || userId,
        };
      } catch (err: any) {
        console.warn(`[useGetStreamBroadcast] Token fetch attempt ${attempt + 1} failed:`, err?.message || String(err));

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
          console.error(`[useGetStreamBroadcast] Failed parsing fallback token response:`, parseErr);
          throw new Error(`GetStream token fallback response parse failed: ${parseErr?.message || String(parseErr)}`);
        }

        if (!response.ok) {
          console.error(`[useGetStreamBroadcast] Fallback token request failed: ${response.status}`, parsed);
          throw new Error(`GetStream token fallback request failed (${response.status}): ${parsed?.error || JSON.stringify(parsed)}`);
        }

        if (!parsed?.token) {
          console.error(`[useGetStreamBroadcast] Fallback token response missing token:`, parsed);
          throw new Error(`GetStream token fallback response missing token: ${JSON.stringify(parsed)}`);
        }

        console.log('[useGetStreamBroadcast] Got token via fallback fetch, room:', roomName, 'attempt:', attempt + 1);
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
      console.error(`[useGetStreamBroadcast] Token fetch failed after all retries for room ${roomName}: ${rootMessage}`);
      throw new Error(`GetStream token fetch failed: ${rootMessage}`);
    }
  }, []);

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

  const syncRemoteParticipantSnapshots = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    const next = new Map<string, StreamVideoParticipant>();
    call.state.remoteParticipants.forEach((participant) => {
      next.set(participant.userId, participant);
    });
    setRemoteParticipants(next);
  }, []);

  const attachCallHandlers = useCallback((call: Call) => {
    const remoteSubscription = call.state.remoteParticipants$.subscribe(
      syncRemoteParticipantSnapshots,
    );
    const localSubscription = call.state.localParticipant$.subscribe((participant) => {
      const audioTrack = participant?.audioStream?.getAudioTracks()[0] || null;
      const videoTrack = participant?.videoStream?.getVideoTracks()[0] || null;
      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);
      setMicEnabled(Boolean(audioTrack?.enabled));
      setCameraEnabled(Boolean(videoTrack?.enabled));
    });
    callSubscriptionsRef.current = [remoteSubscription, localSubscription];
  }, [syncRemoteParticipantSnapshots]);

  const detachCallHandlers = useCallback((call: Call) => {
    void call;
    callSubscriptionsRef.current.forEach((subscription) => subscription.unsubscribe());
    callSubscriptionsRef.current = [];
  }, []);

  const disconnectCall = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    try {
      detachCallHandlers(call);
    } catch (e) {
      console.warn('[useGetStreamBroadcast] Error detaching handlers:', e);
    }
    try {
      call.leave().catch(() => {});
    } catch {
      /* ignore */
    }
    callRef.current = null;
  }, [detachCallHandlers]);

  const disconnectClient = useCallback(async () => {
    if (clientRef.current) {
      try {
        await clientRef.current.disconnectUser();
      } catch {
        /* ignore */
      }
      clientRef.current = null;
    }
  }, []);

  const flipCameraTrack = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;

    const nextFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

    try {
      await call.camera.flip();
      setCurrentFacingMode(nextFacingMode);
    } catch (err) {
      console.warn('[useGetStreamBroadcast] flipCamera failed', err);
    }
  }, [currentFacingMode]);

  const connect = useCallback(async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      const expectedRoomName = streamId;

      let callToUse: Call | null = null;
      const tokenRequestPayload = { room: expectedRoomName, identity: `host_${streamId}`, role: 'host', metadata: { streamId } };
      console.log('[useGetStreamBroadcast][DEBUG] Fetching GetStream token with payload:', tokenRequestPayload);
      const tokenData = await fetchToken(expectedRoomName, `host_${streamId}`, 'Broadcaster');

      const callId = tokenData.callId;
      const tokenUserId = tokenData.userId;
      currentCallIdRef.current = callId;

      console.log('[useGetStreamBroadcast][DEBUG] Token response:', {
        callId,
        userId: tokenUserId,
      });

      if (!callToUse) {
        await initializeClient(tokenUserId, tokenData.token);
        const client = clientRef.current!;
        callToUse = client.call('default', callId);
        callRef.current = callToUse;
        attachCallHandlers(callToUse);
      }

      console.log('[useGetStreamBroadcast][DEBUG] Connecting to GetStream call:', {
        callId,
        callState: callToUse.state.callingState,
      });

      await callToUse.join({ create: true });
      await Promise.all([
        callToUse.camera.enable(),
        callToUse.microphone.enable(),
      ]);
      console.log('[useGetStreamBroadcast][DEBUG] Call joined:', {
        callId: callToUse.id,
        localParticipant: callToUse.state.localParticipant?.userId,
      });
      syncRemoteParticipantSnapshots();
      setIsConnected(true);
      onConnected?.(callToUse);
    } catch (err) {
      console.error('[useGetStreamBroadcast] connect failed', err);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [
    isConnecting,
    streamId,
    attachCallHandlers,
    fetchToken,
    initializeClient,
    onConnected,
    syncRemoteParticipantSnapshots,
  ]);

  const toggleCamera = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;
    const next = !cameraEnabled;
    try {
      if (next) {
        await call.camera.enable();
      } else {
        await call.camera.disable();
      }
      setCameraEnabled(next);
    } catch (err) {
      console.warn('[useGetStreamBroadcast] toggleCamera failed', err);
    }
  }, [cameraEnabled]);

  const toggleMicrophone = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;
    const next = !micEnabled;
    try {
      if (next) {
        await call.microphone.enable();
      } else {
        await call.microphone.disable();
      }
      setMicEnabled(next);
    } catch (err) {
      console.warn('[useGetStreamBroadcast] toggleMicrophone failed', err);
    }
  }, [micEnabled]);

  const flipCamera = useCallback(async () => {
    await flipCameraTrack();
  }, [flipCameraTrack]);

  const disconnect = useCallback(() => {
    disconnectCall();
    disconnectClient();
    setLocalVideoTrack(null);
    setLocalAudioTrack(null);
    setCameraEnabled(false);
    setMicEnabled(false);
    setIsConnected(false);
    setRemoteParticipants(new Map());
  }, [disconnectCall, disconnectClient]);

  // The GetStream call owns its session and closes it when the page unmounts.
  useEffect(() => {
    return () => {
      disconnectCall();
      void disconnectClient();
    };
  }, [disconnectCall, disconnectClient]);

  return {
    callRef,
    clientRef,
    localVideoTrack,
    localAudioTrack,
    cameraFacingMode: currentFacingMode,
    cameraEnabled,
    micEnabled,
    isConnecting,
    isConnected,
    remoteParticipants,
    connect,
    toggleCamera,
    toggleMicrophone,
    flipCamera,
    disconnect,
  };
}