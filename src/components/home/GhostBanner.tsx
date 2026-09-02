import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGhostDropIn } from '@/context/GhostDropInContext';
import { useAuthStore } from '@/lib/store';
import { X, UserPlus, Sparkles } from 'lucide-react';

export default function GhostBanner() {
  const { state, dismissPrompt, signUpFromGhost, clearGhost } = useGhostDropIn();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // If user is signed in, never show the ghost signup popup
  useEffect(() => {
    if (user && visible) {
      clearGhost();
      setVisible(false);
    }
  }, [user, visible, clearGhost]);

  useEffect(() => {
    if (user) return; // Don't show ghost popup to signed-in users
    if (state.promptShown && !state.signUpClicked) {
      setVisible(true);
      setCountdown(10);
    } else {
      setVisible(false);
    }
  }, [state.promptShown, state.signUpClicked]);

  // Countdown timer for auto-dismiss
  useEffect(() => {
    if (!visible || countdown <= 0) return;
    const timer = setTimeout(() => {
      setCountdown(c => c - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [visible, countdown]);

  const handleSignUp = () => {
    signUpFromGhost();
    setVisible(false);
    // Store the stream ID so we can return after signup
    if (state.streamId) {
      sessionStorage.setItem('ghost_return_to', state.streamId);
    }
    navigate('/auth?mode=signup&redirect=ghost');
  };

  const handleDismiss = () => {
    dismissPrompt();
    setVisible(false);
  };

  // Show loading overlay when finding content
  if (state.isLoading) {
    return (
      <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-[#050715]/90 backdrop-blur-sm">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-purple-500/30 border-t-purple-400" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg">👻</span>
          </div>
        </div>
        <p className="mt-4 animate-pulse text-sm font-medium text-slate-400">{state.loadingMessage || 'Finding something awesome...'}</p>
        <p className="mt-1 text-xs text-slate-500">This will only take a moment...</p>
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+4rem)] z-[9999] flex justify-center px-4 animate-[ghostBannerSlideUp_0.4s_ease-out] sm:bottom-20">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-[#1a0530]/95 to-[#0d1b2a]/95 p-4 shadow-[0_8px_32px_rgba(147,51,234,0.25)] backdrop-blur-xl">
        {/* Shimmer glow */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/10 via-transparent to-cyan-500/10" />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          {/* Ghost icon + title */}
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-2 items-center justify-center rounded-lg bg-purple-500/20">
              <Sparkles className="h-4 w-4 text-purple-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Having fun? 🎉</p>
              <p className="text-[10px] text-purple-300/70">You&apos;re watching as a ghost</p>
            </div>
          </div>

          {/* Message */}
          <p className="mb-3 text-xs leading-relaxed text-slate-300">
            Join the chat, make friends, and get your own profile. It only takes 10 seconds!
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSignUp}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition hover:from-purple-500 hover:to-pink-500 hover:shadow-purple-500/25"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Sign Up — Free
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-medium text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              Later{countdown > 0 ? ` (${countdown}s)` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
