import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Zap, Shield, Star, Crown, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { BattleRandomEvent, BATTLE_EVENT_CONFIGS, BattleEventType } from '@/types/battle';
import { cn } from '@/lib/utils';

interface BattleEventOverlayProps {
  battleId: string;
  onClose?: () => void;
}

const EVENT_ICONS: Record<BattleEventType, React.ReactNode> = {
  triple_points: <Star className="w-12 h-12 text-yellow-400" />,
  turtle_mode: <Shield className="w-12 h-12 text-green-400" />,
  turbo_mode: <Zap className="w-12 h-12 text-red-400" />,
  glow_mode: <Star className="w-12 h-12 text-purple-400" />,
  ceo_mode: <Crown className="w-12 h-12 text-blue-400" />,
};

export default function BattleEventOverlay({ battleId, onClose }: BattleEventOverlayProps) {
  const { profile } = useAuthStore();
  const [event, setEvent] = useState<BattleRandomEvent | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isVisible, setIsVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!battleId) return;

    const fetchEvent = async () => {
      const { data, error } = await supabase
        .from('battle_random_events')
        .select('*')
        .eq('battle_id', battleId)
        .eq('status', 'active')
        .single();

      if (error || !data) {
        setEvent(null);
        return;
      }

      setEvent(data as BattleRandomEvent);
      const now = new Date();
      const endsAt = new Date(data.ends_at);
      const remaining = Math.max(0, Math.floor((endsAt.getTime() - now.getTime()) / 1000));
      setTimeRemaining(remaining);
    };

    fetchEvent();

    intervalRef.current = setInterval(fetchEvent, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [battleId]);

  useEffect(() => {
    if (event) {
      setIsVisible(true);
    }
  }, [event]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onClose?.();
    }, 300);
  }, [onClose]);

  if (!event) return null;

  const config = BATTLE_EVENT_CONFIGS[event.event_type];
  const endsAt = new Date(event.ends_at);
  const startedAt = new Date(event.starts_at);
  const totalDuration = (endsAt.getTime() - startedAt.getTime()) / 1000;
  const elapsed = totalDuration - timeRemaining;
  const progressPercent = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div
            className={cn(
              'relative w-full max-w-md mx-4 rounded-2xl border-2 p-6 text-center shadow-2xl',
              config.bgGradient,
              config.borderColor
            )}
          >
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 rounded-full bg-black/40 p-1.5 text-white/70 hover:text-white transition-colors"
              aria-label="Close event banner"
            >
              <X size={16} />
            </button>

            <div className="mb-4 flex justify-center">
              {EVENT_ICONS[event.event_type]}
            </div>

            <h2
              className={cn(
                'text-2xl font-black uppercase tracking-wider mb-2',
                config.color
              )}
            >
              {config.label}
            </h2>

            <p className="text-sm text-white/80 mb-4">
              {config.description}
            </p>

            {event.event_type === 'ceo_mode' && (
              <div className="mb-4 rounded-lg bg-black/30 p-3">
                <p className="text-sm font-bold text-white/90">
                  CEO MODE
                </p>
                <p className="text-xs text-white/60 mt-1">
                  This host's gift vault is locked for 10 seconds.
                </p>
              </div>
            )}

            {event.event_type === 'glow_mode' && (
              <div className="mb-4 rounded-lg bg-black/30 p-3">
                <p className="text-sm font-bold text-white/90">
                  GLOW MODE
                </p>
                <p className="text-xs text-white/60 mt-1">
                   Send 1,000+ troll_coins to earn double bonus coins for both hosts!
                </p>
              </div>
            )}

            <div className="mb-4">
              <div className="flex items-center justify-center gap-2 text-white/70 text-sm">
                <Clock size={14} />
                <span>Time Remaining</span>
              </div>
              <div className="mt-1 font-mono text-3xl font-black text-white">
                {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
              </div>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/30">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: 'linear' }}
                style={{
                  backgroundColor:
                    event.event_type === 'turbo_mode' ? '#ef4444' :
                    event.event_type === 'turtle_mode' ? '#22c55e' :
                    event.event_type === 'triple_points' ? '#eab308' :
                    event.event_type === 'glow_mode' ? '#a855f7' :
                    '#3b82f6',
                }}
              />
            </div>

            <p className="mt-3 text-xs text-white/50">
              Multiplier: {event.multiplier}x
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { EVENT_ICONS };