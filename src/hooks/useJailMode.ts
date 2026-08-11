import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { moderation } from '@/services/maitrollModeration';

export function useJailMode(userId: string | undefined) {
  const [isJailed, setIsJailed] = useState(false);
  const [releaseTime, setReleaseTime] = useState<string | null>(null);
  const [jailTimeRemaining, setJailTimeRemaining] = useState<number | null>(null);
  const [jailId, setJailId] = useState<string | null>(null);
  const [disciplineLevel, setDisciplineLevel] = useState<number>(0);
  const [bondAmount, setBondAmount] = useState<number>(0);
  const [bondAllowed, setBondAllowed] = useState(false);

  useEffect(() => {
    if (!userId) {
      setIsJailed(false);
      return;
    }

    const checkJailStatus = async () => {
      try {
        const state = await moderation.getJailState(userId);
        if (state.isJailed) {
          setIsJailed(true);
          setReleaseTime(state.scheduledReleaseAt || null);
          setJailId(state.jailId || null);
          setDisciplineLevel(state.disciplineLevel || 1);
          setBondAmount(state.bondAmount || 0);
          setBondAllowed(state.bondAllowed || false);
        } else {
          setIsJailed(false);
          setReleaseTime(null);
          setJailId(null);
          setDisciplineLevel(0);
          setBondAmount(0);
          setBondAllowed(false);
        }
      } catch (err) {
        console.error('Error fetching jail status:', err);
        setIsJailed(false);
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
    if (isJailed && releaseTime) {
      const interval = setInterval(() => {
        const now = new Date();
        const release = new Date(releaseTime);
        const remaining = release.getTime() - now.getTime();
        
        if (remaining > 0) {
          setJailTimeRemaining(remaining);
        } else {
          setJailTimeRemaining(0);
          setIsJailed(false);
          setReleaseTime(null);
          setJailId(null);
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isJailed, releaseTime]);

  return { 
    isJailed, 
    jailTimeRemaining, 
    releaseTime,
    jailId,
    disciplineLevel,
    bondAmount,
    bondAllowed
  };
}
