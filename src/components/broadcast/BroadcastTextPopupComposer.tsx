import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PopupStyle } from '@/types/textPopup';
import {
  POPUP_STYLE_CONFIG,
  POPUP_DURATIONS,
  MAX_POPUP_MESSAGE_LENGTH,
} from '@/types/textPopup';

interface BroadcastTextPopupComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (message: string, style: PopupStyle, durationMs: number) => Promise<void>;
  sending?: boolean;
}

export default function BroadcastTextPopupComposer({
  open,
  onOpenChange,
  onSend,
  sending = false,
}: BroadcastTextPopupComposerProps) {
  const [message, setMessage] = useState('');
  const [style, setStyle] = useState<PopupStyle>('default');
  const [durationMs, setDurationMs] = useState<number>(10000);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setMessage('');
      setStyle('default');
      setDurationMs(10000);
      setError(null);
    }
  }, [open]);

  const trimmedMessage = message.trim();
  const charCount = trimmedMessage.length;
  const isOverLimit = charCount > MAX_POPUP_MESSAGE_LENGTH;
  const isEmpty = charCount === 0;
  const canSubmit = !isEmpty && !isOverLimit && !sending;

  const handleSend = useCallback(async () => {
    if (!canSubmit) return;

    setError(null);

    try {
      await onSend(trimmedMessage, style, durationMs);
      onOpenChange(false);
    } catch (_err) {
      setError('Failed to send popup. Please try again.');
    }
  }, [canSubmit, trimmedMessage, style, durationMs, onSend, onOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={cn(
              'fixed z-[120] overflow-hidden',
              'bottom-0 left-0 right-0 rounded-t-[28px]',
              'md:top-1/2 md:left-1/2 md:bottom-auto md:right-auto',
              'md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px]',
              'w-full md:w-[480px] max-h-[85vh]',
              'border border-cyan-400/20 bg-slate-950/98 backdrop-blur-2xl',
              'shadow-[0_0_60px_rgba(34,211,238,0.15)]',
            )}
          >
            {/* Background glow */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.12),transparent_50%)]" />

            <div className="relative flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div>
                  <h2 className="text-lg font-black text-white">
                    Send Broadcast Text Popup
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Show a message overlay to all viewers
                  </p>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Message textarea */}
                <div>
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Type what viewers should see…"
                    maxLength={MAX_POPUP_MESSAGE_LENGTH * 2} // Allow typing but show error
                    rows={3}
                    className={cn(
                      'w-full resize-none rounded-2xl border bg-white/5 px-4 py-3',
                      'text-white placeholder-slate-500 text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-cyan-400/30',
                      'transition-all',
                      isOverLimit
                        ? 'border-red-400/50 focus:ring-red-400/30'
                        : 'border-white/10',
                    )}
                  />
                  <div className="flex items-center justify-between mt-1.5 px-1">
                    <span
                      className={cn(
                        'text-xs',
                        isOverLimit ? 'text-red-400' : 'text-slate-500',
                      )}
                    >
                      {charCount}/{MAX_POPUP_MESSAGE_LENGTH}
                    </span>
                    {isOverLimit && (
                      <span className="text-xs text-red-400 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        Too long
                      </span>
                    )}
                  </div>
                </div>

                {/* Style selector */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 block">
                    Style
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.keys(POPUP_STYLE_CONFIG) as PopupStyle[]).map((s) => {
                      const config = POPUP_STYLE_CONFIG[s];
                      const isSelected = style === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setStyle(s)}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 transition-all',
                            isSelected
                              ? `${config.borderColor} bg-white/10`
                              : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
                          )}
                        >
                          <span className="text-lg">{config.iconEmoji}</span>
                          <span
                            className={cn(
                              'text-[10px] font-bold uppercase tracking-wider',
                              isSelected ? 'text-white' : 'text-slate-500',
                            )}
                          >
                            {config.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Duration selector */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 block">
                    Duration
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {POPUP_DURATIONS.map((d) => {
                      const isSelected = durationMs === d.value;
                      return (
                        <button
                          key={d.value}
                          onClick={() => setDurationMs(d.value)}
                          className={cn(
                            'rounded-xl border px-3 py-2.5 text-sm font-bold transition-all',
                            isSelected
                              ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200'
                              : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]',
                          )}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                    <AlertTriangle size={16} />
                    {error}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-white/10 px-5 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] md:pb-4">
                <div className="flex gap-3">
                  <button
                    onClick={() => onOpenChange(false)}
                    className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!canSubmit}
                    className={cn(
                      'flex-[2] flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all',
                      canSubmit
                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 active:scale-[0.98]'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed',
                    )}
                  >
                    {sending ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Send Popup
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
