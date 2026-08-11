import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Gift, Sparkles, Crown, Gem, Zap, Heart, Users, UserCircle, Radio, Coins, Glasses } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useGiftSystem, GiftItem } from '../../lib/hooks/useGiftSystem';
import { useBroadcastAbilities } from '../../hooks/useBroadcastAbilities';
import { getAbilityById } from '../../types/broadcastAbilities';
import CoinStoreModal from './CoinStoreModal';
import { getGiftVisualConfig, GiftRarity } from '../../lib/giftVisuals';
import { AR_GIFTS, AR_GIFT_CATEGORIES, getARGiftById } from '../../data/arGiftCatalog';

import { toast } from 'sonner';
import { cn } from '../../lib/utils';

// Re-export GiftItem from useGiftSystem for external consumption
export type { GiftItem } from '../../lib/hooks/useGiftSystem';

export type GiftTargetType = 'broadcaster' | 'all' | 'specific';

export interface GiftTarget {
  type: GiftTargetType;
  userId?: string;
  username?: string;
  quantity?: number;
}

interface GiftBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  streamId: string;
  broadcasterId?: string;
  activeUserIds?: string[];
  userProfiles?: Record<string, { username: string; avatar_url?: string }>;
  onGiftSent?: (gift: GiftItem, target: GiftTarget) => void;
  sharedChannel?: any;
}

type GiftCategory = 'all' | 'general' | 'cars' | 'houses' | 'boats' | 'planes' | 'luxury' | 'men' | 'women' | 'lgbt' | 'holiday' | 'smoking' | 'drinking' | 'funny' | 'seasonal';

type ARTabType = 'gifts' | 'ar_gifts' | 'abilities' | 'store';

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

const CATEGORIES: { id: GiftCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: <Gift size={16} /> },
  { id: 'general', label: 'General', icon: <Sparkles size={16} /> },
  { id: 'cars', label: 'Cars', icon: '🏎️' },
  { id: 'houses', label: 'Houses', icon: '🏠' },
  { id: 'boats', label: 'Boats', icon: '🛥️' },
  { id: 'planes', label: 'Planes', icon: '✈️' },
  { id: 'luxury', label: 'Luxury', icon: <Crown size={16} /> },
  { id: 'men', label: 'Men', icon: '👨' },
  { id: 'women', label: 'Women', icon: '👩' },
  { id: 'lgbt', label: 'LGBT', icon: '🌈' },
  { id: 'holiday', label: 'Holiday', icon: '🎄' },
  { id: 'smoking', label: 'Smoking', icon: '🚬' },
  { id: 'drinking', label: 'Drinking', icon: '🍺' },
  { id: 'funny', label: 'Funny', icon: '😂' },
  { id: 'seasonal', label: 'Seasonal', icon: '🌸' },
];

const RARITY_COLORS: Record<Rarity, string> = {
  common: 'border-gray-500 bg-gray-500/10',
  uncommon: 'border-green-500 bg-green-500/10',
  rare: 'border-blue-500 bg-blue-500/10',
  epic: 'border-purple-500 bg-purple-500/10',
  legendary: 'border-orange-500 bg-orange-500/10',
  mythic: 'border-yellow-400 bg-yellow-400/20',
};

const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
};

