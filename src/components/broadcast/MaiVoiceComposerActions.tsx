import React, { useState } from 'react';
import { Mic, AudioLines, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import type { MaiVoiceRoomKind } from '../../lib/maiVoice';
import MaiVoiceRecorder from './MaiVoiceRecorder';
import MaiVoiceProfilePanel from './MaiVoiceProfilePanel';

interface MaiVoiceComposerActionsProps {
  roomKind: MaiVoiceRoomKind;
  roomId: string;
  /** True when the current user opted in to speak their own messages here. */
  myOptIn: boolean;
  onToggleOptIn: (next: boolean) => Promise<boolean>;
  /** Broadcaster switch for recorded voice messages. */
  voiceChatEnabled: boolean;
  /** Broadcaster switch for spoken chat. */
  ttsEnabled: boolean;
  isGuest?: boolean;
  onRequireAuth?: () => void;
  /**
   * Notifies the host page whenever the microphone starts or stops capturing,
   * so the live microphone can be muted for the duration of the recording.
   */
  onRecordingChange?: (recording: boolean) => void;
  /**
   * True when the current user owns the room switch for spoken chat. The
   * button then opens the room controls instead of doing nothing.
   */
  canManageRoom?: boolean;
  /** Opens the per-room Mai Voice controls. */
  onOpenRoomControls?: () => void;
}

/**
 * The two Mai Voice entry points in the chat composer:
 *   • "Mai TTS voice"     – speak my own messages in this room.
 *   • "Mai Voice messages" – record a short voice message for the audience.
 */
export const MaiVoiceComposerActions: React.FC<MaiVoiceComposerActionsProps> = ({
  roomKind,
  roomId,
  myOptIn,
  onToggleOptIn,
  voiceChatEnabled,
  ttsEnabled,
  isGuest,
  onRequireAuth,
  onRecordingChange,
  canManageRoom,
  onOpenRoomControls,
}) => {
  const [showRecorder, setShowRecorder] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [toggling, setToggling] = useState(false);

  const requireAuth = () => {
    if (isGuest) {
      onRequireAuth?.();
      return true;
    }
    return false;
  };

  const handleToggleOptIn = async () => {
    if (requireAuth()) return;
    if (!ttsEnabled) {
      if (canManageRoom && onOpenRoomControls) {
        onOpenRoomControls();
        return;
      }
      toast.error('The broadcaster has turned off spoken chat for this broadcast.');
      return;
    }
    setToggling(true);
    const ok = await onToggleOptIn(!myOptIn);
    setToggling(false);
    if (ok) {
      toast.success(myOptIn ? 'Mai TTS voice turned off for this room.' : 'Mai TTS voice on for this room.');
    }
  };

  const handleOpenRecorder = () => {
    if (requireAuth()) return;
    if (!voiceChatEnabled) {
      toast.error('The broadcaster has turned off voice messages for this broadcast.');
      return;
    }
    setShowRecorder(true);
  };

  const buttonClass = (active: boolean, disabled: boolean) =>
    [
      'flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition whitespace-nowrap',
      active
        ? 'bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/40'
        : 'text-zinc-400 hover:text-yellow-300 hover:bg-white/5',
      disabled ? 'opacity-40 cursor-not-allowed' : '',
    ].join(' ');

  return (
    <>
      <button
        type="button"
        onClick={handleToggleOptIn}
        disabled={toggling}
        title={
          ttsEnabled
            ? myOptIn
              ? 'Mai TTS voice is on — your messages are spoken in their own voice.'
              : 'Turn on Mai TTS voice so your messages are spoken.'
            : canManageRoom
              ? 'Spoken chat is off for this room. Open the Mai Voice controls to turn it on.'
              : 'The broadcaster has turned off spoken chat for this broadcast.'
        }
        className={buttonClass(myOptIn, toggling || (!ttsEnabled && !canManageRoom))}
      >
        <AudioLines size={13} />
        Mai TTS voice
      </button>

      <button
        type="button"
        onClick={handleOpenRecorder}
        title={
          voiceChatEnabled
            ? 'Record a short voice message for the audience.'
            : 'The broadcaster has turned off voice messages for this broadcast.'
        }
        className={buttonClass(false, !voiceChatEnabled)}
      >
        <Mic size={13} />
        Mai Voice messages
      </button>

      <button
        type="button"
        onClick={() => {
          if (requireAuth()) return;
          setShowProfile(true);
        }}
        title="Create or manage your own Mai Voice profile."
        className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-400 transition hover:text-yellow-300 hover:bg-white/5"
      >
        <UserRound size={13} />
        My Mai Voice
      </button>

      {showRecorder && (
        <MaiVoiceRecorder
          roomKind={roomKind}
          roomId={roomId}
          onClose={() => setShowRecorder(false)}
          onSent={() => toast.success('Voice message sent to the room.')}
          onRecordingChange={onRecordingChange}
        />
      )}

      {showProfile && (
        <MaiVoiceProfilePanel onClose={() => setShowProfile(false)} onRecordingChange={onRecordingChange} />
      )}
    </>
  );
};

export default MaiVoiceComposerActions;
