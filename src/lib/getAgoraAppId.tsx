import { useState, useRef, useCallback, useEffect } from 'react';
import AgoraRTC, {
  IAgoraRTCClient,
  ILocalVideoTrack,
  ILocalAudioTrack,
  UID,
} from 'agora-rtc-sdk-ng';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

/**
 * useAgoraScreenShare — Two-phase flow:
 *
 * Phase 1 — PREVIEW (no Agora connection):
 *   1. User clicks "Share Screen" → getDisplayMedia() → local preview
 *   2. User toggles camera/mic → all shown locally
 *   3. User adjusts scenes, overlays, etc.
 *
 * Phase 2 — GO LIVE (Agora connection):
 *   4. User clicks "Go Live" → join Agora → publish tracks → set is_live
 *
 * Phase 3 — END:
 *   5. User clicks "End Stream" → unpublish → leave Agora → set is_live=false, ended_at
 */

export interface AgoraScreenShareState {
  // Preview phase
  isPreviewing: boolean;
  screenStream: MediaStream | null;       // raw display MediaStream for local preview
  cameraStream: MediaStream | null;       // raw camera MediaStream for local preview
  micStream: MediaStream | null;          // raw mic MediaStream for local preview
  hasScreenTrack: boolean;
  hasMicTrack: boolean;
  hasCameraTrack: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;

  // Live phase
  isLive: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  isPaused: boolean;
  error: string | null;
  channelName: string | null;

  // Agora tracks (for publishing)
  screenTrack: ILocalVideoTrack | null;
  micTrack: ILocalAudioTrack | null;
  cameraTrack: ILocalVideoTrack | null;
}

export interface AgoraScreenShareActions {
  startPreview: () => Promise<void>;       // Phase 1: get display media, show locally
  goLive: (channelName: string, streamId: string) => Promise<void>;  // Phase 2: join Agora + publish
  endStream: () => Promise<void>;          // Phase 3: full disconnect
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  stopPreview: () => void;                 // stop everything, back to idle
}

