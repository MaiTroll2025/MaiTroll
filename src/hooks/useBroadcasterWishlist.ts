import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  BroadcasterWishlist,
  WishlistItem,
  WishlistProgress,
  CreateWishlistInput,
  AddWishlistItemInput,
  BackWishlistItemInput,
} from '@/types/supporterEconomy';

export function useBroadcasterWishlist(p_broadcasterId?: string) {
  return useQuery<BroadcasterWishlist[]>({
    queryKey: ['broadcaster-wishlist', p_broadcasterId],
    queryFn: async () => {
      if (!p_broadcasterId) throw new Error('broadcaster_id required');

      const { data, error } = await supabase.rpc('get_broadcaster_wishlist_data', {
        p_broadcaster_id: p_broadcasterId,
      });

      if (error) throw error;
      return data as BroadcasterWishlist[];
    },
    enabled: !!p_broadcasterId,
    staleTime: 30000,
  });
}

export function useCreateWishlist() {
  const queryClient = useQueryClient();

  return useMutation<BroadcasterWishlist, Error, CreateWishlistInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.rpc('create_broadcaster_wishlist', {
        p_broadcaster_id: input.broadcaster_id,
        p_title: input.title,
        p_description: input.description,
        p_target_amount: input.target_amount,
      });

      if (error) throw error;
      return data as BroadcasterWishlist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcaster-wishlist'] });
    },
  });
}

export function useAddWishlistItem() {
  const queryClient = useQueryClient();

  return useMutation<WishlistItem, Error, AddWishlistItemInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.rpc('add_wishlist_item', {
        p_wishlist_id: input.wishlist_id,
        p_title: input.title,
        p_description: input.description,
        p_target_amount: input.target_amount,
      });

      if (error) throw error;
      return data as WishlistItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcaster-wishlist'] });
    },
  });
}

export function useBackWishlistItem() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message: string }, Error, BackWishlistItemInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.rpc('back_wishlist_item', {
        p_user_id: input.user_id,
        p_item_id: input.item_id,
        p_amount: input.amount,
        p_gift_txn_id: input.gift_txn_id,
        p_stream_gift_id: input.stream_gift_id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcaster-wishlist'] });
      queryClient.invalidateQueries({ queryKey: ['wishlist-progress'] });
    },
  });
}

export function useWishlistProgress(p_wishlistId?: string) {
  return useQuery<WishlistProgress[]>({
    queryKey: ['wishlist-progress', p_wishlistId],
    queryFn: async () => {
      if (!p_wishlistId) throw new Error('wishlist_id required');

      const { data, error } = await supabase
        .from('wishlist_progress')
        .select('*')
        .eq('wishlist_id', p_wishlistId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!p_wishlistId,
    staleTime: 30000,
  });
}