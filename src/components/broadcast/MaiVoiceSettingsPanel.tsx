import React, { useCallback, useEffect, useState } from 'react';
import { X, AudioLines, Pause, Play, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchMaiVoiceRoomSettings,
  maiVoiceQueueControl,
  updateMaiVoiceRoomSettings,
  type MaiVoiceRoomKind,
  type MaiVoiceRoomSettings,
} from '../../lib/maiVoice';

interface MaiVoiceSettingsPanelProps {
  roomKind: MaiVoiceRoomKind;
  roomId: string;
  settings: MaiVoiceRoomSettings | null;
  onClose: () => void;
  onChanged: () => void;
}

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2.5 ${
        disabled ? 'opacity-50' : 'cursor-pointer'
      }`}
    >
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-white">{label}</span>
        {description && <span className="block text-[10px] text-zinc-400">{description}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-yellow-500"
      />
    </label>
  );
}

/**
 * Per-room Mai Voice controls for the broadcaster (or any officer/admin who
 * can moderate the room). Every switch is enforced again on the server.
 */
export const MaiVoiceSettingsPanel: React.FC<MaiVoiceSettingsPanelProps> = ({
  roomKind,
  roomId,
  settings,
  onClose,
  onChanged,
}) => {
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<MaiVoiceRoomSettings>>({});
  const [current, setCurrent] = useState<MaiVoiceRoomSettings | null>(settings);

  useEffect(() => {
    if (settings) {
      setCurrent(settings);
    } else {
      // The panel can be opened without a pre-loaded settings row.
      void (async () => {
        const result = await fetchMaiVoiceRoomSettings(roomKind, roomId);
        if (result.ok) setCurrent(result.data.settings ?? null);
      })();
    }
  }, [roomId, roomKind, settings]);

  useEffect(() => {
    if (current) {
      setDraft({
        tts_enabled: current.tts_enabled,
        chat_tts_enabled: current.chat_tts_enabled,
        flying_chat_tts_enabled: current.flying_chat_tts_enabled,
        voice_chat_enabled: current.voice_chat_enabled,
        fallback_voice_enabled: current.fallback_voice_enabled,
        playback_volume: current.playback_volume,
        max_queue_size: current.max_queue_size,
        cooldown_seconds: current.cooldown_seconds,
      });
    }
  }, [current]);

  const patch = useCallback(
    async (changes: Partial<MaiVoiceRoomSettings>) => {
      setSaving(true);
      setDraft((prev) => ({ ...prev, ...changes }));
      const result = await updateMaiVoiceRoomSettings(roomKind, roomId, changes);
      setSaving(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Mai Voice settings updated.');
      onChanged();
    },
    [onChanged, roomId, roomKind],
  );

  const runQueueAction = useCallback(
    async (action: 'pause' | 'resume' | 'clear') => {
      const result = await maiVoiceQueueControl(roomKind, roomId, action);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (action === 'pause') toast.success('Mai Voice playback paused.');
      if (action === 'resume') toast.success('Mai Voice playback resumed.');
      if (action === 'clear') toast.success('Mai Voice queue cleared.');
    },
    [roomId, roomKind],
  );

  const ttsOn = draft.tts_enabled ?? current?.tts_enabled ?? false;
  const chatTtsOn = draft.chat_tts_enabled ?? current?.chat_tts_enabled ?? false;
  const flyingTtsOn = draft.flying_chat_tts_enabled ?? current?.flying_chat_tts_enabled ?? false;
  const voiceChatOn = draft.voice_chat_enabled ?? current?.voice_chat_enabled ?? true;
  const fallbackOn = draft.fallback_voice_enabled ?? current?.fallback_voice_enabled ?? false;
  const volume = draft.playback_volume ?? current?.playback_volume ?? 1;
  const maxQueue = draft.max_queue_size ?? current?.max_queue_size ?? 10;
  const cooldown = draft.cooldown_seconds ?? current?.cooldown_seconds ?? 10;
  const paused = current?.playback_paused === true;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <AudioLines size={16} className="text-yellow-400" />
            Mai Voice controls
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2">
          <Toggle
            label="Mai TTS voice"
            description="Let viewers speak their own messages in their own voice."
            checked={ttsOn}
            disabled={saving}
            onChange={(next) => patch({ tts_enabled: next, chat_tts_enabled: next ? chatTtsOn : false })}
          />
          <Toggle
            label="Speak normal chat"
            description="Read regular chat messages aloud."
            checked={chatTtsOn}
            disabled={saving || !ttsOn}
            onChange={(next) => patch({ chat_tts_enabled: next })}
          />
          <Toggle
            label="Speak flying chat"
            description="Read flying chat messages aloud."
            checked={flyingTtsOn}
            disabled={saving || !ttsOn}
            onChange={(next) => patch({ flying_chat_tts_enabled: next })}
          />
          <Toggle
            label="Standard voice fallback"
            description="Use the shared Mai Voice when a viewer has no voice profile. It is never labelled as the sender's own voice."
            checked={fallbackOn}
            disabled={saving}
            onChange={(next) => patch({ fallback_voice_enabled: next })}
          />
          <Toggle
            label="Mai Voice messages"
            description="Allow viewers to record short voice messages for the audience."
            checked={voiceChatOn}
            disabled={saving}
            onChange={(next) => patch({ voice_chat_enabled: next })}
          />
        </div>

        <div className="mt-4 space-y-3 rounded-lg border border-white/5 bg-white/5 p-3">
          <div>
            <label className="mb-1 flex items-center justify-between text-[11px] font-semibold text-zinc-300">
              Playback volume
              <span className="tabular-nums text-zinc-400">{Math.round(volume * 100)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              disabled={saving}
              onChange={(e) => setDraft((prev) => ({ ...prev, playback_volume: Number(e.target.value) }))}
              onMouseUp={(e) => patch({ playback_volume: Number((e.target as HTMLInputElement).value) })}
              onTouchEnd={(e) => patch({ playback_volume: Number((e.target as HTMLInputElement).value) })}
              className="w-full accent-yellow-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-zinc-300">Queue size</label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxQueue}
                disabled={saving}
                onChange={(e) => setDraft((prev) => ({ ...prev, max_queue_size: Number(e.target.value) }))}
                onBlur={() => patch({ max_queue_size: maxQueue })}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-zinc-300">Cooldown (s)</label>
              <input
                type="number"
                min={0}
                max={600}
                value={cooldown}
                disabled={saving}
                onChange={(e) => setDraft((prev) => ({ ...prev, cooldown_seconds: Number(e.target.value) }))}
                onBlur={() => patch({ cooldown_seconds: cooldown })}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => runQueueAction(paused ? 'resume' : 'pause')}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
            {paused ? 'Resume playback' : 'Pause playback'}
          </button>
          <button
            type="button"
            onClick={() => runQueueAction('clear')}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            <Trash2 size={13} />
            Clear queue
          </button>
        </div>

        <p className="mt-4 flex items-start gap-1.5 text-[10px] leading-relaxed text-zinc-500">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          Every switch is enforced on the server. Recorded voice messages are deleted one minute after they
          are sent.
        </p>
      </div>
    </div>
  );
};

export default MaiVoiceSettingsPanel;
