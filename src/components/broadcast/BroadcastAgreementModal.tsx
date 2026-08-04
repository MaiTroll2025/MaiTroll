import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BroadcastAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const BroadcastAgreementModal: React.FC<BroadcastAgreementModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [checked, setChecked] = useState(false);

  const handleConfirm = () => {
    if (!checked) return;
    onConfirm();
  };

  const handleClose = () => {
    setChecked(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
              'w-full max-w-lg p-6 rounded-2xl',
              'bg-gradient-to-b from-zinc-900 to-black',
              'border-2 border-amber-400/50',
              'shadow-[0_0_60px_rgba(245,158,11,0.2)]'
            )}
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex justify-center mb-4">
              <div className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center',
                'bg-amber-500/20 border-2 border-amber-400',
                'shadow-[0_0_20px_rgba(245,158,11,0.3)]'
              )}>
                <ShieldCheck size={32} className="text-amber-400" />
              </div>
            </div>

            <h2 className="text-2xl font-black text-center text-white mb-4">
              Broadcast Agreement
            </h2>

            <div className="max-h-60 overflow-y-auto rounded-xl bg-zinc-800/60 border border-zinc-700 p-4 mb-5 text-sm text-zinc-300 leading-relaxed space-y-3">
              <p>
                By starting a broadcast, I confirm that I am at least 18 years old and will comply with all applicable laws in my jurisdiction. I understand that I am solely responsible for the content I create, stream, share, or display on Mai Troll.
              </p>
              <p>
                I agree not to broadcast illegal activity, sell or promote controlled substances, threaten or harm others, share non-consensual content, or violate Mai Troll's Terms of Service or Community Guidelines.
              </p>
              <p>
                I further acknowledge that I am of legal age in my jurisdiction to consume any products, substances, beverages, or other items that may be displayed or consumed during my broadcast, and that any such activity is conducted at my own responsibility and in compliance with local laws.
              </p>
              <p>
                Mai Troll reserves the right to remove content, suspend broadcasts, restrict features, or terminate accounts that violate these rules.
              </p>
            </div>

            <label className="flex items-start gap-3 mb-5 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="sr-only peer"
                />
                <div className={cn(
                  'w-5 h-5 rounded border-2 transition-all',
                  checked
                    ? 'bg-amber-500 border-amber-500'
                    : 'bg-zinc-800 border-zinc-600 group-hover:border-zinc-500'
                )}>
                  {checked && (
                    <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-zinc-300 leading-snug">
                I am 18 years of age or older and agree to the Broadcast Agreement, Terms of Service, and Community Guidelines.
              </span>
            </label>

            <div className="space-y-3">
              <button
                onClick={handleConfirm}
                disabled={!checked}
                className={cn(
                  'w-full py-3 px-4 rounded-xl font-bold text-black transition-all',
                  checked
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 transform hover:scale-[1.02] shadow-lg shadow-amber-500/25'
                    : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                )}
              >
                I Agree — Start Broadcast
              </button>

              <button
                onClick={handleClose}
                className={cn(
                  'w-full py-3 px-4 rounded-xl font-bold',
                  'bg-zinc-800 text-zinc-300',
                  'hover:bg-zinc-700 hover:text-white',
                  'transition-all border border-zinc-700'
                )}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BroadcastAgreementModal;
