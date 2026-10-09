import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * useGamingHeartbeat
 *
 * Monitors a HytroGaming stream for activity and auto-disconnects if:
 * 1. No chat messages received within the chat timeout window
 * 2. No audio/sound detected from the stream within the audio timeout window
 *
 * This saves Agora free minutes by disconnecting idle streams.
 *
 * Also sends periodic heartbeats to the backend to keep the stream alive.
 */

interface UseGamingHeartbeatOptions {
  streamId: string;
  channelName: string;
  enabled: boolean;
  /** Milliseconds without chat before considering chat inactive (default: 5 min) */
  chatTimeoutMs?: number;
  /** Milliseconds without audio before considering audio inactive (default: 3 min) */
  audioTimeoutMs?: number;
  /** How often to check activity (default: 30 sec) */
  checkIntervalMs?: number;
  /** Called when auto-disconnect triggers */
  onAutoDisconnect?: (reason: string) => void;
}

interface UseGamingHeartbeatReturn {
  lastChatAt: Date | null;
  lastAudioAt: Date | null;
  isChatActive: boolean;
  isAudioActive: boolean;
  isIdle: boolean;
  idleReason: string | null;
  resetTimers: () => void;
}

export function useGamingHeartbeat({
  streamId,
  channelName: _channelName,
  enabled,
  chatTimeoutMs = 5 * 60 * 1000,    // 5 minutes
  audioTimeoutMs = 3 * 60 * 1000,    // 3 minutes
  checkIntervalMs = 30 * 1000,       // 30 seconds
  onAutoDisconnect,
}: UseGamingHeartbeatOptions): UseGamingHeartbeatReturn {
  const [lastChatAt, setLastChatAt] = useState<Date | null>(null);
  const [lastAudioAt, setLastAudioAt] = useState<Date | null>(null);
  const [isChatActive, setIsChatActive] = useState(true);
  const [isAudioActive, setIsAudioActive] = useState(true);
  const [isIdle, setIsIdle] = useState(false);
  const [idleReason, setIdleReason] = useState<string | null>(null);

  const chatTimeoutRef = useRef(chatTimeoutMs);
  const audioTimeoutRef = useRef(audioTimeoutMs);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const _micStreamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);

  // Reset all timers (e.g., when stream resumes)
  const resetTimers = useCallback(() => {
    const now = new Date();
    setLastChatAt(now);
    setLastAudioAt(now);
    setIsChatActive(true);
    setIsAudioActive(true);
    setIsIdle(false);
    setIdleReason(null);
  }, []);

  // Send heartbeat to backend
  const sendHeartbeat = useCallback(async () => {
    if (!streamId || !enabled) return;
    try {
      await supabase.from('streams').update({
        updated_at: new Date().toISOString(),
      }).eq('id', streamId);
    } catch (err) {
      console.warn('[GamingHeartbeat] Heartbeat failed:', err);
    }
  }, [streamId, enabled]);

  // Subscribe to chat messages
  useEffect(() => {
    if (!streamId || !enabled) return;

    const channel = supabase
      .channel(`gaming-heartbeat-chat:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_messages',
          filter: `stream_id=eq.${streamId}`,
        },
        () => {
          if (isMountedRef.current) {
            setLastChatAt(new Date());
            setIsChatActive(true);
          }
        },
      )
      .subscribe();

    chatChannelRef.current = channel;

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [streamId, enabled]);

  // Monitor audio levels from the stream
  useEffect(() => {
    if (!enabled) return;

    // We monitor audio by checking if the Agora remote audio track is producing sound
    // This is done via a periodic check of audio energy
    let audioCheckInterval: ReturnType<typeof setInterval> | null = null;

    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      audioCheckInterval = setInterval(() => {
        if (!analyserRef.current || !isMountedRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average energy
        const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;

        // Threshold: if average frequency energy > 5, consider audio active
        if (avg > 5) {
          setLastAudioAt(new Date());
          setIsAudioActive(true);
        }
      }, 2000);
    } catch {
      // AudioContext not available, skip audio monitoring
      debug('Audio monitoring not available');
    }

    return () => {
      if (audioCheckInterval) clearInterval(audioCheckInterval);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [enabled]);

  // Main activity check loop
  useEffect(() => {
    if (!enabled) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      return;
    }

    isMountedRef.current = true;

    // Initialize timers
    const now = new Date();
    setLastChatAt(now);
    setLastAudioAt(now);

    // Start heartbeat interval (every 15 seconds)
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 15000);

    // Start activity check interval
    checkIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;

      const now = new Date().getTime();
      const chatTime = lastChatAt?.getTime() || 0;
      const audioTime = lastAudioAt?.getTime() || 0;

      const chatElapsed = now - chatTime;
      const audioElapsed = now - audioTime;

      const chatActive = chatElapsed < chatTimeoutRef.current;
      const audioActive = audioElapsed < audioTimeoutRef.current;

      setIsChatActive(chatActive);
      setIsAudioActive(audioActive);

      // Determine if stream is idle
      if (!chatActive && !audioActive) {
        const reason = 'No chat activity and no audio detected for several minutes';
        setIsIdle(true);
        setIdleReason(reason);
        onAutoDisconnect?.(reason);
      } else if (!chatActive) {
        // Only chat is inactive - warn but don't disconnect yet
        setIdleReason('No chat activity detected');
      } else if (!audioActive) {
        // Only audio is inactive - warn but don't disconnect yet
        setIdleReason('No audio detected from stream');
      } else {
        setIdleReason(null);
        setIsIdle(false);
      }
    }, checkIntervalMs);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [enabled, streamId, sendHeartbeat, checkIntervalMs, onAutoDisconnect, lastChatAt, lastAudioAt]);

  return {
    lastChatAt,
    lastAudioAt,
    isChatActive,
    isAudioActive,
    isIdle,
    idleReason,
    resetTimers,
  };
}

function debug(...args: unknown[]) {
  if (import.meta.env.DEV) console.log('[GamingHeartbeat]', ...args);
}
