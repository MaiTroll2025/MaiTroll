// src/hooks/useAuctionMe.ts
// React hook for MaiTroll Auction Me

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/store';
import {
  startAuctionMe,
  placeAuctionMeBid,
  endAuctionMe,
  cancelAuctionMe,
  getAuctionMeState,
  getTimeRemaining,
  formatTimeRemaining,
  type AuctionMeState,
} from '@/lib/auctionMe';

export function useAuctionMe(streamId: string | undefined) {
  const [state, setState] = useState<AuctionMeState | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const user = useAuthStore((s) => s.profile);

  const refreshState = useCallback(async () => {
    if (!streamId) return;
    const data = await getAuctionMeState(streamId);
    setState(data);
    if (data.active && data.ends_at) {
      setTimeRemaining(getTimeRemaining(data.ends_at));
    } else {
      setTimeRemaining(0);
    }
  }, [streamId]);

  useEffect(() => {
    refreshState();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refreshState]);

  useEffect(() => {
    if (!state?.active) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      if (state.ends_at) {
        const remaining = getTimeRemaining(state.ends_at);
        setTimeRemaining(remaining);
        if (remaining <= 0) {
          clearInterval(timerRef.current!);
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state?.active, state?.ends_at]);

  const start = useCallback(
    async (titleType: 'husband' | 'wife', startingBid: number) => {
      if (!streamId || !user?.id) return;
      setLoading(true);
      setError(null);
      const result = await startAuctionMe(streamId, user.id, titleType, startingBid);
      setLoading(false);
      if (result.success && result.data) {
        setState(result.data);
        setTimeRemaining(getTimeRemaining(result.data.ends_at || ''));
      } else {
        setError(result.error || 'Failed to start auction');
      }
      return result;
    },
    [streamId, user?.id]
  );

  const bid = useCallback(
    async (sessionId: string, amount: number) => {
      setLoading(true);
      setError(null);
      const result = await placeAuctionMeBid(sessionId, amount);
      setLoading(false);
      if (result.success && result.data) {
        setState(result.data);
        setTimeRemaining(getTimeRemaining(result.data.ends_at || ''));
      } else {
        setError(result.error || 'Failed to place bid');
      }
      return result;
    },
    []
  );

  const end = useCallback(async () => {
    if (!state?.session_id) return;
    setLoading(true);
    setError(null);
    const result = await endAuctionMe(state.session_id);
    setLoading(false);
    if (result.success) {
      await refreshState();
    } else {
      setError(result.error || 'Failed to end auction');
    }
    return result;
  }, [state?.session_id, refreshState]);

  const cancel = useCallback(async () => {
    if (!state?.session_id) return;
    setLoading(true);
    setError(null);
    const result = await cancelAuctionMe(state.session_id);
    setLoading(false);
    if (result.success) {
      await refreshState();
    } else {
      setError(result.error || 'Failed to cancel auction');
    }
    return result;
  }, [state?.session_id, refreshState]);

  const isBroadcaster = user?.id === state?.broadcaster_id;
  const isHighestBidder = user?.id === state?.current_bidder_id;

  return {
    state,
    timeRemaining,
    timeRemainingFormatted: formatTimeRemaining(timeRemaining),
    loading,
    error,
    start,
    bid,
    end,
    cancel,
    refreshState,
    isBroadcaster,
    isHighestBidder,
  };
}
