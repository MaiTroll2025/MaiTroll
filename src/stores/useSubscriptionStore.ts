import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

export interface SubscriptionTier {
  id: string;
  name: string;
  price_coins: number;
  benefits: string[];
  color_hex: string;
  icon_name: string;
}

export interface Subscription {
  id: string;
  subscriber_id: string;
  broadcaster_id: string;
  tier_id: string;
  tier?: SubscriptionTier;
  started_at: string;
  expires_at?: string;
  is_active: boolean;
  auto_renew: boolean;
  monthly_revenue_coins: number;
}

interface SubscriptionStore {
  mySubscriptions: Subscription[];
  mySubscriberCount: number;
  myMonthlyRevenue: number;
  isLoading: boolean;
  fetchMySubscriptions: () => Promise<void>;
  fetchMySubscriberStats: () => Promise<void>;
  subscribe: (broadcasterId: string, tierId: string) => Promise<{success: boolean; error?: string}>;
  unsubscribe: (broadcasterId: string) => Promise<void>;
  checkSubscription: (broadcasterId: string) => Promise<Subscription | null>;
}

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  mySubscriptions: [],
  mySubscriberCount: 0,
  myMonthlyRevenue: 0,
  isLoading: false,

  fetchMySubscriptions: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    set({ isLoading: true });
    try {
      const { data } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          tier: subscription_tiers(*)
        `)
        .eq('subscriber_id', user.id)
        .eq('is_active', true)
        .order('started_at', { ascending: false });

      set({ mySubscriptions: data || [] });
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMySubscriberStats: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('monthly_subscriber_count, total_subscriber_revenue_coins')
        .eq('id', user.id)
        .single();

      set({
        mySubscriberCount: data?.monthly_subscriber_count || 0,
        myMonthlyRevenue: data?.total_subscriber_revenue_coins || 0
      });
    } catch (error) {
      console.error('Error fetching subscriber stats:', error);
    }
  },

  subscribe: async (broadcasterId: string, tierId: string) => {
    const { user } = useAuthStore.getState();
    if (!user) return { success: false, error: 'Not logged in' };

    try {
      const { data, error } = await supabase.rpc('create_subscription', {
        p_broadcaster_id: broadcasterId,
        p_tier_id: tierId,
        p_auto_renew: true
      });

      if (error || !data?.success) {
        return { success: false, error: data?.error || error?.message };
      }

      get().fetchMySubscriptions();
      get().fetchMySubscriberStats();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  unsubscribe: async (broadcasterId: string) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    try {
      await supabase.rpc('unsubscribe_from_broadcaster', {
        p_subscriber_id: user.id,
        p_broadcaster_id: broadcasterId
      });

      get().fetchMySubscriptions();
      get().fetchMySubscriberStats();
    } catch (error) {
      console.error('Unsubscribe error:', error);
    }
  },

  checkSubscription: async (broadcasterId: string) => {
    const { user } = useAuthStore.getState();
    if (!user) return null;

    try {
      const { data } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          tier: subscription_tiers(*)
        `)
        .eq('subscriber_id', user.id)
        .eq('broadcaster_id', broadcasterId)
        .eq('is_active', true)
        .single();

      return data || null;
    } catch (error) {
      return null;
    }
  }
}));
