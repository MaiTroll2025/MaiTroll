import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { useStreamRealtime } from '../../hooks/useStreamRealtime';

interface BroadcastLevelBarProps {
  broadcasterId: string;
  streamId?: string;
  className?: string;
}

const MAX_BAR_COINS = 500000000;
const COINS_PER_SECOND = 10;

export default function BroadcastLevelBar({ broadcasterId, streamId, className }: BroadcastLevelBarProps) {
  const [barCoins, setBarCoins] = useState(0);
  const [totalSessionGiftCoins, setTotalSessionGiftCoins] = useState(0);

  const barCoinsRef = useRef(0);
  const holdUntilRef = useRef(0);
  const lastSeenGiftIdsRef = useRef<Set<string>>(new Set());

  const addGiftToBar = useCallback((giftId: string, amount: number) => {
    if (!giftId || lastSeenGiftIdsRef.current.has(giftId)) return;

    lastSeenGiftIdsRef.current.add(giftId);

    const safeAmount = Math.max(0, Number(amount) || 0);
    if (safeAmount <= 0) return;

    setTotalSessionGiftCoins((prev) => prev + safeAmount);

    const nextCoins = Math.min(MAX_BAR_COINS, barCoinsRef.current + safeAmount);
    barCoinsRef.current = nextCoins;
    setBarCoins(nextCoins);

    // 10 coins = 1 second hold. 100 coins = 10 seconds. 500+ coins = 50 seconds.
    const holdSeconds = Math.min(safeAmount, MAX_BAR_COINS) / COINS_PER_SECOND;
    holdUntilRef.current = Math.max(
      holdUntilRef.current,
      Date.now() + holdSeconds * 1000
    );
  }, []);

  useEffect(() => {
    if (!broadcasterId) return;

    const handleGiftLevel = (event: Event) => {
      const detail = (event as CustomEvent<{
        giftId?: string;
        broadcasterId?: string;
        receiverId?: string;
        streamId?: string;
        amount?: number;
      }>).detail;

      if (!detail) return;
      if (detail.broadcasterId !== broadcasterId && detail.receiverId !== broadcasterId && detail.streamId !== streamId) return;

      addGiftToBar(detail.giftId || `gift-${Date.now()}`, Number(detail.amount || 0));
    };

    window.addEventListener('broadcast-gift-level', handleGiftLevel);
    return () => window.removeEventListener('broadcast-gift-level', handleGiftLevel);
  }, [addGiftToBar, broadcasterId, streamId]);

  useEffect(() => {
    setBarCoins(0);
    setTotalSessionGiftCoins(0);
    barCoinsRef.current = 0;
    holdUntilRef.current = 0;
    lastSeenGiftIdsRef.current.clear();
  }, [broadcasterId, streamId]);

  useStreamRealtime(streamId, {
    onGift: (event) => {
      const gift = event.new as any;
      if (!gift) return;
      if (broadcasterId && gift.receiver_id !== broadcasterId && gift.recipient_id !== broadcasterId) return;

      const amount = gift.coins_spent ?? gift.coins_amount ?? gift.amount ?? 0;
      addGiftToBar(String(gift.id || `${gift.sender_id}-${gift.created_at}`), Number(amount));
    },
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();

      if (barCoinsRef.current <= 0) return;
      if (now < holdUntilRef.current) return;

      const nextCoins = Math.max(0, barCoinsRef.current - 1);
      barCoinsRef.current = nextCoins;
      setBarCoins(nextCoins);
    }, 100);

    return () => window.clearInterval(interval);
  }, []);

  const progress = Math.min(100, (barCoins / MAX_BAR_COINS) * 100);
  const _level = Math.floor(totalSessionGiftCoins / 1000) + 1;

  return (
    <div className={cn("w-full", className)}>
      <div className="h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/10 backdrop-blur-sm relative">
        <div
          className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(250,204,21,0.5)]"
          style={{ width: `${progress}%` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full -translate-x-full animate-[shimmer_2s_infinite]" />
      </div>
    </div>
  );
}
