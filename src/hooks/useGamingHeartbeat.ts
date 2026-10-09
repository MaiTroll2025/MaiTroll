import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * useGamingHeartbeat — Monitors a HytroGaming stream for activity.
 * Auto-disconnects if no chat + no audio for several minutes.
 * Uses refs for last-activity times to avoid stale closure issues.
 */

interface UseGamingHeartbeatOptions {
  streamId: string;
  channelName: string;
  enabled: boolean;
  chatTimeoutMs?: number;
  audioTimeoutMs?: number;
  checkIntervalMs?: number;
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
  chatTimeoutMs = 10 * 60 * 1000,
  audioTimeoutMs = 8 * 60 * 1000,
  checkIntervalMs = 30 * 1000,
  onAutoDisconnect,
}: UseGamingHeartbeatOptions): UseGamingHeartbeatReturn {
  const [lastChatAt, setLastChatAt] = useState<Date | null>(null);
  const [lastAudioAt, setLastAudioAt] = useState<Date | null>(null);
  const [isChatActive, setIsChatActive] = useState(true);
  const [isAudioActive, setIsAudioActive] = useState(true);
  const [isIdle, setIsIdle] = useState(false);
  const [idleReason, setIdleReason] = useState<string | null>(null);

  const lastChatAtRef = useRef<Date | null>(null);
  const lastAudioAtRef = useRef<Date | null>(null);
  const chatTimeoutRef = useRef(chatTimeoutMs);
  const audioTimeoutRef = useRef(audioTimeoutMs);
  const onAutoDisconnectRef = useRef(onAutoDisconnect);

  useEffect(() => { chatTimeoutRef.current = chatTimeoutMs; }, [chatTimeoutMs]);
  useEffect(() => { audioTimeoutRef.current = audioTimeoutMs; }, [audioTimeoutMs]);
  useEffect(() => { onAutoDisconnectRef.current = onAutoDisconnect; }, [onAutoDisconnect]);

  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isMountedRef = useRef(true);

  const resetTimers = useCallback(() => {
    const now = new Date();
    setLastChatAt(now); setLastAudioAt(now);
    lastChatAtRef.current = now; lastAudioAtRef.current = now;
    setIsChatActive(true); setIsAudioActive(true);
    setIsIdle(false); setIdleReason(null);
  }, []);

  const sendHeartbeat = useCallback(async () => {
    if (!streamId || !enabled) return;
    try {
      await supabase.from('streams').update({ updated_at: new Date().toISOString() }).eq('id', streamId);
    } catch { /* ignore */ }
  }, [streamId, enabled]);

  // Subscribe to chat messages
  useEffect(() => {
    if (!streamId || !enabled) return;
    const channel = supabase.channel(`gaming-hb-chat:${streamId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stream_messages', filter: `stream_id=eq.${streamId}` }, () => {
        if (isMountedRef.current) { const now = new Date(); setLastChatAt(now); lastChatAtRef.current = now; setIsChatActive(true); }
      }).subscribe();
    chatChannelRef.current = channel;
    return () => { 
      if (channel) {
        supabase.removeChannel(channel); 
      }
    };
  }, [streamId, enabled]);

  // Audio: active while stream is enabled
  useEffect(() => {
    if (!enabled) return;
    const now = new Date(); setLastAudioAt(now); lastAudioAtRef.current = now; setIsAudioActive(true);
  }, [enabled]);

  // Main activity check loop
  useEffect(() => {
    if (!enabled) {
      if (checkIntervalRef.current) { clearInterval(checkIntervalRef.current); checkIntervalRef.current = null; }
      if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null; }
      return;
    }
    isMountedRef.current = true;
    const now = new Date();
    setLastChatAt(now); setLastAudioAt(now); lastChatAtRef.current = now; lastAudioAtRef.current = now;
    setIsChatActive(true); setIsAudioActive(true); setIsIdle(false); setIdleReason(null);
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 15000);
    checkIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      const now = Date.now();
      const chatTime = lastChatAtRef.current?.getTime() || 0;
      const audioTime = lastAudioAtRef.current?.getTime() || 0;
      const chatActive = (now - chatTime) < chatTimeoutRef.current;
      const audioActive = (now - audioTime) < audioTimeoutRef.current;
      setIsChatActive(chatActive); setIsAudioActive(audioActive);
      if (!chatActive && !audioActive) {
        const reason = 'No chat activity and no audio detected for several minutes';
        setIsIdle(true); setIdleReason(reason);
        onAutoDisconnectRef.current?.(reason);
      } else if (!chatActive) { setIdleReason('No chat activity detected'); setIsIdle(false); }
      else if (!audioActive) { setIdleReason('No audio detected from stream'); setIsIdle(false); }
      else { setIdleReason(null); setIsIdle(false); }
    }, checkIntervalMs);
    return () => {
      if (checkIntervalRef.current) { clearInterval(checkIntervalRef.current); checkIntervalRef.current = null; }
      if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null; }
    };
  }, [enabled, streamId, sendHeartbeat, checkIntervalMs]);

  return { lastChatAt, lastAudioAt, isChatActive, isAudioActive, isIdle, idleReason, resetTimers };
}
