import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  fetchMaiVoiceRoomSettings,
  maiVoiceChannel,
  runMaiVoiceMaintenance,
  setMaiVoiceOptIn as apiSetOptIn,
  type MaiVoiceClip,
  type MaiVoiceMessageMeta,
  type MaiVoiceRoomKind,
  type MaiVoiceRoomSettings,
} from '../lib/maiVoice';

interface UseMaiVoiceRoomOptions {
  roomKind: MaiVoiceRoomKind;
  roomId: string | null | undefined;
  /** Set to false to keep the hook completely inert (e.g. chat is closed). */
  enabled?: boolean;
}

export interface MaiVoiceRoomState {
  settings: MaiVoiceRoomSettings | null;
  myOptIn: boolean;
  loading: boolean;
  /** LiveKit room the broadcast is running in. */
  livekitRoomName: string | null;
  /** True when this user may publish the room's voice (broadcaster/admin). */
  canPublishVoice: boolean;
  /** Clips waiting for their scheduled start time. */
  pendingClips: MaiVoiceClip[];
  /** The clip that is currently being played. */
  activeClip: MaiVoiceClip | null;
  /** Metadata of every recorded voice message seen in this room. */
  voiceMessages: MaiVoiceMessageMeta[];
  /** Ids of voice messages a moderator removed. */
  removedMessageIds: string[];
  /** True while the broadcaster has paused playback. */
  playbackPaused: boolean;
  /** True when the room allows recorded voice messages. */
  voiceChatEnabled: boolean;
  /** True when the room allows chat to be spoken. */
  ttsEnabled: boolean;
  refresh: () => Promise<void>;
  setMyOptIn: (enabled: boolean) => Promise<boolean>;
  /** Marks a queued clip as the one that is currently playing. */
  beginClip: (queueItemId: string) => void;
  /** Called by the player once a clip finished (or failed). */
  completeClip: (queueItemId: string, outcome: 'played' | 'failed') => void;
  /** Removes a clip from the pending queue without playing it (e.g. it expired). */
  dropClip: (queueItemId: string) => void;
}

/**
 * Subscribes to the room's Mai Voice realtime topic and exposes everything the
 * chat UI needs: broadcaster settings, the personal "speak my messages"
 * opt-in, the playback queue and the recorded voice messages.
 */
