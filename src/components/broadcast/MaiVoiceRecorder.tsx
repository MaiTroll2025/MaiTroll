import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, X, Send, RotateCcw } from 'lucide-react';
import {
  arrayBufferToBase64,
  pickRecorderMimeType,
  submitMaiVoiceMessage,
  MAI_VOICE_MESSAGE_MAX_SECONDS,
  type MaiVoiceRoomKind,
} from '../../lib/maiVoice';

interface MaiVoiceRecorderProps {
  roomKind: MaiVoiceRoomKind;
  roomId: string;
  onClose: () => void;
  onSent?: (messageId: string) => void;
  /**
   * Called with `true` while the microphone is capturing and `false` once the
   * capture ended. The broadcaster page uses it to mute the live microphone so
   * the audience never hears the raw recording.
   */
  onRecordingChange?: (recording: boolean) => void;
}

type RecorderState = 'idle' | 'recording' | 'review' | 'sending';

/**
 * Records a short voice message and hands it to the `mai-voice` edge
 * function. The audio never touches the database directly — the server stores
 * it in the private bucket and expires it one minute later.
 */
export const MaiVoiceRecorder: React.FC<MaiVoiceRecorderProps> = ({
  roomKind,
  roomId,
  onClose,
  onSent,
  onRecordingChange,
}) => {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  const stopTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        /* ignore */
      }
    });
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopTimers();
      try {
        recorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      releaseStream();
      onRecordingChange?.(false);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [onRecordingChange, releaseStream, stopTimers, previewUrl]);

  const startRecording = useCallback(async () => {
    setError(null);
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Voice recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        onRecordingChange?.(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        blobRef.current = blob;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setState('review');
      };

      recorder.start();
      setElapsed(0);
      setState('recording');
      onRecordingChange?.(true);

      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAt) / 1000);
        setElapsed(seconds);
        if (seconds >= MAI_VOICE_MESSAGE_MAX_SECONDS) {
          stopTimers();
          try {
            if (recorder.state !== 'inactive') recorder.stop();
          } catch {
            /* ignore */
          }
        }
      }, 200);
    } catch (err) {
      console.error('[MaiVoice] Could not start recording:', err);
      onRecordingChange?.(false);
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow microphone access to send a voice message.'
          : 'Could not access the microphone.',
      );
      releaseStream();
    }
  }, [onRecordingChange, previewUrl, releaseStream, stopTimers]);

  const cancelRecording = useCallback(() => {
    stopTimers();
    onRecordingChange?.(false);
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    } catch {
      /* ignore */
    }
    recorderRef.current = null;
    releaseStream();
    blobRef.current = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setElapsed(0);
    setState('idle');
  }, [onRecordingChange, previewUrl, releaseStream, stopTimers]);

  const sendRecording = useCallback(async () => {
    const blob = blobRef.current;
    if (!blob) return;
    setState('sending');
    setError(null);
    try {
      const buffer = await blob.arrayBuffer();
      const result = await submitMaiVoiceMessage({
        roomKind,
        roomId,
        audioBase64: arrayBufferToBase64(buffer),
        mimeType: blob.type || 'audio/webm',
        durationMs: Math.max(1, elapsed * 1000),
        idempotencyKey: `${roomKind}-${roomId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      });

      if (!result.ok) {
        setError(result.error);
        setState('review');
        return;
      }

      onSent?.(result.data.message_id);
      onClose();
    } catch (err) {
      console.error('[MaiVoice] Failed to send voice message:', err);
      setError('Could not send the voice message. Please try again.');
      setState('review');
    }
  }, [elapsed, onClose, onSent, roomId, roomKind]);

  const remaining = Math.max(0, MAI_VOICE_MESSAGE_MAX_SECONDS - elapsed);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Mic size={16} className="text-yellow-400" />
            Mai Voice messages
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

        {error && (
          <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </p>
        )}

        {state === 'idle' && (
          <button
            type="button"
            onClick={startRecording}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-500 px-4 py-4 text-sm font-bold text-black transition hover:bg-yellow-400"
          >
            <Mic size={18} />
            Start recording
          </button>
        )}

        {state === 'recording' && (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="flex items-center gap-2 text-2xl font-black tabular-nums text-white">
              <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
              {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
              {String(elapsed % 60).padStart(2, '0')}
            </div>
            <p className="text-xs text-zinc-400">{remaining}s left</p>
            <button
              type="button"
              onClick={cancelRecording}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/90 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-500"
            >
              <Square size={16} />
              Stop
            </button>
          </div>
        )}

        {(state === 'review' || state === 'sending') && (
          <div className="flex flex-col gap-3">
            <audio ref={previewRef} src={previewUrl ?? undefined} controls className="w-full" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                disabled={state === 'sending'}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
              >
                <RotateCcw size={14} />
                Re-record
              </button>
              <button
                type="button"
                onClick={sendRecording}
                disabled={state === 'sending'}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-yellow-500 px-3 py-2.5 text-xs font-bold text-black transition hover:bg-yellow-400 disabled:opacity-50"
              >
                <Send size={14} />
                {state === 'sending' ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}

        <p className="mt-3 text-center text-[10px] text-zinc-500">
          Voice messages are visible for one minute and are then deleted.
        </p>
      </div>
    </div>
  );
};

export default MaiVoiceRecorder;
