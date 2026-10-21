import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalAudioTrack, Room, Track } from 'livekit-client';
import { supabase } from '../lib/supabase';
import {
  maiVoiceChannel,
  maiVoicePublisherHeartbeat,
  requestMaiVoicePublisherToken,
  unregisterMaiVoicePublisher,
  type MaiVoiceClip,
  type MaiVoiceRoomKind,
} from '../lib/maiVoice';

interface UseMaiVoicePublisherOptions {
  roomKind: MaiVoiceRoomKind;
  roomId: string | null | undefined;
  /** LiveKit room the broadcast is running in. */
  livekitRoomName: string | null | undefined;
  /** The broadcaster's user id — only the broadcaster may publish voice. */
  userId: string | null | undefined;
  /** Set to false to keep the publisher completely inert. */
  enabled?: boolean;
}

export interface MaiVoicePublisherState {
  /** True while the publisher is connected to the LiveKit room. */
  connected: boolean;
  /** Last failure message, empty when everything is fine. */
  error: string;
}

/** How often the publisher tells the server it is still alive. */
const HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Publishes the room's Mai Voice clips to the audience over LiveKit.
 *
 * The server hands the clip to this client (it is the registered publisher of
 * the room) and every other participant deliberately skips local playback for
 * `delivery: 'livekit'` clips. The clip is therefore decoded here and pushed
 * into the room as an auxiliary audio track, so the whole audience hears the
 * same audio at the same moment.
 */
export function useMaiVoicePublisher({
  roomKind,
  roomId,
  livekitRoomName,
  userId,
  enabled = true,
}: UseMaiVoicePublisherOptions): MaiVoicePublisherState {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');

  const roomRef = useRef<Room | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const publishedTrackRef = useRef<LocalAudioTrack | null>(null);
  const startedRef = useRef(false);
  const handledClipsRef = useRef<Set<string>>(new Set());

  /*
   * The LiveKit room a broadcast runs in. Stream rooms use the stream id
   * unless the stream carries an explicit room name, battle rooms always use
   * the "battle-<id>" convention.
   */
  const roomName =
    livekitRoomName || (roomKind === 'battle' ? (roomId ? `battle-${roomId}` : '') : roomId || '');

  const teardown = useCallback(async () => {
    const track = publishedTrackRef.current;
    publishedTrackRef.current = null;
    if (track && roomRef.current) {
      try {
        await roomRef.current.localParticipant.unpublishTrack(track);
      } catch {
        // The room may already be gone — nothing to clean up.
      }
      try {
        track.stop();
      } catch {
        // ignore
      }
    }

    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      try {
        await room.disconnect();
      } catch {
        // ignore
      }
    }

    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context) {
      try {
        await context.close();
      } catch {
        // ignore
      }
    }

    setConnected(false);
  }, []);

  // Connect the hidden publisher participant and keep the server informed.
  useEffect(() => {
    if (!enabled || !roomId || !userId || !roomName) return;
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const start = async () => {
      try {
        const tokenResult = await requestMaiVoicePublisherToken(roomName);
        if (cancelled) return;

        if (!tokenResult.ok) {
          throw new Error(tokenResult.error || 'Could not obtain a Mai Voice publisher token.');
        }

        const url = import.meta.env.VITE_LIVEKIT_URL;
        if (!url) throw new Error('LiveKit is not configured.');

        const room = new Room({ adaptiveStream: false, dynacast: false });
        roomRef.current = room;
        await room.connect(url, tokenResult.data.token);

        if (cancelled) {
          await room.disconnect();
          return;
        }

        setConnected(true);
        setError('');

        const registration = await maiVoicePublisherHeartbeat(roomKind, roomId, roomName);
        if (!registration.ok) {
          console.warn('[MaiVoice] Publisher registration failed:', registration.error);
        }

        heartbeat = setInterval(() => {
          void maiVoicePublisherHeartbeat(roomKind, roomId, roomName);
        }, HEARTBEAT_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Mai Voice publisher failed.';
        console.warn('[MaiVoice] Publisher could not start:', message);
        setError(message);
      }
    };

    void start();

    return () => {
      cancelled = true;
      startedRef.current = false;
      if (heartbeat) clearInterval(heartbeat);
      void unregisterMaiVoicePublisher(roomKind, roomId);
      void teardown();
    };
  }, [enabled, roomId, roomName, userId, roomKind, teardown]);

  // Play the clips the server assigns to this publisher.
  useEffect(() => {
    if (!enabled || !roomId) return;

    const channel = supabase.channel(maiVoiceChannel(roomKind, roomId), {
      config: { broadcast: { self: false } },
    });

    const playClip = async (clip: MaiVoiceClip) => {
      const room = roomRef.current;
      if (!room || room.state !== 'connected') return;
      if (clip.delivery !== 'livekit') return;
      if (clip.publisher_user_id && clip.publisher_user_id !== userId) return;
      if (handledClipsRef.current.has(clip.queue_item_id)) return;
      handledClipsRef.current.add(clip.queue_item_id);

      try {
        const context =
          audioContextRef.current ??
          new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = context;
        if (context.state === 'suspended') {
          await context.resume().catch(() => undefined);
        }

        const response = await fetch(clip.url);
        if (!response.ok) throw new Error('Could not download the clip.');
        const bytes = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(bytes);

        const destination = context.createMediaStreamDestination();
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(destination);
        // The publisher hears the clip locally as well.
        source.connect(context.destination);

        const mediaTrack = destination.stream.getAudioTracks()[0];
        if (!mediaTrack) throw new Error('No audio track for the clip.');

        const localTrack = new LocalAudioTrack(mediaTrack, undefined, false);
        await room.localParticipant.publishTrack(localTrack, {
          source: Track.Source.ScreenShareAudio,
        });
        publishedTrackRef.current = localTrack;

        const delayMs = Math.max(0, (clip.play_at ?? Date.now()) - Date.now());
        source.start(context.currentTime + delayMs / 1000);

        source.onended = () => {
          void (async () => {
            if (publishedTrackRef.current === localTrack) {
              publishedTrackRef.current = null;
            }
            try {
              await room.localParticipant.unpublishTrack(localTrack);
            } catch {
              // ignore
            }
            try {
              localTrack.stop();
            } catch {
              // ignore
            }
          })();
        };
      } catch (err) {
        console.warn('[MaiVoice] Could not publish the clip:', err);
        handledClipsRef.current.delete(clip.queue_item_id);
      }
    };

    channel.on('broadcast', { event: 'voice_play' }, (message: any) => {
      const clip = message?.payload as MaiVoiceClip | undefined;
      if (!clip || !clip.queue_item_id) return;
      if (clip.room_id !== roomId || clip.room_kind !== roomKind) return;
      void playClip(clip);
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, roomId, roomKind, userId]);

  return { connected, error };
}

export default useMaiVoicePublisher;
