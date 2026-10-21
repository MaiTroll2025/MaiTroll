import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { MaiVoiceClip } from '../../lib/maiVoice';

interface MaiVoicePlayerProps {
  /** Clips that are waiting to be played (already filtered by the server). */
  pendingClips: MaiVoiceClip[];
  /** The clip that is currently playing. */
  activeClip: MaiVoiceClip | null;
  /** Playback volume, 0..1. */
  volume?: number;
  /** When true nothing is played (broadcaster paused playback). */
  paused?: boolean;
  onBegin: (queueItemId: string) => void;
  onComplete: (queueItemId: string, outcome: 'played' | 'failed') => void;
}

/**
 * Plays the room's Mai Voice clips for the whole audience.
 *
 * The server decides which clip plays next and when it starts (`play_at`), so
 * every client in the room hears the same thing at the same moment. When the
 * browser blocks autoplay the user gets an explicit "tap to hear" control
 * instead of silently losing the clip.
 */
export const MaiVoicePlayer: React.FC<MaiVoicePlayerProps> = ({
  pendingClips,
  activeClip,
  volume = 1,
  paused = false,
  onBegin,
  onComplete,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(false);

  const nextClip = pendingClips[0] ?? null;

  const startClip = useCallback(
    async (clip: MaiVoiceClip) => {
      const audio = audioRef.current;
      if (!audio) return;

      onBegin(clip.queue_item_id);
      audio.src = clip.url;
      audio.volume = muted ? 0 : Math.max(0, Math.min(1, volume));
      audio.currentTime = 0;

      try {
        await audio.play();
        setBlocked(false);
      } catch (error) {
        // Autoplay policy: the clip stays loaded so a single tap can start it.
        console.warn('[MaiVoice] Playback blocked until the user interacts:', error);
        setBlocked(true);
      }
    },
    [muted, onBegin, volume],
  );

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (paused || activeClip || !nextClip) return;

    const delay = Math.max(0, (nextClip.play_at ?? Date.now()) - Date.now());
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void startClip(nextClip);
    }, delay);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [paused, activeClip, nextClip, startClip]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : Math.max(0, Math.min(1, volume));
  }, [muted, volume]);

  const handleEnded = useCallback(() => {
    if (activeClip) onComplete(activeClip.queue_item_id, 'played');
  }, [activeClip, onComplete]);

  const handleError = useCallback(() => {
    if (activeClip) onComplete(activeClip.queue_item_id, 'failed');
  }, [activeClip, onComplete]);

  const handleUnlock = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    void audio.play()
      .then(() => setBlocked(false))
      .catch(() => undefined);
  }, []);

  const showStatus = Boolean(activeClip) || blocked;

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 sm:bottom-28">
      {showStatus && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/80 px-3 py-1.5 text-xs text-white shadow-xl backdrop-blur">
          {blocked ? (
            <button
              type="button"
              onClick={handleUnlock}
              className="flex items-center gap-1.5 rounded-full bg-yellow-500 px-2.5 py-1 font-semibold text-black transition hover:bg-yellow-400"
            >
              <VolumeX size={13} />
              Tap to hear Mai Voice
            </button>
          ) : (
            <>
              <Volume2 size={13} className="text-yellow-400" />
              <span className="max-w-[220px] truncate">
                {activeClip?.voice_label || 'Mai Voice'}
              </span>
              <button
                type="button"
                onClick={() => setMuted((prev) => !prev)}
                className="rounded-full p-1 text-zinc-300 transition hover:bg-white/10"
                title={muted ? 'Unmute Mai Voice' : 'Mute Mai Voice'}
              >
                {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
            </>
          )}
        </div>
      )}
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onError={handleError}
        preload="auto"
        className="hidden"
      />
    </div>
  );
};

export default MaiVoicePlayer;
