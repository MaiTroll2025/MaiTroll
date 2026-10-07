/**
 * Profile Frame Store Page
 * Browse, preview, purchase, and equip premium animated avatar frames
 */

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, ShoppingCart, Crown, Lock, Star, Zap } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { useCoins } from '../lib/hooks/useCoins';
import { useProfileFrameStore } from '../stores/useProfileFrameStore';
import ProfileFrame from '../components/profile/ProfileFrame';
import type { ProfileFrame as ProfileFrameType, FrameRarity } from '../config/profileFrames';
import { RARITY_COLORS, RARITY_LABELS, RARITY_ORDER, sortFramesByRarity } from '../config/profileFrames';
import { toast } from 'sonner';

const RARITY_FILTERS: { key: FrameRarity | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'common', label: 'Common' },
  { key: 'rare', label: 'Rare' },
  { key: 'epic', label: 'Epic' },
  { key: 'legendary', label: 'Legendary' },
  { key: 'mythic', label: 'Mythic' },
  { key: 'founder', label: 'Founder' },
  { key: 'limited_edition', label: 'Limited' },
];

export default function ProfileFrameStore() {
  const { user, profile } = useAuthStore();
  const { balances } = useCoins();
  const {
    catalog,
    ownedFrames,
    equippedFrame,
    loadCatalog,
    loadUserFrames,
    purchaseFrame,
    equipFrame,
    isFrameOwned,
  } = useProfileFrameStore();

  const [selectedRarity, setSelectedRarity] = useState<FrameRarity | 'all'>('all');
  const [previewFrame, setPreviewFrame] = useState<ProfileFrameType | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [equipping, setEquipping] = useState(false);
  const [activeTab, setActiveTab] = useState<'store' | 'inventory'>('store');

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (user?.id) {
      loadUserFrames(user.id);
    }
  }, [user?.id, loadUserFrames]);

  const filteredFrames = useMemo(() => {
    let frames = catalog;
    if (selectedRarity !== 'all') {
      frames = frames.filter(f => f.rarity === selectedRarity);
    }
    return sortFramesByRarity(frames);
  }, [catalog, selectedRarity]);

  const ownedFrameList = useMemo(() => {
    return catalog.filter(f => isFrameOwned(f.id));
  }, [catalog, isFrameOwned]);

  const handlePurchase = async (frame: ProfileFrameType) => {
    if (!user) return toast.error('Please log in to purchase');
    if (isFrameOwned(frame.id)) return toast.error('You already own this frame');
    if ((balances?.troll_coins || 0) < frame.coinCost) {
      return toast.error(`Not enough coins. Need ${frame.coinCost.toLocaleString()} 🪙`);
    }

    setPurchasing(frame.id);
    const success = await purchaseFrame(frame.id);
    setPurchasing(null);

    if (success) {
      toast.success(`🎉 Purchased ${frame.name}!`);
    } else {
      toast.error('Purchase failed. Please try again.');
    }
  };

  const handleEquip = async (frameId: string | null) => {
    if (!user) return;
    setEquipping(true);
    const success = await equipFrame(frameId);
    setEquipping(false);

    if (success) {
      toast.success(frameId ? 'Frame equipped!' : 'Frame unequipped');
    } else {
      toast.error('Failed to equip frame');
    }
  };

  const avatarUrl = profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || 'default'}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                <Sparkles className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">
                  Profile Frames
                </h1>
                <p className="text-xs text-slate-400">Premium animated avatar frames</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
              <span className="text-yellow-400 text-sm font-bold">🪙 {(balances?.troll_coins || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            <button
              onClick={() => setActiveTab('store')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'store'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShoppingCart className="w-4 h-4 inline mr-1.5" />
              Store
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'inventory'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Crown className="w-4 h-4 inline mr-1.5" />
              My Frames ({ownedFrameList.length})
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {activeTab === 'store' ? (
            <motion.div
              key="store"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Rarity Filters */}
              <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
                {RARITY_FILTERS.map(filter => (
                  <button
                    key={filter.key}
                    onClick={() => setSelectedRarity(filter.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      selectedRarity === filter.key
                        ? 'bg-white/15 text-white border border-white/20'
                        : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Frame Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFrames.map(frame => {
                  const owned = isFrameOwned(frame.id);
                  const isEquipped = equippedFrame?.id === frame.id;
                  const canAfford = (balances?.troll_coins || 0) >= frame.coinCost;
                  const rarity = RARITY_COLORS[frame.rarity];

                  return (
                    <motion.div
                      key={frame.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`relative rounded-2xl border overflow-hidden transition-all ${
                        isEquipped
                          ? 'border-purple-400/50 bg-purple-500/10 shadow-[0_0_30px_rgba(168,85,247,0.15)]'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                      }`}
                    >
                      {/* Rarity indicator bar */}
                      <div
                        className="absolute top-0 left-0 right-0 h-0.5"
                        style={{ background: rarity.text }}
                      />

                      <div className="p-5">
                        {/* Preview */}
                        <div className="flex justify-center mb-4">
                          <div
                            className="cursor-pointer transition-transform hover:scale-105"
                            onClick={() => setPreviewFrame(frame)}
                          >
                            <ProfileFrame
                              frame={frame}
                              avatarUrl={avatarUrl}
                              size="lg"
                              username={profile?.username || 'Preview'}
                              showBadge
                            />
                          </div>
                        </div>

                        {/* Info */}
                        <div className="text-center mb-3">
                          <h3 className="font-bold text-white text-sm">{frame.name}</h3>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{frame.description}</p>
                        </div>

                        {/* Rarity & Price */}
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{
                              color: rarity.text,
                              backgroundColor: rarity.bg,
                              border: `1px solid ${rarity.border}`,
                            }}
                          >
                            {RARITY_LABELS[frame.rarity]}
                          </span>
                          <span className="text-sm font-bold text-yellow-400">
                            🪙 {frame.coinCost.toLocaleString()}
                          </span>
                        </div>

                        {/* Action Button */}
                        {owned ? (
                          <button
                            onClick={() => handleEquip(isEquipped ? null : frame.id)}
                            disabled={equipping}
                            className={`w-full py-2 rounded-xl text-sm font-bold transition-all ${
                              isEquipped
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30'
                                : 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30'
                            }`}
                          >
                            {isEquipped ? (
                              <><Check className="w-4 h-4 inline mr-1" /> Equipped</>
                            ) : (
                              <><Star className="w-4 h-4 inline mr-1" /> Equip</>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePurchase(frame)}
                            disabled={purchasing === frame.id || !canAfford}
                            className={`w-full py-2 rounded-xl text-sm font-bold transition-all ${
                              canAfford
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20'
                                : 'bg-white/5 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {purchasing === frame.id ? (
                              <Zap className="w-4 h-4 inline animate-spin" />
                            ) : !canAfford ? (
                              <><Lock className="w-4 h-4 inline mr-1" /> Not enough coins</>
                            ) : (
                              <><ShoppingCart className="w-4 h-4 inline mr-1" /> Purchase</>
                            )}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {filteredFrames.length === 0 && (
                <div className="text-center py-20">
                  <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No frames found for this rarity</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {ownedFrameList.length === 0 ? (
                <div className="text-center py-20">
                  <Crown className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                   <p className="text-slate-400 mb-2">You don&apos;t own any frames yet</p>
                  <button
                    onClick={() => setActiveTab('store')}
                    className="px-4 py-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 text-sm font-semibold hover:bg-purple-500/30 transition-all"
                  >
                    Browse Store
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ownedFrameList.map(frame => {
                    const isEquipped = equippedFrame?.id === frame.id;
                    const rarity = RARITY_COLORS[frame.rarity];

                    return (
                      <motion.div
                        key={frame.id}
                        layout
                        className={`relative rounded-2xl border p-5 transition-all ${
                          isEquipped
                            ? 'border-purple-400/50 bg-purple-500/10 shadow-[0_0_30px_rgba(168,85,247,0.15)]'
                            : 'border-white/10 bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex justify-center mb-4">
                          <ProfileFrame
                            frame={frame}
                            avatarUrl={avatarUrl}
                            size="lg"
                            username={profile?.username || ''}
                            showBadge
                          />
                        </div>

                        <div className="text-center mb-3">
                          <h3 className="font-bold text-white text-sm">{frame.name}</h3>
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: rarity.text }}
                          >
                            {RARITY_LABELS[frame.rarity]}
                          </span>
                        </div>

                        <button
                          onClick={() => handleEquip(isEquipped ? null : frame.id)}
                          disabled={equipping}
                          className={`w-full py-2 rounded-xl text-sm font-bold transition-all ${
                            isEquipped
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30'
                          }`}
                        >
                          {isEquipped ? '✓ Equipped' : 'Equip'}
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewFrame && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setPreviewFrame(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 rounded-3xl border border-white/10 p-8 max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center mb-6">
                <ProfileFrame
                  frame={previewFrame}
                  avatarUrl={avatarUrl}
                  size="xl"
                  username={profile?.username || 'Preview'}
                  showBadge
                />
              </div>

              <h2 className="text-xl font-black text-center mb-1">{previewFrame.name}</h2>
              <p className="text-sm text-slate-400 text-center mb-4">{previewFrame.description}</p>

              <div className="flex items-center justify-center gap-3 mb-6">
                <span
                  className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full"
                  style={{
                    color: RARITY_COLORS[previewFrame.rarity].text,
                    backgroundColor: RARITY_COLORS[previewFrame.rarity].bg,
                    border: `1px solid ${RARITY_COLORS[previewFrame.rarity].border}`,
                  }}
                >
                  {RARITY_LABELS[previewFrame.rarity]}
                </span>
                <span className="text-sm font-bold text-yellow-400">
                  🪙 {previewFrame.coinCost.toLocaleString()}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewFrame(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-slate-300 border border-white/10 text-sm font-semibold hover:bg-white/10 transition-all"
                >
                  Close
                </button>
                {!isFrameOwned(previewFrame.id) && (
                  <button
                    onClick={() => {
                      handlePurchase(previewFrame);
                      setPreviewFrame(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold hover:from-purple-500 hover:to-pink-500 transition-all"
                  >
                    Purchase
                  </button>
                )}
                {isFrameOwned(previewFrame.id) && equippedFrame?.id !== previewFrame.id && (
                  <button
                    onClick={() => {
                      handleEquip(previewFrame.id);
                      setPreviewFrame(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 text-sm font-bold hover:bg-purple-500/30 transition-all"
                  >
                    Equip
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
