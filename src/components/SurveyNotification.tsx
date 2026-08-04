import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, X, ChevronRight } from 'lucide-react';

import { useAuthStore } from '@/lib/store';
import { getActiveSurveyForCurrentWeek, hasUserRespondedToSurvey } from '@/lib/survey';
import type { WeeklySurvey } from '@/types/survey';

interface SurveyNotificationProps {
  onDismissed?: () => void;
}

export default function SurveyNotification({ onDismissed }: SurveyNotificationProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [survey, setSurvey] = useState<WeeklySurvey | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);

  const checkSurvey = useCallback(async () => {
    if (!user?.id) return;

    try {
      const activeSurvey = await getActiveSurveyForCurrentWeek();
      if (!activeSurvey) return;

      const responded = await hasUserRespondedToSurvey(activeSurvey.id, user.id);
      if (responded) return;

      setSurvey(activeSurvey);
      setVisible(true);
    } catch (err) {
      console.error('[SurveyNotification] Check failed:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    checkSurvey();
  }, [checkSurvey]);

  useEffect(() => {
    if (!visible || dismissed) return;
    if (timeLeft <= 0) {
      handleDismiss();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, dismissed, timeLeft]);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    onDismissed?.();
  };

  const handleTakeSurvey = () => {
    if (survey) {
      navigate(`/survey/${survey.id}`);
    }
    handleDismiss();
  };

  if (!visible || !survey) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -30, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4"
      >
        <div className="rounded-2xl border border-purple-500/30 bg-gray-900/95 backdrop-blur-xl shadow-2xl shadow-purple-500/10 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-5 py-3 flex items-center justify-between border-b border-purple-500/20">
            <div className="flex items-center gap-2">
              <div className="relative">
                <ClipboardList className="h-5 w-5 text-purple-400" />
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-purple-500 animate-pulse" />
              </div>
              <span className="text-sm font-bold text-purple-400">Weekly Survey</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{timeLeft}s</span>
              <button
                onClick={handleDismiss}
                className="rounded-full p-1 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-5 py-4">
            <h3 className="text-lg font-bold text-white mb-1">{survey.title}</h3>
            <p className="text-sm text-gray-400 mb-4">
              Share your feedback to help improve Mai Troll! Tell us what needs to be changed, any issues, and what you want to see next.
            </p>

            <button
              onClick={handleTakeSurvey}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 text-sm font-bold text-white hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/20 active:scale-[0.98]"
            >
              <ClipboardList className="h-4 w-4" />
              Take Survey
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="h-0.5 bg-gray-800">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 15, ease: 'linear' }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
