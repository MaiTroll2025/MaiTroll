import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';

interface GhostDropInState {
  isGhost: boolean;
  streamId: string | null;
  startedAt: number | null;
  promptShown: boolean;
  promptDismissed: boolean;
  signUpClicked: boolean;
  isLoading: boolean;
  loadingMessage: string;
}

interface GhostDropInContextType {
  state: GhostDropInState;
  startGhostDropIn: (streamId: string) => void;
  showPrompt: () => void;
  dismissPrompt: () => void;
  signUpFromGhost: () => void;
  clearGhost: () => void;
}

const GhostDropInContext = createContext<GhostDropInContextType | null>(null);

const STORAGE_KEY = 'MaiTroll_ghost_last_seen';

function getStoredState(): GhostDropInState {
  try {
    const raw = localStorage.getItem('MaiTroll_ghost_state');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Clear stale state if older than 24h
      if (parsed.startedAt && Date.now() - parsed.startedAt < 24 * 60 * 60 * 1000) {
        return parsed;
      }
    }
  } catch {}
  return {
    isGhost: false,
    streamId: null,
    startedAt: null,
    promptShown: false,
    promptDismissed: false,
    signUpClicked: false,
    isLoading: false,
    loadingMessage: '',
  };
}

function saveState(state: GhostDropInState) {
  try {
    localStorage.setItem('MaiTroll_ghost_state', JSON.stringify(state));
  } catch {}
}

