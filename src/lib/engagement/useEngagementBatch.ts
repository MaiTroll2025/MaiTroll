import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { EngagementBatch, StreamType } from '../../types/engagement';

interface UseEngagementBatchOptions {
  streamType: StreamType;
  streamId: string;
  userId: string;
  enabled?: boolean;
  flushInterval?: number;
}

interface UseEngagementBatchReturn {
  batch: EngagementBatch;
  incrementLikes: (count?: number) => void;
  incrementReactions: (count?: number) => void;
  incrementMessages: (count?: number) => void;
  flush: () => Promise<void>;
  isFlushing: boolean;
}

const DEFAULT_FLUSH_INTERVAL = 2500;
const MAX_BATCH_SIZE = 1000;

export function useEngagementBatch({
  streamType,
  streamId,
  userId,
  enabled = true,
  flushInterval = DEFAULT_FLUSH_INTERVAL,
}: UseEngagementBatchOptions): UseEngagementBatchReturn {
  const [batch, setBatch] = useState<EngagementBatch>({
    likes: 0,
    reactions: 0,
    messages: 0,
    gifts: 0,
    giftCoins: 0,
  });
  const [isFlushing, setIsFlushing] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batchRef = useRef<EngagementBatch>({
    likes: 0,
    reactions: 0,
    messages: 0,
    gifts: 0,
    giftCoins: 0,
  });
  const mountedRef = useRef<boolean>(true);

  const flush = useCallback(async () => {
    if (!enabled || !streamId || !userId) return;

    const currentBatch = batchRef.current;
    const hasPending =
      currentBatch.likes > 0 ||
      currentBatch.reactions > 0 ||
      currentBatch.messages > 0 ||
      currentBatch.gifts > 0 ||
      currentBatch.giftCoins > 0;

    if (!hasPending) return;

    setIsFlushing(true);

    try {
      const { error } = await supabase.rpc('increment_stream_engagement', {
        p_stream_type: streamType,
        p_stream_id: streamId,
        p_likes: Math.min(currentBatch.likes, MAX_BATCH_SIZE),
        p_reactions: Math.min(currentBatch.reactions, MAX_BATCH_SIZE),
        p_messages: Math.min(currentBatch.messages, MAX_BATCH_SIZE),
        p_gifts: Math.min(currentBatch.gifts, MAX_BATCH_SIZE),
        p_gift_coins: Math.min(currentBatch.giftCoins, MAX_BATCH_SIZE),
        p_user_id: userId,
      });

      if (error) throw error;

      if (mountedRef.current) {
        batchRef.current = { likes: 0, reactions: 0, messages: 0, gifts: 0, giftCoins: 0 };
        setBatch(batchRef.current);
      }
    } catch (err) {
      console.error('Failed to flush engagement batch:', err);
    } finally {
      if (mountedRef.current) {
        setIsFlushing(false);
      }
    }
  }, [streamType, streamId, userId, enabled]);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(flush, flushInterval);
  }, [flush, flushInterval]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const incrementLikes = useCallback(
    (count: number = 1) => {
      batchRef.current = { ...batchRef.current, likes: batchRef.current.likes + count };
      setBatch(batchRef.current);
    },
    []
  );

  const incrementReactions = useCallback(
    (count: number = 1) => {
      batchRef.current = { ...batchRef.current, reactions: batchRef.current.reactions + count };
      setBatch(batchRef.current);
    },
    []
  );

  const incrementMessages = useCallback(
    (count: number = 1) => {
      batchRef.current = { ...batchRef.current, messages: batchRef.current.messages + count };
      setBatch(batchRef.current);
    },
    []
  );

  useEffect(() => {
    mountedRef.current = true;
    startTimer();

    return () => {
      mountedRef.current = false;
      stopTimer();
      flush();
    };
  }, [startTimer, stopTimer, flush]);

  return {
    batch,
    incrementLikes,
    incrementReactions,
    incrementMessages,
    flush,
    isFlushing,
  };
}