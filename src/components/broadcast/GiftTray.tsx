import React, { useEffect, useState, useMemo } from 'react';
import { Coins, Loader2, ChevronDown, Gem } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useGiftSystem, GiftItem } from '../../lib/hooks/useGiftSystem';
import { getGiftVisualConfig } from '../../lib/giftVisuals';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { quietRefreshGiftProfile } from '../../lib/hooks/useGiftSystem';
import MKeyGiftCard from './mkey/MKeyGiftCard';
import MKeySendPanel from './mkey/MKeySendPanel';
import { useMKeyWallet } from '../../hooks/useMKeyWallet';

interface GiftTrayProps {
  recipientId: string;
  streamId: string;
  onClose: () => void;
  battleId?: string | null;
  allRecipients?: string[];
}

export default function GiftTray({ recipientId, streamId, onClose, battleId, allRecipients }: GiftTrayProps) {
  const navigate = useNavigate();
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const { sendGift, isSending } = useGiftSystem();
  const { user, profile } = useAuthStore();
  const [_sendingToAll, setSendingToAll] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);

  // 🔑 MKeys are a gift-tray item. Selecting one swaps the tray body over to
  // the MKey send interface rather than opening a disconnected promotion UI.
  const [showMKeys, setShowMKeys] = useState(false);
  const { wallet: mkeyWallet } = useMKeyWallet();

  // Calculate trollmonds info for display
  // New rule: gifts >= 100 coins deduct 100 trollmonds per gift (if sender has trollmonds)
  // Gifts under 100 coins have no trollmond cost
  const trollmondBalance = profile?.trollmonds || 0;

  // Calculate trollmond cost for a specific gift
  const getGiftTrollmondCost = (coinCost: number): number => {
    if (coinCost >= 100) return 100;
    return 0;
  };

  useEffect(() => {
    const fetchGifts = async () => {
      try {
        let mappedGifts: GiftItem[] = [];

        // Prefer gift_items to align with send_gift RPC expectations
        const { data: giftItems, error: giftItemsError } = await supabase
          .from('gift_items')
          .select('*')
          .order('coin_cost', { ascending: true });

        if (giftItemsError) {
          throw giftItemsError;
        }

        if (giftItems && giftItems.length > 0) {
          mappedGifts = giftItems.map((g: any) => ({
            id: g.id,
            name: g.name?.startsWith('gift_') ? g.name.replace('gift_', '') : g.name,
            icon: g.icon || '🎁',
            coinCost: g.coin_cost || g.value || 0,
            type: 'paid' as const,
            slug: g.gift_slug || g.name,
            animationKey: g.animation_key || g.animationKey || g.gift_slug || g.name,
            animationType: g.animation_type || g.animationType || undefined,
            animationUrl: g.animation_url || g.animationUrl || null,
            animationDurationMs: g.animation_duration_ms || g.animationDurationMs || undefined,
            soundUrl: g.sound_url || g.soundUrl || null,
            isFullscreen: g.is_fullscreen ?? g.isFullscreen ?? undefined,
            rarity: g.rarity || undefined,
            description: g.description || undefined,
            trayVisualUrl: g.tray_visual_url || g.trayVisualUrl || undefined,
            trayGradient: g.tray_gradient || g.trayGradient || undefined,
            category: 'gift',
            subcategory: g.category || 'Misc'
          }));
        } else {
          // Fallback to purchasable_items if gift_items is empty
          const { data: purchasableItems } = await supabase
            .from('purchasable_items')
            .select('*')
            .eq('category', 'gift')
            .eq('is_active', true)
            .order('coin_price', { ascending: true });

          if (purchasableItems && purchasableItems.length > 0) {
            mappedGifts = purchasableItems.map((g: any) => ({
              id: g.id,
              name: g.display_name,
              icon: g.metadata?.icon || '🎁',
              coinCost: g.coin_price || 0,
              type: 'paid' as const,
              slug: g.item_key,
              category: g.category,
              subcategory: g.metadata?.subcategory || 'Misc'
            }));
          }
        }

        setGifts(mappedGifts);
        
        if (mappedGifts.length > 0) {
          const firstCat = mappedGifts[0].subcategory;
          if (firstCat && firstCat !== 'Misc') {
            setActiveCategory('All');
          }
        }
      } catch (e) {
        console.error(e);
        // Fallback if error occurs
        const { data: giftItems } = await supabase
          .from('gift_items')
          .select('*')
          .order('coin_cost', { ascending: true });
        
        if (giftItems && giftItems.length > 0) {
          const mappedGifts = giftItems.map((g: any) => ({
            id: g.id,
            name: g.name?.startsWith('gift_') ? g.name.replace('gift_', '') : g.name,
            icon: g.icon || '🎁',
            coinCost: g.coin_cost || g.value || 0,
            type: 'paid' as const,
            slug: g.gift_slug || g.name,
            animationKey: g.animation_key || g.animationKey || g.gift_slug || g.name,
            animationType: g.animation_type || g.animationType || undefined,
            animationUrl: g.animation_url || g.animationUrl || null,
            animationDurationMs: g.animation_duration_ms || g.animationDurationMs || undefined,
            soundUrl: g.sound_url || g.soundUrl || null,
            isFullscreen: g.is_fullscreen ?? g.isFullscreen ?? undefined,
            rarity: g.rarity || undefined,
            description: g.description || undefined,
            trayVisualUrl: g.tray_visual_url || g.trayVisualUrl || undefined,
            trayGradient: g.tray_gradient || g.trayGradient || undefined,
            category: 'gift',
            subcategory: g.category || 'Misc'
          }));
          setGifts(mappedGifts);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchGifts();
  }, []);

  const categories = React.useMemo(() => {
    const cats = Array.from(new Set(gifts.map(g => g.subcategory).filter(Boolean) as string[]));
    const order = [
      'Court & Government',
      'Podcast & Media', 
      'Homes & Real Estate',
      'Vehicles & Transport',
      'Money & Flex',
      'Battle & Chaos',
      'Luxury / Rare'
    ];
    
    return ['All', ...cats.sort((a, b) => {
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    })];
  }, [gifts]);

  const filteredGifts = React.useMemo(() => {
    if (activeCategory === 'All') return gifts;
    return gifts.filter(g => g.subcategory === activeCategory);
  }, [gifts, activeCategory]);

  const handleSend = async (gift: GiftItem) => {
    if (!user) {
      navigate('/auth?mode=signup');
      return;
    }
    if (allRecipients && allRecipients.length > 0) {
      setSendingToAll(true);
      try {
        const promises = allRecipients.map(recipientId => 
          sendGift(gift, { receiverId: recipientId, quantity: 1, battleId: battleId ?? null }).catch(e => console.error(`Failed to send to ${recipientId}`, e))
        );
        
        await Promise.all(promises);
        toast.success(`Gift sent to ${allRecipients.length} users!`);
        void quietRefreshGiftProfile(user.id);

      } catch (e) {
        console.error(e);
        toast.error("Failed to send some gifts");
      }
      setSendingToAll(false);
      onClose();
      return;
    }

    const success = await sendGift(gift, { receiverId: recipientId, quantity: 1, battleId: battleId ?? null, streamId: streamId });
    if (success) {
      setSelectedGift(gift);
      toast.success(`Sent ${gift.name}!`);
      onClose();
    }
  };

  const canAfford = (cost: number) => {
    return (profile?.troll_coins || 0) >= cost;
  };

  return (
    <div className="bg-zinc-900/95 backdrop-blur-xl border-t border-white/10 p-3 md:p-4 rounded-t-2xl md:rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-10 fixed inset-x-0 bottom-0 z-[120] max-h-[70vh] md:max-h-[72vh] md:left-12 md:right-80 lg:right-[22rem] xl:right-[24rem] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 md:mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-bold text-base md:text-lg flex items-center gap-2">
            <Coins className="text-yellow-400" size={18} />
            {allRecipients ? "Gift Everyone" : "Send Gift"}
          </h3>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          {/* MKey Balance */}
          <button
            type="button"
            onClick={() => setShowMKeys(true)}
            title="MKeys — invite active users to this broadcast"
            className="flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-1 font-mono text-xs text-cyan-200 transition-colors hover:border-cyan-300/60 hover:bg-cyan-400/20 md:px-3 md:text-sm"
          >
            <span aria-hidden="true">🔑</span>
            <span>{mkeyWallet.available.toLocaleString()}</span>
          </button>

          {/* Trollmonds Balance */}
          <div className="text-purple-400 font-mono text-xs md:text-sm bg-purple-400/10 px-2 md:px-3 py-1 rounded-full border border-purple-400/20 flex items-center gap-1">
            <Gem size={12} />
            <span className="hidden sm:inline">{trollmondBalance.toLocaleString()}</span>
            <span className="sm:hidden">{trollmondBalance}</span>
          </div>
          
          {/* Coin Balance */}
          <div className="text-yellow-400 font-mono text-xs md:text-sm bg-yellow-400/10 px-2 md:px-3 py-1 rounded-full border border-yellow-400/20 flex items-center gap-1">
            <Coins size={12} />
            <span className="hidden sm:inline">{profile?.troll_coins?.toLocaleString() || 0}</span>
            <span className="sm:hidden">{profile?.troll_coins || 0}</span>
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <ChevronDown size={20} />
          </button>
        </div>
      </div>

      {/* 🔑 MKey send interface, in-place inside the tray */}
      {showMKeys ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950/60">
          <MKeySendPanel broadcastId={streamId} onBack={() => setShowMKeys(false)} />
        </div>
      ) : (
      <>
      {/* Category Tabs */}
      {!loading && gifts.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-hide flex-shrink-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1.5 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat 
                  ? 'bg-yellow-400 text-black' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Gift Grid */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-white" />
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2 overflow-y-auto flex-1 min-h-0 custom-scrollbar pb-safe">
          {/* 🔑 MKEY — the one tray item that buys an audience, not a reaction. */}
          <MKeyGiftCard
            onSelect={() => setShowMKeys(true)}
            available={mkeyWallet.available}
            held={mkeyWallet.held}
            compact
          />

          {filteredGifts.map((gift) => {
            const affordable = user ? canAfford(gift.coinCost) : true;
            const giftConfig = getGiftVisualConfig(gift);
            const isSelected = selectedGift?.id === gift.id;

            return (
              <button
                key={gift.id}
                disabled={isSending || (user && !affordable)}
                onClick={() => handleSend(gift)}
                className={cn(
                  "relative overflow-hidden p-2 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 text-left min-h-[120px]",
                  isSelected
                    ? 'border-yellow-400/80 bg-yellow-400/10'
                    : 'border-white/10 bg-slate-950/70 hover:border-white/25 hover:bg-slate-900/90',
                  giftConfig.glowClass,
                  !affordable && 'opacity-50 cursor-not-allowed'
                )}
                style={{ backgroundImage: giftConfig.gradient }}
              >
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_55%)] pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center gap-2 w-full">
                  <div className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 text-3xl",
                    giftConfig.rarity === 'legendary' ? 'bg-white/10' : 'bg-slate-900/70'
                  )}>
                    {gift.icon || '🎁'}
                  </div>
                  <div className="text-[10px] sm:text-xs font-semibold text-white text-center truncate w-full">
                    {giftConfig.trayLabel || gift.name}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-100 bg-black/20 px-2 py-1 rounded-full">
                    <Coins size={10} />
                    {gift.coinCost.toLocaleString()}
                  </div>
                  {getGiftTrollmondCost(gift.coinCost) > 0 && (
                    <div className="flex items-center gap-0.5 text-[9px] font-mono text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded-full">
                      <Gem size={8} />
                      -{getGiftTrollmondCost(gift.coinCost)}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-center gap-1 text-[8px] uppercase tracking-[0.12em] text-slate-300">
                    <span className={cn(
                      'rounded-full px-2 py-0.5',
                      giftConfig.rarity === 'mythic' && 'bg-fuchsia-500/20 text-fuchsia-200',
                      giftConfig.rarity === 'legendary' && 'bg-amber-500/20 text-amber-200',
                      giftConfig.rarity === 'epic' && 'bg-violet-500/20 text-violet-200',
                      giftConfig.rarity === 'rare' && 'bg-sky-500/20 text-sky-200',
                      giftConfig.rarity === 'uncommon' && 'bg-emerald-500/20 text-emerald-200',
                      giftConfig.rarity === 'common' && 'bg-slate-700/30 text-slate-300'
                    )}>
                      {giftConfig.rarity}
                    </span>
                    <span className="hidden sm:inline">{giftConfig.animationType.replace('_', ' ')}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Footer Info */}
      {!loading && (
        <div className="mt-2 pt-2 border-t border-white/10 flex-shrink-0">
          <p className="text-[9px] sm:text-[10px] text-gray-500 text-center">
            Tap a gift to send • Coins are deducted instantly • 🔑 MKeys come back if nobody joins
          </p>
        </div>
      )}
      </>
      )}
    </div>
  );
}
