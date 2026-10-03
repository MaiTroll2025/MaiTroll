import React, { useState, useEffect } from 'react';
import { X, Minus, Plus, Coins } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MAX_GUEST_SEATS } from '../../config/broadcastCategories';

interface OpenStagePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (count: number, priceCoins: number) => void;
  loading?: boolean;
  initialCount?: number;
  initialPrice?: number;
}

export default function OpenStagePassModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  initialCount = 1,
  initialPrice = 0,
}: OpenStagePassModalProps) {
  const [count, setCount] = useState(Math.min(MAX_GUEST_SEATS, Math.max(1, initialCount)));
  const [priceCoins, setPriceCoins] = useState(Math.max(0, initialPrice));

  useEffect(() => {
    if (isOpen) {
      setCount(Math.min(MAX_GUEST_SEATS, Math.max(1, initialCount)));
      setPriceCoins(Math.max(0, initialPrice));
    }
  }, [isOpen, initialCount, initialPrice]);

  if (!isOpen) return null;

  const isFree = priceCoins === 0;
  const estimatedEarnings = count * priceCoins;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #131320 0%, #0a0a14 100%)',
          boxShadow: '0 0 60px rgba(124, 58, 237, 0.15), 0 0 120px rgba(6, 182, 212, 0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Top neon accent line */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">
              Seats
            </h2>
            <p className="text-[11px] text-slate-400 mt-1">
              Choose up to {MAX_GUEST_SEATS} viewer seats. Your broadcaster slot counts as one additional box.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
          >
            <X size={14} className="text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-5">
          {/* Number of viewer seats */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Viewer seats
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCount((c) => Math.max(1, c - 1))}
                disabled={count <= 1}
                className={cn(
                  'w-10 h-10 rounded-xl border flex items-center justify-center transition-all',
                  count <= 1
                    ? 'bg-white/5 border-white/10 text-white/25 cursor-not-allowed'
                    : 'bg-white/5 border-white/15 text-white hover:bg-white/10 hover:border-cyan-500/40'
                )}
              >
                <Minus size={16} />
              </button>

              <div className="flex-1 text-center">
                <span className="text-3xl font-black text-white tabular-nums tracking-tight">{count}</span>
              </div>

              <button
                onClick={() => setCount((c) => Math.min(MAX_GUEST_SEATS, c + 1))}
                disabled={count >= MAX_GUEST_SEATS}
                className={cn(
                  'w-10 h-10 rounded-xl border flex items-center justify-center transition-all',
                  count >= MAX_GUEST_SEATS
                    ? 'bg-white/5 border-white/10 text-white/25 cursor-not-allowed'
                    : 'bg-white/5 border-white/15 text-white hover:bg-white/10 hover:border-cyan-500/40'
                )}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Price per viewer seat */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Price per viewer seat (coins)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Coins size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/60" />
                <input
                  type="number"
                  min={0}
                  value={priceCoins}
                  onChange={(e) => setPriceCoins(Math.max(0, parseInt(e.target.value || '0', 10)))}
                  placeholder="0"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white text-sm font-semibold placeholder:text-white/25 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <button
                onClick={() => setPriceCoins(0)}
                className={cn(
                  'px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all',
                  isFree
                    ? 'bg-violet-600/30 border border-violet-500/40 text-violet-300'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
                )}
              >
                Free
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              Viewers will pay coins to claim a seat when the price is above 0.
            </p>
          </div>

          {/* Viewer seat preview */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Seat layout
            </label>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 6 }, (_, i) => {
                const slotNum = i + 1;
                const isOpen = slotNum <= count;
                return (
                  <div
                    key={slotNum}
                    className={cn(
                      'aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 border transition-all',
                      isOpen
                        ? 'bg-violet-600/15 border-violet-500/35 text-violet-300'
                        : 'bg-white/3 border-white/8 text-slate-600'
                    )}
                  >
                    <span className="text-[10px] font-black">{slotNum}</span>
                    <span className="text-[8px] font-bold uppercase tracking-wider">
                      {isOpen ? 'Open' : 'Locked'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="p-3 rounded-xl bg-white/3 border border-white/8 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">You will open</span>
              <span className="font-bold text-white">{count} viewer seat{count !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Price per seat</span>
              <span className="font-bold text-white">{isFree ? 'Free' : `${priceCoins} coins`}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-white/8">
              <span className="text-slate-400">Estimated total</span>
              <span className="font-bold text-amber-400">
                {estimatedEarnings} coins
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={() => onConfirm(count, priceCoins)}
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-black tracking-wide uppercase transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #6d28d9 100%)',
              boxShadow: '0 0 30px rgba(124,58,237,0.35), 0 0 60px rgba(124,58,237,0.15)',
            }}
          >
            <span className="text-white">
              {loading
                ? 'Applying…'
                : `Apply ${count} seat${count !== 1 ? 's' : ''}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
