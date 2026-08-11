import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { WeeklyCashbackStatus, WeeklyCashbackPeriod } from '@/types/supporterEconomy';

export function useWeeklyCashback() {
  return useQuery<WeeklyCashbackStatus[]>({
    queryKey: ['weekly-cashback-status'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('get_weekly_cashback_status', {
        p_user_id: user.id,
      });

      if (error) throw error;
      return data as WeeklyCashbackStatus[];
    },
    staleTime: 60000,
  });
}

export function useCashbackPeriods() {
  return useQuery<WeeklyCashbackPeriod[]>({
    queryKey: ['cashback-periods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_cashback_periods')
        .select('*')
        .order('period_start', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    staleTime: 120000,
  });
}

export function useProcessFridayRewards() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (force: boolean = false) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('process-friday-rewards', {
        body: { force },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashback-periods'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-cashback-status'] });
    },
  });
}