import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { UserProfile } from '@/lib/supabase';

interface SupportGoalReminderData {
  broadcaster_user_id: string;
  stream_id: string | null;
  display_name: string;
  username: string;
  avatar_url: string;
  current_balance: number;
  next_cashout_tier: number;
  coins_needed: number;
  cashout_label: string;
}

export const useSupportGoalReminder = () => {
  const { user } = useAuthStore();
  const [reminder, setReminder] = useState<SupportGoalReminderData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReminderData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get users the current user follows
      const { data: followsData, error: followsError } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followsError) throw followsError;

      if (!followsData || followsData.length === 0) {
        setReminder(null);
        setLoading(false);
        return;
      }

      const followedUserIds = followsData.map(follow => follow.following_id);

      // Get followed users who are currently live
      const { data: liveStreamsData, error: liveStreamsError } = await supabase
        .from('streams')
        .select('id, broadcaster_id, title, is_live, agora_channel')
        .in('broadcaster_id', followedUserIds)
        .eq('is_live', true);

      if (liveStreamsError) throw liveStreamsError;

      if (!liveStreamsData || liveStreamsData.length === 0) {
        setReminder(null);
        setLoading(false);
        return;
      }

      // Get broadcaster profiles for the live streams
      const broadcasterIds = liveStreamsData.map(stream => stream.broadcaster_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, full_name, troll_coins')
        .in('id', broadcasterIds);

      if (profilesError) throw profilesError;

      // Get cashout tiers
      const { data: tiersData, error: tiersError } = await supabase
        .from('cashout_tiers')
        .select('coin_amount, cash_amount')
        .eq('is_active', true)
        .order('coin_amount', { ascending: true });

      if (tiersError) throw tiersError;

      if (!tiersData || tiersData.length === 0) {
        setReminder(null);
        setLoading(false);
        return;
      }

      // Process each live followed broadcaster to find reminder candidates
      const candidates: SupportGoalReminderData[] = [];

      for (const stream of liveStreamsData) {
        const profile = profilesData?.find(p => p.id === stream.broadcaster_id);
        if (!profile) continue;

        // Calculate current cashout-eligible balance
        // All troll coins are cashout-eligible; subtract reserved coins for pending payouts
        const currentBalance = (profile.troll_coins || 0);

        // Find next cashout tier
        let nextTier = tiersData[tiersData.length - 1]; // Default to highest tier
        for (const tier of tiersData) {
          if (tier.coin_amount > currentBalance) {
            nextTier = tier;
            break;
          }
        }

        // If already at or above highest tier, skip
        if (currentBalance >= nextTier.coin_amount) continue;

        const coinsNeeded = nextTier.coin_amount - currentBalance;
        
        // Only consider if within reminder window (1000 coins)
        if (coinsNeeded > 1000) continue;

        // Check if this reminder was recently dismissed
        const { data: dismissalData, error: dismissalError } = await supabase
          .from('support_goal_reminder_dismissals')
          .select('dismissed_at')
          .eq('viewer_user_id', user.id)
          .eq('broadcaster_user_id', profile.id)
          .eq('cashout_tier', nextTier.coin_amount)
          .gte('dismissed_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (dismissalError) {
          throw dismissalError;
        }

        // If dismissed recently, skip
        if (dismissalData) continue;

        // Create cashout label
        const cashLabel = `${nextTier.cash_amount}$`;

        candidates.push({
          broadcaster_user_id: profile.id,
          stream_id: stream.id,
          display_name: profile.full_name || profile.username,
          username: profile.username,
          avatar_url: profile.avatar_url || '',
          current_balance,
          next_cashout_tier: nextTier.coin_amount,
          coins_needed,
          cashout_label: cashLabel
        });
      }

      // Sort by coins needed (closest to cashout first)
      candidates.sort((a, b) => a.coins_needed - b.coins_needed);

      // Return the best candidate (closest to cashout) or null
      setReminder(candidates[0] || null);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching support goal reminder:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setReminder(null);
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchReminderData();
    
    // Also check when coming back to foreground after 5 minutes
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Check again when tab becomes visible
        setTimeout(fetchReminderData, 5 * 60 * 1000); // 5 minutes
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchReminderData]);

  return { reminder, loading, error, refetch: fetchReminderData };
};