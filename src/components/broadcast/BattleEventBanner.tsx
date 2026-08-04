import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { BattleRandomEvent, BATTLE_EVENT_CONFIGS } from '@/types/battle';
import { cn } from '@/lib/utils';

interface BattleEventBannerProps {
  battleId: string;
  onEventStart?: (event: BattleRandomEvent) => void;
}

export default function BattleEventBanner({ battleId, onEventStart }: BattleEventBannerProps) {
  const { profile } = useAuthStore();
  const [activeEvent, setActiveEvent] = useState<BattleRandomEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!battleId) return;

    const fetchActiveEvent = async () => {
      const { data, error } = await supabase
        .from('battle_random_events')
        .select('*')
        .eq('battle_id', battleId)
        .eq('status', 'active')
        .single();

      if (error || !data) {
        setActiveEvent(null);
        setDismissed(false);
        return;
      }

      const event = data as BattleRandomEvent;

      if (activeEvent?.id !== event.id) {
        setActiveEvent(event);
        setDismissed(false);
        setIsVisible(true);
        onEventStart?.(event);
      }
    };

    fetchActiveEvent();

    const channel = supabase
      .channel(`battle-event-banner:${battleId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'battle_random_events',
        filter: `battle_id=eq.${battleId}`,
      }, (payload) => {
        const newEvent = payload.new as BattleRandomEvent;
        if (newEvent.status === 'active') {
          setActiveEvent(newEvent);
          setDismissed(false);
          setIsVisible(true);
          onEventStart?.(newEvent);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'battle_random_events',
        filter: `battle_id=eq.${battleId}`,
      }, (payload) => {
        const updated = payload.new as BattleRandomEvent;
        if (updated.status === 'expired' || updated.status === 'cancelled') {
          setActiveEvent(null);
          setDismissed(false);
          setIsVisible(false);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [battleId, onEventStart]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setDismissed(true);
  }, []);

  if (!activeEvent || dismissed) return null;

  const config = BATTLE_EVENT_CONFIGS[activeEvent.event_type];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={cn(
            'fixed top-0 left-0 right-0 z-40 mx-4 mt-2 rounded-xl border-2 p-3 shadow-xl backdrop-blur-md sm:mx-auto sm:max-w-lg',
            config.bgGradient,
            config.borderColor
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{config.icon}</div>
              <div className="text-left">
                <h3
                  className={cn(
                    'text-sm font-black uppercase tracking-wider',
                    config.color
                  )}
                >
                  {config.label}
                </h3>
                <p className="text-xs text-white/70">
                  {config.description}
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="rounded-full bg-black/30 p-1 text-white/60 hover:text-white transition-colors"
              aria-label="Dismiss event notification"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}