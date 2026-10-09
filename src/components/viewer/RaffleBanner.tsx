import React, { useState, useEffect } from 'react';
import { Trophy, Clock, Users, Minus, Plus } from 'lucide-react';

interface RaffleBannerProps {
  raffle: {
    id: string;
    ticket_cost: number;
    current_round: number;
    next_draw_at: string;
  } | null;
  tickets: { ticket_number: number }[];
  onBuy: (raffleId: string, qty: number) => Promise<void>;
  onDraw?: (raffleId: string) => Promise<void>;
  isAdmin?: boolean;
}

export default function RaffleBanner({ raffle, tickets, onBuy, onDraw, isAdmin }: RaffleBannerProps) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showResult, setShowResult] = useState<string | null>(null);

  useEffect(() => {
    if (!raffle) return;
    const update = () => {
      const remaining = Math.max(0, Math.floor((new Date(raffle.next_draw_at).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [raffle]);

  if (!raffle) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleBuy = async () => {
    try {
      await onBuy(raffle.id, quantity);
      setShowResult(`Bought ${quantity} ticket(s)!`);
      setTimeout(() => setShowResult(null), 2000);
    } catch (err: any) {
      setShowResult(err.message || 'Failed to buy');
      setTimeout(() => setShowResult(null), 2000);
    }
  };

  const handleDraw = async () => {
    if (!onDraw) return;
    try {
      const _result = await onDraw(raffle.id);
      setShowResult('Winners drawn!');
      setTimeout(() => setShowResult(null), 3000);
    } catch (_err: any) {
      setShowResult('Draw failed');
      setTimeout(() => setShowResult(null), 2000);
    }
  };

  return (
    <div className="bg-gradient-to-r from-emerald-900/90 to-teal-900/90 border border-emerald-500/30 rounded-xl p-3 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-emerald-400" />
          <span className="font-bold text-emerald-300 text-sm">Smoke Event Raffle</span>
          <span className="text-xs bg-emerald-600/50 px-2 py-0.5 rounded-full text-emerald-200">
            Round {raffle.current_round}
          </span>
        </div>
        <div className="flex items-center gap-1 text-emerald-300">
          <Clock size={14} />
          <span className="font-mono text-sm font-bold">{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Prize info */}
      <div className="flex items-center gap-3 mb-2 text-xs">
        <span className="text-yellow-300">1st: $25</span>
        <span className="text-zinc-300">2nd: $15</span>
        <span className="text-amber-600">3rd: $5</span>
      </div>

      {/* Tickets owned */}
      {tickets.length > 0 && (
        <div className="flex items-center gap-1 mb-2 text-xs text-emerald-200">
          <Users size={12} />
          <span>You have {tickets.length} ticket(s)</span>
        </div>
      )}

      {/* Result toast */}
      {showResult && (
        <div className="mb-2 px-3 py-1.5 bg-emerald-600/50 rounded-lg text-center">
          <span className="text-sm font-bold text-white">{showResult}</span>
        </div>
      )}

      {/* Buy controls */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-zinc-800/80 rounded-lg">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="p-1.5 text-zinc-400 hover:text-white"
          >
            <Minus size={14} />
          </button>
          <span className="text-sm font-bold text-white w-6 text-center">{quantity}</span>
          <button
            onClick={() => setQuantity(Math.min(10, quantity + 1))}
            className="p-1.5 text-zinc-400 hover:text-white"
          >
            <Plus size={14} />
          </button>
        </div>
        <button
          onClick={handleBuy}
          className="flex-1 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-lg text-sm hover:from-emerald-400 hover:to-teal-500 transition-all"
        >
          Buy {quantity} Ticket{quantity > 1 ? 's' : ''} ({raffle.ticket_cost * quantity} coins)
        </button>
        {isAdmin && (
          <button
            onClick={handleDraw}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs transition-all"
          >
            Draw Now
          </button>
        )}
      </div>
    </div>
  );
}
