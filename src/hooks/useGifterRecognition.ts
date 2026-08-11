import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  GifterLeaderboardEntry,
  FanCrown,
} from '@/types/supporterEconomy';

export function useGifterLeaderboard(p_type: string = 'weekly', p_limit: number = 100) {
  return useQuery<GifterLeaderboardEntry[]>({
    queryKey: ['gifter-leaderboard', p_type, p_limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_gifter_leaderboard', {
        p_type,
        p_limit,
      });

      if (error) throw error;
      return data as GifterLeaderboardEntry[];
    },
    staleTime: 120000,
  });
}

export function useFanCrownStatus(p_userId?: string) {
  return useQuery<FanCrown[]>({
    queryKey: ['fan-crown-status', p_userId],
    queryFn: async () => {
      if (!p_userId) throw new Error('user_id required');

      const { data, error } = await supabase.rpc('get_fan_crown_status', {
        p_user_id: p_userId,
      });

      if (error) throw error;
      return data as FanCrown[];
    },
    enabled: !!p_userId,
    staleTime: 60000,
  });
}

export function useFanCrownHistory() {
  return useQuery<FanCrown[]>({
    queryKey: ['fan-crown-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fan_crowns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    staleTime: 120000,
  });
}