export function GhostDropInProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GhostDropInState>(getStoredState);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  const startGhostDropIn = useCallback((streamId: string) => {
    const newState: GhostDropInState = {
      ...getStoredState(),
      isGhost: true,
      streamId,
      startedAt: Date.now(),
      promptShown: false,
      promptDismissed: false,
      signUpClicked: false,
    };
    setState(newState);

    // Set timer for 30 seconds to show the signup prompt
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, promptShown: true }));
    }, 30000);
  }, []);

  const showPrompt = useCallback(() => {
    setState(prev => ({ ...prev, promptShown: true }));
  }, []);

  const dismissPrompt = useCallback(() => {
    setState(prev => ({ ...prev, promptDismissed: true, promptShown: false }));
    // Re-show after 2 minutes if still ghost
    if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
    promptTimerRef.current = setTimeout(() => {
      setState(prev => {
        if (prev.isGhost && !prev.signUpClicked) {
          return { ...prev, promptShown: true, promptDismissed: false };
        }
        return prev;
      });
    }, 120000);
  }, []);

  const signUpFromGhost = useCallback(() => {
    setState(prev => ({ ...prev, signUpClicked: true, promptShown: false }));
  }, []);

  const clearGhost = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
    const fresh: GhostDropInState = {
      isGhost: false,
      streamId: null,
      startedAt: null,
      promptShown: false,
      promptDismissed: false,
      signUpClicked: false,
      isLoading: false,
      loadingMessage: '',
    };
    setState(fresh);
  }, []);

  // Find content and route to ghost mode
  const findAndRouteToContent = useCallback(async (): Promise<boolean> => {
    try {
      // 1. Try live broadcasts first
      const { data: streams } = await supabase
        .from('streams')
        .select('id, title, broadcaster_id, category')
        .or('is_live.eq.true,status.eq.live')
        .order('current_viewers', { ascending: false, nullsFirst: false })
        .limit(10);

      if (streams && streams.length > 0) {
        const randomStream = streams[Math.floor(Math.random() * streams.length)];
        setState(prev => ({ ...prev, isLoading: true, loadingMessage: 'Finding a live stream for you...' }));
        setTimeout(() => {
          startGhostDropIn(randomStream.id);
          setState(prev => ({ ...prev, isLoading: false }));
          if (randomStream.category === 'gaming') {
            navigate(`/gaming/watch/${randomStream.id}?ghost=true`);
          } else {
            navigate(`/watch/${randomStream.id}?ghost=true`);
          }
        }, 1200);
        return true;
      }

      // 2. Try gaming streams
      const { data: gamingStreams } = await supabase
        .from('streams')
        .select('id, title, broadcaster_id')
        .eq('category', 'gaming')
        .or('is_live.eq.true,status.eq.live')
        .order('current_viewers', { ascending: false, nullsFirst: false })
        .limit(5);

      if (gamingStreams && gamingStreams.length > 0) {
        const randomGame = gamingStreams[Math.floor(Math.random() * gamingStreams.length)];
        setState(prev => ({ ...prev, isLoading: true, loadingMessage: 'Finding a game for you...' }));
        setTimeout(() => {
          startGhostDropIn(randomGame.id);
          setState(prev => ({ ...prev, isLoading: false }));
          navigate(`/gaming/watch/${randomGame.id}?ghost=true`);
        }, 1200);
        return true;
      }

      // 3. Try podcasts
      const { data: podcasts } = await supabase
        .from('streams')
        .select('id, title, broadcaster_id')
        .eq('category', 'podcast')
        .or('is_live.eq.true,status.eq.live')
        .order('current_viewers', { ascending: false, nullsFirst: false })
        .limit(5);

      if (podcasts && podcasts.length > 0) {
        const randomPodcast = podcasts[Math.floor(Math.random() * podcasts.length)];
        setState(prev => ({ ...prev, isLoading: true, loadingMessage: 'Finding a podcast for you...' }));
        setTimeout(() => {
          startGhostDropIn(randomPodcast.id);
          setState(prev => ({ ...prev, isLoading: false }));
          navigate(`/podcast/${randomPodcast.id}?ghost=true`);
        }, 1200);
        return true;
      }

      return false;
    } catch (err) {
      console.warn('[GhostDropIn] Failed to find content:', err);
      return false;
    }
  }, [navigate, startGhostDropIn]);

  // Check on every location change for unauthenticated users
  useEffect(() => {
    if (user) return;
    if (state.isGhost || state.isLoading) return;

    if (location.pathname.startsWith('/watch/') ||
        location.pathname.startsWith('/gaming/watch/') ||
        location.pathname.startsWith('/podcast/')) {
      return;
    }

    const skipPaths = ['/auth', '/auth/callback', '/profile/', '/legal/', '/terms', '/privacy'];
    if (skipPaths.some(p => location.pathname.startsWith(p))) return;

    const lastGhost = localStorage.getItem(STORAGE_KEY);
    if (lastGhost) {
      const elapsed = Date.now() - parseInt(lastGhost, 10);
      if (elapsed < 24 * 60 * 60 * 1000) return;
    }

    const initGhostDropIn = async () => {
      const found = await findAndRouteToContent();
      if (!found) {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      }
    };

    initGhostDropIn();
  }, [user, state.isGhost, state.isLoading, location.pathname, findAndRouteToContent]);

  // Clear ghost state when user signs in (prevents ghost popup for signed-in users)
  useEffect(() => {
    if (user && state.isGhost) {
      clearGhost();
    }
  }, [user, state.isGhost, clearGhost]);

  // If user just signed up from ghost mode, return them to the broadcast
  useEffect(() => {
    if (user && state.signUpClicked) {
      const returnStreamId = sessionStorage.getItem('ghost_return_to');
      if (returnStreamId) {
        sessionStorage.removeItem('ghost_return_to');
        clearGhost();
        navigate(`/watch/${returnStreamId}`);
      }
    }
  }, [user, state.signUpClicked, navigate, clearGhost]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
    };
  }, []);

  return (
    <GhostDropInContext.Provider
      value={{ state, startGhostDropIn, showPrompt, dismissPrompt, signUpFromGhost, clearGhost }}
    >
      {children}
    </GhostDropInContext.Provider>
  );
}

export function useGhostDropIn() {
  const ctx = useContext(GhostDropInContext);
  if (!ctx) throw new Error('useGhostDropIn must be used within GhostDropInProvider');
  return ctx;
}
