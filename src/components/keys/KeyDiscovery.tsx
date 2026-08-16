import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Sparkles, Lock, Unlock } from 'lucide-react';
import type { KeyInstance, KeyRarity } from '../../types/keys';
import { KEY_RARITY_COLORS } from '../../types/keys';

interface KeyDiscoveryProps {
  keyData: {
    key_letter: string;
    rarity: KeyRarity;
    value: number;
    is_key_to_city: boolean;
    cashout_available_at: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyDiscovery({ keyData, isOpen, onClose }: KeyDiscoveryProps) {
  const [phase, setPhase] = useState<'locked' | 'unlocking' | 'revealed'>('locked');

  useEffect(() => {
    if (isOpen && keyData) {
      setPhase('locked');
      const timer1 = setTimeout(() => setPhase('unlocking'), 800);
      const timer2 = setTimeout(() => setPhase('revealed'), 1800);
      const timer3 = setTimeout(() => {}, 5000);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isOpen, keyData]);

  if (!isOpen || !keyData) return null;

  const colors = KEY_RARITY_COLORS[keyData.rarity];
  const isLegendary = keyData.rarity === 'LEGENDARY';
  const isKeyToCity = keyData.is_key_to_city;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
        >
          <div className="w-full max-w-sm text-center">
            {/* Phase 1: Locked */}
            {phase === 'locked' && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="space-y-4"
              >
                <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-4 border-white/20 bg-white/5">
                  <Lock className="h-16 w-16 text-white/60" />
                </div>
                <p className="text-lg font-bold text-white">THE CITY HAS GIVEN YOU A KEY...</p>
                <p className="text-sm text-white/50">Unlocking...</p>
              </motion.div>
            )}

            {/* Phase 2: Unlocking */}
            {phase === 'unlocking' && (
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 0.6 }}
                className="space-y-4"
              >
                <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-4 border-yellow-500/50 bg-yellow-500/10">
                  <Key className="h-16 w-16 text-yellow-400" />
                </div>
                <div className="flex items-center justify-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                    >
                      <Sparkles className="h-4 w-4 text-yellow-400" />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Phase 3: Revealed */}
            {phase === 'revealed' && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 15 }}
                className="space-y-4"
              >
                {isKeyToCity && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ delay: 0.3 }}
                    className="mx-auto inline-flex rounded-full bg-yellow-500 px-4 py-1.5 text-sm font-black text-black"
                  >
                    🔑 KEY TO THE CITY
                  </motion.div>
                )}

                <div
                  className={`mx-auto flex h-40 w-40 items-center justify-center rounded-3xl border-4 ${colors.border} ${colors.bg} shadow-2xl ${isLegendary ? 'shadow-yellow-500/40' : ''}`}
                >
                  <span className={`text-6xl font-black ${colors.text}`}>
                    {keyData.key_letter}
                  </span>
                </div>

                <div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
                    {keyData.rarity.replace('_', ' ')}
                  </span>
                </div>

                {isKeyToCity ? (
                  <p className="text-2xl font-black text-yellow-300">20,000 TC</p>
                ) : (
                  <p className="text-xl font-bold text-white">
                    {keyData.value.toLocaleString()} <span className="text-white/60">Troll Coins</span>
                  </p>
                )}

                <p className="text-xs text-white/50">
                  Cashout available in 14 days
                </p>

                <button
                  onClick={onClose}
                  className="mt-4 rounded-xl bg-white/10 px-6 py-3 text-sm font-bold text-white hover:bg-white/20"
                >
                  Awesome!
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
