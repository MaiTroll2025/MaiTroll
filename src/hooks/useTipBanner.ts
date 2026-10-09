import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface TipBannerData {
  id: string;
  username: string;
  giftName: string;
  giftIcon: string;
  amount: number;
  coinCost: number;
}

const TIP_BANNER_DURATION_MS = 4000;

/**
 * useTipBanner — Listens for gift/tip broadcast events on a stream and
 * manages a queue of tip banners to display, each lasting 4 seconds.
 *
 * Listens on the `stream-gifts:{streamId}` channel (same channel the
 * gift system broadcasts on) for `gift_sent` events.
 */
export function useTipBanner(streamId: string | null | undefined) {
  const [activeTip, setActiveTip] = useState<TipBannerData | null>(null);
  const [_queue, setQueue] = useState<TipBannerData[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isShowingRef = useRef(false);

  const showNextTip = useCallback(() => {
    setQueue((prev) => {
      if (prev.length === 0) {
        isShowingRef.current = false;
        return prev;
      }
      const [next, ...rest] = prev;
      setActiveTip(next);
      isShowingRef.current = true;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setActiveTip(null);
        setTimeout(() => showNextTip(), 300);
      }, TIP_BANNER_DURATION_MS);

      return rest;
    });
  }, []);

  const enqueueTip = useCallback(
    (tip: TipBannerData) => {
      if (isShowingRef.current) {
        setQueue((prev) => [...prev, tip]);
      } else {
        setActiveTip(tip);
        isShowingRef.current = true;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setActiveTip(null);
          setTimeout(() => showNextTip(), 300);
        }, TIP_BANNER_DURATION_MS);
      }
    },
    [showNextTip],
  );

  // Listen for gift broadcast events on the gift channel
  useEffect(() => {
    if (!streamId) return;

    // Listen on the same channel the gift system broadcasts on.
    // Multiple clients can subscribe to the same channel name in Supabase.
    const channel = supabase.channel(`stream-gifts:${streamId}`);

    channel
      .on('broadcast', { event: 'gift_sent' }, (payload: any) => {
        const data = payload?.payload;
        if (!data) return;

        const tip: TipBannerData = {
          id: data.id || `tip-${Date.now()}-${Math.random()}`,
          username: data.sender_name || data.username || 'Someone',
          giftName: data.gift_name || data.item_name || 'Gift',
          giftIcon: data.gift_icon || data.icon || '🎁',
          amount: data.quantity || data.amount || 1,
          coinCost: data.amount || data.coin_cost || data.coinCost || 0,
        };

        enqueueTip(tip);
      })
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [streamId, enqueueTip]);

  return { activeTip, enqueueTip };
}
