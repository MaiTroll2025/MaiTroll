import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, X } from 'lucide-react';

interface TrollDropOverlayProps {
  drop: {
    id: string;
    coin_value: number;
    total_bills: number;
    ends_at: string;
  } | null;
  onClaim: (dropId: string, billIndex: number) => Promise<any>;
  onClose: () => void;
}

interface FallingBill {
  id: number;
  x: number;
  y: number;
  rotation: number;
  speed: number;
  wobble: number;
  claimed: boolean;
}

export default function TrollDropOverlay({ drop, onClaim, onClose }: TrollDropOverlayProps) {
  const [bills, setBills] = useState<FallingBill[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [claimed, setClaimed] = useState(0);
  const [showResult, setShowResult] = useState<string | null>(null);

  // Initialize bills when drop starts
  useEffect(() => {
    if (!drop) return;
    
    const newBills: FallingBill[] = [];
    for (let i = 0; i < drop.total_bills; i++) {
      newBills.push({
        id: i,
        x: Math.random() * 90 + 5,
        y: -10 - Math.random() * 20,
        rotation: Math.random() * 360,
        speed: 0.5 + Math.random() * 1.5,
        wobble: Math.random() * 10,
        claimed: false,
      });
    }
    setBills(newBills);

    // Timer
    const endsAt = new Date(drop.ends_at).getTime();
    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        onClose();
      }
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [drop, onClose]);

  // Animate bills falling
  useEffect(() => {
    if (!drop || timeLeft <= 0) return;

    const animate = () => {
      setBills(prev => prev.map(bill => {
        if (bill.claimed) return bill;
        const newY = bill.y + bill.speed;
        if (newY > 110) {
          return { ...bill, y: -10, x: Math.random() * 90 + 5 };
        }
        return {
          ...bill,
          y: newY,
          rotation: bill.rotation + 1,
          x: bill.x + Math.sin(Date.now() / 1000 + bill.wobble) * 0.3,
        };
      }));
    };

    const interval = setInterval(animate, 50);
    return () => clearInterval(interval);
  }, [drop, timeLeft]);

  const handleClaim = useCallback(async (billIndex: number) => {
    if (!drop) return;
    
    const bill = bills.find(b => b.id === billIndex);
    if (!bill || bill.claimed) return;

    try {
      const result = await onClaim(drop.id, billIndex);
      if (result?.success) {
        setBills(prev => prev.map(b => b.id === billIndex ? { ...b, claimed: true } : b));
        setClaimed(prev => prev + 1);
        setShowResult(`+${drop.coin_value} coins!`);
        setTimeout(() => setShowResult(null), 2000);
      } else {
        setShowResult(result?.error || 'Failed to claim');
        setTimeout(() => setShowResult(null), 2000);
      }
    } catch {
      setShowResult('Error claiming');
      setTimeout(() => setShowResult(null), 2000);
    }
  }, [drop, bills, onClaim]);

  if (!drop) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-auto">
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

      {/* Header */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600/90 to-yellow-600/90 rounded-full shadow-lg">
          <DollarSign size={20} className="text-white" />
          <span className="font-bold text-white">TROLL DROP</span>
          <span className="text-sm text-yellow-200">{drop.coin_value} coins each</span>
        </div>
        <div className="px-3 py-2 bg-zinc-900/90 rounded-full">
          <span className="font-mono font-bold text-white">{timeLeft}s</span>
        </div>
        <div className="px-3 py-2 bg-zinc-900/90 rounded-full">
          <span className="text-sm text-amber-300">Claimed: {claimed}/{drop.total_bills}</span>
        </div>
      </div>

      {/* Result toast */}
      {showResult && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 px-6 py-3 bg-emerald-600 rounded-full animate-bounce">
          <span className="font-bold text-white">{showResult}</span>
        </div>
      )}

      {/* Falling bills */}
      {bills.map(bill => !bill.claimed && (
        <button
          key={bill.id}
          onClick={() => handleClaim(bill.id)}
          className="absolute transition-transform hover:scale-110 cursor-pointer"
          style={{
            left: `${bill.x}%`,
            top: `${bill.y}%`,
            transform: `rotate(${bill.rotation}deg)`,
          }}
        >
          <div className="w-12 h-6 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 rounded-sm shadow-lg border border-amber-500/50 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
            <span className="text-[8px] font-black text-amber-900 relative z-10">Mai Troll</span>
            <div className="absolute right-0 top-0 w-2 h-2 bg-amber-600 rounded-full" />
          </div>
        </button>
      ))}
    </div>
  );
}
