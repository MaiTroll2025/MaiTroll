import React, { useEffect, useState } from 'react';
import { Key, Lock, Unlock, Trophy, Coins, Shield, RefreshCw, ShoppingBag, History, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '../lib/supabase';
import {
  getUserKeysPrivate,
  getUserKeysPublic,
  calculateUserKeysSummary,
  formatCashoutDate,
  getDaysUntilCashout,
  isCashoutAvailable,
  getMarketplaceListings,
  getUserListings,
  getTradeRequests,
  getUserKeyTransactions,
  purchaseKey,
  cancelKeyListing,
  acceptTradeRequest,
  declineTradeRequest,
  cashoutKey,
  cashoutMaiTrollSet,
} from '../services/keyService';
import type { KeyInstance, KeyMarketplaceListing, KeyTradeRequest, KeyTradeItem, KeyTransaction, KeyRarity } from '../types/keys';
import { KEY_RARITY_COLORS, KEY_RARITY_ICONS } from '../types/keys';

interface KeysPageProps {
  profileId: string;
  isOwnProfile: boolean;
}

export default function KeysPage({ profileId, isOwnProfile }: KeysPageProps) {
  const [keys, setKeys] = useState<KeyInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetCashoutModal, setShowSetCashoutModal] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);
  const [activeView, setActiveView] = useState<'collection' | 'marketplace' | 'trades' | 'history'>('collection');

  const summary = calculateUserKeysSummary(keys);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
    supabase.auth.getUser().then(r => setCurrentUserId(r.data.user?.id || null));
  }, [profileId, isOwnProfile]);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const data = isOwnProfile
        ? await getUserKeysPrivate(profileId)
        : await getUserKeysPublic(profileId);
      setKeys(data);
    } catch (e) {
      console.warn('Failed to load keys:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCashoutKey = async (keyId: string) => {
    if (!currentUserId) return;
    setCashingOut(true);
    try {
      const result = await cashoutKey(keyId, currentUserId);
      if (result.success) {
        toast.success(`Cashed out ${result.value} Troll Coins!`);
        loadKeys();
      } else if (result.error === 'CASHOUT_LOCKED') {
        toast.error(`Cashout locked until ${formatCashoutDate(result.available_at || '')}`);
      } else {
        toast.error(result.error || 'Cashout failed');
      }
    } finally {
      setCashingOut(false);
    }
  };

  const handleSetCashout = async () => {
    if (!currentUserId) return;
    setCashingOut(true);
    try {
      const result = await cashoutMaiTrollSet(currentUserId);
      if (result.success) {
        toast.success(`Set cashed out! ${result.final_amount} Troll Coins (including ${result.bonus_amount} bonus)`);
        loadKeys();
        setShowSetCashoutModal(false);
      } else if (result.error === 'INCOMPLETE_SET') {
        toast.error('You need all five keys (M, A, I, T, R) to complete the set.');
      } else if (result.error === 'CASHOUT_LOCKED') {
        toast.error('Some keys are still locked for cashout.');
      } else {
        toast.error(result.error || 'Set cashout failed');
      }
    } finally {
      setCashingOut(false);
    }
  };

  const getRarityBadge = (rarity: KeyRarity) => {
    const colors = KEY_RARITY_COLORS[rarity];
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
        {rarity.replace('_', ' ')}
      </span>
    );
  };

  const renderKeyCard = (key: KeyInstance, showValue: boolean = false) => {
    const colors = KEY_RARITY_COLORS[key.rarity];
    const available = isCashoutAvailable(key.cashout_available_at);
    const daysLeft = getDaysUntilCashout(key.cashout_available_at);

    return (
      <div
        key={key.id}
        className={`relative rounded-2xl border ${colors.border} ${colors.bg} p-4 transition-all hover:scale-[1.02] ${
          key.is_key_to_city ? 'ring-2 ring-yellow-400/50 shadow-lg shadow-yellow-500/20' : ''
        }`}
      >
        {key.is_key_to_city && (
          <div className="absolute -top-2 -right-2 rounded-full bg-yellow-500 px-2 py-0.5 text-[10px] font-black text-black">
            KEY TO THE CITY
          </div>
        )}

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors.bg} border ${colors.border} text-2xl font-black ${colors.text}`}>
              {key.key_letter}
            </div>
            <div>
              <p className="font-black text-white text-lg">{KEY_RARITY_ICONS[key.rarity]} {key.key_letter}</p>
              {getRarityBadge(key.rarity)}
            </div>
          </div>

          {showValue && (
            <div className="text-right">
              <p className="text-xs text-white/50">Value</p>
              <p className="font-bold text-yellow-300">{key.value.toLocaleString()} TC</p>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-white/60">
            {available ? (
              <><Unlock size={12} className="text-green-400" /> Available</>
            ) : (
              <><Lock size={12} className="text-yellow-400" /> {daysLeft}d left</>
            )}
          </div>
          <span className="text-white/40">
            {formatCashoutDate(key.cashout_available_at)}
          </span>
        </div>

        {isOwnProfile && available && key.status === 'active' && (
          <button
            onClick={() => handleCashoutKey(key.id)}
            disabled={cashingOut}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2 text-sm font-bold text-white hover:from-green-500 hover:to-emerald-500 disabled:opacity-50"
          >
            {cashingOut ? 'Processing...' : 'Cashout Key'}
          </button>
        )}

        {isOwnProfile && !available && key.status === 'active' && (
          <div className="mt-3 flex items-center justify-center gap-1 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs font-bold text-yellow-300">
            <Lock size={12} />
            Cashout Locked
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center">
          <Key className="mx-auto h-6 w-6 text-purple-400" />
          <p className="mt-1 text-2xl font-black text-white">{summary.total_keys}</p>
          <p className="text-xs text-white/50">Total Keys</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center">
          <Coins className="mx-auto h-6 w-6 text-yellow-400" />
          <p className="mt-1 text-2xl font-black text-white">{summary.total_value.toLocaleString()}</p>
          <p className="text-xs text-white/50">Total Value (TC)</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center">
          <Trophy className="mx-auto h-6 w-6 text-orange-400" />
          <p className="mt-1 text-2xl font-black text-white">{summary.rare_keys}</p>
          <p className="text-xs text-white/50">Rare Keys</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center">
          <Shield className="mx-auto h-6 w-6 text-cyan-400" />
          <p className="mt-1 text-2xl font-black text-white">{summary.complete_sets}/1</p>
          <p className="text-xs text-white/50">Complete Sets</p>
        </div>
      </div>

      {/* Set Progress */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <h3 className="mb-3 text-sm font-bold text-white/80">MAITROLL Set Progress</h3>
        <div className="flex items-center gap-2">
          {(['M', 'A', 'I', 'T', 'R'] as const).map(letter => {
            const has = summary.letters_owned.includes(letter);
            return (
              <div
                key={letter}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 font-black text-lg transition-all ${
                  has
                    ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                    : 'border-white/10 bg-white/5 text-white/30'
                }`}
              >
                {has ? letter : '?'}
              </div>
            );
          })}
        </div>
        {isOwnProfile && summary.complete_sets === 1 && (
          <button
            onClick={() => setShowSetCashoutModal(true)}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-yellow-600 to-orange-600 px-4 py-3 text-sm font-black text-white hover:from-yellow-500 hover:to-orange-500"
          >
            🔑 CASHOUT MAITROLL SET (+5% BONUS)
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10">
        {[
          { key: 'collection', label: 'Collection', icon: Key },
          { key: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
          { key: 'trades', label: 'Trades', icon: RefreshCw },
          { key: 'history', label: 'History', icon: History },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold transition ${
              activeView === tab.key
                ? 'border-b-2 border-purple-500 text-purple-300'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Collection View */}
      {activeView === 'collection' && (
        <div>
          {keys.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
              <Key className="mx-auto h-12 w-12 text-white/20" />
              <p className="mt-3 text-white/50">No keys yet. Keep exploring MaiTroll to discover keys!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {keys.map(key => renderKeyCard(key, isOwnProfile))}
            </div>
          )}
        </div>
      )}

      {/* Marketplace View */}
      {activeView === 'marketplace' && (
        <MarketplaceView userId={profileId} isOwnProfile={isOwnProfile} onUpdate={loadKeys} />
      )}

      {/* Trades View */}
      {activeView === 'trades' && (
        <TradesView userId={profileId} isOwnProfile={isOwnProfile} onUpdate={loadKeys} />
      )}

      {/* History View */}
      {activeView === 'history' && <HistoryView userId={profileId} />}

      {/* Set Cashout Modal */}
      {showSetCashoutModal && (
        <SetCashoutModal
          summary={summary}
          keys={keys.filter(k => k.status === 'active')}
          onConfirm={handleSetCashout}
          onClose={() => setShowSetCashoutModal(false)}
          cashingOut={cashingOut}
        />
      )}
    </div>
  );
}

// =========================================================================
// MARKETPLACE VIEW
// =========================================================================

function MarketplaceView({ userId, isOwnProfile, onUpdate }: { userId: string; isOwnProfile: boolean; onUpdate: () => void }) {
  const [listings, setListings] = useState<(KeyMarketplaceListing & { key_instance: KeyInstance })[]>([]);
  const [myListings, setMyListings] = useState<KeyMarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [marketListings, userListings] = await Promise.all([
        getMarketplaceListings(),
        isOwnProfile ? getUserListings(userId) : Promise.resolve([]),
      ]);
      setListings(marketListings);
      setMyListings(userListings);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (listingId: string) => {
    const result = await purchaseKey(listingId, userId);
    if (result.success) {
      toast.success('Key purchased!');
      loadData();
      onUpdate();
    } else {
      toast.error(result.error || 'Purchase failed');
    }
  };

  const handleCancelListing = async (listingId: string) => {
    const result = await cancelKeyListing(listingId, userId);
    if (result.success) {
      toast.success('Listing cancelled');
      loadData();
    } else {
      toast.error(result.error || 'Failed to cancel');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-white/50" /></div>;
  }

  return (
    <div className="space-y-6">
      {isOwnProfile && myListings.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-bold text-white/80">Your Listings</h3>
          <div className="space-y-2">
            {myListings.map(listing => (
              <div key={listing.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div>
                  <p className="font-bold text-white">{listing.key_instance_id.slice(0, 8)}...</p>
                  <p className="text-sm text-yellow-300">{listing.price.toLocaleString()} TC</p>
                </div>
                <button
                  onClick={() => handleCancelListing(listing.id)}
                  className="rounded-lg border border-red-500/30 px-3 py-1 text-xs font-bold text-red-300 hover:bg-red-500/10"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-sm font-bold text-white/80">Available Listings</h3>
        {listings.length === 0 ? (
          <p className="text-white/50 text-center py-6">No keys listed for sale right now.</p>
        ) : (
          <div className="space-y-2">
            {listings.map(listing => (
              <div key={listing.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20 text-lg font-black text-purple-300">
                    {(listing as any).key_instance?.key_letter || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-white">{(listing as any).key_instance?.rarity || 'Unknown'}</p>
                    <p className="text-xs text-white/50">Key Value: {(listing as any).key_instance?.value?.toLocaleString() || '?'} TC</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-yellow-300">{listing.price.toLocaleString()} TC</p>
                  {isOwnProfile ? (
                    <span className="text-xs text-white/40">Your listing</span>
                  ) : (
                    <button
                      onClick={() => handlePurchase(listing.id)}
                      className="rounded-lg bg-green-600 px-3 py-1 text-xs font-bold text-white hover:bg-green-500"
                    >
                      Buy
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// TRADES VIEW
// =========================================================================

function TradesView({ userId, isOwnProfile, onUpdate }: { userId: string; isOwnProfile: boolean; onUpdate: () => void }) {
  const [trades, setTrades] = useState<(KeyTradeRequest & { trade_items: KeyTradeItem[] })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrades();
  }, [userId]);

  const loadTrades = async () => {
    setLoading(true);
    try {
      const result = await getTradeRequests(userId);
      setTrades(result);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (tradeId: string) => {
    const result = await acceptTradeRequest(tradeId, userId);
    if (result.success) {
      toast.success('Trade accepted!');
      loadTrades();
      onUpdate();
    } else {
      toast.error(result.error || 'Failed to accept trade');
    }
  };

  const handleDecline = async (tradeId: string) => {
    const result = await declineTradeRequest(tradeId, userId);
    if (result.success) {
      toast.success('Trade declined');
      loadTrades();
    } else {
      toast.error(result.error || 'Failed to decline trade');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-white/50" /></div>;
  }

  return (
    <div className="space-y-4">
      {trades.length === 0 ? (
        <p className="text-white/50 text-center py-6">No trade requests yet.</p>
      ) : (
        trades.map(trade => (
          <div key={trade.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-white/50">
                  {trade.from_user_id === userId ? 'Sent to' : 'From'}
                </p>
                <p className="font-bold text-white">
                  {trade.from_user_id === userId ? trade.to_user_id : trade.from_user_id}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                trade.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                trade.status === 'accepted' ? 'bg-green-500/20 text-green-300' :
                'bg-red-500/20 text-red-300'
              }`}>
                {trade.status.toUpperCase()}
              </span>
            </div>
            {trade.trade_items?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-white/50 mb-1">Items</p>
                <div className="flex flex-wrap gap-2">
                  {trade.trade_items.map(item => (
                    <span key={item.id} className="rounded-lg bg-white/5 px-2 py-1 text-xs font-bold text-white/70">
                      {item.key_instance_id.slice(0, 8)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {trade.status === 'pending' && trade.to_user_id === userId && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleAccept(trade.id)}
                  className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-500"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleDecline(trade.id)}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-500"
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// =========================================================================
// HISTORY VIEW
// =========================================================================

function HistoryView({ userId }: { userId: string }) {
  const [transactions, setTransactions] = useState<KeyTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [userId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const result = await getUserKeyTransactions(userId);
      setTransactions(result);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-white/50" /></div>;
  }

  return (
    <div className="space-y-2">
      {transactions.length === 0 ? (
        <p className="text-white/50 text-center py-6">No transaction history yet.</p>
      ) : (
        transactions.map(tx => (
          <div key={tx.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div>
              <p className="font-bold text-white text-sm">{tx.action.replace('_', ' ').toUpperCase()}</p>
              <p className="text-xs text-white/50">
                {new Date(tx.created_at).toLocaleString()}
              </p>
            </div>
            <p className="font-bold text-yellow-300">{tx.value.toLocaleString()} TC</p>
          </div>
        ))
      )}
    </div>
  );
}

// =========================================================================
// SET CASHOUT MODAL
// =========================================================================

function SetCashoutModal({
  summary,
  keys,
  onConfirm,
  onClose,
  cashingOut,
}: {
  summary: ReturnType<typeof calculateUserKeysSummary>;
  keys: KeyInstance[];
  onConfirm: () => void;
  onClose: () => void;
  cashingOut: boolean;
}) {
  const totalValue = keys.reduce((sum, k) => sum + k.value, 0);
  const bonus = totalValue * 0.05;
  const finalAmount = totalValue + bonus;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6">
        <h2 className="text-xl font-black text-white mb-2">🔑 Cashout MAITROLL Set</h2>
        <p className="text-sm text-white/60 mb-4">
          Complete the MAITROLL set and receive a 5% completion bonus!
        </p>

        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-white/70">Total Key Value</span>
            <span className="font-bold text-white">{totalValue.toLocaleString()} TC</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-yellow-300">5% Completion Bonus</span>
            <span className="font-bold text-yellow-300">+{bonus.toLocaleString()} TC</span>
          </div>
          <div className="border-t border-yellow-500/30 pt-2 flex justify-between">
            <span className="font-bold text-white">Final Amount</span>
            <span className="font-black text-yellow-300 text-lg">{finalAmount.toLocaleString()} TC</span>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs text-white/50 mb-2">Keys in this set:</p>
          <div className="flex gap-2">
            {keys.map(key => (
              <div key={key.id} className={`flex h-8 w-8 items-center justify-center rounded-lg ${KEY_RARITY_COLORS[key.rarity].bg} border ${KEY_RARITY_COLORS[key.rarity].border} text-sm font-black ${KEY_RARITY_COLORS[key.rarity].text}`}>
                {key.key_letter}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
            <p className="text-xs text-orange-200">
              Once cashed out, these keys will be permanently removed from your collection. This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={cashingOut}
            className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={cashingOut}
            className="flex-1 rounded-xl bg-gradient-to-r from-yellow-600 to-orange-600 px-4 py-3 text-sm font-black text-white hover:from-yellow-500 hover:to-orange-500 disabled:opacity-50"
          >
            {cashingOut ? 'Processing...' : 'Confirm Cashout'}
          </button>
        </div>
      </div>
    </div>
  );
}
