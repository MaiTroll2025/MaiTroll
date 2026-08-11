import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft, SkipForward } from 'lucide-react';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  spotlightPadding?: number;
}

interface TutorialOverlayProps {
  steps: TutorialStep[];
  currentStepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
  isTouchDevice: boolean;
}

function isTouchDeviceDetector(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    ('maxTouchPoints' in navigator && (navigator as any).maxTouchPoints > 0)
  );
}

export default function TutorialOverlay({
  steps,
  currentStepIndex,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  isTouchDevice,
}: TutorialOverlayProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = steps[currentStepIndex];
  const isLast = currentStepIndex === steps.length - 1;
  const isFirst = currentStepIndex === 0;

  const updateTargetRect = useCallback(() => {
    if (!step.targetSelector) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      } as DOMRect);
    } else {
      setTargetRect(null);
    }
  }, [step.targetSelector]);

  useEffect(() => {
    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);
    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [updateTargetRect]);

  const padding = step.spotlightPadding ?? 12;
  const spotlightStyle: React.CSSProperties = targetRect
    ? {
        position: 'fixed',
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
        borderRadius: 16,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.75)',
        zIndex: 9998,
        pointerEvents: 'none',
        transition: 'all 0.3s ease',
      }
    : { display: 'none' };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999]"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60" />

        {/* Spotlight cutout */}
        {targetRect && (
          <div
            style={spotlightStyle}
            className="border-2 border-cyan-400/80"
          />
        )}

        {/* Animated pointer indicator */}
        {targetRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: targetRect.left + targetRect.width / 2 - 16,
              y: targetRect.top + targetRect.height / 2 - 16,
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="fixed z-[9999] pointer-events-none"
          >
            {isTouchDevice ? (
              <div className="text-4xl animate-bounce">👆</div>
            ) : (
              <svg width="32" height="32" viewBox="0 0 32 32" className="drop-shadow-lg">
                <path d="M8 4 L24 16 L16 18 L14 28 Z" fill="white" stroke="#06b6d4" strokeWidth="2" />
              </svg>
            )}
          </motion.div>
        )}

        {/* Tooltip card */}
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 p-5 shadow-2xl backdrop-blur"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-full p-1 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <h3 className="mb-2 text-lg font-bold text-white">{step.title}</h3>
          <p className="mb-4 text-sm leading-relaxed text-slate-300">{step.description}</p>

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {!isFirst && (
                <button
                  type="button"
                  onClick={onPrev}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={onSkip}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
              >
                <SkipForward className="h-4 w-4" />
                Skip
              </button>
            </div>

            <button
              type="button"
              onClick={isLast ? onComplete : onNext}
              className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-bold text-white hover:from-cyan-600 hover:to-blue-700"
            >
              {isLast ? 'Finish' : 'Next'}
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </motion.div>
        </motion.div>
      </AnimatePresence>
  );
}
