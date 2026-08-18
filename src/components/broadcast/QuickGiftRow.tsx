import React from 'react';
import { supabase } from '../../lib/supabase';
import { useGiftSystem } from '../../lib/hooks/useGiftSystem';
import { useAuthStore } from '../../lib/store';
import { Loader2 } from 'lucide-react';

export default function QuickGiftRow({ recipientId, streamId, battleId, onClose }: { recipientId: string; streamId: string; battleId?: string | null; onClose: () => void }) {
  const [gifts, setGifts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sendingId, setSendingId] = React.useState<string | null>(null);
  const { sendGift } = useGiftSystem();
  const { profile } = useAuthStore();

  React.useEffect(() => {
    const fetchGifts = async () => {
      try {
        const { data } = await supabase.from('gift_items').select('*').order('coin_cost', { ascending: true }).limit(8);
        setGifts(data || []);
      } catch {
        setGifts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchGifts();
  }, []);

  const handleSend = async (gift: any) => {
    if (!profile || sendingId) return;
    setSendingId(gift.id);
    const success = await sendGift(gift, { receiverId: recipientId, quantity: 1, battleId: battleId ?? null, streamId });
    if (success) {
      onClose();
    }
    setSendingId(null);
  };

  const canAfford = (cost: number) => (profile?.troll_coins || 0) >= cost;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {loading ? (
        <Loader2 className="animate-spin text-white mx-auto" size={20} />
      ) : gifts.length === 0 ? (
        <p className="text-xs text-gray-400">No gifts available</p>
      ) : (
        gifts.map((gift) => {
          const affordable = canAfford(gift.coin_cost || 0);
          return (
            <button
              key={gift.id}
              disabled={!affordable}
              onClick={() => handleSend(gift)}
              className={`flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 min-w-[70px] transition-all ${
                affordable ? 'hover:border-white/25 hover:bg-white/10' : 'opacity-40 cursor-not-allowed'
              }`}
            >
              <span className="text-xl">{gift.icon || '🎁'}</span>
              <span className="text-[9px] font-bold text-white truncate w-full text-center">{gift.name?.replace('gift_', '')}</span>
              <span className="text-[9px] text-yellow-400 font-mono">{gift.coin_cost}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