export function useAgoraScreenShare(): AgoraScreenShareState & AgoraScreenShareActions {
  // Preview state
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [hasScreenTrack, setHasScreenTrack] = useState(false);
  const [hasMicTrack, setHasMicTrack] = useState(false);
  const [hasCameraTrack, setHasCameraTrack] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);

  // Live state
  const [isLive, setIsLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);

  // Agora tracks
  const [screenTrack, setScreenTrack] = useState<ILocalVideoTrack | null>(null);
  const [micTrack, setMicTrack] = useState<ILocalAudioTrack | null>(null);
  const [cameraTrack, setCameraTrack] = useState<ILocalVideoTrack | null>(null);

  // Refs
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const cameraClientRef = useRef<IAgoraRTCClient | null>(null);
  const joinedRef = useRef(false);
  const cameraJoinedRef = useRef(false);
  const screenTrackRef = useRef<ILocalVideoTrack | null>(null);
  const micTrackRef = useRef<ILocalAudioTrack | null>(null);
  const cameraTrackRef = useRef<ILocalVideoTrack | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);

  const getAgoraAppId = () => import.meta.env.VITE_AGORA_APP_ID;
  const debug = (...args: unknown[]) => { if (import.meta.env.DEV) console.log('[AgoraScreenShare]', ...args); };

  const getUserUid = (uid: string): UID => {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) { hash = (hash << 5) - hash + uid.charCodeAt(i); hash |= 0; }
    return Math.abs(hash) % 4294967295;
  };

  const getCameraUid = (uid: string): UID => getUserUid(`${uid}-camera`);

  const fetchToken = useCallback(async (channel: string, uid: UID): Promise<string> => {
    const response = await supabase.functions.invoke('agora-token', {
      body: { channel, userId: uid.toString(), tokenType: 'rtc', role: 'publisher' },
    });
    const { data, error: err } = response as any;
    if (err) throw new Error(`Token error: ${err.message}`);
    if (!data?.token) throw new Error('No token received');
    return data.token;
  }, []);

  // ── Phase 1: Start Preview (no Agora) ──
  const startPreview = useCallback(async () => {
    debug('Starting preview...');
    setError(null);
    try {
      // Get display media for preview
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' } as MediaTrackConstraints,
        audio: false,
      });
      if (!isMountedRef.current) { displayStream.getTracks().forEach(t => t.stop()); return; }

      displayStreamRef.current = displayStream;
      setScreenStream(displayStream);
      setHasScreenTrack(true);
      setIsPreviewing(true);

      // Handle user clicking "Stop sharing" from browser UI
      const vt = displayStream.getVideoTracks()[0];
      if (vt) { vt.onended = () => { debug('Screen share ended by browser UI'); stopPreview(); }; }

      // Auto-enable mic for preview
      try {
        const ms = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        micStreamRef.current = ms;
        setMicStream(ms);
        setHasMicTrack(true);
        setMicEnabled(true);
      } catch { debug('Mic not available'); }

      toast.success('Preview started — adjust your setup, then click Go Live');
    } catch (err: any) {
      console.error('[AgoraScreenShare] Preview failed:', err);
      setError(err?.message || 'Failed to start preview');
      if (err?.name === 'NotAllowedError') toast.error('Screen sharing was denied');
      else toast.error(err?.message || 'Failed to start preview');
    }
  }, []);

  // ── Phase 2: Go Live (join Agora + publish) ──
  const goLive = useCallback(async (chName: string, streamIdArg: string) => {
    if (!screenStream) { toast.error('Start preview first'); return; }
    setIsConnecting(true);
    setError(null);
    setChannelName(chName);
    setStreamId(streamIdArg);

    try {
      const appId = getAgoraAppId();
      if (!appId) throw new Error('VITE_AGORA_APP_ID not configured');

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      const uid = getUserUid(chName);
      const token = await fetchToken(chName, uid);
      debug('Joining Agora:', chName, 'uid:', uid);
      await client.join(appId, chName, token, uid);
      joinedRef.current = true;

      // Create Agora screen track from the existing display stream
      const displayVideoTrack = displayStreamRef.current?.getVideoTracks()[0];
      if (displayVideoTrack) {
        const st = AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: displayVideoTrack });
        screenTrackRef.current = st;
        setScreenTrack(st);
      }

      // Create Agora mic track from existing mic stream
      let micAgoraTrack: ILocalAudioTrack | null = null;
      const micMediaTrack = micStreamRef.current?.getAudioTracks()[0];
      if (micMediaTrack) {
        micAgoraTrack = AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: micMediaTrack });
        micTrackRef.current = micAgoraTrack;
        setMicTrack(micAgoraTrack);
      }

      // Create Agora camera track from existing camera stream.
      let camAgoraTrack: ILocalVideoTrack | null = null;
      const camMediaTrack = cameraStreamRef.current?.getVideoTracks()[0];
      if (camMediaTrack) {
        camAgoraTrack = AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: camMediaTrack });
        cameraTrackRef.current = camAgoraTrack;
        setCameraTrack(camAgoraTrack);
      }

      // Publish main stream tracks (screen + mic) on the primary client.
      const toPublish: (ILocalVideoTrack | ILocalAudioTrack)[] = [];
      if (screenTrackRef.current) toPublish.push(screenTrackRef.current);
      if (micAgoraTrack) toPublish.push(micAgoraTrack);
      if (toPublish.length > 0) {
        await client.publish(toPublish);
      }
      debug('Published primary client tracks', toPublish.length);

      // If camera is enabled, create a secondary Agora client to publish it separately.
      if (camAgoraTrack) {
        const cameraUid = getCameraUid(chName);
        const cameraToken = await fetchToken(chName, cameraUid);
        const cameraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        cameraClientRef.current = cameraClient;
        await cameraClient.join(getAgoraAppId()!, chName, cameraToken, cameraUid);
        cameraJoinedRef.current = true;
        await cameraClient.publish([camAgoraTrack]);
        debug('Published camera track on secondary client');
      }

      if (isMountedRef.current) {
        setIsLive(true);
        setIsConnected(true);
        setIsConnecting(false);
      }
    } catch (err: any) {
      console.error('[AgoraScreenShare] Go live failed:', err);
      if (isMountedRef.current) {
        setError(err?.message || 'Failed to go live');
        setIsConnecting(false);
      }
      toast.error(err?.message || 'Failed to go live');
    }
  }, [screenStream, fetchToken]);

  // ── Phase 3: End Stream (full disconnect) ──
  const endStream = useCallback(async () => {
    debug('Ending stream — full disconnect...');
    try {
      // 1. Unpublish all tracks from the main Agora client.
      if (clientRef.current && joinedRef.current) {
        const toUnpublish: (ILocalVideoTrack | ILocalAudioTrack)[] = [];
        if (screenTrackRef.current) toUnpublish.push(screenTrackRef.current);
        if (micTrackRef.current) toUnpublish.push(micTrackRef.current);
        if (toUnpublish.length > 0) {
          try { await clientRef.current.unpublish(toUnpublish); } catch { /* ignore */ }
        }
        // 2. Leave the main Agora channel
        await clientRef.current.leave();
        joinedRef.current = false;
        debug('Left Agora main channel');
      }

      // 3. Unpublish and leave the camera Agora client if it exists.
      if (cameraClientRef.current && cameraJoinedRef.current) {
        if (cameraTrackRef.current) {
          try { await cameraClientRef.current.unpublish([cameraTrackRef.current]); } catch { /* ignore */ }
        }
        await cameraClientRef.current.leave();
        cameraJoinedRef.current = false;
        debug('Left Agora camera channel');
      }

      // 3. Stop all Agora tracks
      if (screenTrackRef.current) { screenTrackRef.current.stop(); screenTrackRef.current.close(); screenTrackRef.current = null; }
      if (micTrackRef.current) { micTrackRef.current.stop(); micTrackRef.current.close(); micTrackRef.current = null; }
      if (cameraTrackRef.current) { cameraTrackRef.current.stop(); cameraTrackRef.current.close(); cameraTrackRef.current = null; }
      if (cameraClientRef.current) { cameraClientRef.current = null; }

      // 4. Stop all media streams
      if (displayStreamRef.current) { displayStreamRef.current.getTracks().forEach(t => t.stop()); displayStreamRef.current = null; }
      if (cameraStreamRef.current) { cameraStreamRef.current.getTracks().forEach(t => t.stop()); cameraStreamRef.current = null; }
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }

      // 5. Update database — set is_live=false, ended_at
      const finalStreamId = streamId;
      if (finalStreamId) {
        try {
          await supabase.from('streams').update({
            is_live: false,
            status: 'ended',
            ended_at: new Date().toISOString(),
          }).eq('id', finalStreamId);
          debug('Database updated: is_live=false, ended_at set');
        } catch (dbErr) { console.warn('[AgoraScreenShare] DB update failed:', dbErr); }
      }
    } catch (err) {
      console.warn('[AgoraScreenShare] End stream error:', err);
    }

    // 6. Reset all state
    if (isMountedRef.current) {
      setIsLive(false);
      setIsConnected(false);
      setIsConnecting(false);
      setIsPreviewing(false);
      setHasScreenTrack(false);
      setHasMicTrack(false);
      setHasCameraTrack(false);
      setScreenStream(null);
      setCameraStream(null);
      setMicStream(null);
      setScreenTrack(null);
      setMicTrack(null);
      setCameraTrack(null);
      setChannelName(null);
      setStreamId(null);
      setError(null);
      setCameraEnabled(false);
      setMicEnabled(true);
    }
    toast.success('Stream ended');
  }, [streamId]);

  // ── Stop preview (back to idle) ──
  const stopPreview = useCallback(() => {
    debug('Stopping preview...');
    if (displayStreamRef.current) { displayStreamRef.current.getTracks().forEach(t => t.stop()); displayStreamRef.current = null; }
    if (cameraStreamRef.current) { cameraStreamRef.current.getTracks().forEach(t => t.stop()); cameraStreamRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    setIsPreviewing(false);
    setHasScreenTrack(false);
    setHasMicTrack(false);
    setHasCameraTrack(false);
    setScreenStream(null);
    setCameraStream(null);
    setMicStream(null);
    setCameraEnabled(false);
    setMicEnabled(true);
    setError(null);
  }, []);

  // ── Toggle mic ──
  const toggleMic = useCallback(async () => {
    if (!micEnabled) {
      // Enable mic
      try {
        const ms = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        micStreamRef.current = ms;
        setMicStream(ms);
        setHasMicTrack(true);
        setMicEnabled(true);

        // If already live, publish mic track
        if (clientRef.current && joinedRef.current) {
          const mt = AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: ms.getAudioTracks()[0] });
          micTrackRef.current = mt;
          setMicTrack(mt);
          await clientRef.current.publish([mt]);
        }
        toast.success('Microphone enabled');
      } catch { toast.error('Could not access microphone'); }
    } else {
      // Disable mic
      if (micTrackRef.current && clientRef.current && joinedRef.current) {
        try { await clientRef.current.unpublish([micTrackRef.current]); } catch { /* ignore */ }
        micTrackRef.current.stop(); micTrackRef.current.close(); micTrackRef.current = null;
        setMicTrack(null);
      }
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
      setMicStream(null);
      setHasMicTrack(false);
      setMicEnabled(false);
      toast.info('Microphone disabled');
    }
  }, [micEnabled]);

  // ── Toggle camera ──
  const toggleCamera = useCallback(async () => {
    if (!cameraEnabled) {
      // Enable camera
      try {
        const cs = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        });
        cameraStreamRef.current = cs;
        setCameraStream(cs);
        setHasCameraTrack(true);
        setCameraEnabled(true);

        // If already live, only publish camera if screen share is not active.
        if (clientRef.current && joinedRef.current) {
          if (cameraClientRef.current && cameraJoinedRef.current && cameraTrackRef.current) {
            const oldTrack = cameraTrackRef.current;
            const ct = AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: cs.getVideoTracks()[0] });
            cameraTrackRef.current = ct;
            setCameraTrack(ct);
            try {
              await cameraClientRef.current.unpublish([oldTrack]);
            } catch { /* ignore */ }
            oldTrack.stop();
            oldTrack.close();
            await cameraClientRef.current.publish([ct]);
            toast.success('Camera enabled and republished');
          } else if (screenTrackRef.current) {
            if (!channelName) {
              debug('No channel name available yet for camera publish');
            } else {
              try {
                const cameraUid = getCameraUid(channelName);
                const cameraToken = await fetchToken(channelName, cameraUid);
                const cameraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
                cameraClientRef.current = cameraClient;
                await cameraClient.join(getAgoraAppId()!, channelName, cameraToken, cameraUid);
                cameraJoinedRef.current = true;
                const ct = AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: cs.getVideoTracks()[0] });
                cameraTrackRef.current = ct;
                setCameraTrack(ct);
                await cameraClient.publish([ct]);
                toast.success('Camera enabled and published');
              } catch (publishErr) {
                console.error('[AgoraScreenShare] Camera publish failed:', publishErr);
                toast.error('Failed to publish camera');
              }
            }
          } else {
            const ct = AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: cs.getVideoTracks()[0] });
            cameraTrackRef.current = ct;
            setCameraTrack(ct);
            await clientRef.current.publish([ct]);
            toast.success('Camera enabled');
          }
        } else {
          toast.success('Camera enabled');
        }
      } catch (err: any) {
        console.error('[AgoraScreenShare] Camera error:', err);
        toast.error('Could not access camera');
      }
    } else {
      // Disable camera
      if (cameraTrackRef.current) {
        if (cameraClientRef.current && cameraJoinedRef.current) {
          try { await cameraClientRef.current.unpublish([cameraTrackRef.current]); } catch { /* ignore */ }
          try { await cameraClientRef.current.leave(); } catch { /* ignore */ }
          cameraJoinedRef.current = false;
          cameraClientRef.current = null;
        } else if (clientRef.current && joinedRef.current) {
          try { await clientRef.current.unpublish([cameraTrackRef.current]); } catch { /* ignore */ }
        }
        cameraTrackRef.current.stop();
        cameraTrackRef.current.close();
        cameraTrackRef.current = null;
        setCameraTrack(null);
      }
      if (cameraStreamRef.current) { cameraStreamRef.current.getTracks().forEach(t => t.stop()); cameraStreamRef.current = null; }
      setCameraStream(null);
      setHasCameraTrack(false);
      setCameraEnabled(false);
      toast.info('Camera disabled');
    }
  }, [cameraEnabled, channelName, fetchToken]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      screenTrackRef.current?.stop(); screenTrackRef.current?.close();
      micTrackRef.current?.stop(); micTrackRef.current?.close();
      cameraTrackRef.current?.stop(); cameraTrackRef.current?.close();
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
      displayStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      if (cameraClientRef.current && cameraJoinedRef.current) { cameraClientRef.current.leave().catch(() => {}); }
      if (clientRef.current && joinedRef.current) { clientRef.current.leave().catch(() => {}); }
    };
  }, []);

  return {
    isPreviewing, screenStream, cameraStream, micStream,
    hasScreenTrack, hasMicTrack, hasCameraTrack,
    micEnabled, cameraEnabled,
    isLive, isConnecting, isConnected, isPaused, error, channelName,
    screenTrack, micTrack, cameraTrack,
    startPreview, goLive, endStream, stopPreview, toggleMic, toggleCamera,
  };
}
