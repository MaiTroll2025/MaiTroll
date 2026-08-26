// src/components/broadcast/SeatFocusButton.tsx
// Seat Focus button for viewer pages

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, X, Volume2, VolumeX } from 'lucide-react';
import type { SeatInfo } from '@/hooks/useSeatFocus';

interface SeatFocusButtonProps {
  seats: Record<number, SeatInfo>;
  focusedUserId: string;
  focusedSeatIndex: number | null;
  onToggle: (seatIndex: number, seatUserId: string | null | undefined) => void;
  onFocusAll: () => void;
  getSeatLabel: (seatIndex: number) => string;
  isFocused: (seatIndex: number, seatUserId?: string) => boolean;
}

export default function SeatFocusButton({
  seats,
  focusedUserId,
  focusedSeatIndex,
  onToggle,
  onFocusAll,
  getSeatLabel,
  isFocused,
}: {
  seats: Record<number, any>;
  focusedUserId: string;
  focusedSeatIndex: number | null;
  onToggle: (seatIndex: number, seatUserId: string | null | undefined) => void;
  onFocusAll: () => void;
  getSeatLabel: (seatIndex: number) => string;
  isFocused: (seatIndex: number, seatUserId?: string) => boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const seatEntries = Object.entries(seats).filter(
    ([, seat]) => seat.userId || seat.guestId
  );

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`p-2 rounded-xl border transition-all ${
          focusedUserId !== 'all'
            ? 'bg-neon-blue/20 border-neon-blue text-neon-blue'
            : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
        }`}
        title={focusedUserId !== 'all' ? 'Listening to one person' : 'Listen to all'}
      >
        {focusedUserId !== 'all' ? (
          <Volume2 className="w-5 h-5" />
        ) : (
          <Users className="w-5 h-5" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full left-0 mb-2 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-sm font-bold text-white">Audio Focus</span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2">
              <button
                onClick={() => {
                  onFocusAll();
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  focusedUserId === 'all'
                    ? 'bg-neon-blue/20 text-neon-blue'
                    : 'text-zinc-300 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  <span className="font-medium">Listen to All</span>
                </div>
              </button>

              <div className="mt-2 space-y-1">
                {seatEntries.map(([seatIndex, seat]) => {
                  const seatUserId = seat.userId || seat.guestId || null;
                  const focused = isFocused(parseInt(seatIndex), seatUserId || undefined);
                  return (
                    <button
                      key={seatIndex}
                      onClick={() => {
                        onToggle(parseInt(seatIndex), seatUserId);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        focused
                          ? 'bg-neon-blue/20 text-neon-blue'
                          : 'text-zinc-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <VolumeX className="w-4 h-4" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {seat.username || `Seat ${parseInt(seatIndex) + 1}`}
                          </div>
                          <div className="text-xs opacity-70">
                            {getSeatLabel(parseInt(seatIndex))}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
