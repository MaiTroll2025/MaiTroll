import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { maiVoiceInvoke, recordMaiVoiceMessageListen, type MaiVoiceMessageMeta } from '../../lib/maiVoice';

interface MaiVoiceMessageStripProps {
  messages: MaiVoiceMessageMeta[];
  /** Ids a moderator removed — they are hidden from the audience. */
  removedMessageIds?: string[];
  /** Called when a viewer reports a voice message. */
  onReport?: (messageId: string) => void;
}

export const MaiVoiceMessageStrip: React.FC<MaiVoiceMessageStripProps> = ({
  messages,
  removedMessageIds = [],
  onReport,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const visible = messages.filter((item) => !removedMessageIds.includes(item.message_id));

  // Drop the cached signed URLs of messages that expired.
  useEffect(() => {
    const known = new Set(visible.map((item) => item.message_id));
    for (const key of Array.from(urlCacheRef.current.keys())) {
      if (!known.has(key)) urlCacheRef.current.delete(key);
    }
  }, [visible]);

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlayingId(null);
    setProgress(0);
  }, []);

  const playMessage = useCallback(
    async (messageId: string) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (playingId === messageId) {
        stopPlayback();
        return;
      }

      let url = urlCacheRef.current.get(messageId);
      if (!url) {
        setLoadingId(messageId);
        const result = await maiVoiceInvoke<{ url: string; duration_ms: number }>({
          action: 'get-playback-url',
          messageId,
        });
        setLoadingId(null);
        if (!result.ok) {
          if (result.code === 'UNAUTHORIZED') {
            toast.error('Sign in to play voice messages.');
          } else {
            toast.error(result.error);
          }
          return;
        }
        url = result.data.url;
        urlCacheRef.current.set(messageId, url);
      }

      // Track the listen on the server.
      void recordMaiVoiceMessageListen(messageId);

      // A new clip always replaces the one that is playing.
      if (playingId && playingId !== messageId) stopPlayback();

      audio.src = url;
      setPlayingId(messageId);
      setProgress(0);
      try {
        await audio.play();
      } catch {
        setPlayingId(null);
        toast.error('Tap the message again to play it.');
      }
    },
    [playingId, stopPlayback],
  );

  if (!visible.length) {
    return (
      <div className="hidden">
        <audio ref={audioRef} className="hidden" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 px-3 pb-1.5">
      {visible.map((item) => {
        const isPlaying = playingId === item.message_id;
        const isLoading = loadingId === item.message_id;
        const seconds = Math.max(1, Math.round((item.duration_ms ?? 0) / 1000));
        const firstLetter = item.sender_name?.charAt(0)?.toUpperCase() || '?';

        return (
          <motion.div
            key={item.message_id}
            initial={{ opacity: 0, y: 14, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="flex max-w-[92%] items-center gap-2.5 self-start rounded-2xl rounded-bl-md border border-yellow-400/25 bg-black/80 px-3 py-2 shadow-lg shadow-black/40 backdrop-blur"
          >
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden border border-yellow-400/30 bg-yellow-500/10">
              {item.sender_avatar ? (
                <img
                  src={item.sender_avatar}
                  alt={`${item.sender_name}'s avatar`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-[11px] font-black text-yellow-300">{firstLetter}</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => void playMessage(item.message_id)}
              disabled={isLoading}
              title={isPlaying ? 'Stop this voice message' : `Play the voice message from ${item.sender_name}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-500/90 text-black transition hover:bg-yellow-400 disabled:opacity-60"
            >
              {isLoading ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              ) : isPlaying ? (
                <Pause size={14} />
              ) : (
                <Play size={14} className="ml-0.5" />
              )}
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Mic size={11} className="shrink-0 text-yellow-400" />
                <span className="truncate text-[11px] font-bold text-white">{item.sender_name}</span>
                <span className="shrink-0 text-[10px] text-zinc-400">{seconds}s</span>
              </div>
              <div className="text-[10px] text-zinc-500">Voice message • {(item as any).listener_count || 0} listened</div>
              {isPlaying && (
                <div className="mt-1 h-0.5 w-24 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-yellow-400 transition-[width] duration-150"
                    style={{ width: `${Math.min(100, Math.max(2, progress * 100))}%` }}
                  />
                </div>
              )}
            </div>

            {onReport && (
              <button
                type="button"
                onClick={() => onReport(item.message_id)}
                className="ml-1 rounded-full p-1 text-zinc-500 transition hover:text-red-400"
                title="Report this voice message"
              >
                <ShieldAlert size={12} />
              </button>
            )}
          </motion.div>
        );
      })}
      <audio
        ref={audioRef}
        className="hidden"
        onEnded={stopPlayback}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          if (!audio.duration || !Number.isFinite(audio.duration)) return;
          setProgress(audio.currentTime / audio.duration);
        }}
        onPause={() => setProgress(0)}
      />
    </div>
  );
};

export default MaiVoiceMessageStrip;
