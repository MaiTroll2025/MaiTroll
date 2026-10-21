import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, X, Trash2, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import {
  arrayBufferToBase64,
  deleteMaiVoiceProfile,
  enrollMaiVoice,
  fetchMaiVoiceProfile,
  pickRecorderMimeType,
  setMaiVoiceEnabled,
  MAI_VOICE_CONSENT_VERSION,
  MAI_VOICE_ENROLLMENT_MAX_SECONDS,
  MAI_VOICE_ENROLLMENT_MIN_SECONDS,
  type MaiVoiceProfile,
} from '../../lib/maiVoice';

interface MaiVoiceProfilePanelProps {
  onClose: () => void;
  /**
   * Called with `true` while the microphone is capturing a sample and `false`
   * once the capture ended. The broadcaster page uses it to mute the live
   * microphone so the audience never hears the raw recording.
   */
  onRecordingChange?: (recording: boolean) => void;
}

/**
 * Lets a user create, enable, disable or delete their own voice profile.
 * The sample never leaves the browser until the user explicitly consents.
 */
export const MaiVoiceProfilePanel: React.FC<MaiVoiceProfilePanelProps> = ({ onClose, onRecordingChange }) => {
  const [profile, setProfile] = useState<MaiVoiceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [providerConfigured, setProviderConfigured] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchMaiVoiceProfile();
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setProfile(result.data.profile);
    setProviderConfigured(result.data.provider_configured);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      try {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      } catch {
        /* ignore */
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      onRecordingChange?.(false);
    };
  }, [onRecordingChange]);

  const startRecording = useCallback(async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Voice recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      const startedAt = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        setRecording(false);
        onRecordingChange?.(false);
        const seconds = Math.floor((Date.now() - startedAt) / 1000);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setBusy(true);
        const result = await enrollMaiVoice({
          audioBase64: arrayBufferToBase64(await blob.arrayBuffer()),
          mimeType: blob.type || 'audio/webm',
          durationMs: seconds * 1000,
        });
        setBusy(false);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.data.message);
        void load();
      };
      recorder.start();
      setElapsed(0);
      setRecording(true);
      onRecordingChange?.(true);
      timerRef.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAt) / 1000);
        setElapsed(seconds);
        if (seconds >= MAI_VOICE_ENROLLMENT_MAX_SECONDS) {
          try {
            if (recorder.state !== 'inactive') recorder.stop();
          } catch {
            /* ignore */
          }
        }
      }, 250);
    } catch (err) {
      console.error('[MaiVoice] Enrollment recording failed:', err);
      onRecordingChange?.(false);
      toast.error(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access was blocked.'
          : 'Could not access the microphone.',
      );
    }
  }, [load, onRecordingChange]);

  const stopRecording = useCallback(() => {
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const handleToggle = useCallback(async () => {
    if (!profile) return;
    setBusy(true);
    const result = await setMaiVoiceEnabled(!profile.is_enabled);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    void load();
  }, [load, profile]);

  const handleDelete = useCallback(async () => {
    setBusy(true);
    const result = await deleteMaiVoiceProfile();
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Your Mai Voice profile was deleted.');
    void load();
  }, [load]);

  const statusLabel = (() => {
    if (!profile) return 'Not set up';
    switch (profile.status) {
      case 'ready':
        return profile.is_enabled ? 'Ready' : 'Disabled';
      case 'processing':
        return 'Processing';
      case 'failed':
        return 'Failed';
      case 'deletion_pending':
        return 'Deleting';
      case 'deleted':
        return 'Deleted';
      default:
        return profile.status;
    }
  })();

  const needsSample = !profile || ['not_set_up', 'failed', 'deleted'].includes(profile.status);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Mic size={16} className="text-yellow-400" />
            My Mai Voice
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

        {loading ? (
          <p className="py-6 text-center text-xs text-zinc-400">Loading your voice profile…</p>
        ) : (
          <>
            <div className="mb-4 rounded-xl border border-white/5 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Status</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-200">
                  {statusLabel}
                </span>
              </div>
              {profile?.failure_reason && (
                <p className="mt-2 text-[11px] text-amber-300">{profile.failure_reason}</p>
              )}
              {profile?.provider_requires_verification && (
                <p className="mt-2 text-[11px] text-amber-300">
                  The voice provider still needs to verify your sample.
                </p>
              )}
            </div>

            {!providerConfigured && (
              <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                The voice provider is not configured on the server yet, so new voice profiles cannot be created
                right now.
              </p>
            )}

            {needsSample ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <p className="text-center text-[11px] text-zinc-400">
                  Record a clear sample between {MAI_VOICE_ENROLLMENT_MIN_SECONDS} and{' '}
                  {MAI_VOICE_ENROLLMENT_MAX_SECONDS} seconds. It is only used to build your own voice.
                </p>
                {recording ? (
                  <>
                    <div className="flex items-center gap-2 text-2xl font-black tabular-nums text-white">
                      <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                      {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
                      {String(elapsed % 60).padStart(2, '0')}
                    </div>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/90 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-500"
                    >
                      <Square size={16} />
                      Stop and create my voice
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={busy || !providerConfigured}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-yellow-400 disabled:opacity-50"
                  >
                    <Mic size={16} />
                    Record my voice sample
                  </button>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  {profile?.is_enabled ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  {profile?.is_enabled ? 'Turn off my voice' : 'Turn on my voice'}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-red-500/20 px-3 py-2.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/30 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            )}

            <p className="mt-4 flex items-start gap-1.5 text-[10px] leading-relaxed text-zinc-500">
              <ShieldCheck size={12} className="mt-0.5 shrink-0" />
              By creating a voice profile you consent to version {MAI_VOICE_CONSENT_VERSION}. Speaking in a
              broadcast is a separate, per-room consent and is never implied by creating a profile.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default MaiVoiceProfilePanel;
