import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { StreamEngagement, EngagementCounts } from '../../types/engagement';

interface UseStreamEngagementOptions {
  streamType: string;
  streamId: string;
  enabled?: boolean;
  pollInterval?: number;
}

interface UseStreamEngagementReturn {
  engagement: StreamEngagement | null;
  counts: EngagementCounts;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useStreamEngagement({
  streamType,
  streamId,
  enabled = true,
  pollInterval = 5000,
}: UseStreamEngagementOptions): UseStreamEngagementReturn {
  const [engagement, setEngagement] = useState<StreamEngagement | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef<boolean>(true);

  const fetchEngagement = useCallback(async () => {
    if (!enabled || !streamId) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('stream_engagement')
        .select('*')
        .eq('stream_type', streamType)
        .eq('stream_id', streamId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (mountedRef.current) {
        setEngagement(data ?? null);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [streamType, streamId, enabled]);

  const subscribeToRealtime = useCallback(() => {
    if (!enabled || !streamId) return;

    const channel = supabase
      .channel(`stream_engagement:${streamType}:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stream_engagement',
          filter: `stream_type=eq.${streamType},stream_id=eq.${streamId}`,
        },
        (payload) => {
          if (mountedRef.current) {
            setEngagement(payload.new as StreamEngagement);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamType, streamId, enabled]);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(fetchEngagement, pollInterval);
  }, [fetchEngagement, pollInterval]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchEngagement();
  }, [fetchEngagement]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);

    fetchEngagement().then(() => {
      const cleanup = subscribeToRealtime();
      startPolling();

      return () => {
        cleanup?.();
        stopPolling();
      };
    });

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [fetchEngagement, subscribeToRealtime, startPolling, stopPolling]);

  const counts: EngagementCounts = engagement
    ? {
        totalLikes: engagement.total_likes,
        totalReactions: engagement.total_reactions,
        totalMessages: engagement.total_messages,
        totalGifts: engagement.total_gifts,
        totalGiftCoins: engagement.total_gift_coins,
        uniqueLikers: engagement.unique_likers,
        uniqueReactors: engagement.unique_reactors,
        uniqueChatters: engagement.unique_chatters,
        uniqueGifters: engagement.unique_gifters,
      }
    : {
        totalLikes: 0,
        totalReactions: 0,
        totalMessages: 0,
        totalGifts: 0,
        totalGiftCoins: 0,
        uniqueLikers: 0,
        uniqueReactors: 0,
        uniqueChatters: 0,
        uniqueGifters: 0,
      };

  return { engagement, counts, loading, error, refetch };
}