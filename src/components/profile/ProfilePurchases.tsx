import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Package, Gavel, Loader2 } from 'lucide-react';

interface MarketplaceItem {
  id: string;
  title: string;
  thumbnail_url?: string | null;
}

interface SellerProfile {
  id: string;
  username: string;
}

interface MarketplacePurchase {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  marketplace_item?: MarketplaceItem;
  seller_profile?: SellerProfile;
}

interface AuctionLot {
  id: string;
  title: string;
  image_urls?: string | null;
  final_bid?: number;
  current_highest_bid?: number;
  auction_shows?: {
    id: string;
    title: string;
  };
}

export default function ProfilePurchases({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [marketplacePurchases, setMarketplacePurchases] = useState<MarketplacePurchase[]>([]);
  const [auctionWins, setAuctionWins] = useState<AuctionLot[]>([]);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    async function load() {
      setLoading(true);
      try {
        const [marketRes, auctionRes] = await Promise.all([
          supabase
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
              seller_profile:user_profiles!marketplace_purchases_seller_id_fkey(
                id,
                username
              )
            `)
            .eq('buyer_id', userId)
            .order('created_at', { ascending: false }),
          supabase
            .from('auction_lots')
            .select(`
              id,
              title,
              image_urls,
              final_bid,
              current_highest_bid,
              auction_shows(
                id,
                title
              )
            `)
            .eq('winner_user_id', userId)
            .order('created_at', { ascending: false })
        ]);

        if (isMounted) {
          setMarketplacePurchases((marketRes.data || []) as MarketplacePurchase[]);
          setAuctionWins((auctionRes.data || []) as AuctionLot[]);
        }
      } catch (err) {
        console.error('[ProfilePurchases] Error:', err);
        toast.error('Failed to load purchase history');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <span className="ml-2 text-gray-400">Loading purchases...</span>
      </div>
    );
  }

  const all = [
    ...marketplacePurchases.map(p => ({ ...p, source: 'marketplace' as const })),
    ...auctionWins.map(a => ({ ...a, source: 'auction' as const }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (all.length === 0) {
    return (
      <div className="text-center py-12 text-white/50">
        <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No purchases yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {all.map(item => {
        if (item.source === 'marketplace') {
          const p = item as typeof marketplacePurchases[0] & { source: 'marketplace' };
          return (
            <div key={p.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="h-12 w-12 shrink-0 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-300">
                <Package size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white truncate">{p.marketplace_item?.title || 'Marketplace Item'}</p>
                <p className="text-xs text-slate-400">Seller: {p.seller_profile?.username || 'Unknown'}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-green-300">{Number(p.amount || 0).toLocaleString()} TC</p>
                <p className="text-[10px] text-slate-500">{new Date(p.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          );
        }

        const a = item as typeof auctionWins[0] & { source: 'auction' };
        return (
          <div key={a.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-300">
              <Gavel size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white truncate">{a.title || 'Auction Item'}</p>
              <p className="text-xs text-slate-400">Show: {a.auction_shows?.title || 'Unknown'}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-green-300">{Number(a.final_bid || a.current_highest_bid || 0).toLocaleString()} TC</p>
              <p className="text-[10px] text-slate-500">{new Date(a.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
