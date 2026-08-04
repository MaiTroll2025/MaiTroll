import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useTrollEngine, TrollEvent } from './useTrollEngine';
import { subscribeEvents, TrollEventType } from '../lib/events';
import TrollOverlay from './TrollOverlay';
import { PreflightStore } from '../lib/preflightStore';
import { useLocation } from 'react-router-dom';

interface TrollContextType {
  triggerTroll: (context?: string, options?: { safe?: boolean }) => void;
}

const TrollContext = createContext<TrollContextType | undefined>(undefined);

interface TrollProviderProps {
  children: ReactNode;
}

// Event types that can trigger trolls with their contexts
const EVENT_TROLL_CONTEXTS: Record<TrollEventType, string> = {
  'chat_message_sent': 'chat',
  'reaction_added': 'reaction',
  'district_entered': 'district',
  'stream_watch_time': 'stream',
  'coin_spent': 'coin_spend',
  'court_event': 'court',
  'war_match_end': 'battle',
  'ai_decision_event': 'ai_decision',
  'economy_loss': 'economy',
  'economy_gain': 'economy',
  'pod_started': 'pod',
  'pod_listened': 'pod',
  'utromail_message_sent': 'chat',
  badge_progress: ''
};

const ACTION_COUNT_RESET_MS = 5 * 60 * 1000; // reset counts after 5 minutes of inactivity
const ACTION_COUNT_MIN_THRESHOLD = 15;
const ACTION_COUNT_MAX_THRESHOLD = 25;

const getRandomThreshold = () =>
  Math.floor(Math.random() * (ACTION_COUNT_MAX_THRESHOLD - ACTION_COUNT_MIN_THRESHOLD + 1)) + ACTION_COUNT_MIN_THRESHOLD;

export const TrollProvider = ({ children }: TrollProviderProps) => {
  const { triggerTroll: engineTriggerTroll, completeTroll } = useTrollEngine((event) => {
    // Handle background troll triggers from useTrollEngine
    setActiveTroll(event);
    setTimeout(() => {
      setActiveTroll(null);
      completeTroll();
    }, event.duration);
  });
  const [activeTroll, setActiveTroll] = useState<TrollEvent | null>(null);
  const location = useLocation();
  const isIdleRef = useRef(false);
  const actionStoreRef = useRef<Record<string, { count: number; threshold: number; lastActionAt: number }>>({});

  // Idle detection: user must be idle for 10+ seconds on homepage to allow trolls
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;
    
    const resetIdleTimer = () => {
      isIdleRef.current = false;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        isIdleRef.current = true;
      }, 10000); // 10 seconds of no activity = idle
    };

    // Start idle timer
    resetIdleTimer();

    // Reset on any user activity
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(evt => window.addEventListener(evt, resetIdleTimer));

    return () => {
      clearTimeout(idleTimer);
      activityEvents.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
    };
  }, []);

  // Helper: determine if we're on a page where trolls are allowed (homepage only)
  const isHomepage = location.pathname === '/' || location.pathname === '/home';
  const isInExcludedPage = (
    location.pathname.startsWith('/broadcast') ||
    location.pathname.startsWith('/jail') ||
    location.pathname.startsWith('/court') ||
    location.pathname.startsWith('/church') ||
    location.pathname.includes('/coinstore') ||
    location.pathname.includes('/organization') ||
    location.pathname.includes('/tcnn') ||
    location.pathname.includes('/auction') ||
    location.pathname.includes('/call') ||
    location.pathname.startsWith('/stream') ||
    location.pathname.startsWith('/watch') ||
    location.pathname.startsWith('/profile')
  );

  // Combined condition for showing trolls
  const canShowTrolls = isHomepage && !isInExcludedPage && !PreflightStore.getInBattle() && !PreflightStore.getInTutorial() && !PreflightStore.getInBroadcast() && isIdleRef.current;

  // Handle triggering a troll
  const triggerTroll = useCallback((context?: string, options?: { safe?: boolean }) => {
    const event = engineTriggerTroll(context, options);

    if (event && canShowTrolls) {
      setActiveTroll(event);

      // Auto-complete the troll after duration
      setTimeout(() => {
        setActiveTroll(null);
        completeTroll();
      }, event.duration);
    }
  }, [engineTriggerTroll, completeTroll, canShowTrolls]);

  // Subscribe to events and trigger trolls based on action count
  useEffect(() => {
    const unsubscribe = subscribeEvents((event) => {
      const context = EVENT_TROLL_CONTEXTS[event.type];
      if (!context) return;

      const userId = event.userId;
      if (!userId) return;

      const now = Date.now();
      const actionStore = actionStoreRef.current;
      let entry = actionStore[userId];

      if (!entry) {
        entry = {
          count: 0,
          threshold: getRandomThreshold(),
          lastActionAt: now,
        };
        actionStore[userId] = entry;
      }

      if (now - entry.lastActionAt > ACTION_COUNT_RESET_MS) {
        entry.count = 0;
        entry.threshold = getRandomThreshold();
      }

      entry.lastActionAt = now;
      entry.count = Math.min(entry.count + 1, entry.threshold);
      const currentCount = entry.count;
      const threshold = entry.threshold;

      if (import.meta.env.DEV) {
        console.log(`[TrollProvider] User ${userId} action count: ${currentCount}/${threshold}`);
      }

      if (currentCount >= threshold) {
        if (canShowTrolls) {
          if (import.meta.env.DEV) {
            console.log(`[TrollProvider] Threshold reached! Triggering troll for ${userId}`);
          }

          entry.count = 0;
          entry.threshold = getRandomThreshold();

          setTimeout(() => {
            triggerTroll(context);
          }, 500);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [triggerTroll, canShowTrolls]);

  return (
    <TrollContext.Provider value={{ triggerTroll }}>
      {children}
      {/* Only show troll overlays on homepage when idle and not in restricted modes */}
      {activeTroll && canShowTrolls && (
        <TrollOverlay event={activeTroll} onComplete={() => setActiveTroll(null)} />
      )}
    </TrollContext.Provider>
  );
};

export const useTrollContext = () => {
  const context = useContext(TrollContext);
  if (!context) {
    throw new Error('useTrollContext must be used within a TrollProvider');
  }
  return context;
};

export default TrollProvider;
