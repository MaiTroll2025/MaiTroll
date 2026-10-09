import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { BroadcastPinnedProduct, ShopItem } from '../types/liveCommerce';

interface UseBroadcastPinnedProductsOptions {
  streamId: string;
  userId?: string;
  isHost?: boolean;
}

interface PinnedProductWithItem extends BroadcastPinnedProduct {
  product?: ShopItem;
}

export function useBroadcastPinnedProducts({
  streamId,
  userId,
  isHost = false,
}: UseBroadcastPinnedProductsOptions) {
  const [pinnedProducts, setPinnedProducts] = useState<PinnedProductWithItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch pinned products with product details
  const fetchPinnedProducts = useCallback(async () => {
    if (!streamId) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('broadcast_pinned_products')
        .select('*')
        .eq('stream_id', streamId)
        .eq('is_active', true)
        .order('position', { ascending: true });

      if (fetchError) throw fetchError;

      // Get product details for each pinned product
      if (data && data.length > 0) {
        const productIds = data.map((p) => p.product_id);
        const { data: products, error: productsError } = await supabase
          .from('shop_items')
          .select('*')
          .in('id', productIds)
          .eq('is_active', true);

        if (productsError) throw productsError;

        // Merge product data
        const mergedData = data.map((pinned) => ({
          ...pinned,
          product: products?.find((prod) => prod.id === pinned.product_id),
        }));

        setPinnedProducts(mergedData);
      } else {
        setPinnedProducts([]);
      }
    } catch (err: any) {
      console.error('Error fetching pinned products:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [streamId]);

  // Pin a product to the broadcast
  const pinProduct = useCallback(
    async (productId: string): Promise<{ success: boolean; error?: string }> => {
      if (!userId || !isHost) {
        return { success: false, error: 'Not authorized to pin products' };
      }

      try {
        const { data: _data, error } = await supabase.rpc('pin_product_to_broadcast', {
          p_stream_id: streamId,
          p_product_id: productId,
          p_pinned_by: userId,
        });

        if (error) throw error;

        // Refresh the list
        await fetchPinnedProducts();

        return { success: true };
      } catch (err: any) {
        console.error('Error pinning product:', err);
        return { success: false, error: err.message };
      }
    },
    [streamId, userId, isHost, fetchPinnedProducts]
  );

  // Unpin a product from the broadcast
  const unpinProduct = useCallback(
    async (productId: string): Promise<{ success: boolean; error?: string }> => {
      if (!userId || !isHost) {
        return { success: false, error: 'Not authorized to unpin products' };
      }

      try {
        const { error } = await supabase.rpc('unpin_product_from_broadcast', {
          p_stream_id: streamId,
          p_product_id: productId,
        });

        if (error) throw error;

        // Refresh the list
        await fetchPinnedProducts();

        return { success: true };
      } catch (err: any) {
        console.error('Error unpinning product:', err);
        return { success: false, error: err.message };
      }
    },
    [streamId, userId, isHost, fetchPinnedProducts]
  );

  // Subscribe to realtime updates
  useEffect(() => {
    if (!streamId) return;

    // Initial fetch
    fetchPinnedProducts();

    // Subscribe to changes
    const channel = supabase
      .channel(`pinned-products-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broadcast_pinned_products',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          console.log('Pinned product change:', payload);
          // Refresh the list on any change
          fetchPinnedProducts();
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [streamId, fetchPinnedProducts]);

  return {
    pinnedProducts,
    isLoading,
    error,
    pinProduct,
    unpinProduct,
    refresh: fetchPinnedProducts,
  };
}