export function useMaiVoiceRoom({
  roomKind,
  roomId,
  enabled = true,
}: UseMaiVoiceRoomOptions): MaiVoiceRoomState {
  const [settings, setSettings] = useState<MaiVoiceRoomSettings | null>(null);
  const [myOptIn, setMyOptInState] = useState(false);
  const [loading, setLoading] = useState(false);
  const [livekitRoomName, setLivekitRoomName] = useState<string | null>(null);
  const [canPublishVoice, setCanPublishVoice] = useState(false);
  const [pendingClips, setPendingClips] = useState<MaiVoiceClip[]>([]);
  const [activeClip, setActiveClip] = useState<MaiVoiceClip | null>(null);
  const [voiceMessages, setVoiceMessages] = useState<MaiVoiceMessageMeta[]>([]);
  const [removedMessageIds, setRemovedMessageIds] = useState<string[]>([]);
  const [playbackPaused, setPlaybackPaused] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activeClipRef = useRef<MaiVoiceClip | null>(null);

  useEffect(() => {
    activeClipRef.current = activeClip;
  }, [activeClip]);

  const refresh = useCallback(async () => {
    if (!roomId || !enabled) return;
    setLoading(true);
    try {
      const result = await fetchMaiVoiceRoomSettings(roomKind, roomId);
      if (result.ok) {
        setSettings(result.data.settings ?? null);
        setMyOptInState(result.data.my_opt_in === true);
        setPlaybackPaused(result.data.settings?.playback_paused === true);
        setLivekitRoomName(result.data.livekit_room_name ?? null);
        setCanPublishVoice(result.data.can_publish_voice === true);
      }
    } finally {
      setLoading(false);
    }
  }, [roomKind, roomId, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime subscription for the room.
  useEffect(() => {
    if (!roomId || !enabled) return;

    const channel = supabase.channel(maiVoiceChannel(roomKind, roomId), {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'voice_play' }, (message: any) => {
      const clip = message?.payload as MaiVoiceClip | undefined;
      if (!clip || !clip.queue_item_id) return;
      if (clip.room_id !== roomId || clip.room_kind !== roomKind) return;

      setPendingClips((prev) => {
        if (prev.some((item) => item.queue_item_id === clip.queue_item_id)) return prev;
        // LiveKit delivery is mutually exclusive with local playback: the clip
        // arrives through the LiveKit audio track instead of the signed URL.
        if (clip.delivery === 'livekit') return prev;
        return [...prev, clip];
      });
    });

    channel.on('broadcast', { event: 'voice_message' }, (message: any) => {
      const meta = message?.payload as MaiVoiceMessageMeta | undefined;
      if (!meta || !meta.message_id) return;
      if (meta.room_id !== roomId || meta.room_kind !== roomKind) return;
      setVoiceMessages((prev) => {
        if (prev.some((item) => item.message_id === meta.message_id)) return prev;
        return [meta, ...prev].slice(0, 25);
      });
    });

    channel.on('broadcast', { event: 'voice_state' }, (message: any) => {
      const payload = message?.payload as { action?: string } | undefined;
      if (!payload?.action) return;
      if (payload.action === 'pause') setPlaybackPaused(true);
      if (payload.action === 'resume') setPlaybackPaused(false);
      if (payload.action === 'clear' || payload.action === 'skip') {
        setPendingClips([]);
        setActiveClip(null);
      }
    });

    channel.on('broadcast', { event: 'voice_removed' }, (message: any) => {
      const payload = message?.payload as { message_id?: string } | undefined;
      if (!payload?.message_id) return;
      setRemovedMessageIds((prev) =>
        prev.includes(payload.message_id!) ? prev : [...prev, payload.message_id!],
      );
      setVoiceMessages((prev) => prev.filter((item) => item.message_id !== payload.message_id));
      setPendingClips((prev) => prev.filter((item) => item.message_id !== payload.message_id));
    });

    channel.on('broadcast', { event: 'voice_settings' }, (message: any) => {
      const payload = message?.payload as { settings?: Partial<MaiVoiceRoomSettings> } | undefined;
      if (!payload?.settings) return;
      setSettings((prev) => (prev ? { ...prev, ...payload.settings } : (prev as any)));
      if (typeof payload.settings.playback_paused === 'boolean') {
        setPlaybackPaused(payload.settings.playback_paused);
      }
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomKind, roomId, enabled]);

  // Recorded voice messages expire one minute after they were sent.
  useEffect(() => {
    if (!voiceMessages.length) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setVoiceMessages((prev) => prev.filter((item) => new Date(item.expires_at).getTime() > now));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [voiceMessages.length]);

  // Ask the server to drop the expired clips and voice messages (rows plus the
  // objects in the `mai-voice` bucket). Without this the storage objects of the
  // one minute lifetime would pile up.
  useEffect(() => {
    if (!enabled || !roomId) return;
    let cancelled = false;
    const ping = () => {
      if (cancelled) return;
      void runMaiVoiceMaintenance();
    };
    ping();
    const timer = window.setInterval(ping, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, roomId]);

  const setMyOptIn = useCallback(
    async (next: boolean) => {
      if (!roomId) return false;
      const result = await apiSetOptIn(roomKind, roomId, next);
      if (result.ok) {
        setMyOptInState(result.data.tts_enabled === true);
        return true;
      }
      return false;
    },
    [roomKind, roomId],
  );

  const beginClip = useCallback((queueItemId: string) => {
    setPendingClips((prev) => {
      const clip = prev.find((item) => item.queue_item_id === queueItemId);
      if (clip) setActiveClip(clip);
      return prev;
    });
  }, []);

  const completeClip = useCallback((queueItemId: string, outcome: 'played' | 'failed') => {
    setActiveClip((current) => (current && current.queue_item_id === queueItemId ? null : current));
    setPendingClips((prev) => prev.filter((item) => item.queue_item_id !== queueItemId));
    if (outcome === 'failed') {
      // Nothing else to do — the clip simply does not play for this client.
    }
  }, []);

  const dropClip = useCallback((queueItemId: string) => {
    setPendingClips((prev) => prev.filter((item) => item.queue_item_id !== queueItemId));
    setActiveClip((current) => (current && current.queue_item_id === queueItemId ? null : current));
  }, []);

  return useMemo(
    () => ({
      settings,
      myOptIn,
      loading,
      livekitRoomName,
      canPublishVoice,
      pendingClips,
      activeClip,
      voiceMessages,
      removedMessageIds,
      playbackPaused,
      voiceChatEnabled: settings?.voice_chat_enabled !== false,
      ttsEnabled: settings?.tts_enabled === true,
      refresh,
      setMyOptIn,
      beginClip,
      completeClip,
      dropClip,
    }),
    [
      settings,
      myOptIn,
      loading,
      livekitRoomName,
      canPublishVoice,
      pendingClips,
      activeClip,
      voiceMessages,
      removedMessageIds,
      playbackPaused,
      refresh,
      setMyOptIn,
      beginClip,
      completeClip,
      dropClip,
    ],
  );
}