const GiftBoxModalComponent = function GiftBoxModal({
  isOpen,
  onClose,
  recipientId,
  streamId,
  broadcasterId = recipientId,
  activeUserIds = [],
  userProfiles = {},
  onGiftSent,
  sharedChannel
}: GiftBoxModalProps) {
  const { user, profile } = useAuthStore();
  
  // Gift target selection state
  const [giftTarget, setGiftTarget] = useState<GiftTarget>({ type: 'specific', userId: recipientId });

  useEffect(() => {
    if (isOpen) {
      setGiftTarget({ type: 'specific', userId: recipientId });
    }
  }, [isOpen, recipientId]);
  
  const { sendGift, isSending } = useGiftSystem()
  const {
    abilities: userAbilities,
    loading: abilitiesLoading,
    useAbility,
    getCooldownRemaining,
    isEffectActive,
    getEffectRemaining,
  } = useBroadcastAbilities(streamId);

  // Holiday theme disabled - always show regular gift UI
  const activeHoliday: { name: string; icon: string } | null = null;

  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<GiftCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ARTabType>('gifts');
  const [arCategory, setArCategory] = useState<string>('all');

  // Fetch gifts from database with defensive fallback
  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setGifts([]);
    fetchGifts();
  }, [isOpen]);

  async function fetchGifts() {
    try {
      // Try multiple tables in order of preference
      const tables = ['gift_items'];
      let rawGifts: any[] = [];
      let usedTable = '';

      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .order('coin_cost', { ascending: true })
            .limit(200);

          if (!error && data && data.length > 0) {
            rawGifts = data;
            usedTable = table;
            if (import.meta.env.DEV) {
              console.debug(`[GiftBoxModal] Loaded ${data.length} gifts from table "${table}"`);
            }
            break;
          }
        } catch (err) {
          console.warn(`[GiftBoxModal] Table "${table}" failed:`, err);
          continue;
        }
      }

      if (rawGifts.length === 0) {
        // Fallback to purchasable_items if gift_items is empty
        const { data: purchasableItems } = await supabase
          .from('purchasable_items')
          .select('*')
          .eq('category', 'gift')
          .eq('is_active', true)
          .order('coin_price', { ascending: true })
          .limit(200);

        if (purchasableItems && purchasableItems.length > 0) {
          rawGifts = purchasableItems;
          usedTable = 'purchasable_items';
          if (import.meta.env.DEV) {
            console.debug(`[GiftBoxModal] Loaded ${purchasableItems.length} gifts from table "purchasable_items"`);
          }
        }
      }

      if (rawGifts.length === 0) {
        console.warn('[GiftBoxModal] No gifts found in any table');
        setGifts([]);
        return;
      }

      // Normalize gift items from any table schema into unified GiftItem format
      const transformedGifts: GiftItem[] = rawGifts.map((g: any) => {
        const id = g.id || String(g._id || g.gift_id || '');
        const name = g.name || g.gift_name || g.title || g.display_name || 'Unknown Gift';
        const icon = g.icon || g.icon_url || g.emoji || g.gift_icon || '🎁';
        const coinCost = Number(g.coin_cost ?? g.coinCost ?? g.value ?? g.cost ?? g.price ?? g.coin_price ?? g.coins ?? g.amount ?? 0);
        const slug = g.slug || g.gift_slug || g.item_key || name.toLowerCase().replace(/\s+/g, '-');
        const animationType = g.animation_type || g.animationType || g.animation || undefined;
        const category = g.category || g.gift_category || g.metadata?.subcategory || undefined;

        return {
          id,
          name,
          icon,
          coinCost,
          type: coinCost > 0 ? 'paid' : 'free',
          slug,
          animationKey: g.animation_key || g.animationKey || g.gift_slug || slug,
          animationType,
          animationUrl: g.animation_url || g.animationUrl || g.video_url || g.videoUrl || null,
          videoUrl: g.video_url || g.videoUrl || g.animation_url || g.animationUrl || null,
          animationDurationMs: g.animation_duration_ms || g.animationDurationMs || undefined,
          soundUrl: g.sound_url || g.soundUrl || null,
          isFullscreen: g.is_fullscreen ?? g.isFullscreen ?? undefined,
          rarity: g.rarity || undefined,
          description: g.description || undefined,
          trayVisualUrl: g.tray_visual_url || g.trayVisualUrl || undefined,
          trayGradient: g.tray_gradient || g.trayGradient || undefined,
          category,
        };
      });

      setGifts(transformedGifts);

      if (import.meta.env.DEV && usedTable) {
        console.debug(`[GiftBoxModal] Normalized ${transformedGifts.length} gifts from "${usedTable}"`);
      }
    } catch (err) {
      console.error('[GiftBoxModal] Failed to load gifts from all tables:', err);
    } finally {
      setIsLoading(false);
    }
  }

  // Helper function to get gift category
  const getGiftCategory = (gift: GiftItem): GiftCategory => {
    const nameLower = gift.name.toLowerCase();
    const icon = gift.icon;
    const category = String(gift.category || '').toLowerCase();

    if (category.includes('royalty') || category.includes('luxury') || nameLower.includes('crown') || nameLower.includes('diamond') || nameLower.includes('gold') || nameLower.includes('platinum') || nameLower.includes('aurora')) return 'luxury';
    if (nameLower.includes('car') || nameLower.includes('lamborghini') || nameLower.includes('ferrari')) return 'cars';
    if (nameLower.includes('house') || nameLower.includes('mansion') || nameLower.includes('castle')) return 'houses';
    if (nameLower.includes('boat') || nameLower.includes('yacht')) return 'boats';
    if (nameLower.includes('plane') || nameLower.includes('jet') || nameLower.includes('helicopter')) return 'planes';
    if (nameLower.includes('cigarette') || nameLower.includes('cigar') || nameLower.includes('smoke')) return 'smoking';
    if (nameLower.includes('beer') || nameLower.includes('wine') || nameLower.includes('champagne')) return 'drinking';
    if (nameLower.includes('clown') || nameLower.includes('meme') || nameLower.includes('troll')) return 'funny';
    if (nameLower.includes('christmas') || nameLower.includes('santa') || nameLower.includes('pumpkin')) return 'holiday';
    if (nameLower.includes('rainbow') || nameLower.includes('pride')) return 'lgbt';
    if (icon === '👨' || nameLower.includes('men') || nameLower.includes('muscle')) return 'men';
    if (icon === '👩' || nameLower.includes('women') || nameLower.includes('dress')) return 'women';
    if (nameLower.includes('sunny') || nameLower.includes('snow') || nameLower.includes('spring')) return 'seasonal';
    
    return 'general';
  };

  // Filter gifts
  const filteredGifts = useMemo(() => {
    let filtered = gifts;

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(g => {
        // Find the gift's category from original data
        const originalGift = gifts.find(gg => gg.id === g.id);
        return originalGift && getGiftCategory(g) === selectedCategory;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(g => 
        g.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [gifts, selectedCategory, searchQuery]);

  const handleSendGift = async () => {
    console.log('[GiftBoxModal] handleSendGift clicked', {
      selectedGiftId: selectedGift?.id || null,
      selectedGiftName: selectedGift?.name || null,
      userId: user?.id || null,
      giftTarget,
      recipientId,
      broadcasterId,
      quantity,
      canAfford,
      isSending,
    });

    if (!selectedGift || !user) {
      console.warn('[GiftBoxModal] send aborted before sendGift', {
        hasSelectedGift: !!selectedGift,
        hasUser: !!user,
      });
      return;
    }

    try {
      let success: boolean | { success: boolean; bonus?: any } = false;

      // AR gifts use a separate RPC
      if (activeTab === 'ar_gifts' && selectedGift) {
        const arGift = getARGiftById(selectedGift.id);
        if (!arGift) {
          toast.error('Unknown AR gift');
          return;
        }

        const targetId = giftTarget.userId || recipientId;

        const { data, error } = await supabase.rpc('send_ar_gift', {
          p_sender_id: user.id,
          p_receiver_id: targetId,
          p_stream_id: streamId || null,
          p_battle_id: null,
          p_gift_id: arGift.id,
          p_quantity: quantity,
        });

        if (error) throw error;

        if (data && (data as any).success) {
          const targetName = userProfiles[targetId]?.username || 'user';
          toast.success(`✨ Sent AR ${arGift.icon} ${arGift.name} to ${targetName}!`);
          onGiftSent?.(selectedGift, { type: 'specific', userId: targetId, username: targetName, quantity });
          onClose();
          setSelectedGift(null);
          setQuantity(1);
          setGiftTarget({ type: 'specific', userId: recipientId });
        } else {
          toast.error((data as any)?.message || 'Failed to send AR gift');
        }
        return;
      }
      
      if (giftTarget.type === 'all') {
        // Send to all active users (broadcaster + guests)
        const allRecipients = [broadcasterId, ...activeUserIds.filter(id => id !== broadcasterId)];
        let sentCount = 0;
        
        for (const targetId of allRecipients) {
          if (targetId && targetId !== user.id) {
            const result = await sendGift(selectedGift, { receiverId: targetId, quantity });
            if (result) sentCount++;
          }
        }
        
        success = sentCount > 0;
         if (success) {
           toast.success(`Sent ${quantity}x ${selectedGift.name} to ${sentCount} users!`);
           onGiftSent?.(selectedGift, { type: 'all', quantity });
         }
       } else if (giftTarget.type === 'broadcaster') {
         success = await sendGift(selectedGift, { receiverId: broadcasterId, quantity });
          if (Boolean(success)) {
            toast.success(`Sent ${quantity}x ${selectedGift.name} to broadcaster!`);
            onGiftSent?.(selectedGift, { type: 'broadcaster', userId: broadcasterId, quantity });
          }
       } else {
         const targetId = giftTarget.userId || recipientId;
         success = await sendGift(selectedGift, { receiverId: targetId, quantity });
          if (Boolean(success)) {
           const targetName = userProfiles[targetId]?.username || 'user';
           toast.success(`Sent ${quantity}x ${selectedGift.name} to ${targetName}!`);
           onGiftSent?.(selectedGift, { type: 'specific', userId: targetId, username: targetName, quantity });
         }
      }
      
      if (Boolean(success)) {
        onClose();
        setSelectedGift(null);
        setQuantity(1);
        setGiftTarget({ type: 'specific', userId: recipientId });
      }
    } catch (err) {
      console.error('Error sending gift:', err);
    }
  };

  const getTotalCost = () => {
    if (!selectedGift) return 0;
    return selectedGift.coinCost * quantity;
  };

  const canAfford = profile && profile.troll_coins >= getTotalCost();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 100 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 100 }}
          className="bg-zinc-900 border sm:border border-white/10 rounded-2xl w-[94vw] sm:w-[78vw] max-w-3xl h-[68vh] sm:h-[72vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-white/10 bg-zinc-900/50 flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
              {activeHoliday ? (
                <>
                  <span className="text-2xl">{activeHoliday.icon}</span>
                  <h2 className="text-base sm:text-xl font-bold text-white">
                    Send {activeHoliday.name} Gift
                  </h2>
                </>
              ) : (
                <>
                  <Gift className="text-yellow-400" size={20} />
                  <h2 className="text-base sm:text-xl font-bold text-white">Send Gift</h2>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={20} className="text-zinc-400" />
            </button>
          </div>

          <div className="flex border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950/90">
            <button
              type="button"
              onClick={() => setActiveTab('gifts')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 px-3 py-2 text-sm font-bold transition-colors',
                activeTab === 'gifts' ? 'bg-yellow-500/15 text-yellow-300' : 'text-zinc-400 hover:bg-white/10 hover:text-white'
              )}
            >
              <Gift size={16} />
              Gifts
            </button>
            <button
              type="button"
              onClick={() => {}}
              disabled
              className={cn(
                'flex flex-1 items-center justify-center gap-2 px-3 py-2 text-sm font-bold transition-colors opacity-40 cursor-not-allowed',
                'text-zinc-500'
              )}
            >
              <Glasses size={16} />
              AR Gifts ✨
              <span className="text-[9px]">(Soon)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('abilities')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 px-3 py-2 text-sm font-bold transition-colors',
                activeTab === 'abilities' ? 'bg-violet-500/15 text-violet-300' : 'text-zinc-400 hover:bg-white/10 hover:text-white'
              )}
            >
              <Zap size={16} />
              Ability Bag
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('store')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 px-3 py-2 text-sm font-bold transition-colors',
                activeTab === 'store' ? 'bg-emerald-500/15 text-emerald-300' : 'text-zinc-400 hover:bg-white/10 hover:text-white'
              )}
            >
              <Coins size={16} />
              Quick Store
            </button>
          </div>

          {/* Balance Display */}
          <div className="px-3 sm:px-4 py-2 bg-zinc-800/50 border-b border-white/5 flex items-center justify-between text-xs sm:text-sm flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Balance:</span>
              <span className="text-yellow-400 font-bold">{(profile?.troll_coins || 0).toLocaleString()} 🪙</span>
            </div>
            {selectedGift && (
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">Total:</span>
                <span className={cn("font-bold", canAfford ? "text-green-400" : "text-red-400")}>
                  {getTotalCost().toLocaleString()} 🪙
                </span>
              </div>
            )}
          </div>

          {activeTab === 'store' ? (
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-slate-400">
                <span>Quick Store • buy coins without leaving the stream</span>
              </div>
              <CoinStoreModal isOpen={true} onClose={() => setActiveTab('gifts')} embedded allowCardPayment={false} />
            </div>
          ) : activeTab === 'abilities' ? (
            <div className="flex-1 overflow-hidden p-4 flex flex-col">
              {abilitiesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400"></div>
                </div>
              ) : !streamId ? (
                <div className="flex flex-1 items-center justify-center text-center text-slate-400">
                  Join a broadcast to open your Ability Bag and use your powers.
                </div>
              ) : userAbilities.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-slate-400">
                  <span className="text-4xl">📦</span>
                  <div className="text-white font-semibold">Your Ability Bag is empty</div>
                  <div className="max-w-sm text-sm text-slate-400">Spin the Troll Wheel, unlock new abilities, and come back here to deploy them in broadcast.</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-1">
                  {userAbilities.map((userAbility) => {
                    const ability = getAbilityById(userAbility.ability_id);
                    if (!ability) return null;

                    const cooldownRemaining = getCooldownRemaining(userAbility.ability_id);
                    const isOnCooldown = cooldownRemaining > 0;
                    const effectActive = isEffectActive(userAbility.ability_id);
                    const abilityRemaining = getEffectRemaining(userAbility.ability_id);
                    const canUseAbility = !ability.requiresTarget && userAbility.quantity > 0 && !abilitiesLoading && !isOnCooldown;

                    return (
                      <div key={userAbility.id} className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.35)]">
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: `${ability.color}15`, boxShadow: `0 0 18px ${ability.glowColor}` }}>
                            {ability.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-bold text-white truncate">{ability.name}</div>
                              <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded-full text-white" style={{ background: `${ability.color}20` }}>{ability.rarity}</span>
                              <span className="text-[10px] text-slate-400">x{userAbility.quantity}</span>
                            </div>
                            <p className="mt-2 text-sm text-slate-300 leading-5 line-clamp-3">{ability.description}</p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-2">
                          {effectActive && (
                            <div className="text-xs rounded-2xl bg-emerald-500/15 text-emerald-300 px-3 py-2">Active • {abilityRemaining}s remaining</div>
                          )}
                          {isOnCooldown && (
                            <div className="text-xs rounded-2xl bg-orange-500/15 text-orange-300 px-3 py-2">Cooldown • {cooldownRemaining}s</div>
                          )}
                          {ability.requiresTarget && (
                            <div className="text-xs rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 px-3 py-2">Targeted ability - use from the Ability panel or broadcast action menu.</div>
                          )}
                          <button
                            type="button"
                            onClick={() => useAbility(userAbility.ability_id)}
                            disabled={!canUseAbility}
                            className={cn(
                              'w-full rounded-2xl px-4 py-3 text-sm font-semibold transition-all',
                              canUseAbility
                                ? 'bg-violet-500 text-white hover:bg-violet-400'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                            )}
                          >
                            {canUseAbility ? 'Use Ability' : ability.requiresTarget ? 'Select target in panel' : 'Unable to use now'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'ar_gifts' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* AR Category Filter */}
              <div className="flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-white/5 flex-shrink-0 scrollbar-hide">
                {AR_GIFT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setArCategory(cat.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                      arCategory === cat.id
                        ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-transparent'
                    )}
                  >
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>

              {/* AR Gift Grid */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {AR_GIFTS
                    .filter((g) => arCategory === 'all' || g.category === arCategory)
                    .map((gift) => {
                      const isSelected = selectedGift?.id === gift.id;
                      const isLegendary = gift.category === 'legendary' || gift.rarity === 'mythic';

                      return (
                        <motion.button
                          key={gift.id}
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => {
                            const giftItem: GiftItem = {
                              id: gift.id,
                              name: gift.name,
                              icon: gift.icon,
                              coinCost: gift.price,
                              type: 'paid' as const,
                              slug: gift.id,
                              animationKey: gift.id,
                              animationType: 'ar_gift',
                              animationDurationMs: gift.durationMs,
                              rarity: gift.rarity,
                              description: gift.description,
                              category: 'ar_gift',
                              subcategory: gift.category,
                            };
                            setSelectedGift(giftItem);
                          }}
                          className={cn(
                            'relative overflow-hidden p-2 rounded-2xl border-2 transition-all flex flex-col items-center gap-1.5 text-left',
                            isSelected
                              ? 'border-fuchsia-400/80 bg-fuchsia-400/10'
                              : isLegendary
                                ? 'border-yellow-500/30 bg-gradient-to-b from-yellow-500/10 to-purple-500/10 hover:border-yellow-400/50'
                                : 'border-white/10 bg-slate-950/60 hover:border-fuchsia-500/30 hover:bg-slate-900/80'
                          )}
                        >
                          {isLegendary && (
                            <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/5 to-transparent pointer-events-none" />
                          )}
                          <div className="relative z-10 flex flex-col items-center gap-1.5 w-full">
                            <div className={cn(
                              'flex h-12 w-12 items-center justify-center rounded-xl border text-2xl',
                              isLegendary
                                ? 'border-yellow-500/30 bg-yellow-500/10'
                                : 'border-white/10 bg-slate-900/70'
                            )}>
                              {gift.icon}
                            </div>
                            <span className="text-[10px] sm:text-xs font-semibold text-white tracking-tight text-center truncate w-full">
                              {gift.name}
                            </span>
                            <span className="text-[10px] font-semibold text-fuchsia-300 flex items-center gap-1">
                              {gift.price.toLocaleString()} <span>🪙</span>
                            </span>
                            <div className="flex items-center gap-1">
                              <span className={cn(
                                'text-[8px] uppercase tracking-wider font-bold rounded-full px-1.5 py-0.5',
                                gift.rarity === 'mythic' ? 'bg-fuchsia-500/20 text-fuchsia-200' :
                                gift.rarity === 'legendary' ? 'bg-amber-500/20 text-amber-200' :
                                gift.rarity === 'epic' ? 'bg-violet-500/20 text-violet-200' :
                                gift.rarity === 'rare' ? 'bg-sky-500/20 text-sky-200' :
                                gift.rarity === 'uncommon' ? 'bg-emerald-500/20 text-emerald-200' :
                                'bg-slate-700/30 text-slate-300'
                              )}>
                                {gift.rarity}
                              </span>
                              <span className="text-[7px] text-slate-500 uppercase">
                                {gift.trackingPoint.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : (
          <div className="flex flex-1 overflow-hidden flex-col sm:flex-row">
            {/* Categories - horizontal scroll on mobile, sidebar on desktop */}
            <div className="sm:w-48 border-b sm:border-r border-white/10 bg-zinc-900/30 overflow-x-auto overflow-y-hidden sm:overflow-y-auto py-2 flex-shrink-0">
              <div className="flex sm:flex-col gap-1 sm:gap-0 px-2 sm:px-0">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "px-3 py-2 text-left flex items-center gap-2 text-sm transition-colors whitespace-nowrap",
                      selectedCategory === cat.id
                        ? "bg-yellow-500/20 text-yellow-400 border-r-2 sm:border-r-0 sm:border-b-2 border-yellow-500"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <span className="flex-shrink-0">{cat.icon}</span>
                    <span className="hidden sm:inline">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Gift Grid */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search Bar */}
              <div className="p-2 sm:p-4 border-b border-white/5">
                <div className="relative">
                  <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                  <input
                    type="text"
                    placeholder="Search gifts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-yellow-500"
                  />
                </div>
              </div>

              {/* Gifts */}
              <div className="flex-1 overflow-y-auto p-2 sm:p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
                  </div>
                ) : filteredGifts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
                    <Gift size={32} className="opacity-40" />
                    <p className="text-sm font-medium">No gifts available</p>
                    <p className="text-xs text-zinc-600 text-center px-4">
                      Gifts are currently being loaded or none are active. Check back soon!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                    {filteredGifts.map((gift) => {
                      const isSelected = selectedGift?.id === gift.id;
                      const giftConfig = getGiftVisualConfig(gift);

                      return (
                        <motion.button
                          key={gift.id}
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setSelectedGift(gift)}
                          className={cn(
                            "relative overflow-hidden p-2 sm:p-3 rounded-3xl border-2 transition-all flex flex-col items-center gap-1 text-left",
                            isSelected
                              ? "border-yellow-400/80 bg-yellow-400/10"
                              : "border-white/10 bg-slate-950/60 hover:border-white/25 hover:bg-slate-900/80",
                            giftConfig.glowClass
                          )}
                          style={{ backgroundImage: giftConfig.gradient }}
                        >
                          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_55%)] pointer-events-none" />
                          <div className="relative z-10 flex flex-col items-center gap-1 w-full">
                            <div className={cn(
                              "flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 text-3xl",
                              giftConfig.rarity === 'legendary' ? 'bg-white/5' : 'bg-slate-900/70'
                            )}>
                              {gift.icon}
                            </div>
                            <span className="text-[10px] sm:text-xs font-semibold text-white tracking-tight text-center truncate w-full">
                              {giftConfig.trayLabel || gift.name}
                            </span>
                            <span className="text-[10px] sm:text-[11px] font-semibold text-cyan-200 flex items-center gap-1">
                              {gift.coinCost.toLocaleString()} <span>🪙</span>
                            </span>
                            <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.08em] font-bold">
                              <span className={cn(
                                'rounded-full px-2 py-0.5',
                                giftConfig.rarity === 'mythic' ? 'bg-fuchsia-500/20 text-fuchsia-200' :
                                giftConfig.rarity === 'legendary' ? 'bg-amber-500/20 text-amber-200' :
                                giftConfig.rarity === 'epic' ? 'bg-violet-500/20 text-violet-200' :
                                giftConfig.rarity === 'rare' ? 'bg-sky-500/20 text-sky-200' :
                                giftConfig.rarity === 'uncommon' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-700/30 text-slate-300'
                              )}>
                                {giftConfig.rarity}
                              </span>
                              <span className="hidden sm:inline text-[8px] text-slate-300">{giftConfig.animationType.replace('_', ' ')}</span>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Recipient Selection - Always show when a gift is selected */}
          {(activeTab === 'gifts' || activeTab === 'ar_gifts') && selectedGift && (
            <div className="p-2 sm:p-4 border-t border-white/10 bg-zinc-900/50 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <UserCircle size={16} className="text-yellow-400 sm:h-[18px] sm:w-[18px]" />
                <span className="text-xs sm:text-sm font-medium text-white">Send to:</span>
              </div>
              
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {/* Broadcaster Option */}
                <button
                  onClick={() => setGiftTarget({ type: 'broadcaster', userId: broadcasterId })}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all",
                    giftTarget.type === 'broadcaster'
                      ? "bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400"
                      : "bg-zinc-800 border-2 border-transparent text-zinc-400 hover:bg-zinc-700"
                  )}
                >
                  <Radio size={14} className="sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">B (Broadcaster)</span>
                  <span className="sm:hidden">Broadcaster</span>
                </button>
                
                {/* All Users Option */}
                <button
                  onClick={() => setGiftTarget({ type: 'all' })}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all",
                    giftTarget.type === 'all'
                      ? "bg-purple-500/20 border-2 border-purple-500 text-purple-400"
                      : "bg-zinc-800 border-2 border-transparent text-zinc-400 hover:bg-zinc-700"
                  )}
                >
                  <Users size={14} className="sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">A (All)</span>
                  <span className="sm:hidden">All</span>
                </button>
                
                {/* Specific User Options */}
                {activeUserIds.map((userId) => (
                  <button
                    key={userId}
                    onClick={() => setGiftTarget({ type: 'specific', userId, username: userProfiles[userId]?.username })}
                    className={cn(
                      "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all",
                      giftTarget.type === 'specific' && giftTarget.userId === userId
                        ? "bg-blue-500/20 border-2 border-blue-500 text-blue-400"
                        : "bg-zinc-800 border-2 border-transparent text-zinc-400 hover:bg-zinc-700"
                    )}
                  >
                    <img
                      src={userProfiles[userId]?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfiles[userId]?.username || 'U')}&background=random`}
                      alt=""
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full"
                    />
                    <span className="max-w-[60px] sm:max-w-[100px] truncate">{userProfiles[userId]?.username || 'User'}</span>
                  </button>
                ))}
                
                {/* Current recipient if not in active list */}
                {recipientId !== broadcasterId && !activeUserIds.includes(recipientId) && (
                  <button
                    onClick={() => setGiftTarget({ type: 'specific', userId: recipientId, username: userProfiles[recipientId]?.username })}
                    className={cn(
                      "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all",
                      giftTarget.type === 'specific' && giftTarget.userId === recipientId
                        ? "bg-blue-500/20 border-2 border-blue-500 text-blue-400"
                        : "bg-zinc-800 border-2 border-transparent text-zinc-400 hover:bg-zinc-700"
                    )}
                  >
                    <UserCircle size={14} className="sm:h-4 sm:w-4" />
                    <span className="max-w-[60px] sm:max-w-[100px] truncate">{userProfiles[recipientId]?.username || 'Selected User'}</span>
                  </button>
                )}
              </div>
              
              {giftTarget.type === 'all' && (
                <p className="text-[10px] sm:text-xs text-amber-400 mt-1.5 sm:mt-2">
                  ⚠️ This will send gifts to all users (cost × {1 + activeUserIds.length} users)
                </p>
              )}
            </div>
          )}

          {/* Send Button */}
          {(activeTab === 'gifts' || activeTab === 'ar_gifts') && selectedGift && (
            <div className="p-2 sm:p-4 border-t border-white/10 bg-zinc-900/50 flex items-center justify-between gap-2 sm:gap-4 flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-1 sm:gap-2">
                  <span className="text-zinc-400 text-xs sm:text-sm">Qty:</span>
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white flex items-center justify-center text-sm"
                  >
                    -
                  </button>
                  <span className="w-8 sm:w-12 text-center text-white font-bold text-xs sm:text-sm">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(99, quantity + 1))}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white flex items-center justify-center text-sm"
                  >
                    +
                  </button>
                </div>
                
                <button
                  onClick={() => setQuantity(q => Math.min(99, Math.floor((profile?.troll_coins || 0) / selectedGift.coinCost)))}
                  className="px-2 sm:px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg"
                >
                  Max
                </button>
              </div>

              <button
                onClick={handleSendGift}
                disabled={isSending || !canAfford}
                className={cn(
                  "px-4 sm:px-8 py-2 sm:py-3 rounded-xl font-bold flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm transition-all",
                  isSending && "opacity-50",
                  canAfford
                    ? activeTab === 'ar_gifts'
                      ? "bg-gradient-to-r from-fuchsia-500 to-purple-500 hover:from-fuchsia-400 hover:to-purple-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                      : "bg-yellow-500 hover:bg-yellow-400 text-black"
                    : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                )}
              >
                {activeTab === 'ar_gifts' ? <Glasses size={16} className="sm:h-5 sm:w-5" /> : <Gift size={16} className="sm:h-5 sm:w-5" />}
                <span className="hidden sm:inline">
                  {activeTab === 'ar_gifts' ? (
                    `Send AR ${quantity}x ${selectedGift.name}`
                  ) : activeUserIds.length > 0 ? (
                    giftTarget.type === 'all' ? (
                      `Send to All (${1 + activeUserIds.length})`
                    ) : giftTarget.type === 'broadcaster' ? (
                      'Send to Broadcaster'
                    ) : (
                      `Send ${quantity}x ${selectedGift.name}`
                    )
                  ) : (
                    `Send ${quantity}x ${selectedGift.name}`
                  )}
                </span>
                <span className="sm:hidden">
                  Send {quantity}x
                </span>
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Helper function to determine rarity based on cost
function getGiftRarity(cost: number): Rarity {
  if (cost >= 5000) return 'mythic';
  if (cost >= 2500) return 'legendary';
  if (cost >= 500) return 'epic';
  if (cost >= 100) return 'rare';
  if (cost >= 50) return 'uncommon';
  return 'common';
}

export default React.memo(GiftBoxModalComponent);
