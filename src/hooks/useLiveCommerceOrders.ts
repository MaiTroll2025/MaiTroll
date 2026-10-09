import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ShopOrder, PurchaseRequest, PurchaseResult, ShipOrderRequest } from '../types/liveCommerce';

interface UseLiveCommerceOrdersOptions {
  userId?: string;
  isSeller?: boolean;
}

export function useLiveCommerceOrders({ userId, isSeller = false }: UseLiveCommerceOrdersOptions) {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch orders based on user role
  const fetchOrders = useCallback(async () => {
    if (!userId) return;

    try {
      let query = supabase
        .from('shop_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (isSeller) {
        query = query.eq('seller_id', userId);
      } else {
        query = query.eq('buyer_id', userId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setOrders(data || []);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isSeller]);

  // Purchase a product (with escrow)
  const purchaseProduct = useCallback(
    async (request: PurchaseRequest): Promise<PurchaseResult> => {
      if (!userId) {
        return { success: false, error: 'You must be logged in to purchase' };
      }

      try {
        const { data, error } = await supabase.rpc('create_order_with_escrow', {
          p_buyer_id: userId,
          p_product_id: request.productId,
          p_quantity: request.quantity,
          p_shipping_name: request.shippingName,
          p_shipping_address: request.shippingAddress,
          p_shipping_city: request.shippingCity,
          p_shipping_state: request.shippingState,
          p_shipping_zip: request.shippingZip,
        });

        if (error) throw error;

        return { success: true, orderId: data };
      } catch (err: any) {
        console.error('Error purchasing product:', err);
        return { success: false, error: err.message };
      }
    },
    [userId]
  );

  // Ship an order (seller only)
  const shipOrder = useCallback(
    async (request: ShipOrderRequest): Promise<{ success: boolean; error?: string }> => {
      if (!userId || !isSeller) {
        return { success: false, error: 'Not authorized to ship orders' };
      }

      try {
        const { error } = await supabase.rpc('ship_order', {
          p_order_id: request.orderId,
          p_tracking_number: request.trackingNumber,
          p_carrier: request.carrier,
          p_seller_id: userId,
        });

        if (error) throw error;

        // Refresh orders
        await fetchOrders();

        return { success: true };
      } catch (err: any) {
        console.error('Error shipping order:', err);
        return { success: false, error: err.message };
      }
    },
    [userId, isSeller, fetchOrders]
  );

  // Confirm delivery (buyer only)
  const confirmDelivery = useCallback(
    async (orderId: string): Promise<{ success: boolean; error?: string }> => {
      if (!userId) {
        return { success: false, error: 'You must be logged in' };
      }

      try {
        const { error } = await supabase.rpc('confirm_delivery', {
          p_order_id: orderId,
          p_user_id: userId,
        });

        if (error) throw error;

        // Refresh orders
        await fetchOrders();

        return { success: true };
      } catch (err: any) {
        console.error('Error confirming delivery:', err);
        return { success: false, error: err.message };
      }
    },
    [userId, fetchOrders]
  );

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) return;

    // Initial fetch
    fetchOrders();

    // Subscribe to order changes
    const channel = supabase
      .channel(`orders-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shop_orders',
          filter: isSeller
            ? `seller_id=eq.${userId}`
            : `buyer_id=eq.${userId}`,
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId, isSeller, fetchOrders]);

  return {
    orders,
    isLoading,
    error,
    purchaseProduct,
    shipOrder,
    confirmDelivery,
    refresh: fetchOrders,
  };
}

// Hook to get a single order with items
export function useOrderDetails(orderId: string) {
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('shop_orders')
          .select('*, items(*, product(*))')
          .eq('id', orderId)
          .single();

        if (fetchError) throw fetchError;
        setOrder(data);
      } catch (err: any) {
        console.error('Error fetching order:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  return { order, isLoading, error };
}

// Hook for seller to get products for pinning
export function useSellerProducts(sellerId?: string) {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) return;

    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('shop_items')
          .select('*')
          .eq('shop_id', sellerId) // This needs shop_id, not owner_id
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setProducts(data || []);
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [sellerId]);

  return { products, isLoading };
}
