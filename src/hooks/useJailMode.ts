import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { moderation, type JailState } from '@/services/maitrollModeration';

export function useJailMode(userId: string | undefined) {
  const [isJailed, setIsJailed] = useState(false);
  const [jailState, setJailState] = useState<JailState | null>(null);
  const [jailTimeRemaining, setJailTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsJailed(false);
      setJailState(null);
      return;
    }

    const checkJailStatus = async () => {
      try {
        const state = await moderation.getJailState(userId);
        if (state.isJailed) {
          setIsJailed(true);
          setJailState(state);
        } else {
          setIsJailed(false);
          setJailState(null);
        }
      } catch (err) {
        console.error('Error fetching jail status:', err);
        setIsJailed(false);
        setJailState(null);
      }
    };

    checkJailStatus();

    const subscription = supabase
      .channel(`jail:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jail',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          checkJailStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userId]);

  useEffect(() => {
    if (!isJailed || !jailState?.scheduledReleaseAt) {
      if (isJailed && !jailState?.scheduledReleaseAt) {
        setJailTimeRemaining(null);
      }
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const release = new Date(jailState.scheduledReleaseAt);
      const remaining = release.getTime() - now.getTime();

      if (remaining > 0) {
        setJailTimeRemaining(remaining);
      } else {
        setJailTimeRemaining(0);
        setIsJailed(false);
        setJailState(null);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isJailed, jailState?.scheduledReleaseAt]);

  return {
    isJailed,
    jailState,
    jailTimeRemaining,
  };
}
