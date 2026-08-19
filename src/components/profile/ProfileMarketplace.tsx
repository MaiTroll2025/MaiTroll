import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { Store, Package, Loader2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MarketplaceItem {
  id: string;
  title: string;
  price_coins: number;
  status: string;
  thumbnail_url?: string | null;
}

interface Purchase {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  marketplace_item?: MarketplaceItem;
  buyer_profile?: { username: string };
  seller_profile?: { username: string };
}

export default function ProfileMarketplace({ userId }: { userId: string }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [orders, setOrders] = useState<Purchase[]>([]);
  const [isSeller, setIsSeller] = useState(false);

  const isOwn = user?.id === userId;

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    async function load() {
      setLoading(true);
      try {
        const [itemsRes, ordersRes] = await Promise.all([
          supabase
            .from('marketplace_items')
            .select('id, title, price_coins, status, thumbnail_url')
            .eq('seller_id', userId)
            .order('created_at', { ascending: false }),
          isOwn
            ? supabase
                .from('marketplace_purchases')
                .select(`
                  id,
                  amount,
                  status,
                  created_at,
                  marketplace_item:marketplace_items!marketplace_purchases_item_id_fkey(
                    id,
                    title,
                    thumbnail_url
                  ),
                  buyer_profile:user_profiles!marketplace_purchases_buyer_id_fkey(username),
                  seller_profile:user_profiles!marketplace_purchases_seller_id_fkey(username)
                `)
                .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
                .order('created_at', { ascending: false })
            : { data: null as Purchase[] | null, error: null }
        ]);

        if (isMounted) {
          const itemData = (itemsRes.data || []) as MarketplaceItem[];
          setItems(itemData);
          setIsSeller(itemData.length > 0);
          setOrders((ordersRes.data || []) as Purchase[]);
        }
      } catch (err) {
        console.error('[ProfileMarketplace] Error:', err);
        toast.error('Failed to load marketplace data');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [userId, isOwn]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <span className="ml-2 text-gray-400">Loading marketplace...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isSeller && isOwn && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white flex items-center gap-2">
                <Store size={18} className="text-green-400" /> Your Store
              </h3>
              <p className="text-xs text-slate-400 mt-1">{items.length} active listings</p>
            </div>
            <button
              onClick={() => navigate('/marketplace/sell')}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-black text-white hover:bg-green-500"
            >
              <ExternalLink size={14} /> Manage Store
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4">
            {items.slice(0, 6).map(item => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                {item.thumbnail_url && (
                  <img src={item.thumbnail_url} alt={item.title} className="w-full aspect-square object-cover rounded-lg mb-2" />
                )}
                <p className="font-bold text-white text-sm truncate">{item.title}</p>
                <p className="text-xs text-green-300 font-black">{Number(item.price_coins || 0).toLocaleString()} TC</p>
                <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-slate-300 capitalize mt-2 inline-block">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <Package size={18} className="text-purple-400" /> Orders
        </h3>
        {orders.length === 0 ? (
          <div className="text-center py-8 text-white/50">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No orders yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map(order => (
              <div key={order.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-300">
                  <Package size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white text-sm truncate">
                    {order.marketplace_item?.title || 'Item'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {isOwn && order.seller_profile?.username
                      ? `From: ${order.seller_profile.username}`
                      : order.buyer_profile?.username
                        ? `Buyer: ${order.buyer_profile.username}`
                        : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-green-300 text-sm">{Number(order.amount || 0).toLocaleString()} TC</p>
                  <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-slate-300 capitalize">
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
